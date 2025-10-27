import { z } from "zod";
import type { APIRoute } from "astro";
import type { SupabaseClient } from "../db/supabase.client";
import type { PaginationMeta } from "../types";

/* ------------------------------------------------------------------ */
/* Error handling                                                     */
/* ------------------------------------------------------------------ */

export interface ApiError {
  error: string;
  details?: unknown;
}

export class ApiException extends Error {
  constructor(
    public statusCode: number,
    public apiError: ApiError
  ) {
    super(apiError.error);
  }
}

export function createApiError(statusCode: number, message: string, details?: unknown): Response {
  return new Response(
    JSON.stringify({
      error: message,
      details,
    } satisfies ApiError),
    {
      status: statusCode,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

/* ------------------------------------------------------------------ */
/* Authentication & Authorization                                     */
/* ------------------------------------------------------------------ */

export interface AuthenticatedUser {
  id: string;
  role: "super_admin" | "trainer" | "client";
  email?: string;
  full_name: string;
}

export async function getAuthenticatedUser(supabase: SupabaseClient): Promise<AuthenticatedUser | null> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    // Get user details from our users table
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, role, email, full_name")
      .eq("id", user.id)
      .is("deleted_at", null)
      .single();

    if (userError || !userData) {
      return null;
    }

    return {
      id: userData.id,
      role: userData.role as "super_admin" | "trainer" | "client",
      email: userData.email || undefined,
      full_name: userData.full_name,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error getting authenticated user:", error);
    return null;
  }
}

export function requireAuth(user: AuthenticatedUser | null): AuthenticatedUser {
  if (!user) {
    throw new ApiException(401, { error: "Authentication required" });
  }
  return user;
}

export function requireRole(user: AuthenticatedUser, allowedRoles: string[]): void {
  if (!allowedRoles.includes(user.role)) {
    throw new ApiException(403, {
      error: "Insufficient permissions",
      details: { required: allowedRoles, current: user.role },
    });
  }
}

/**
 * Invite a user via Supabase Auth (email)
 */
export async function inviteUser(supabase: SupabaseClient, email: string): Promise<void> {
  const { error } = await supabase.auth.admin.inviteUserByEmail(email);

  if (error) {
    // eslint-disable-next-line no-console
    console.error("Error inviting user:", error);
    throw new ApiException(500, {
      error: "Failed to send invitation",
      details: error.message,
    });
  }
}

/**
 * Invite a user via Supabase Auth (phone)
 * Note: This is a placeholder - actual phone invitation would need to be implemented
 * based on your Supabase configuration and SMS provider
 */
export async function inviteUserByPhone(supabase: SupabaseClient, phone: string): Promise<void> {
  // For now, we'll create the user without sending an actual SMS invitation
  // In production, you would integrate with your SMS provider or use Supabase's phone auth
  // eslint-disable-next-line no-console
  console.log(`Phone invitation would be sent to: ${phone}`);

  // This is a placeholder - actual implementation would depend on your SMS setup
  // You might use Supabase's signUp with phone or integrate with Twilio/similar service
}

/* ------------------------------------------------------------------ */
/* Validation schemas                                                 */
/* ------------------------------------------------------------------ */

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const UuidParamSchema = z.object({
  id: z.string().uuid("Invalid UUID format"),
});

export const UserRole = z.enum(["super_admin", "trainer", "client"]);

export const UsersQuerySchema = PaginationQuerySchema.extend({
  role: UserRole.optional(),
  deleted: z.coerce.boolean().optional(),
});

export const TrainersQuerySchema = PaginationQuerySchema.extend({
  search: z.string().optional(),
});

export const CreateTrainerSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(100, "Full name too long"),
  email: z.string().email("Invalid email format"),
});

export const UpdateTrainerSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(100, "Full name too long").optional(),
  bio: z.string().max(500, "Bio too long").nullable().optional(),
});

export const ClientsQuerySchema = PaginationQuerySchema.extend({
  missingReportForWeek: z.coerce.boolean().optional(),
});

export const CreateClientSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(100, "Full name too long"),
  phone: z.string().min(1, "Phone number is required").max(20, "Phone number too long"),
  email: z.string().email("Invalid email format").optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .optional(),
  gender: z.string().max(20, "Gender too long").optional(),
});

export const UpdateClientSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(100, "Full name too long").optional(),
  phone: z.string().min(1, "Phone number is required").max(20, "Phone number too long").optional(),
  email: z.string().email("Invalid email format").optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .optional(),
  gender: z.string().max(20, "Gender too long").optional(),
});

export const ReportsQuerySchema = PaginationQuerySchema.extend({
  // No additional filters for now
});

