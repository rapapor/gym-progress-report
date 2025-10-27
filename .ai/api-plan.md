# REST API Plan

## 1. Resources
| Resource | DB Table | Description |
|----------|----------|-------------|
| User | users | Authenticated person in the system (`super_admin`, `trainer`, `client`). Managed primarily by Supabase Auth. |
| Trainer | trainers | Extension of `User` with trainer-specific fields. |
| Client | clients | Extension of `User` with client-specific fields. |
| Trainer-Client Mapping | trainer_client | Active/inactive assignment of clients to trainers. |
| Report | reports | Weekly progress report submitted by a client. |
| Report Image | report_images | Image belonging to a report, stored in Supabase Storage. |

## 2. Endpoints

### 2.1 Auth (handled by Supabase)
Supabase handles email/phone login, OTP invitations and password resets via its `/auth/*` routes. The app will invoke Supabase JS SDK on the client side, so these are not repeated here.

### 2.2 Users (Admin-level only)
| Method | Path | Description | Success | Errors |
|--------|------|-------------|---------|--------|
| GET | `/api/users` | List all users (paginated). Filter by role, `deleted_at`. **Role:** super_admin. | 200 OK | 401/403, 400 pagination |
| GET | `/api/users/{id}` | Get user by ID. | 200 OK | 404 |
| PATCH | `/api/users/{id}` | Update user metadata (name, role). | 200 OK | 400 validation, 404 |
| DELETE | `/api/users/{id}` | Soft-delete user (`deleted_at`). | 204 No Content | 404 |

### 2.3 Trainers
| Method | Path | Description | Success | Errors |
|--------|------|-------------|---------|--------|
| POST | `/api/trainers` | Create trainer. Body: `{fullName, email}`. Sends OTP invite via Supabase. **Role:** super_admin. | 201 Created | 400, 409 |
| GET | `/api/trainers` | List trainers (paginated, search by name/email). **Role:** super_admin. | 200 OK | 400 |
| GET | `/api/trainers/{trainerId}` | Get trainer profile. Accessible by self or super_admin. | 200 OK | 404 |
| PATCH | `/api/trainers/{trainerId}` | Update bio, name. Accessible by self or super_admin. | 200 OK | 400, 404 |

### 2.4 Clients
| Method | Path | Description | Success | Errors |
|--------|------|-------------|---------|--------|
| POST | `/api/clients` | Create client & map to trainer. Body: `{fullName, phone, email?, dateOfBirth?, gender?}`. **Role:** trainer. Sends OTP invite. | 201 Created | 400, 409 |
| GET | `/api/clients` | List clients for current trainer. Query: `missingReportForWeek?`. | 200 OK | 400 |
| GET | `/api/clients/{clientId}` | Get client profile (trainer or self). | 200 OK | 404 |
| PATCH | `/api/clients/{clientId}` | Update client profile (trainer or self). | 200 OK | 400, 404 |
| DELETE | `/api/clients/{clientId}` | Soft-delete client (trainer or super_admin). | 204 | 404 |

### 2.5 Trainer-Client Mapping
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/trainers/{trainerId}/clients/{clientId}/activate` | Activate assignment (`is_active=true`, `started_at=now()`). |
| POST | `/api/trainers/{trainerId}/clients/{clientId}/deactivate` | Deactivate assignment (`is_active=false`). |

### 2.6 Reports
| Method | Path | Description | Success | Errors |
|--------|------|-------------|---------|--------|
| POST | `/api/clients/{clientId}/reports` | Submit weekly report. Body includes measures, cardioDays, note, images (multipart). Enforces max 2 per calendar week. **Role:** client. | 201 Created | 400 validation, 409 duplicate |
| GET | `/api/clients/{clientId}/reports` | List reports (desc). Query: `page, pageSize`. Trainer or client. | 200 OK | 404 client |
| GET | `/api/reports/{reportId}` | Get report detail with images. | 200 OK | 404 |
| PATCH | `/api/reports/{reportId}` | Edit report (only within 1h, if sequence=0). | 200 OK | 400, 403, 404 |
| DELETE | `/api/reports/{reportId}` | Soft-delete report (client owner or super_admin). | 204 | 404 |

### 2.7 Trend Charts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/clients/{clientId}/trends` | Returns arrays of measurements over time for graphing. Optional query `metrics=weight,waist`. |

