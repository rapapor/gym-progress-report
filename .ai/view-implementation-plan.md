# API Endpoint Implementation Plan

## Conventions & Shared Considerations

### Tech Stack
- **Runtime**: Astro 5 serverless functions (`/src/pages/api/*`).
- **Database**: Supabase PostgreSQL with RLS enabled, accessed via `context.locals.supabase` (type `SupabaseClient`).
- **Validation**: Zod schemas built on top of shared DTO / Command models from `src/types.ts`.
- **Error Envelope**: All error responses return JSON `{ error: string; details?: unknown }` with the status codes defined in section 6.
- **Pagination Meta**: List endpoints wrap data in `{ data: T[]; meta: PaginationMeta }`.
- **Soft-Delete**: Endpoints that delete rows set `deleted_at`; clients use `is_deleted` for images.

### Standard Endpoint Template (applied per section below)
1. Overview
2. Request Details (method, URL, params, body)
3. Types (DTOs & Commands)
4. Response Details
5. Data Flow
6. Security Considerations
7. Error Handling
8. Performance Notes
9. Implementation Steps

---

## 1. Auth – handled by Supabase
(No custom routes; use Supabase JS SDK on client.)

---

## 2. Users (Admin-level)

### 2.1 GET /api/users
1. **Overview**: Paginated list of all users, filterable by `role` and `deleted_at`.
2. **Request**
   - Method: GET
   - URL: `/api/users?page=1&pageSize=20&role=trainer&deleted=false`
   - Query Params:
     - `page` (number, default 1)
     - `pageSize` (number, 1–100, default 20)
     - `role` (optional enum `super_admin|trainer|client`)
     - `deleted` (optional boolean → maps to `deleted_at IS NOT NULL`)
3. **Types**: returns `UserDTO[]` with `PaginationMeta`.
4. **Response**: 200 OK `{ data, meta }`.
5. **Data Flow**:
   1. Verify `locals.user.role === 'super_admin'`.
   2. Build dynamic Supabase query with filters.
   3. `orderBy created_at desc` + range for pagination.
6. **Security**: RLS bypassed via `supabase.rpc('admin_view_users')` or using service key (recommended: PostgREST RLS policy `super_admin` TRUE).
7. **Errors**:
   - 400 invalid params (Zod)
   - 401 unauthenticated
8. **Performance**: Index `users(created_at DESC)` covers scan.
9. **Steps**:
   1. Add Zod query schema.
   2. Implement route.
   3. Unit-test pagination & filters.

### 2.2 GET /api/users/{id}
1. **Overview**: Fetch single user by UUID.
2. **Request**
   - Method: GET
   - URL: `/api/users/{id}`
   - Path Params: `id` (uuid, required)
3. **Types**: returns `UserDTO`.
4. **Response**: 200 OK `UserDTO`.
5. **Data Flow**: Verify super_admin as above → `supabase.from('users').select({...}).eq('id', id).single()`.
6. **Security**: RLS super_admin.
7. **Errors**: 404 not found, 400 invalid id.
8. **Performance**: PK lookup.
9. **Steps**: add route, zod param validation, tests.

### 2.3 PATCH /api/users/{id}
1. **Overview**: Update user metadata (name, role).
2. **Request**
   - Method: PATCH
   - Body: `{ fullName?: string; role?: 'super_admin'|'trainer'|'client' }`.
3. **Types**: uses inline Zod + `UserDTO` response.
4. **Response**: 200 OK `UserDTO`.
5. **Data Flow**: Service layer `UserService.update()` handling Supabase update.
6. **Security**: super_admin only.
7. **Errors**: 400 validation, 404.
8. **Performance**: N/A.
9. **Steps**: create service function, tests.

### 2.4 DELETE /api/users/{id}
1. **Overview**: Soft-delete by setting `deleted_at`.
2. **Request**: DELETE `/api/users/{id}`.
3. **Response**: 204 No Content.
4. **Data Flow**: update row `deleted_at=now()`.
5. **Security**: super_admin.
6. **Errors**: 404.
7. **Steps**: service + route.

---

## 3. Trainers

### 3.1 POST /api/trainers
1. **Overview**: Create trainer & send invite.
2. **Request**
   - Method: POST
   - Body `CreateTrainerCommand` (see `types.ts`).
3. **Types**: `CreateTrainerCommand`, response `TrainerDTO`.
4. **Response**: 201 Created.
5. **Data Flow**: Service `TrainerService.create(cmd, supabase)`:
   1. Insert into `users` with role trainer.
   2. Insert into `trainers`.
   3. Call Supabase Auth invite.
6. **Security**: super_admin.
7. **Errors**: 400 validation, 409 duplicate.
8. **Performance**: Transaction.
9. **Steps**: implement command handler + unit tests.

