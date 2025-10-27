import type { APIRoute } from "astro";
import {
  createApiRoute,
  requireAuth,
  requireRole,
  UuidParamSchema,
  UpdateClientSchema,
  createSuccessResponse,
  ApiException,
} from "../../../lib/api-helpers";
import type { ClientDTO } from "../../../types";

/**
 * Helper function to check if user can access client data
 */
async function checkClientAccess(supabase: any, userId: string, userRole: string, clientId: string): Promise<boolean> {
  // Super admin can access any client
  if (userRole === "super_admin") {
    return true;
  }

  // Client can access their own data
  if (userRole === "client" && userId === clientId) {
    return true;
  }

  // Trainer can access their assigned clients
  if (userRole === "trainer") {
    const { data, error } = await supabase
      .from("trainer_client")
      .select("client_id")
      .eq("trainer_id", userId)
      .eq("client_id", clientId)
      .eq("is_active", true)
      .single();

    if (error && error.code !== "PGRST116") {
      // eslint-disable-next-line no-console
      console.error("Error checking trainer-client relationship:", error);
      return false;
    }

    return !!data;
  }

  return false;
}

/**
 * GET /api/clients/{clientId}
 *
 * Get client profile. Accessible by the client themselves, their trainer, or super_admin.
 *
 * Path Parameters:
 * - clientId: string (UUID, required)
 *
 * Response: 200 OK ClientDTO
 * {
 *   id: string,
 *   full_name: string,
 *   email: string | null,
 *   phone: string | null,
 *   role: string,
 *   date_of_birth: string | null,
 *   gender: string | null
 * }
 *
 * Errors:
 * - 400: Invalid UUID format
 * - 401: Unauthenticated
 * - 403: Forbidden (not self, trainer, or super_admin)
 * - 404: Client not found
 */
export const GET: APIRoute = createApiRoute(async ({ params, supabase, user }) => {
  // Authentication & Authorization
  const authenticatedUser = requireAuth(user);

  // Validate path parameters
  const { id: clientId } = UuidParamSchema.parse({ id: params.clientId });

  // Check authorization
  const hasAccess = await checkClientAccess(supabase, authenticatedUser.id, authenticatedUser.role, clientId);

  if (!hasAccess) {
    throw new ApiException(403, {
      error: "Access denied. You can only view your own profile, your assigned clients, or be a super admin.",
    });
  }

  // Fetch client from database
  const { data, error } = await supabase
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
    .eq("role", "client")
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      throw new ApiException(404, { error: "Client not found" });
    }

    // eslint-disable-next-line no-console
    console.error("Error fetching client:", error);
    throw new ApiException(500, { error: "Failed to fetch client" });
  }

  if (!data) {
    throw new ApiException(404, { error: "Client not found" });
  }

  // Transform to DTO
  const clientDto: ClientDTO = {
    id: data.id,
    full_name: data.full_name,
    email: data.email,
    phone: data.phone,
    role: data.role,
    date_of_birth: data.clients?.[0]?.date_of_birth || null,
    gender: data.clients?.[0]?.gender || null,
  };

  return createSuccessResponse(clientDto);
});

/**
 * PATCH /api/clients/{clientId}
 *
 * Update client profile. Accessible by the client themselves, their trainer, or super_admin.
 *
 * Path Parameters:
 * - clientId: string (UUID, required)
 *
 * Request Body:
 * {
 *   fullName?: string,
 *   phone?: string,
 *   email?: string,
 *   dateOfBirth?: string (YYYY-MM-DD),
 *   gender?: string
 * }
 *
 * Response: 200 OK ClientDTO
 *
 * Errors:
 * - 400: Validation error or invalid UUID
 * - 401: Unauthenticated
 * - 403: Forbidden (not self, trainer, or super_admin)
 * - 404: Client not found
 * - 409: Phone or email already exists
 */
