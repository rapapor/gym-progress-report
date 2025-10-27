import type { APIRoute } from "astro";
import {
  createApiRoute,
  requireAuth,
  requireRole,
  CreateTrainerSchema,
  TrainersQuerySchema,
  getPaginationRange,
  calculatePagination,
  createPaginatedResponse,
  createSuccessResponse,
  inviteUser,
  ApiException,
} from "../../../lib/api-helpers";
import type { TrainerDTO } from "../../../types";

/**
 * POST /api/trainers
 *
 * Create trainer and send invitation via Supabase Auth.
 * Requires super_admin role.
 *
 * Request Body:
 * {
 *   fullName: string,
 *   email: string
 * }
 *
 * Response: 201 Created TrainerDTO
 *
 * Errors:
 * - 400: Validation error
 * - 401: Unauthenticated
 * - 403: Insufficient permissions (not super_admin)
 * - 409: Email already exists
 * - 500: Server error
 */
export const POST: APIRoute = createApiRoute(async ({ request, supabase, user }) => {
  // Authentication & Authorization
  const authenticatedUser = requireAuth(user);
  requireRole(authenticatedUser, ["super_admin"]);

  // Parse and validate request body
  const body = await request.json();
  const { fullName, email } = CreateTrainerSchema.parse(body);

  // Check if user with this email already exists
  const { data: existingUser, error: checkError } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .is("deleted_at", null)
    .single();

  if (checkError && checkError.code !== "PGRST116") {
    console.error("Error checking existing user:", checkError);
    throw new ApiException(500, { error: "Failed to check existing user" });
  }

  if (existingUser) {
    throw new ApiException(409, {
      error: "User with this email already exists",
      details: { email },
    });
  }

  // Start transaction: create user and trainer records
  const userId = crypto.randomUUID();

  try {
    // Insert into users table
    const { error: userError } = await supabase.from("users").insert({
      id: userId,
      full_name: fullName,
      email: email,
      role: "trainer",
    });

    if (userError) {
      console.error("Error creating user:", userError);
      throw new ApiException(500, { error: "Failed to create user" });
    }

    // Insert into trainers table
    const { error: trainerError } = await supabase.from("trainers").insert({
      id: userId,
      bio: null,
    });

    if (trainerError) {
      console.error("Error creating trainer:", trainerError);
      // Cleanup: delete the user record
      await supabase.from("users").delete().eq("id", userId);
      throw new ApiException(500, { error: "Failed to create trainer profile" });
    }

    // Send invitation via Supabase Auth
    await inviteUser(supabase, email);

    // Fetch the created trainer with user data
    const { data: trainerData, error: fetchError } = await supabase
      .from("users")
      .select(
        `
        id,
        full_name,
        email,
        phone,
        role,
        trainers (
          bio
        )
      `
      )
      .eq("id", userId)
      .single();

    if (fetchError || !trainerData) {
      console.error("Error fetching created trainer:", fetchError);
      throw new ApiException(500, { error: "Failed to fetch created trainer" });
    }

    // Transform to DTO
    const trainerDto: TrainerDTO = {
      id: trainerData.id,
      full_name: trainerData.full_name,
      email: trainerData.email,
      phone: trainerData.phone,
      role: trainerData.role,
      bio: trainerData.trainers?.[0]?.bio || null,
    };

    return createSuccessResponse(trainerDto, 201);
  } catch (error) {
    // If it's already an ApiException, re-throw it
    if (error instanceof ApiException) {
      throw error;
    }

    console.error("Unexpected error creating trainer:", error);
    throw new ApiException(500, { error: "Failed to create trainer" });
  }
});

/**
 * GET /api/trainers
 *
 * List trainers with optional search functionality.
 * Requires super_admin role.
 *
 * Query Parameters:
 * - page: number (default: 1)
 * - pageSize: number (default: 20, max: 100)
 * - search: string (optional, searches in full_name and email)
 *
 * Response: 200 OK
 * {
 *   data: TrainerDTO[],
 *   meta: PaginationMeta
 * }
 */
export const GET: APIRoute = createApiRoute(async ({ request, supabase, user }) => {
  // Authentication & Authorization
  const authenticatedUser = requireAuth(user);
  requireRole(authenticatedUser, ["super_admin"]);

  // Parse and validate query parameters
  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());

  const { page, pageSize, search } = TrainersQuerySchema.parse(queryParams);

  // Build the query
  let query = supabase
    .from("users")
    .select(
      `
      id,
      full_name,
      email,
      phone,
      role,
      trainers (
        bio
      )
    `,
      { count: "exact" }
    )
    .eq("role", "trainer")
    .is("deleted_at", null);

  // Apply search filter if provided
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
  }

  // Apply ordering
  query = query.order("created_at", { ascending: false });

  // Apply pagination
  const { from, to } = getPaginationRange(page, pageSize);
  query = query.range(from, to);

  // Execute query
  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching trainers:", error);
    throw new ApiException(500, { error: "Failed to fetch trainers" });
  }

  if (!data) {
    throw new ApiException(500, { error: "No data returned from query" });
  }

  // Transform to DTOs
  const trainers: TrainerDTO[] = data.map((trainer) => ({
    id: trainer.id,
    full_name: trainer.full_name,
    email: trainer.email,
    phone: trainer.phone,
    role: trainer.role,
    bio: trainer.trainers?.[0]?.bio || null,
  }));

  // Calculate pagination metadata
  const totalItems = count || 0;
  const meta = calculatePagination(page, pageSize, totalItems);

  return createPaginatedResponse(trainers, meta);
});