### 2.8 Report Images (usually handled via Supabase Storage presigned URLs)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/reports/{reportId}/images/upload-url` | Returns presigned URL for uploading one image (client). Limits: 3 images, 5 MB each. |
| DELETE | `/api/report-images/{imageId}` | Marks image `is_deleted=true`. |

## 3. Authentication & Authorization
- Supabase JWT (row-level security).
- Roles embedded in JWT (`role` claim).
- Middleware (`src/middleware/index.ts`) checks token & sets `locals.user`.
- RLS policies from DB enforce data access; API additionally verifies role before mutating.
- Rate limiting via Astro middleware (e.g., 100 req/15 min per user).

## 4. Validation & Business Logic
### 4.1 Validation Rules
- Weight, waist, chest, biceps, thigh ≥ 0 (DB CHECK) and reasonable upper bounds in API.
- `cardioDays` 0-7.
- Max 2 reports/week enforced by query on `reports` (`UNIQUE` constraint `(client_id, week_number, year, sequence)`).
- Images: ≤3 per report, each ≤5 MB, JPEG/PNG.

### 4.2 Business Logic Mapping
| PRD Feature | Endpoint(s) | Notes |
|-------------|-------------|-------|
| US-002 Create trainer | `POST /api/trainers` | Sends Supabase invite. |
| US-003 Create client | `POST /api/clients` | Trainer ownership. |
| US-004 Activate account | handled by Supabase `/auth/verify` | |
| US-005 Offline read-only | Client PWA caches GET routes and guards POST when offline. |
| US-006 Submit weekly report | `POST /api/clients/{id}/reports` | Validation rules above. |
| US-007 Client list with status | `GET /api/clients?missingReportForWeek=true` | DB view or query. |
| US-008 Report detail | `GET /api/reports/{id}` | Includes diff vs previous (computed). |
| US-009 Trend charts | `GET /api/clients/{id}/trends` | Aggregated data. |
| US-010 Image comparison | Front-end uses images from `GET /api/reports`. |
| US-011 Reset client password | Supabase Admin API. |
| US-012 Super-admin full access | All `User` & `Report*` endpoints unrestricted. |
| US-013 Image retention | Supabase cron function, not API. |
| US-014 i18n | No API impact. |
| US-015 Accessibility | No API impact. |

## 5. Pagination, Filtering, Sorting
- Standard query params: `page` (default 1), `pageSize` (default 20, max 100).
- Sorting via `sort` (e.g., `created_at:desc`).
- Filtering via explicit params (e.g., `role`, `is_active`).
- Responses include `meta` object: `{page, pageSize, totalPages, totalItems}`.

## 6. Error Handling
| Code | Meaning | Example |
|------|---------|---------|
| 400 | Validation error | Invalid `cardioDays`. |
| 401 | Unauthenticated | Missing/expired JWT. |
| 403 | Forbidden | Trainer accessing another trainer’s client. |
| 404 | Not found | Unknown resource ID. |
| 409 | Conflict | Duplicate report in week. |
| 429 | Too Many Requests | Rate-limit exceeded. |
| 500 | Server error | Unexpected failure. |

## 7. Security Considerations
- HTTPS everywhere.
- CSRF protection for cookie-based auth (if used).
- JWT verified server-side; short-lived access tokens with refresh.
- Input validation & sanitization against XSS/SQLi.
- Presigned URLs limit direct Storage access duration & content-type.
- Soft-delete strategy preserves history; super_admin can permanently delete.

## 8. Performance
- Use DB indexes listed in schema (e.g., `reports(client_id, created_at DESC)` for listing).
- BRIN indexes accelerate archival queries.
- `trends` endpoint aggregates via SQL `ROLLUP` with caching (e.g., 5 min).
- Image uploads go directly to Storage, bypassing API server.

## 9. Assumptions
- Supabase project with Row Level Security enabled as per schema.
- Astro serverless functions (`/src/pages/api/*`) host the REST endpoints.
- Rate-limiting implemented via KV store (e.g., Upstash Redis).
- Editing a report allowed only within 1 hour after submission unless super_admin.