export const PATCH: APIRoute = createApiRoute(async ({ request, params, supabase, user }) => {
  // Authentication & Authorization
  const authenticatedUser = requireAuth(user);

  // Validate path parameters
  const { id: clientId } = UuidParamSchema.parse({ id: params.clientId });

  // Check authorization
  const hasAccess = await checkClientAccess(supabase, authenticatedUser.id, authenticatedUser.role, clientId);

  if (!hasAccess) {
    throw new ApiException(403, {
      error: "Access denied. You can only update your own profile, your assigned clients, or be a super admin.",
    });
  }

  // Parse and validate request body
  const body = await request.json();
  const { fullName, phone, email, dateOfBirth, gender } = UpdateClientSchema.parse(body);

  // Check if there's anything to update
  if (
    fullName === undefined &&
    phone === undefined &&
    email === undefined &&
    dateOfBirth === undefined &&
    gender === undefined
  ) {
    throw new ApiException(400, { error: "No valid fields provided for update" });
  }

  // First check if client exists
  const { data: existingClient, error: fetchError } = await supabase
    .from("users")
    .select("id, phone, email")
    .eq("id", clientId)
    .eq("role", "client")
    .is("deleted_at", null)
    .single();

  if (fetchError || !existingClient) {
    throw new ApiException(404, { error: "Client not found" });
  }

  // Check for conflicts with phone/email if they're being updated
  if (phone && phone !== existingClient.phone) {
    const { data: phoneConflict } = await supabase
      .from("users")
      .select("id")
      .eq("phone", phone)
      .neq("id", clientId)
      .is("deleted_at", null)
      .single();

    if (phoneConflict) {
      throw new ApiException(409, {
        error: "Phone number already exists",
        details: { phone },
      });
    }
  }

  if (email && email !== existingClient.email) {
    const { data: emailConflict } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .neq("id", clientId)
      .is("deleted_at", null)
      .single();

    if (emailConflict) {
      throw new ApiException(409, {
        error: "Email already exists",
        details: { email },
      });
    }
  }

  try {
    // Update users table if user fields are provided
    const userUpdates: any = {};
    if (fullName !== undefined) userUpdates.full_name = fullName;
    if (phone !== undefined) userUpdates.phone = phone;
    if (email !== undefined) userUpdates.email = email;

    if (Object.keys(userUpdates).length > 0) {
      const { error: userUpdateError } = await supabase.from("users").update(userUpdates).eq("id", clientId);

      if (userUpdateError) {
        // eslint-disable-next-line no-console
        console.error("Error updating user:", userUpdateError);
        throw new ApiException(500, { error: "Failed to update client user data" });
      }
    }

    // Update clients table if client-specific fields are provided
    const clientUpdates: any = {};
    if (dateOfBirth !== undefined) clientUpdates.date_of_birth = dateOfBirth;
    if (gender !== undefined) clientUpdates.gender = gender;

    if (Object.keys(clientUpdates).length > 0) {
      const { error: clientUpdateError } = await supabase.from("clients").update(clientUpdates).eq("id", clientId);

      if (clientUpdateError) {
        // eslint-disable-next-line no-console
        console.error("Error updating client:", clientUpdateError);
        throw new ApiException(500, { error: "Failed to update client profile data" });
      }
    }

    // Fetch updated client data
    const { data: updatedData, error: updatedFetchError } = await supabase
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

    if (updatedFetchError || !updatedData) {
      // eslint-disable-next-line no-console
      console.error("Error fetching updated client:", updatedFetchError);
      throw new ApiException(500, { error: "Failed to fetch updated client data" });
    }

    // Transform to DTO
    const clientDto: ClientDTO = {
      id: updatedData.id,
      full_name: updatedData.full_name,
      email: updatedData.email,
      phone: updatedData.phone,
      role: updatedData.role,
      date_of_birth: updatedData.clients?.[0]?.date_of_birth || null,
      gender: updatedData.clients?.[0]?.gender || null,
    };

    return createSuccessResponse(clientDto);
  } catch (error) {
    // If it's already an ApiException, re-throw it
    if (error instanceof ApiException) {
      throw error;
    }

    // eslint-disable-next-line no-console
    console.error("Unexpected error updating client:", error);
    throw new ApiException(500, { error: "Failed to update client" });
  }
});

/**
 * DELETE /api/clients/{clientId}
 *
 * Soft-delete client by setting deleted_at timestamp.
 * Requires trainer (for their clients) or super_admin role.
 *
 * Path Parameters:
 * - clientId: string (UUID, required)
 *
 * Response: 204 No Content
 *
 * Errors:
 * - 400: Invalid UUID format
 * - 401: Unauthenticated
 * - 403: Forbidden (not trainer of client or super_admin)
 * - 404: Client not found
 */
export const DELETE: APIRoute = createApiRoute(async ({ params, supabase, user }) => {
  // Authentication & Authorization
  const authenticatedUser = requireAuth(user);

  // Validate path parameters
  const { id: clientId } = UuidParamSchema.parse({ id: params.clientId });

  // Check authorization - only trainer or super_admin can delete clients
  // Clients cannot delete themselves
  let hasAccess = false;

  if (authenticatedUser.role === "super_admin") {
    hasAccess = true;
  } else if (authenticatedUser.role === "trainer") {
    const { data, error } = await supabase
      .from("trainer_client")
      .select("client_id")
      .eq("trainer_id", authenticatedUser.id)
      .eq("client_id", clientId)
      .eq("is_active", true)
      .single();

    if (error && error.code !== "PGRST116") {
      // eslint-disable-next-line no-console
      console.error("Error checking trainer-client relationship:", error);
      throw new ApiException(500, { error: "Failed to verify permissions" });
    }

    hasAccess = !!data;
  }

  if (!hasAccess) {
    throw new ApiException(403, {
      error: "Access denied. Only trainers can delete their assigned clients or super admins.",
    });
  }

  // First check if client exists and is not already deleted
  const { data: existingClient, error: fetchError } = await supabase
    .from("users")
    .select("id")
    .eq("id", clientId)
    .eq("role", "client")
    .is("deleted_at", null)
    .single();

  if (fetchError || !existingClient) {
    throw new ApiException(404, { error: "Client not found" });
  }

  // Soft delete the client
  const { error } = await supabase.from("users").update({ deleted_at: new Date().toISOString() }).eq("id", clientId);

  if (error) {
    // eslint-disable-next-line no-console
    console.error("Error deleting client:", error);
    throw new ApiException(500, { error: "Failed to delete client" });
  }

  return new Response(null, { status: 204 });
});