export const SubmitReportSchema = z.object({
  weight: z.number().min(0, "Weight must be non-negative").max(1000, "Weight too high").optional(),
  waist: z.number().min(0, "Waist must be non-negative").max(500, "Waist too high").optional(),
  chest: z.number().min(0, "Chest must be non-negative").max(500, "Chest too high").optional(),
  biceps_left: z.number().min(0, "Biceps left must be non-negative").max(200, "Biceps left too high").optional(),
  biceps_right: z.number().min(0, "Biceps right must be non-negative").max(200, "Biceps right too high").optional(),
  thigh_left: z.number().min(0, "Thigh left must be non-negative").max(300, "Thigh left too high").optional(),
  thigh_right: z.number().min(0, "Thigh right must be non-negative").max(300, "Thigh right too high").optional(),
  cardio_days: z
    .number()
    .int()
    .min(0, "Cardio days must be non-negative")
    .max(7, "Cardio days cannot exceed 7")
    .optional(),
  note: z.string().max(1000, "Note too long").optional(),
});

export const EditReportSchema = z.object({
  weight: z.number().min(0, "Weight must be non-negative").max(1000, "Weight too high").optional(),
  waist: z.number().min(0, "Waist must be non-negative").max(500, "Waist too high").optional(),
  chest: z.number().min(0, "Chest must be non-negative").max(500, "Chest too high").optional(),
  biceps_left: z.number().min(0, "Biceps left must be non-negative").max(200, "Biceps left too high").optional(),
  biceps_right: z.number().min(0, "Biceps right must be non-negative").max(200, "Biceps right too high").optional(),
  thigh_left: z.number().min(0, "Thigh left must be non-negative").max(300, "Thigh left too high").optional(),
  thigh_right: z.number().min(0, "Thigh right must be non-negative").max(300, "Thigh right too high").optional(),
  cardio_days: z
    .number()
    .int()
    .min(0, "Cardio days must be non-negative")
    .max(7, "Cardio days cannot exceed 7")
    .optional(),
  note: z.string().max(1000, "Note too long").optional(),
});

export const ImageUploadRequestSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png"], {
    errorMap: () => ({ message: "Content type must be image/jpeg or image/png" }),
  }),
  size: z.number().int().min(1, "File size must be positive").max(5 * 1024 * 1024, "File size cannot exceed 5MB"),
});

export const TrendsQuerySchema = z.object({
  metrics: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      return val.split(",").map((metric) => metric.trim());
    })
    .refine(
      (metrics) => {
        if (!metrics) return true;
        const validMetrics = ["weight", "waist", "chest", "biceps_left", "biceps_right", "thigh_left", "thigh_right", "cardio_days"];
        return metrics.every((metric) => validMetrics.includes(metric));
      },
      {
        message: "Invalid metrics. Valid options: weight, waist, chest, biceps_left, biceps_right, thigh_left, thigh_right, cardio_days",
      }
    ),
});

/* ------------------------------------------------------------------ */
/* Pagination helpers                                                 */
/* ------------------------------------------------------------------ */

export function calculatePagination(page: number, pageSize: number, totalItems: number): PaginationMeta {
  const totalPages = Math.ceil(totalItems / pageSize);

  return {
    page,
    pageSize,
    totalPages,
    totalItems,
  };
}

export function getPaginationRange(page: number, pageSize: number): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return { from, to };
}

/* ------------------------------------------------------------------ */
/* API Route wrapper                                                  */
/* ------------------------------------------------------------------ */

export function createApiRoute(
  handler: (context: {
    request: Request;
    params: Record<string, string | undefined>;
    supabase: SupabaseClient;
    user: AuthenticatedUser | null;
  }) => Promise<Response>
): APIRoute {
  return async (context) => {
    try {
      const supabase = context.locals.supabase as SupabaseClient;
      const user = await getAuthenticatedUser(supabase);

      return await handler({
        request: context.request,
        params: context.params,
        supabase,
        user,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("API Error:", error);

      if (error instanceof ApiException) {
        return createApiError(error.statusCode, error.apiError.error, error.apiError.details);
      }

      if (error instanceof z.ZodError) {
        return createApiError(400, "Validation error", {
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      return createApiError(500, "Internal server error");
    }
  };
}

/* ------------------------------------------------------------------ */
/* Response helpers                                                   */
/* ------------------------------------------------------------------ */

export function createSuccessResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export function createPaginatedResponse<T>(data: T[], meta: PaginationMeta, status = 200): Response {
  return createSuccessResponse({ data, meta }, status);
}

/* ------------------------------------------------------------------ */
/* Week calculation helpers                                           */
/* ------------------------------------------------------------------ */

/**
 * Get the current week number and year
 */
export function getCurrentWeekInfo(): { year: number; weekNumber: number } {
  const now = new Date();
  const year = now.getFullYear();

  // Calculate week number (ISO 8601 week numbering)
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const weekNumber = Math.ceil(dayOfYear / 7);

  return { year, weekNumber };
}

/**
 * Get week info for a specific date
 */
export function getWeekInfo(date: Date): { year: number; weekNumber: number } {
  const year = date.getFullYear();

  // Calculate week number (ISO 8601 week numbering)
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const weekNumber = Math.ceil(dayOfYear / 7);

  return { year, weekNumber };
}

/**
 * Check if a report can be edited (within 1 hour and sequence 0)
 */
export function canEditReport(createdAt: string, sequence: number): boolean {
  if (sequence !== 0) {
    return false;
  }

  const createdDate = new Date(createdAt);
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  return createdDate > oneHourAgo;
}
