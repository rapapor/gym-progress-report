import type { APIRoute } from "astro";
import {
  createApiRoute,
  requireAuth,
  requireRole,
  UsersQuerySchema,
  getPaginationRange,
  calculatePagination,
  createPaginatedResponse,
  ApiException,
} from "../../../lib/api-helpers";
import type { UserDTO } from "../../../types";

/**
 * GET /api/users
 *
 * Paginated list of all users, filterable by role and deleted status.
 * Requires super_admin role.
 *
 * Query Parameters:
 * - page: number (default: 1)
 * - pageSize: number (default: 20, max: 100)
 * - role: 'super_admin' | 'trainer' | 'client' (optional)
 * - deleted: boolean (optional, filters by deleted_at IS NOT NULL)
 *
 * Response: 200 OK
 * {
 *   data: UserDTO[],
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

  const { page, pageSize, role, deleted } = UsersQuerySchema.parse(queryParams);

  // Build the query
  let query = supabase.from("users").select("id, full_name, email, phone, role", { count: "exact" });

  // Apply filters
  if (role) {
    query = query.eq("role", role);
  }

  if (deleted !== undefined) {
    if (deleted) {
      query = query.not("deleted_at", "is", null);
    } else {
      query = query.is("deleted_at", null);
    }
  } else {
    // By default, exclude deleted users
    query = query.is("deleted_at", null);
  }

  // Apply ordering
  query = query.order("created_at", { ascending: false });

  // Apply pagination
  const { from, to } = getPaginationRange(page, pageSize);
  query = query.range(from, to);

  // Execute query
  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching users:", error);
    throw new ApiException(500, { error: "Failed to fetch users" });
  }

  if (!data) {
    throw new ApiException(500, { error: "No data returned from query" });
  }

  // Transform to DTOs
  const users: UserDTO[] = data.map((user) => ({
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
  }));

  // Calculate pagination metadata
  const totalItems = count || 0;
  const meta = calculatePagination(page, pageSize, totalItems);

  return createPaginatedResponse(users, meta);
});
