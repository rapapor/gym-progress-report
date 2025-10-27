import type { APIRoute } from "astro";
import {
  createApiRoute,
  requireAuth,
  requireRole,
  UuidParamSchema,
  UpdateTrainerSchema,
  createSuccessResponse,
  ApiException,
} from "../../../lib/api-helpers";
import type { TrainerDTO } from "../../../types";

/**
 * GET /api/trainers/{trainerId}
 *
 * Get trainer profile. Accessible by the trainer themselves or super_admin.
 *
 * Path Parameters:
 * - trainerId: string (UUID, required)
 *
 * Response: 200 OK TrainerDTO
 * {
 *   id: string,
 *   full_name: string,
 *   email: string | null,
 *   phone: string | null,
 *   role: string,
 *   bio: string | null
 * }
 *
 * Errors:
 * - 400: Invalid UUID format
 * - 401: Unauthenticated
 * - 403: Forbidden (not self or super_admin)
 * - 404: Trainer not found
 */
export const GET: APIRoute = createApiRoute(async ({ params, supabase, user }) => {
  // Authentication & Authorization
  const authenticatedUser = requireAuth(user);

  // Validate path parameters
  const { id: trainerId } = UuidParamSchema.parse({ id: params.trainerId });

  // Check authorization: self or super_admin
  if (authenticatedUser.role !== "super_admin" && authenticatedUser.id !== trainerId) {
    throw new ApiException(403, {
      error: "Access denied. You can only view your own profile or be a super admin.",
    });
  }

  // Fetch trainer from database
  const { data, error } = await supabase
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
    .eq("id", trainerId)
    .eq("role", "trainer")
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      throw new ApiException(404, { error: "Trainer not found" });
    }

    console.error("Error fetching trainer:", error);
    throw new ApiException(500, { error: "Failed to fetch trainer" });
  }

  if (!data) {
    throw new ApiException(404, { error: "Trainer not found" });
  }

  // Transform to DTO
  const trainerDto: TrainerDTO = {
    id: data.id,
    full_name: data.full_name,
    email: data.email,
    phone: data.phone,
    role: data.role,
    bio: data.trainers?.[0]?.bio || null,
  };

  return createSuccessResponse(trainerDto);
});

/**
 * PATCH /api/trainers/{trainerId}
 *
 * Update trainer profile (bio, name). Accessible by the trainer themselves or super_admin.
 *
 * Path Parameters:
 * - trainerId: string (UUID, required)
 *
 * Request Body:
 * {
 *   fullName?: string,
 *   bio?: string | null
 * }
 *
 * Response: 200 OK TrainerDTO
 *
 * Errors:
 * - 400: Validation error or invalid UUID
 * - 401: Unauthenticated
 * - 403: Forbidden (not self or super_admin)
 * - 404: Trainer not found
 */
export const PATCH: APIRoute = createApiRoute(async ({ request, params, supabase, user }) => {
  // Authentication & Authorization
  const authenticatedUser = requireAuth(user);

  // Validate path parameters
  const { id: trainerId } = UuidParamSchema.parse({ id: params.trainerId });

  // Check authorization: self or super_admin
  if (authenticatedUser.role !== "super_admin" && authenticatedUser.id !== trainerId) {
    throw new ApiException(403, {
      error: "Access denied. You can only update your own profile or be a super admin.",
    });
  }

  // Parse and validate request body
  const body = await request.json();
  const { fullName, bio } = UpdateTrainerSchema.parse(body);

  // Check if there's anything to update
  if (fullName === undefined && bio === undefined) {
    throw new ApiException(400, { error: "No valid fields provided for update" });
  }

  // First check if trainer exists
  const { data: existingTrainer, error: fetchError } = await supabase
    .from("users")
    .select("id")
    .eq("id", trainerId)
    .eq("role", "trainer")
    .is("deleted_at", null)
    .single();

  if (fetchError || !existingTrainer) {
    throw new ApiException(404, { error: "Trainer not found" });
  }

  try {
    // Update users table if fullName is provided
    if (fullName !== undefined) {
      const { error: userUpdateError } = await supabase
        .from("users")
        .update({ full_name: fullName })
        .eq("id", trainerId);

      if (userUpdateError) {
        console.error("Error updating user:", userUpdateError);
        throw new ApiException(500, { error: "Failed to update trainer name" });
      }
    }

    // Update trainers table if bio is provided
    if (bio !== undefined) {
      const { error: trainerUpdateError } = await supabase.from("trainers").update({ bio: bio }).eq("id", trainerId);

      if (trainerUpdateError) {
        console.error("Error updating trainer:", trainerUpdateError);
        throw new ApiException(500, { error: "Failed to update trainer bio" });
      }
    }

    // Fetch updated trainer data
    const { data: updatedData, error: updatedFetchError } = await supabase
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
      .eq("id", trainerId)
      .single();

    if (updatedFetchError || !updatedData) {
      console.error("Error fetching updated trainer:", updatedFetchError);
      throw new ApiException(500, { error: "Failed to fetch updated trainer data" });
    }

    // Transform to DTO
    const trainerDto: TrainerDTO = {
      id: updatedData.id,
      full_name: updatedData.full_name,
      email: updatedData.email,
      phone: updatedData.phone,
      role: updatedData.role,
      bio: updatedData.trainers?.[0]?.bio || null,
    };

    return createSuccessResponse(trainerDto);
  } catch (error) {
    // If it's already an ApiException, re-throw it
    if (error instanceof ApiException) {
      throw error;
    }

    console.error("Unexpected error updating trainer:", error);
    throw new ApiException(500, { error: "Failed to update trainer" });
  }
});