### 3.2 GET /api/trainers
1. **Overview**: List trainers with optional search.
2. **Request**
   - Method: GET
   - URL: `/api/trainers?page=1&pageSize=20&search=smith`
   - Query Params: `page`, `pageSize`, `search?` (matches name/email).
3. **Types**: returns `TrainerDTO[]` + `PaginationMeta`.
4. **Response**: 200 OK `{ data, meta }`.
5. **Data Flow**: super_admin → supabase text search on `full_name || email`.
6. **Security**: super_admin.
7. **Errors**: 400.
8. **Performance**: Trigram index on `full_name` & `email`.
9. **Steps**: implement search util.

### 3.3 GET /api/trainers/{trainerId}
1. **Overview**: Get trainer profile (self or admin).
2. **Request**: GET `/api/trainers/{trainerId}`.
3. **Types**: `TrainerDTO`.
4. **Response**: 200 OK.
5. **Data Flow**: Verify requester is self OR super_admin.
6. **Security**: RLS ensures row-level; extra check in route for clarity.
7. **Errors**: 404, 403.
8. **Steps**: add policy `users.id = auth.uid()` for trainers.

### 3.4 PATCH /api/trainers/{trainerId}
1. **Overview**: Update bio/name.
2. **Request**: PATCH with `UpdateTrainerCommand`.
3. **Response**: 200 OK `TrainerDTO`.
4. **Security**: self or super_admin.
5. **Errors**: 400, 404.
6. **Steps**: service.

---

## 4. Clients

### 4.1 POST /api/clients
1. **Overview**: Trainer creates client & assignment.
2. **Request**
   - Method: POST
   - Body: `CreateClientCommand`.
3. **Types**: command + response `ClientDTO`.
4. **Response**: 201 Created.
5. **Data Flow**:
   1. Insert into `users` (role client) & `clients`.
   2. Insert into `trainer_client` with `is_active=true`.
   3. Invite via Supabase Auth (phone/email).
6. **Security**: role `trainer`.
7. **Errors**: 400 validation, 409 duplicate.
8. **Performance**: transaction.

### 4.2 GET /api/clients
1. **Overview**: List clients for current trainer; optional missingReport filter.
2. **Request**: GET `/api/clients?page=1&pageSize=20&missingReportForWeek=true`.
3. **Types**: `ClientDTO[]` + meta.
4. **Data Flow**: join `trainer_client` where trainer_id=auth.uid(); if missingReport param, left join latest reports.
5. **Security**: RLS ensures trainer sees own clients.
6. **Errors**: 400.

### 4.3 GET /api/clients/{clientId}
1. **Overview**: Retrieve client profile (by trainer owner or the client themself).
2. **Request**
   - Method: GET
   - URL: `/api/clients/{clientId}`
   - Path Params: `clientId` (uuid, required)
3. **Types**: `ClientDTO`.
4. **Response**: 200 OK.
5. **Data Flow**: RLS ensures row access; extra check that requester is trainer with active assignment OR same uid.
6. **Security**: trainer or self; super_admin always allowed.
7. **Errors**: 403 forbidden if not related; 404 if unknown.
8. **Performance**: PK lookup.
9. **Steps**: route + Zod param validation.

### 4.4 PATCH /api/clients/{clientId}
1. **Overview**: Update client profile.
2. **Request**
   - Method: PATCH
   - Body: `UpdateClientCommand`.
3. **Response**: 200 OK `ClientDTO`.
4. **Data Flow**: Service `ClientService.update()` performs Supabase update on `users` & `clients` tables within transaction.
5. **Security**: self or owning trainer or super_admin.
6. **Errors**: 400 validation, 403/404.
7. **Steps**: implement service + tests.

### 4.5 DELETE /api/clients/{clientId}
1. **Overview**: Soft-delete client (`deleted_at`).
2. **Request**: DELETE `/api/clients/{clientId}`.
3. **Response**: 204 No Content.
4. **Data Flow**: update `users.deleted_at` + cascade policies.
5. **Security**: owning trainer or super_admin.
6. **Errors**: 404, 403.
7. **Steps**: route.

---

## 5. Trainer-Client Mapping

### 5.1 POST /api/trainers/{trainerId}/clients/{clientId}/activate
1. **Overview**: Activate assignment.
2. **Request**: POST empty body.
3. **Response**: 200 OK `TrainerClientAssignmentDTO`.
4. **Data Flow**: Update `is_active=true`, `started_at=now()` row insert/update.
5. **Security**: trainerId must equal auth.uid() OR super_admin.
6. **Errors**: 403, 404.

