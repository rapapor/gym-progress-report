import type { APIRoute } from "astro";
import {
  createApiRoute,
  requireAuth,
  UuidParamSchema,
  EditReportSchema,
  createSuccessResponse,
  canEditReport,
  ApiException,
} from "../../../lib/api-helpers";
import type { ReportDTO } from "../../../types";

/**
 * Helper function to check if user can access report
 */
async function checkReportAccess(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  userId: string,
  userRole: string,
  reportId: string
): Promise<{ hasAccess: boolean; clientId?: string }> {
  // Get report with client info
  const { data: report, error } = await supabase
    .from("reports")
    .select("client_id")
    .eq("id", reportId)
    .is("deleted_at", null)
    .single();

  if (error || !report) {
    return { hasAccess: false };
  }

  const clientId = report.client_id;

  // Super admin can access any reports
  if (userRole === "super_admin") {
    return { hasAccess: true, clientId };
  }

  // Client can access their own reports
  if (userRole === "client" && userId === clientId) {
    return { hasAccess: true, clientId };
  }

  // Trainer can access their assigned clients' reports
  if (userRole === "trainer") {
    const { data: assignment, error: assignmentError } = await supabase
      .from("trainer_client")
      .select("client_id")
      .eq("trainer_id", userId)
      .eq("client_id", clientId)
      .eq("is_active", true)
      .single();

    if (assignmentError && assignmentError.code !== "PGRST116") {
      // eslint-disable-next-line no-console
      console.error("Error checking trainer-client relationship:", assignmentError);
      return { hasAccess: false };
    }

    return { hasAccess: !!assignment, clientId };
  }

  return { hasAccess: false };
}

/**
 * GET /api/reports/{reportId}
 *
 * Get full report detail with images.
 * Accessible by the client themselves, their trainer, or super_admin.
 *
 * Path Parameters:
 * - reportId: string (UUID, required)
 *
 * Response: 200 OK ReportDTO
 * {
 *   id: string,
 *   client_id: string,
 *   year: number,
 *   week_number: number,
 *   sequence: number,
 *   weight: number | null,
 *   waist: number | null,
 *   chest: number | null,
 *   biceps_left: number | null,
 *   biceps_right: number | null,
 *   thigh_left: number | null,
 *   thigh_right: number | null,
 *   cardio_days: number | null,
 *   note: string | null,
 *   created_at: string,
 *   deleted_at: string | null,
 *   images: ReportImageDTO[]
 * }
 *
 * Errors:
 * - 400: Invalid UUID format
 * - 401: Unauthenticated
 * - 403: Forbidden (not client, trainer, or super_admin)
 * - 404: Report not found
 * - 500: Server error
 */
