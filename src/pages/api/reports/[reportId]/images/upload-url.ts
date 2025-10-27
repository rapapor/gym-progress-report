import type { APIRoute } from "astro";
import {
  createApiRoute,
  requireAuth,
  UuidParamSchema,
  ImageUploadRequestSchema,
  createSuccessResponse,
  ApiException,
} from "../../../../../lib/api-helpers";

/**
 * Helper function to check if user can upload images to report
 */
async function checkImageUploadAccess(
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

  // Only the client owner can upload images (super_admin could also be allowed)
  if (userRole === "client" && userId === clientId) {
    return { hasAccess: true, clientId };
  }

  // Super admin can also upload images
  if (userRole === "super_admin") {
    return { hasAccess: true, clientId };
  }

  return { hasAccess: false };
}

/**
 * POST /api/reports/{reportId}/images/upload-url
 *
 * Returns presigned URL for uploading one image to a report.
 * Limits: 3 images per report, 5 MB each, JPEG/PNG only.
 * Only the client who owns the report can upload images.
 *
 * Path Parameters:
 * - reportId: string (UUID, required)
 *
 * Request Body:
 * {
 *   contentType: "image/jpeg" | "image/png",
 *   size: number (bytes, max 5MB)
 * }
 *
 * Response: 200 OK
 * {
 *   url: string,
 *   storagePath: string,
 *   imageId: string
 * }
 *
 * Errors:
 * - 400: Validation error, invalid UUID, or too many images
 * - 401: Unauthenticated
 * - 403: Forbidden (not report owner)
 * - 404: Report not found
 * - 500: Server error
 */
export const POST: APIRoute = createApiRoute(async ({ request, params, supabase, user }) => {
  // Authentication & Authorization
  const authenticatedUser = requireAuth(user);

  // Validate path parameters
  const { id: reportId } = UuidParamSchema.parse({ id: params.reportId });

  // Check authorization
  const { hasAccess, clientId } = await checkImageUploadAccess(
    supabase,
    authenticatedUser.id,
    authenticatedUser.role,
    reportId
  );

  if (!hasAccess) {
    throw new ApiException(403, {
      error: "Access denied. Only the client who owns the report can upload images.",
    });
  }

  // Parse and validate request body
  const body = await request.json();
  const { contentType, size } = ImageUploadRequestSchema.parse(body);

  // Check how many images already exist for this report
  const { data: existingImages, error: countError } = await supabase
    .from("report_images")
    .select("id")
    .eq("report_id", reportId)
    .eq("is_deleted", false);

  if (countError) {
    // eslint-disable-next-line no-console
    console.error("Error checking existing images:", countError);
    throw new ApiException(500, { error: "Failed to check existing images" });
  }

  // Maximum 3 images per report
  if (existingImages && existingImages.length >= 3) {
    throw new ApiException(400, {
      error: "Maximum 3 images per report exceeded",
      details: { existingCount: existingImages.length },
    });
  }

  // Generate unique image ID and storage path
  const imageId = crypto.randomUUID();
  const fileExtension = contentType === "image/jpeg" ? "jpg" : "png";
  const storagePath = `reports/${reportId}/${imageId}.${fileExtension}`;

  try {
    // Generate presigned URL for upload
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("report-images")
      .createSignedUploadUrl(storagePath, {
        upsert: false, // Don't allow overwriting
      });

    if (uploadError || !uploadData) {
      // eslint-disable-next-line no-console
      console.error("Error creating presigned URL:", uploadError);
      throw new ApiException(500, { error: "Failed to create upload URL" });
    }

    // Create database record for the image (pre-upload)
    const { error: insertError } = await supabase
      .from("report_images")
      .insert({
        id: imageId,
        report_id: reportId,
        storage_path: storagePath,
        size_bytes: size,
        width: null, // Will be updated after upload
        height: null, // Will be updated after upload
        is_deleted: false,
      });

    if (insertError) {
      // eslint-disable-next-line no-console
      console.error("Error creating image record:", insertError);
      throw new ApiException(500, { error: "Failed to create image record" });
    }

    return createSuccessResponse({
      url: uploadData.signedUrl,
      storagePath: storagePath,
      imageId: imageId,
    });
  } catch (error) {
    // If it's already an ApiException, re-throw it
    if (error instanceof ApiException) {
      throw error;
    }

    // eslint-disable-next-line no-console
    console.error("Unexpected error creating upload URL:", error);
    throw new ApiException(500, { error: "Failed to create upload URL" });
  }
});