### 5.2 POST /api/trainers/{trainerId}/clients/{clientId}/deactivate
1. **Overview**: Deactivate assignment (`is_active=false`).
2. **Request**: POST empty body.
3. **Response**: 200 OK `TrainerClientAssignmentDTO`.
4. **Data Flow**: update row `is_active=false` in `trainer_client`.
5. **Security**: trainerId == auth.uid() or super_admin.
6. **Errors**: 403, 404.
7. **Steps**: service.

---

## 6. Reports

### 6.1 POST /api/clients/{clientId}/reports
1. **Overview**: Client submits weekly report (max 2/week).
2. **Request**
   - Method: POST multipart/form-data
   - Body fields: `SubmitReportCommand` JSON part + `images` array (≤3, each ≤5 MB).
3. **Types**: `SubmitReportCommand`.
4. **Response**: 201 Created `ReportDTO`.
5. **Data Flow**:
   1. Validate limit 2 per week via pre-query UNIQUE.
   2. Insert `reports` row (sequence 0 or 1 depending on existing).
   3. For each image: generate storage path, upload via presigned, insert `report_images` rows.
6. **Security**: auth.uid()==clientId.
7. **Errors**: 400 validation, 409 duplicate.

### 6.2 GET /api/clients/{clientId}/reports
1. **Overview**: Paginated list of reports for client.
2. **Request**
   - Method: GET
   - URL: `/api/clients/{clientId}/reports?page=1&pageSize=10`
   - Query Params: `page`, `pageSize`.
3. **Types**: `ReportListItemDTO[]` + meta.
4. **Response**: 200 OK.
5. **Data Flow**: Supabase query order by `created_at DESC` with range.
6. **Security**: trainer owner or client self.
7. **Errors**: 404 client, 400 params.
8. **Performance**: index `reports(client_id, created_at DESC)`.
9. **Steps**: route + service.

### 6.3 GET /api/reports/{reportId}
1. **Overview**: Get full report detail with images.
2. **Request**: GET `/api/reports/{reportId}`.
3. **Types**: `ReportDTO`.
4. **Response**: 200 OK.
5. **Data Flow**: select `reports` + `report_images` where `is_deleted=false`.
6. **Security**: trainer owner or client self.
7. **Errors**: 404.
8. **Steps**: route.

### 6.4 PATCH /api/reports/{reportId}
1. **Overview**: Edit report within 1h if sequence=0.
2. **Request**: PATCH body `EditReportCommand`.
3. **Response**: 200 OK `ReportDTO`.
4. **Data Flow**: Check timestamp `< now() - 1h`; check `sequence==0`; update row.
5. **Security**: client owner only (or super_admin bypass).
6. **Errors**: 400 validation, 403 edit window passed, 404.
7. **Steps**: route + business rule helper.

### 6.5 DELETE /api/reports/{reportId}
1. **Overview**: Soft-delete report.
2. **Request**: DELETE `/api/reports/{reportId}`.
3. **Response**: 204.
4. **Data Flow**: set `deleted_at`.
5. **Security**: client owner or super_admin.
6. **Errors**: 404.
7. **Steps**: route.

---

## 7. Trends

### 7.1 GET /api/clients/{clientId}/trends
1. **Overview**: Aggregated measurement arrays.
2. **Request**: GET with optional `metrics` query.
3. **Response**: 200 OK `TrendsDTO`.
4. **Data Flow**: SQL ROLLUP or Supabase RPC returning aggregated arrays.
5. **Security**: trainer or client (RLS).
6. **Performance**: materialized view + 5 min cache.

---

## 8. Report Images

### 8.1 POST /api/reports/{reportId}/images/upload-url
1. **Overview**: Return presigned URL for one image.
2. **Request**: POST, body `{ contentType: 'image/jpeg', size: number }`.
3. **Response**: 200 OK `{ url, storagePath }`.
4. **Data Flow**: Verify report owner; count existing images; generate signedUploadUrl.
5. **Security**: client owner.
6. **Errors**: 400 too many images, 404.

### 8.2 DELETE /api/report-images/{imageId}
1. **Overview**: Mark image deleted and optionally queue storage deletion.
2. **Request**: DELETE `/api/report-images/{imageId}`.
3. **Response**: 204.
4. **Data Flow**: update row `is_deleted=true`, `deleted_at=now()`.
5. **Security**: owner client or super_admin.
6. **Errors**: 404, 403.
7. **Steps**: route.

---

## 9. Shared Error Codes
| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No Content |
| 400 | Validation error |
| 401 | Unauthenticated |
| 403 | Forbidden |
| 404 | Not found |
| 409 | Conflict |
| 429 | Too Many Requests |
| 500 | Server error |
