import type { APIRoute } from "astro";
import { createApiRoute, requireAuth, UuidParamSchema, ApiException } from "../../../lib/api-helpers";

/**
 * Helper function to check if user can delete image
 */
async function checkImageDeleteAccess(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  userId: string,
  userRole: string,
  imageId: string
): Promise<{ hasAccess: boolean; image?: unknown }> {
  // Get image with report and client info
  const { data: image, error } = await supabase
    .from("report_images")
    .select(
      `
      id,
      report_id,
      storage_path,
      is_deleted,
      reports!inner (
        client_id
      )
    `
    )
    .eq("id", imageId)
    .eq("is_deleted", false)
    .single();

  if (error || !image) {
    return { hasAccess: false };
  }

  const clientId = image.reports.client_id;

  // Super admin can delete any images
  if (userRole === "super_admin") {
    return { hasAccess: true, image };
  }

  // Client can delete their own report images
  if (userRole === "client" && userId === clientId) {
    return { hasAccess: true, image };
  }

  return { hasAccess: false };
}

/**
 * DELETE /api/report-images/{imageId}
 *
 * Mark image as deleted and optionally queue storage deletion.
 * Only the client who owns the report or super_admin can delete images.
 *
 * Path Parameters:
 * - imageId: string (UUID, required)
 *
 * Response: 204 No Content
 *
 * Errors:
 * - 400: Invalid UUID format
 * - 401: Unauthenticated
 * - 403: Forbidden (not owner or super_admin)
 * - 404: Image not found
 * - 500: Server error
 */
export const DELETE: APIRoute = createApiRoute(async ({ params, supabase, user }) => {
  // Authentication & Authorization
  const authenticatedUser = requireAuth(user);

  // Validate path parameters
  const { id: imageId } = UuidParamSchema.parse({ id: params.imageId });

  // Check authorization
  const { hasAccess, image } = await checkImageDeleteAccess(
    supabase,
    authenticatedUser.id,
    authenticatedUser.role,
    imageId
  );

  if (!hasAccess) {
    throw new ApiException(403, {
      error: "Access denied. Only the client who owns the report can delete images (or super_admin).",
    });
  }

  if (!image) {
    throw new ApiException(404, { error: "Image not found" });
  }

  try {
    // Mark image as deleted in database
    const { error: updateError } = await supabase
      .from("report_images")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("id", imageId);

    if (updateError) {
      // eslint-disable-next-line no-console
      console.error("Error marking image as deleted:", updateError);
      throw new ApiException(500, { error: "Failed to delete image" });
    }

    // Optionally delete from storage (in production, this might be done by a background job)
    // For now, we'll just mark it as deleted in the database
    // The actual file cleanup can be handled by a scheduled function
    try {
      const { error: storageError } = await supabase.storage.from("report-images").remove([image.storage_path]);

      if (storageError) {
        // eslint-disable-next-line no-console
        console.warn(
          "Warning: Failed to delete image from storage, but database record was marked as deleted:",
          storageError
        );
        // Don't fail the request - the database record is marked as deleted
      }
    } catch (storageError) {
      // eslint-disable-next-line no-console
      console.warn("Warning: Storage deletion failed:", storageError);
      // Don't fail the request - the database record is marked as deleted
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    // If it's already an ApiException, re-throw it
    if (error instanceof ApiException) {
      throw error;
    }

    // eslint-disable-next-line no-console
    console.error("Unexpected error deleting image:", error);
    throw new ApiException(500, { error: "Failed to delete image" });
  }
});
