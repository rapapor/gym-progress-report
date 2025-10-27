import type { APIRoute } from "astro";
import {
  createApiRoute,
  requireAuth,
  requireRole,
  CreateClientSchema,
  ClientsQuerySchema,
  getPaginationRange,
  calculatePagination,
  createPaginatedResponse,
  createSuccessResponse,
  inviteUser,
  inviteUserByPhone,
  ApiException,
} from "../../../lib/api-helpers";
import type { ClientDTO } from "../../../types";

/**
 * POST /api/clients
 *
 * Create client and automatically assign to the current trainer.
 * Requires trainer role.
 *
 * Request Body:
 * {
 *   fullName: string,
 *   phone: string,
 *   email?: string,
 *   dateOfBirth?: string (YYYY-MM-DD),
 *   gender?: string
 * }
 *
 * Response: 201 Created ClientDTO
 *
 * Errors:
 * - 400: Validation error
 * - 401: Unauthenticated
 * - 403: Insufficient permissions (not trainer)
 * - 409: Phone or email already exists
 * - 500: Server error
 */
export const POST: APIRoute = createApiRoute(async ({ request, supabase, user }) => {
  // Authentication & Authorization
  const authenticatedUser = requireAuth(user);
  requireRole(authenticatedUser, ["trainer"]);

  // Parse and validate request body
  const body = await request.json();
  const { fullName, phone, email, dateOfBirth, gender } = CreateClientSchema.parse(body);

  // Check if user with this phone already exists
  const { data: existingUserByPhone, error: checkPhoneError } = await supabase
    .from("users")
    .select("id")
    .eq("phone", phone)
    .is("deleted_at", null)
    .single();

  if (checkPhoneError && checkPhoneError.code !== "PGRST116") {
    // eslint-disable-next-line no-console
    console.error("Error checking existing user by phone:", checkPhoneError);
    throw new ApiException(500, { error: "Failed to check existing user" });
  }

  if (existingUserByPhone) {
    throw new ApiException(409, {
      error: "User with this phone number already exists",
      details: { phone },
    });
  }

  // Check if user with this email already exists (if email provided)
  if (email) {
    const { data: existingUserByEmail, error: checkEmailError } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .is("deleted_at", null)
      .single();

    if (checkEmailError && checkEmailError.code !== "PGRST116") {
      // eslint-disable-next-line no-console
      console.error("Error checking existing user by email:", checkEmailError);
      throw new ApiException(500, { error: "Failed to check existing user" });
    }

    if (existingUserByEmail) {
      throw new ApiException(409, {
        error: "User with this email already exists",
        details: { email },
      });
    }
  }

  // Start transaction: create user, client, and trainer-client mapping
  const clientId = crypto.randomUUID();

  try {
    // Insert into users table
    const { error: userError } = await supabase.from("users").insert({
      id: clientId,
      full_name: fullName,
      email: email || null,
      phone: phone,
      role: "client",
    });

    if (userError) {
      // eslint-disable-next-line no-console
      console.error("Error creating user:", userError);
      throw new ApiException(500, { error: "Failed to create user" });
    }

    // Insert into clients table
    const { error: clientError } = await supabase.from("clients").insert({
      id: clientId,
      date_of_birth: dateOfBirth || null,
      gender: gender || null,
    });

    if (clientError) {
      // eslint-disable-next-line no-console
      console.error("Error creating client:", clientError);
      // Cleanup: delete the user record
      await supabase.from("users").delete().eq("id", clientId);
      throw new ApiException(500, { error: "Failed to create client profile" });
    }

    // Create trainer-client mapping (active by default)
    const { error: mappingError } = await supabase.from("trainer_client").insert({
      trainer_id: authenticatedUser.id,
      client_id: clientId,
      is_active: true,
      started_at: new Date().toISOString(),
    });

    if (mappingError) {
      // eslint-disable-next-line no-console
      console.error("Error creating trainer-client mapping:", mappingError);
      // Cleanup: delete the user and client records
      await supabase.from("clients").delete().eq("id", clientId);
      await supabase.from("users").delete().eq("id", clientId);
      throw new ApiException(500, { error: "Failed to assign client to trainer" });
    }

    // Send invitation via Supabase Auth
    try {
      if (email) {
        await inviteUser(supabase, email);
      } else {
        await inviteUserByPhone(supabase, phone);
      }
    } catch (inviteError) {
      // Log the error but don't fail the entire operation
      // eslint-disable-next-line no-console
      console.warn("Failed to send invitation, but client was created:", inviteError);
    }

    // Fetch the created client with user data
    const { data: clientData, error: fetchError } = await supabase
      .from("users")
      .select(
        `
        id,
        full_name,
        email,
        phone,
        role,
        clients (
          date_of_birth,
          gender
        )
      `
      )
      .eq("id", clientId)
      .single();

    if (fetchError || !clientData) {
      // eslint-disable-next-line no-console
      console.error("Error fetching created client:", fetchError);
      throw new ApiException(500, { error: "Failed to fetch created client" });
    }

    // Transform to DTO
    const clientDto: ClientDTO = {
      id: clientData.id,
      full_name: clientData.full_name,
      email: clientData.email,
      phone: clientData.phone,
      role: clientData.role,
      date_of_birth: clientData.clients?.[0]?.date_of_birth || null,
      gender: clientData.clients?.[0]?.gender || null,
    };

    return createSuccessResponse(clientDto, 201);
  } catch (error) {
    // If it's already an ApiException, re-throw it
    if (error instanceof ApiException) {
      throw error;
    }

    // eslint-disable-next-line no-console
    console.error("Unexpected error creating client:", error);
    throw new ApiException(500, { error: "Failed to create client" });
  }
});

