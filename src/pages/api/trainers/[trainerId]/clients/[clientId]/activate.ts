import type { APIRoute } from "astro";
import {
  createApiRoute,
  requireAuth,
  UuidParamSchema,
  createSuccessResponse,
  ApiException,
} from "../../../../../../lib/api-helpers";
import type { TrainerClientAssignmentDTO } from "../../../../../../types";

/**
 * POST /api/trainers/{trainerId}/clients/{clientId}/activate
 *
 * Activate trainer-client assignment.
 * Sets is_active=true and started_at=now().
 *
 * Path Parameters:
 * - trainerId: string (UUID, required)
 * - clientId: string (UUID, required)
 *
 * Response: 200 OK TrainerClientAssignmentDTO
 * {
 *   trainer_id: string,
 *   client_id: string,
 *   is_active: boolean,
 *   started_at: string
 * }
 *
 * Errors:
 * - 400: Invalid UUID format
 * - 401: Unauthenticated
 * - 403: Forbidden (trainerId must equal auth.uid() or be super_admin)
 * - 404: Trainer, client, or assignment not found
 * - 500: Server error
 */
export const POST: APIRoute = createApiRoute(async ({ params, supabase, user }) => {
  // Authentication & Authorization
  const authenticatedUser = requireAuth(user);

  // Validate path parameters
  const { id: trainerId } = UuidParamSchema.parse({ id: params.trainerId });
  const { id: clientId } = UuidParamSchema.parse({ id: params.clientId });

  // Check authorization: trainerId must equal auth.uid() OR be super_admin
  if (authenticatedUser.role !== "super_admin" && authenticatedUser.id !== trainerId) {
    throw new ApiException(403, {
      error: "Access denied. You can only manage your own client assignments or be a super admin.",
      details: { requestedTrainerId: trainerId, currentUserId: authenticatedUser.id },
    });
  }

  // Verify trainer exists and is active
  const { data: trainer, error: trainerError } = await supabase
    .from("users")
    .select("id")
    .eq("id", trainerId)
    .eq("role", "trainer")
    .is("deleted_at", null)
    .single();

  if (trainerError || !trainer) {
    throw new ApiException(404, { error: "Trainer not found" });
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

  // Check if assignment already exists
  const { data: existingAssignment, error: checkError } = await supabase
    .from("trainer_client")
    .select("trainer_id, client_id, is_active, started_at")
    .eq("trainer_id", trainerId)
    .eq("client_id", clientId)
    .single();

  if (checkError && checkError.code !== "PGRST116") {
    // eslint-disable-next-line no-console
    console.error("Error checking existing assignment:", checkError);
    throw new ApiException(500, { error: "Failed to check existing assignment" });
  }

  let assignmentData: TrainerClientAssignmentDTO;

  if (existingAssignment) {
    // Update existing assignment to active
    const { data: updatedAssignment, error: updateError } = await supabase
      .from("trainer_client")
      .update({
        is_active: true,
        started_at: new Date().toISOString(),
      })
      .eq("trainer_id", trainerId)
      .eq("client_id", clientId)
      .select("trainer_id, client_id, is_active, started_at")
      .single();

    if (updateError || !updatedAssignment) {
      // eslint-disable-next-line no-console
      console.error("Error updating assignment:", updateError);
      throw new ApiException(500, { error: "Failed to activate assignment" });
    }

    assignmentData = updatedAssignment;
  } else {
    // Create new assignment
    const { data: newAssignment, error: insertError } = await supabase
      .from("trainer_client")
      .insert({
        trainer_id: trainerId,
        client_id: clientId,
        is_active: true,
        started_at: new Date().toISOString(),
      })
      .select("trainer_id, client_id, is_active, started_at")
      .single();

    if (insertError || !newAssignment) {
      // eslint-disable-next-line no-console
      console.error("Error creating assignment:", insertError);
      throw new ApiException(500, { error: "Failed to create assignment" });
    }

    assignmentData = newAssignment;
  }

  return createSuccessResponse(assignmentData);
});
