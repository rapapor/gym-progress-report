import type { APIRoute } from "astro";
import {
  createApiRoute,
  requireAuth,
  UuidParamSchema,
  SubmitReportSchema,
  ReportsQuerySchema,
  getPaginationRange,
  calculatePagination,
  createPaginatedResponse,
  createSuccessResponse,
  getCurrentWeekInfo,
  ApiException,
} from "../../../../../lib/api-helpers";
import type { ReportDTO, ReportListItemDTO } from "../../../../../types";

/**
 * Helper function to check if user can access client's reports
 */
async function checkReportAccess(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  userId: string,
  userRole: string,
  clientId: string
): Promise<boolean> {
  // Super admin can access any reports
  if (userRole === "super_admin") {
    return true;
  }

  // Client can access their own reports
  if (userRole === "client" && userId === clientId) {
    return true;
  }

  // Trainer can access their assigned clients' reports
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
 * POST /api/clients/{clientId}/reports
 *
 * Submit weekly report for a client. Maximum 2 reports per calendar week.
 * Requires client role (must be the client themselves).
 *
 * Path Parameters:
 * - clientId: string (UUID, required)
 *
 * Request Body:
 * {
 *   weight?: number,
 *   waist?: number,
 *   chest?: number,
 *   biceps_left?: number,
 *   biceps_right?: number,
 *   thigh_left?: number,
 *   thigh_right?: number,
 *   cardio_days?: number (0-7),
 *   note?: string
 * }
 *
 * Response: 201 Created ReportDTO
 *
 * Errors:
 * - 400: Validation error or invalid UUID
 * - 401: Unauthenticated
 * - 403: Forbidden (not the client themselves)
 * - 404: Client not found
 * - 409: Maximum 2 reports per week exceeded
 * - 500: Server error
 */
export const POST: APIRoute = createApiRoute(async ({ request, params, supabase, user }) => {
  // Authentication & Authorization
  const authenticatedUser = requireAuth(user);

  // Validate path parameters
  const { id: clientId } = UuidParamSchema.parse({ id: params.clientId });

  // Only the client themselves can submit reports
  if (authenticatedUser.role !== "client" || authenticatedUser.id !== clientId) {
    throw new ApiException(403, {
      error: "Access denied. Only clients can submit their own reports.",
    });
  }

  // Verify client exists and is active
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

  // Parse and validate request body
  const body = await request.json();
  const reportData = SubmitReportSchema.parse(body);

  // Get current week info
  const { year, weekNumber } = getCurrentWeekInfo();

  // Check how many reports exist for this week
  const { data: existingReports, error: countError } = await supabase
    .from("reports")
    .select("id, sequence")
    .eq("client_id", clientId)
    .eq("year", year)
    .eq("week_number", weekNumber)
    .is("deleted_at", null)
    .order("sequence", { ascending: true });

  if (countError) {
    // eslint-disable-next-line no-console
    console.error("Error checking existing reports:", countError);
    throw new ApiException(500, { error: "Failed to check existing reports" });
  }

  // Maximum 2 reports per week
  if (existingReports && existingReports.length >= 2) {
    throw new ApiException(409, {
      error: "Maximum 2 reports per week exceeded",
      details: { year, weekNumber, existingCount: existingReports.length },
    });
  }

  // Determine sequence number (0 or 1)
  const sequence = existingReports ? existingReports.length : 0;

  // Create the report
  const reportId = crypto.randomUUID();

  const { data: newReport, error: insertError } = await supabase
    .from("reports")
    .insert({
      id: reportId,
      client_id: clientId,
      year: year,
      week_number: weekNumber,
      sequence: sequence,
      weight: reportData.weight || null,
      waist: reportData.waist || null,
      chest: reportData.chest || null,
      biceps_left: reportData.biceps_left || null,
      biceps_right: reportData.biceps_right || null,
      thigh_left: reportData.thigh_left || null,
      thigh_right: reportData.thigh_right || null,
      cardio_days: reportData.cardio_days || null,
      note: reportData.note || null,
    })
    .select(
      `
      id,
      client_id,
      year,
      week_number,
      sequence,
      weight,
      waist,
      chest,
      biceps_left,
      biceps_right,
      thigh_left,
      thigh_right,
      cardio_days,
      note,
      created_at,
      deleted_at
    `
    )
    .single();

  if (insertError || !newReport) {
    // eslint-disable-next-line no-console
    console.error("Error creating report:", insertError);
    throw new ApiException(500, { error: "Failed to create report" });
  }

  // Transform to DTO (with empty images array for new report)
  const reportDto: ReportDTO = {
    ...newReport,
    images: [], // New reports don't have images yet
  };

  return createSuccessResponse(reportDto, 201);
});

/**
 * GET /api/clients/{clientId}/reports
 *
 * List reports for a client in descending order by creation date.
 * Accessible by the client themselves, their trainer, or super_admin.
 *
 * Path Parameters:
 * - clientId: string (UUID, required)
 *
 * Query Parameters:
 * - page: number (default: 1)
 * - pageSize: number (default: 20, max: 100)
 *
 * Response: 200 OK
 * {
 *   data: ReportListItemDTO[],
 *   meta: PaginationMeta
 * }
 *
 * Errors:
 * - 400: Invalid UUID format or pagination params
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
  const hasAccess = await checkReportAccess(supabase, authenticatedUser.id, authenticatedUser.role, clientId);

  if (!hasAccess) {
    throw new ApiException(403, {
      error: "Access denied. You can only view your own reports, your assigned clients' reports, or be a super admin.",
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

  const { page, pageSize } = ReportsQuerySchema.parse(queryParams);

  // Build the query - exclude note field for list view
  let query = supabase
    .from("reports")
    .select(
      `
      id,
      client_id,
      year,
      week_number,
      sequence,
      weight,
      waist,
      chest,
      biceps_left,
      biceps_right,
      thigh_left,
      thigh_right,
      cardio_days,
      created_at,
      deleted_at
    `,
      { count: "exact" }
    )
    .eq("client_id", clientId)
    .is("deleted_at", null);

  // Apply ordering (most recent first)
  query = query.order("created_at", { ascending: false });

  // Apply pagination
  const { from, to } = getPaginationRange(page, pageSize);
  query = query.range(from, to);

  // Execute query
  const { data, error, count } = await query;

  if (error) {
    // eslint-disable-next-line no-console
    console.error("Error fetching reports:", error);
    throw new ApiException(500, { error: "Failed to fetch reports" });
  }

  if (!data) {
    throw new ApiException(500, { error: "No data returned from query" });
  }

  // Transform to DTOs (ReportListItemDTO excludes note field)
  const reports: ReportListItemDTO[] = data.map((report) => ({
    id: report.id,
    client_id: report.client_id,
    year: report.year,
    week_number: report.week_number,
    sequence: report.sequence,
    weight: report.weight,
    waist: report.waist,
    chest: report.chest,
    biceps_left: report.biceps_left,
    biceps_right: report.biceps_right,
    thigh_left: report.thigh_left,
    thigh_right: report.thigh_right,
    cardio_days: report.cardio_days,
    created_at: report.created_at,
    deleted_at: report.deleted_at,
  }));

  // Calculate pagination metadata
  const totalItems = count || 0;
  const meta = calculatePagination(page, pageSize, totalItems);

  return createPaginatedResponse(reports, meta);
});