/**
 * GET /api/clients
 *
 * List clients for the current trainer with optional missing report filter.
 * Requires trainer role.
 *
 * Query Parameters:
 * - page: number (default: 1)
 * - pageSize: number (default: 20, max: 100)
 * - missingReportForWeek: boolean (optional, filters clients missing reports for current week)
 *
 * Response: 200 OK
 * {
 *   data: ClientDTO[],
 *   meta: PaginationMeta
 * }
 */
export const GET: APIRoute = createApiRoute(async ({ request, supabase, user }) => {
  // Authentication & Authorization
  const authenticatedUser = requireAuth(user);
  requireRole(authenticatedUser, ["trainer"]);

  // Parse and validate query parameters
  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());

  const { page, pageSize, missingReportForWeek } = ClientsQuerySchema.parse(queryParams);

  // Build the base query - get clients assigned to this trainer
  let query = supabase
    .from("trainer_client")
    .select(
      `
      client_id,
      is_active,
      started_at,
      clients!inner (
        id,
        date_of_birth,
        gender,
        users!inner (
          id,
          full_name,
          email,
          phone,
          role
        )
      )
    `,
      { count: "exact" }
    )
    .eq("trainer_id", authenticatedUser.id)
    .eq("is_active", true)
    .is("clients.deleted_at", null);

  // Apply missing report filter if requested
  if (missingReportForWeek) {
    // Get current week info
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentWeek = Math.ceil(((now.getTime() - new Date(currentYear, 0, 1).getTime()) / 86400000 + 1) / 7);

    // This is a complex query that would need to be handled with a custom RPC function
    // For now, we'll fetch all clients and filter in application logic
    // In production, this should be optimized with a database view or RPC
  }

  // Apply ordering
  query = query.order("started_at", { ascending: false });

  // Apply pagination
  const { from, to } = getPaginationRange(page, pageSize);
  query = query.range(from, to);

  // Execute query
  const { data, error, count } = await query;

  if (error) {
    // eslint-disable-next-line no-console
    console.error("Error fetching clients:", error);
    throw new ApiException(500, { error: "Failed to fetch clients" });
  }

  if (!data) {
    throw new ApiException(500, { error: "No data returned from query" });
  }

  // Transform to DTOs
  const clients: ClientDTO[] = data.map((mapping) => {
    const client = mapping.clients;
    const user = client.users;

    return {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      date_of_birth: client.date_of_birth,
      gender: client.gender,
    };
  });

  // If missing report filter is requested, we need to check for reports
  let filteredClients = clients;
  if (missingReportForWeek) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentWeek = Math.ceil(((now.getTime() - new Date(currentYear, 0, 1).getTime()) / 86400000 + 1) / 7);

    // Get clients who have reports for current week
    const clientIds = clients.map((c) => c.id);
    if (clientIds.length > 0) {
      const { data: reportsData } = await supabase
        .from("reports")
        .select("client_id")
        .in("client_id", clientIds)
        .eq("year", currentYear)
        .eq("week_number", currentWeek)
        .is("deleted_at", null);

      const clientsWithReports = new Set(reportsData?.map((r) => r.client_id) || []);
      filteredClients = clients.filter((client) => !clientsWithReports.has(client.id));
    }
  }

  // Calculate pagination metadata (note: this is approximate when filtering is applied)
  const totalItems = missingReportForWeek ? filteredClients.length : count || 0;
  const meta = calculatePagination(page, pageSize, totalItems);

  return createPaginatedResponse(filteredClients, meta);
});
