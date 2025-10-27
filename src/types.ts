// ... existing code ...

// Central DTO & command-model exports for REST API.
// All types are built *directly* on generated database table types
// (see src/db/database.types.ts) to guarantee schema-level safety.

import type { Tables, TablesInsert } from "./db/database.types";

/* ------------------------------------------------------------------ */
/* Basic reusable table aliases                                       */
/* ------------------------------------------------------------------ */

type UserRow = Tables<"users">;
type TrainerRow = Tables<"trainers">;
type ClientRow = Tables<"clients">;
type ReportRow = Tables<"reports">;
type ReportImageRow = Tables<"report_images">;
type TrainerClientRow = Tables<"trainer_client">;

/* ------------------------------------------------------------------ */
/* Generic helpers                                                    */
/* ------------------------------------------------------------------ */

/** Pagination metadata envelope returned by list endpoints. */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

/* ------------------------------------------------------------------ */
/* User / Trainer / Client DTOs                                       */
/* ------------------------------------------------------------------ */

/**
 * Minimal public representation of any user.
 * Maps 1-to-1 to selected columns of `users` table.
 */
export type UserDTO = Pick<UserRow, "id" | "full_name" | "email" | "phone" | "role">;

/**
 * TrainerDTO = UserDTO + trainer-specific extension stored
 * in `trainers` table.
 */
export interface TrainerDTO extends UserDTO, Pick<TrainerRow, "bio"> {}

/**
 * ClientDTO = UserDTO + client-specific fields held
 * in `clients` table.
 */
export interface ClientDTO extends UserDTO, Pick<ClientRow, "date_of_birth" | "gender"> {}

/* ------------------------------------------------------------------ */
/* Trainer-Client assignment                                          */
/* ------------------------------------------------------------------ */

export type TrainerClientAssignmentDTO = TrainerClientRow;

/* ------------------------------------------------------------------ */
/* Report images                                                      */
/* ------------------------------------------------------------------ */

export type ReportImageDTO = ReportImageRow;

/* ------------------------------------------------------------------ */
/* Report DTOs                                                        */
/* ------------------------------------------------------------------ */

/**
 * Lightweight item returned in report listings.
 * Omits heavyweight relational data such as `images`.
 */
export type ReportListItemDTO = Omit<ReportRow, "note">;

/**
 * Full report detail with embedded images array.
 */
export interface ReportDTO extends ReportRow {
  images: ReportImageDTO[];
}

/* ------------------------------------------------------------------ */
/* Trends                                                              */
/* ------------------------------------------------------------------ */

export interface TrendsDTO {
  weight?: number[];
  waist?: number[];
  chest?: number[];
  biceps_left?: number[];
  biceps_right?: number[];
  thigh_left?: number[];
  thigh_right?: number[];
  cardio_days?: number[];
}

/* ------------------------------------------------------------------ */
/* Command models (request bodies)                                    */
/* ------------------------------------------------------------------ */

/* -------------------------- Trainer -------------------------------- */

/** Body of POST /api/trainers */
export interface CreateTrainerCommand {
  fullName: string;
  email: string;
}

/** Body of PATCH /api/trainers/{id} */
export interface UpdateTrainerCommand {
  fullName?: string;
  bio?: string | null;
}

/* --------------------------- Client -------------------------------- */

/** Body of POST /api/clients */
export interface CreateClientCommand {
  fullName: string;
  phone: string;
  email?: string;
  dateOfBirth?: string;
  gender?: string;
}

/** Body of PATCH /api/clients/{id} */
export type UpdateClientCommand = Partial<CreateClientCommand>;

/* --------------------------- Reports ------------------------------- */

/**
 * Body of POST /api/clients/{clientId}/reports
 * Combines DB insert payload with extra multipart images.
 */
export interface SubmitReportCommand
  extends Omit<TablesInsert<"reports">, "client_id" | "created_at" | "sequence" | "id"> {
  /** Up to 3 images attached in the same multipart request. */
  images?: File[];
}

/**
 * Body of PATCH /api/reports/{reportId}
 * All fields optional and images excluded.
 */
export type EditReportCommand = Partial<Omit<SubmitReportCommand, "images">>;

/* ------------------------------------------------------------------ */

// export type {
//   UserDTO,
//   TrainerDTO,
//   ClientDTO,
//   TrainerClientAssignmentDTO,
//   ReportDTO,
//   ReportListItemDTO,
//   ReportImageDTO,
//   TrendsDTO,
//   CreateTrainerCommand,
//   UpdateTrainerCommand,
//   CreateClientCommand,
//   UpdateClientCommand,
//   SubmitReportCommand,
//   EditReportCommand,
// };
