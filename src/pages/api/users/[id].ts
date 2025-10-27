import type { APIRoute } from "astro";
import {
  createApiRoute,
  requireAuth,
  requireRole,
  UuidParamSchema,
  createSuccessResponse,
  ApiException,
} from "../../../lib/api-helpers";
import type { UserDTO } from "../../../types";

/**
 * GET /api/users/{id}
 *
 * Fetch single user by UUID.
 * Requires super_admin role.
 *
 * Path Parameters:
 * - id: string (UUID, required)
 *
 * Response: 200 OK UserDTO
 * {
 *   id: string,
 *   full_name: string,
 *   email: string | null,
 *   phone: string | null,
 *   role: string
 * }
 *
 * Errors:
 * - 400: Invalid UUID format
 * - 401: Unauthenticated
 * - 403: Insufficient permissions (not super_admin)
 * - 404: User not found
 */
export const GET: APIRoute = createApiRoute(async ({ params, supabase, user }) => {
  // Authentication & Authorization
  const authenticatedUser = requireAuth(user);
  requireRole(authenticatedUser, ["super_admin"]);

  // Validate path parameters
  const { id } = UuidParamSchema.parse(params);

  // Fetch user from database
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email, phone, role")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      throw new ApiException(404, { error: "User not found" });
    }

    console.error("Error fetching user:", error);
    throw new ApiException(500, { error: "Failed to fetch user" });
  }

  if (!data) {
    throw new ApiException(404, { error: "User not found" });
  }

  // Transform to DTO
  const userDto: UserDTO = {
    id: data.id,
    full_name: data.full_name,
    email: data.email,
    phone: data.phone,
    role: data.role,
  };

  return createSuccessResponse(userDto);
});

/**
 * PATCH /api/users/{id}
 *
 * Update user metadata (name, role).
 * Requires super_admin role.
 *
 * Path Parameters:
 * - id: string (UUID, required)
 *
 * Request Body:
 * {
 *   fullName?: string,
 *   role?: 'super_admin' | 'trainer' | 'client'
 * }
 *
 * Response: 200 OK UserDTO
 *
 * Errors:
 * - 400: Validation error or invalid UUID
 * - 401: Unauthenticated
 * - 403: Insufficient permissions
 * - 404: User not found
 */
export const PATCH: APIRoute = createApiRoute(async ({ request, params, supabase, user }) => {
  // Authentication & Authorization
  const authenticatedUser = requireAuth(user);
  requireRole(authenticatedUser, ["super_admin"]);

  // Validate path parameters
  const { id } = UuidParamSchema.parse(params);

  // Parse and validate request body
  const body = await request.json();

  // Simple validation for update fields
  const updateData: { full_name?: string; role?: string } = {};

  if (body.fullName !== undefined) {
    if (typeof body.fullName !== "string" || body.fullName.trim().length === 0) {
      throw new ApiException(400, { error: "fullName must be a non-empty string" });
    }
    updateData.full_name = body.fullName.trim();
  }

  if (body.role !== undefined) {
    if (!["super_admin", "trainer", "client"].includes(body.role)) {
      throw new ApiException(400, {
        error: "role must be one of: super_admin, trainer, client",
        details: { provided: body.role },
      });
    }
    updateData.role = body.role;
  }

  // Check if there's anything to update
  if (Object.keys(updateData).length === 0) {
    throw new ApiException(400, { error: "No valid fields provided for update" });
  }

  // First check if user exists
  const { data: existingUser, error: fetchError } = await supabase
    .from("users")
    .select("id")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (fetchError || !existingUser) {
    throw new ApiException(404, { error: "User not found" });
  }

  // Update the user
  const { data, error } = await supabase
    .from("users")
    .update(updateData)
    .eq("id", id)
    .select("id, full_name, email, phone, role")
    .single();

  if (error) {
    console.error("Error updating user:", error);
    throw new ApiException(500, { error: "Failed to update user" });
  }

  if (!data) {
    throw new ApiException(500, { error: "No data returned after update" });
  }

  // Transform to DTO
  const userDto: UserDTO = {
    id: data.id,
    full_name: data.full_name,
    email: data.email,
    phone: data.phone,
    role: data.role,
  };

  return createSuccessResponse(userDto);
});

/**
 * DELETE /api/users/{id}
 *
 * Soft-delete user by setting deleted_at timestamp.
 * Requires super_admin role.
 *
 * Path Parameters:
 * - id: string (UUID, required)
 *
 * Response: 204 No Content
 *
 * Errors:
 * - 400: Invalid UUID format
 * - 401: Unauthenticated
 * - 403: Insufficient permissions
 * - 404: User not found
 */
export const DELETE: APIRoute = createApiRoute(async ({ params, supabase, user }) => {
  // Authentication & Authorization
  const authenticatedUser = requireAuth(user);
  requireRole(authenticatedUser, ["super_admin"]);

  // Validate path parameters
  const { id } = UuidParamSchema.parse(params);

  // First check if user exists and is not already deleted
  const { data: existingUser, error: fetchError } = await supabase
    .from("users")
    .select("id")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (fetchError || !existingUser) {
    throw new ApiException(404, { error: "User not found" });
  }

  // Soft delete the user
  const { error } = await supabase.from("users").update({ deleted_at: new Date().toISOString() }).eq("id", id);

  if (error) {
    console.error("Error deleting user:", error);
    throw new ApiException(500, { error: "Failed to delete user" });
  }

  return new Response(null, { status: 204 });
});