export const GET: APIRoute = createApiRoute(async ({ params, supabase, user }) => {
  // Authentication & Authorization
  const authenticatedUser = requireAuth(user);

  // Validate path parameters
  const { id: reportId } = UuidParamSchema.parse({ id: params.reportId });

  // Check authorization
  const { hasAccess, clientId } = await checkReportAccess(
    supabase,
    authenticatedUser.id,
    authenticatedUser.role,
    reportId
  );

  if (!hasAccess) {
    throw new ApiException(403, {
      error: "Access denied. You can only view your own reports, your assigned clients' reports, or be a super admin.",
    });
  }

  // Fetch report with images
  const { data: report, error: reportError } = await supabase
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
      note,
      created_at,
      deleted_at
    `
    )
    .eq("id", reportId)
    .is("deleted_at", null)
    .single();

  if (reportError || !report) {
    throw new ApiException(404, { error: "Report not found" });
  }

  // Fetch associated images
  const { data: images, error: imagesError } = await supabase
    .from("report_images")
    .select(
      `
      id,
      report_id,
      storage_path,
      size_bytes,
      width,
      height,
      created_at,
      deleted_at,
      is_deleted
    `
    )
    .eq("report_id", reportId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });

  if (imagesError) {
    // eslint-disable-next-line no-console
    console.error("Error fetching report images:", imagesError);
    throw new ApiException(500, { error: "Failed to fetch report images" });
  }

  // Transform to DTO
  const reportDto: ReportDTO = {
    ...report,
    images: images || [],
  };

  return createSuccessResponse(reportDto);
});

/**
 * PATCH /api/reports/{reportId}
 *
 * Edit report within 1 hour if sequence=0.
 * Only the client who created the report can edit it (or super_admin).
 *
 * Path Parameters:
 * - reportId: string (UUID, required)
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
 * Response: 200 OK ReportDTO
 *
 * Errors:
 * - 400: Validation error or invalid UUID
 * - 401: Unauthenticated
 * - 403: Forbidden (edit window passed, not sequence 0, or not owner/super_admin)
 * - 404: Report not found
 * - 500: Server error
 */
export const PATCH: APIRoute = createApiRoute(async ({ request, params, supabase, user }) => {
  // Authentication & Authorization
  const authenticatedUser = requireAuth(user);

  // Validate path parameters
  const { id: reportId } = UuidParamSchema.parse({ id: params.reportId });

  // Check authorization and get report details
  const { hasAccess, clientId } = await checkReportAccess(
    supabase,
    authenticatedUser.id,
    authenticatedUser.role,
    reportId
  );

  if (!hasAccess) {
    throw new ApiException(403, {
      error: "Access denied. You can only edit your own reports, your assigned clients' reports, or be a super admin.",
    });
  }

  // Get full report details to check edit permissions
  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select("id, client_id, sequence, created_at")
    .eq("id", reportId)
    .is("deleted_at", null)
    .single();

  if (reportError || !report) {
    throw new ApiException(404, { error: "Report not found" });
  }

  // Only the client owner can edit (unless super_admin)
  if (authenticatedUser.role !== "super_admin" && authenticatedUser.id !== report.client_id) {
    throw new ApiException(403, {
      error: "Only the client who created the report can edit it (or super_admin).",
    });
  }

  // Check if report can be edited (within 1 hour and sequence 0)
  if (authenticatedUser.role !== "super_admin" && !canEditReport(report.created_at, report.sequence)) {
    throw new ApiException(403, {
      error: "Report can only be edited within 1 hour of creation and must be the first report of the week (sequence 0).",
      details: {
        sequence: report.sequence,
        createdAt: report.created_at,
        canEdit: false,
      },
    });
  }

  // Parse and validate request body
  const body = await request.json();
  const updateData = EditReportSchema.parse(body);

  // Check if there's anything to update
  const updateFields = Object.keys(updateData).filter((key) => updateData[key as keyof typeof updateData] !== undefined);
  if (updateFields.length === 0) {
    throw new ApiException(400, { error: "No valid fields provided for update" });
  }

  // Update the report
  const { data: updatedReport, error: updateError } = await supabase
    .from("reports")
    .update({
      weight: updateData.weight !== undefined ? updateData.weight : undefined,
      waist: updateData.waist !== undefined ? updateData.waist : undefined,
      chest: updateData.chest !== undefined ? updateData.chest : undefined,
      biceps_left: updateData.biceps_left !== undefined ? updateData.biceps_left : undefined,
      biceps_right: updateData.biceps_right !== undefined ? updateData.biceps_right : undefined,
      thigh_left: updateData.thigh_left !== undefined ? updateData.thigh_left : undefined,
      thigh_right: updateData.thigh_right !== undefined ? updateData.thigh_right : undefined,
      cardio_days: updateData.cardio_days !== undefined ? updateData.cardio_days : undefined,
      note: updateData.note !== undefined ? updateData.note : undefined,
    })
    .eq("id", reportId)
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

  if (updateError || !updatedReport) {
    // eslint-disable-next-line no-console
    console.error("Error updating report:", updateError);
    throw new ApiException(500, { error: "Failed to update report" });
  }

  // Fetch associated images
  const { data: images, error: imagesError } = await supabase
    .from("report_images")
    .select(
      `
      id,
      report_id,
      storage_path,
      size_bytes,
      width,
      height,
      created_at,
      deleted_at,
      is_deleted
    `
    )
    .eq("report_id", reportId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });

  if (imagesError) {
    // eslint-disable-next-line no-console
    console.error("Error fetching report images:", imagesError);
    // Don't fail the update, just return empty images array
  }

  // Transform to DTO
  const reportDto: ReportDTO = {
    ...updatedReport,
    images: images || [],
  };

  return createSuccessResponse(reportDto);
});

/**
 * DELETE /api/reports/{reportId}
 *
 * Soft-delete report by setting deleted_at timestamp.
 * Only the client owner or super_admin can delete reports.
 *
 * Path Parameters:
 * - reportId: string (UUID, required)
 *
 * Response: 204 No Content
 *
 * Errors:
 * - 400: Invalid UUID format
 * - 401: Unauthenticated
 * - 403: Forbidden (not owner or super_admin)
 * - 404: Report not found
 * - 500: Server error
 */
export const DELETE: APIRoute = createApiRoute(async ({ params, supabase, user }) => {
  // Authentication & Authorization
  const authenticatedUser = requireAuth(user);

  // Validate path parameters
  const { id: reportId } = UuidParamSchema.parse({ id: params.reportId });

  // Check authorization and get report details
  const { hasAccess, clientId } = await checkReportAccess(
    supabase,
    authenticatedUser.id,
    authenticatedUser.role,
    reportId
  );

  if (!hasAccess) {
    throw new ApiException(403, {
      error: "Access denied. You can only delete your own reports or be a super admin.",
    });
  }

  // Get report details to check ownership
  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select("id, client_id")
    .eq("id", reportId)
    .is("deleted_at", null)
    .single();

  if (reportError || !report) {
    throw new ApiException(404, { error: "Report not found" });
  }

  // Only the client owner or super_admin can delete
  if (authenticatedUser.role !== "super_admin" && authenticatedUser.id !== report.client_id) {
    throw new ApiException(403, {
      error: "Only the client who created the report can delete it (or super_admin).",
    });
  }

  // Soft delete the report
  const { error: deleteError } = await supabase
    .from("reports")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", reportId);

  if (deleteError) {
    // eslint-disable-next-line no-console
    console.error("Error deleting report:", deleteError);
    throw new ApiException(500, { error: "Failed to delete report" });
  }

  return new Response(null, { status: 204 });
});
