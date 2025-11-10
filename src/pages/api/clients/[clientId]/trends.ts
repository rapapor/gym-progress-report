import type { APIRoute } from "astro";
import {
  createApiRoute,
  requireAuth,
  UuidParamSchema,
  TrendsQuerySchema,
  createSuccessResponse,
  ApiException,
} from "../../../../lib/api-helpers";
import type { TrendsDTO } from "../../../../types";

/**
 * Helper function to check if user can access client's trends
 */
async function checkTrendsAccess(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  userId: string,
  userRole: string,
  clientId: string
): Promise<boolean> {
  // Super admin can access any trends
  if (userRole === "super_admin") {
    return true;
  }

  // Client can access their own trends
  if (userRole === "client" && userId === clientId) {
    return true;
  }

  // Trainer can access their assigned clients' trends
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
 * GET /api/clients/{clientId}/trends
 *
 * Returns aggregated measurement arrays over time for graphing.
 * Accessible by the client themselves, their trainer, or super_admin.
 *
 * Path Parameters:
 * - clientId: string (UUID, required)
 *
 * Query Parameters:
 * - metrics: string (optional, comma-separated list of metrics to include)
 *   Valid metrics: weight, waist, chest, biceps_left, biceps_right, thigh_left, thigh_right, cardio_days
 *   Example: ?metrics=weight,waist,chest
 *
 * Response: 200 OK TrendsDTO
 * {
 *   weight?: number[],
 *   waist?: number[],
 *   chest?: number[],
 *   biceps_left?: number[],
 *   biceps_right?: number[],
 *   thigh_left?: number[],
 *   thigh_right?: number[],
 *   cardio_days?: number[]
 * }
 *
 * Note: Arrays are ordered chronologically (oldest to newest).
 * Null values are excluded from arrays.
 *
 * Errors:
 * - 400: Invalid UUID format or invalid metrics
 * - 401: Unauthenticated
 * - 403: Forbidden (not client, trainer, or super_admin)
 * - 404: Client not found
 * - 500: Server error
 */
export const GET: APIRoute = createApiRoute(async ({ request, params, supabase, user }) => {
  // Authentication & Authorization
  const authenticatedUser = requireAuth(user);

  // Validate path parameters
  const { id: clientId } = UuidParamSchema.parse({ id: params.clientId });

  // Check authorization
  const hasAccess = await checkTrendsAccess(supabase, authenticatedUser.id, authenticatedUser.role, clientId);

  if (!hasAccess) {
    throw new ApiException(403, {
      error: "Access denied. You can only view your own trends, your assigned clients' trends, or be a super admin.",
    });
  }

  // Verify client exists
  const { data: client, error: clientError } = await supabase
    .from("users")
    .select("id")
    .eq("id", clientId)
    .eq("role", "client")
    .is("deleted_at", null)
    .single();

  if (clientError || !client) {
    throw new ApiException(404, { error: "Client not found" });
  }

  // Parse and validate query parameters
  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());

  const { metrics } = TrendsQuerySchema.parse(queryParams);

  // Define all possible metrics
  const allMetrics = [
    "weight",
    "waist",
    "chest",
    "biceps_left",
    "biceps_right",
    "thigh_left",
    "thigh_right",
    "cardio_days",
  ];
  const requestedMetrics = metrics || allMetrics;

  // Build select clause for requested metrics
  const selectFields = ["created_at", ...requestedMetrics].join(", ");

  // Fetch reports ordered chronologically
  const { data: reports, error: reportsError } = await supabase
    .from("reports")
    .select(selectFields)
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true }); // Oldest to newest for trends

  if (reportsError) {
    // eslint-disable-next-line no-console
    console.error("Error fetching reports for trends:", reportsError);
    throw new ApiException(500, { error: "Failed to fetch trend data" });
  }

  if (!reports) {
    throw new ApiException(500, { error: "No data returned from query" });
  }

  // Transform data into trends format
  const trends: TrendsDTO = {};

  // Initialize arrays for requested metrics
  requestedMetrics.forEach((metric) => {
    trends[metric as keyof TrendsDTO] = [];
  });

  // Populate arrays with non-null values
  reports.forEach((report) => {
    requestedMetrics.forEach((metric) => {
      const value = report[metric as keyof typeof report];
      if (value !== null && value !== undefined) {
        const trendsArray = trends[metric as keyof TrendsDTO] as number[];
        trendsArray.push(Number(value));
      }
    });
  });

  // Remove empty arrays (metrics with no data)
  Object.keys(trends).forEach((key) => {
    const trendsKey = key as keyof TrendsDTO;
    if (trends[trendsKey] && (trends[trendsKey] as number[]).length === 0) {
      trends[trendsKey] = undefined;
    }
  });

  // Filter out undefined values
  const filteredTrends = Object.fromEntries(
    Object.entries(trends).filter(([, value]) => value !== undefined)
  ) as TrendsDTO;

  return createSuccessResponse(filteredTrends);
});
