# DTO Mappings Reference

> All request DTOs with validation rules, endpoints, guards, and service notes.
> Reflects actual implemented code — controllers, DTOs and services as they exist.
> Last updated: April 2026

---

## Table of Contents

1. [Auth Module](#1-auth-module)
2. [Platform Module (Superadmin)](#2-platform-module-superadmin)
3. [Organization Module](#3-organization-module)
4. [Role Module](#4-role-module)
5. [Hospital Module](#5-hospital-module)
6. [Prescription Module](#6-prescription-module)
7. [Medicine Library Module](#7-medicine-library-module)
8. [Guard Reference](#8-guard-reference)
9. [JWT Payload Reference](#9-jwt-payload-reference)
10. [Full Endpoint Index](#10-full-endpoint-index)
11. [Known Issues / TODOs](#11-known-issues--todos)

---

## 1. Auth Module

Base path: `/api/auth`

---

### `LoginDto`
**Endpoint:** `POST /api/auth/login`
**Auth:** Public

| Field | Type | Rules |
|-------|------|-------|
| `email` | string | Required · valid email |
| `password` | string | Required |

**Response:** `{ token, refreshToken, user }` + sets `refreshToken` HttpOnly cookie

---

### `SuperadminLoginDto`
**Endpoint:** `POST /api/auth/superadmin/login`
**Auth:** Public

| Field | Type | Rules |
|-------|------|-------|
| `email` | string | Required · valid email |
| `password` | string | Required |

**Response:** `{ token, superAdmin: { id, name, email } }`

---

### `RegisterDto`
**Endpoint:** `POST /api/auth/register`
**Auth:** Public

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | Required · min 2 |
| `email` | string | Required · valid email |
| `password` | string | Required · min 6 |
| `role` | string | Optional · `ADMIN \| DOCTOR \| PHARMACIST` · default `DOCTOR` |
| `clinic_name` | string | Optional · used as org name for ADMIN/DOCTOR |

**Service note:**
- `ADMIN` role maps to `ORG_ADMIN` internally
- Auto-creates an organization for `ADMIN` and `DOCTOR` roles
- Creates role-specific profile row (`doctor_profiles` or `pharmacist_profiles`)

**Response:** `{ token, refreshToken, user }` + sets `refreshToken` HttpOnly cookie

---

### `ForgotPasswordDto`
**Endpoint:** `POST /api/auth/forgot-password`
**Auth:** Public

| Field | Type | Rules |
|-------|------|-------|
| `email` | string | Required · valid email |

**Service note:**
- Always returns same message (never reveals whether email exists)
- Generates 6-digit OTP, stores SHA-256 hash in `password_reset_tokens`, expires in 10 min
- Sends OTP via email (Nodemailer → Office365 SMTP)

**Response:** `{ message: "If that email is registered, an OTP has been sent." }`

---

### `ResetPasswordDto`
**Endpoint:** `POST /api/auth/reset-password`
**Auth:** Public

| Field | Type | Rules |
|-------|------|-------|
| `email` | string | Required · valid email |
| `otp` | string | Required · exactly 6 digits |
| `password` | string | Required · min 6 |

**Service note:**
- Validates OTP hash + expiry against `password_reset_tokens`
- Updates `password_hash`, marks token `used_at`, revokes all refresh tokens (forces re-login on all devices)

---

### Other Auth Endpoints (no DTO body)

| Method | Path | Notes | Auth |
|--------|------|-------|------|
| `GET` | `/api/auth/me` | Returns current user from JWT | JwtAuthGuard |
| `POST` | `/api/auth/refresh` | Reads `refreshToken` cookie · rotates token pair | Public |
| `POST` | `/api/auth/logout` | Revokes refresh token · clears cookie | Public |

---

## 2. Platform Module (Superadmin)

Base paths: `/api/superadmin`, `/plans`

**All `/api/superadmin/*` routes:** `SuperAdminAuthGuard`
**`/plans` GET routes:** Public
**`/plans` POST/PUT routes:** `SuperAdminAuthGuard`

> ⚠️ `SuperadminController` still uses `@Res()` + Express response directly — bypasses `ResponseInterceptor`. Frontend must read `res.data` directly (not `res.data.data`).

---

### `CreatePlanDto`
**Endpoints:** `POST /plans` · `PUT /plans/:id` (all fields optional for PUT via `Partial<CreatePlanDto>`)
**Auth:** SuperAdminAuthGuard

| Field | Type | Rules |
|-------|------|-------|
| `name` | enum | Required · `FREE \| PRO \| GROWTH \| ENT` |
| `display_name` | string | Required |
| `rx_limit` | number | Required · min 1 (prescriptions/month) |
| `team_limit` | number | Required · min 1 (staff per hospital) |
| `hospital_limit` | number | Required · min 1 |
| `price_monthly` | number | Optional |
| `features` | object | Optional · arbitrary feature flags |

---

### `CreateOrgDto`
**Endpoint:** `POST /api/superadmin/organizations`
**Auth:** SuperAdminAuthGuard

| Field | Type | Rules |
|-------|------|-------|
| `org_name` | string | Required · min 2 |
| `plan` | string | Optional · `FREE \| PRO \| GROWTH \| ENT \| ENTERPRISE` |
| `admin_name` | string | Required · min 2 |
| `admin_email` | string | Required · valid email |
| `admin_password` | string | Required · min 6 |
| `address` | string | Optional |
| `phone` | string | Optional |
| `website` | string | Optional |

---

### Superadmin Endpoints (no DTO body)

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/superadmin/dashboard` | Platform stats |
| `GET` | `/api/superadmin/organizations` | List all orgs (supports query params) |
| `GET` | `/api/superadmin/organizations/:id` | Single org detail |
| `PUT` | `/api/superadmin/organizations/:id` | Update org (body: any) |
| `DELETE` | `/api/superadmin/organizations/:id` | Delete org |
| `GET` | `/api/superadmin/users` | List all users (supports query params) |
| `GET` | `/plans` | Public · list active plans |
| `GET` | `/plans/:id` | Public · single plan |

---

## 3. Organization Module

Base path: `/api/organizations`
All routes: `JwtAuthGuard`. Write operations: `OrgAdminGuard`.

---

### `UpdateOrgDto`
**Endpoint:** `PUT /api/organizations/me`
**Auth:** OrgAdminGuard

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | Required · max 255 |
| `address` | string | Optional · max 500 |
| `phone` | string | Optional · max 20 |
| `website` | string | Optional · max 255 |

---

### `CreateMemberDto`
**Endpoint:** `POST /api/organizations/me/members`
**Auth:** OrgAdminGuard

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | Required · min 2 |
| `email` | string | Required · valid email |
| `password` | string | Required · min 6 |
| `role` | enum | Required · `DOCTOR \| PHARMACIST` |

**Service note:** Creates user + profile row in a transaction. Checks team limit from plan.

---

### `ChangePlanDto`
**Endpoint:** `PUT /api/organizations/me/plan`
**Auth:** OrgAdminGuard

| Field | Type | Rules |
|-------|------|-------|
| `plan` | string | Required · plan name (case-insensitive) |

---

### `InviteDto`
**Endpoint:** `POST /api/organizations/me/invite`
**Auth:** OrgAdminGuard
> ⚠️ Endpoint defined in DTO but **not yet wired** in the controller.

| Field | Type | Rules |
|-------|------|-------|
| `email` | string | Required · valid email |
| `role` | enum | Optional · `DOCTOR \| PHARMACIST` |
| `custom_role_id` | string | Optional |

---

### Organization Endpoints

| Method | Path | DTO | Guard |
|--------|------|-----|-------|
| `GET` | `/api/organizations/me` | — | Jwt |
| `PUT` | `/api/organizations/me` | `UpdateOrgDto` | OrgAdmin |
| `GET` | `/api/organizations/me/team` | — | Jwt |
| `POST` | `/api/organizations/me/members` | `CreateMemberDto` | OrgAdmin |
| `DELETE` | `/api/organizations/me/members/:memberId` | — | OrgAdmin |
| `PUT` | `/api/organizations/me/plan` | `ChangePlanDto` | OrgAdmin |

---

## 4. Role Module

Base path: `/api/roles`
All routes: `JwtAuthGuard`. Write operations: `OrgAdminGuard`.

---

### `CreateRoleDto`
**Endpoint:** `POST /api/roles`
**Auth:** OrgAdminGuard

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | Required · max 100 |
| `display_name` | string | Required · max 100 |
| `base_role` | enum | Optional · `DOCTOR \| PHARMACIST \| VIEWER \| ADMIN` · default `DOCTOR` |
| `permissions` | object | Optional · `Record<string, boolean>` |
| `color` | string | Optional · hex color · default `#1D9E75` |
| `is_default` | boolean | Optional |

---

### `UpdateRoleDto`
**Endpoint:** `PUT /api/roles/:id`
**Auth:** OrgAdminGuard

| Field | Type | Rules |
|-------|------|-------|
| `display_name` | string | Optional · max 100 |
| `base_role` | enum | Optional · `DOCTOR \| PHARMACIST \| VIEWER \| ADMIN` |
| `permissions` | object | Optional |
| `color` | string | Optional |
| `is_default` | boolean | Optional |

---

### `AssignRoleDto`
**Endpoint:** `POST /api/roles/assign`
**Auth:** OrgAdminGuard

| Field | Type | Rules |
|-------|------|-------|
| `user_id` | string | Required |
| `role_id` | string | Required |

---

### Role Endpoints

| Method | Path | DTO | Guard |
|--------|------|-----|-------|
| `GET` | `/api/roles` | — | Jwt |
| `POST` | `/api/roles` | `CreateRoleDto` | OrgAdmin |
| `PUT` | `/api/roles/:id` | `UpdateRoleDto` | OrgAdmin |
| `DELETE` | `/api/roles/:id` | — | OrgAdmin |
| `POST` | `/api/roles/assign` | `AssignRoleDto` | OrgAdmin |

---

## 5. Hospital Module

Base path: `/api/organizations/me/hospitals`
All routes: `JwtAuthGuard`. Write operations: `OrgAdminGuard`.

---

### `CreateHospitalDto`
**Endpoint:** `POST /api/organizations/me/hospitals`
**Auth:** OrgAdminGuard

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | Required · min 2 · max 255 |
| `phone` | string | Optional · max 20 |
| `email` | string | Optional · valid email |
| `address_line1` | string | Required |
| `address_line2` | string | Optional |
| `city` | string | Required |
| `state` | string | Optional |
| `pincode` | string | Optional |
| `admin_name` | string | Required |
| `admin_email` | string | Required · valid email |
| `admin_password` | string | Required · min 6 |

---

### `UpdateHospitalDto`
**Endpoint:** `PUT /api/organizations/me/hospitals/:id`
**Auth:** OrgAdminGuard

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | Optional · min 2 · max 255 |
| `phone` | string | Optional · max 20 |
| `email` | string | Optional · valid email |
| `status` | enum | Optional · `ACTIVE \| SUSPENDED` |

---

### `UpsertAddressDto`
**Endpoint:** `PUT /api/organizations/me/hospitals/:id/address`
**Auth:** OrgAdminGuard

| Field | Type | Rules |
|-------|------|-------|
| `address_line1` | string | Optional |
| `address_line2` | string | Optional |
| `city` | string | Optional |
| `state` | string | Optional |
| `pincode` | string | Optional |
| `lat` | number | Optional · -90 to 90 |
| `lng` | number | Optional · -180 to 180 |

**Service note:** `INSERT ... ON DUPLICATE KEY UPDATE` on `hospital_id`.

---

### Hospital Endpoints

| Method | Path | DTO | Guard |
|--------|------|-----|-------|
| `GET` | `/api/organizations/me/hospitals` | — | Jwt |
| `POST` | `/api/organizations/me/hospitals` | `CreateHospitalDto` | OrgAdmin |
| `GET` | `/api/organizations/me/hospitals/:id` | — | Jwt |
| `PUT` | `/api/organizations/me/hospitals/:id` | `UpdateHospitalDto` | OrgAdmin |
| `PUT` | `/api/organizations/me/hospitals/:id/address` | `UpsertAddressDto` | OrgAdmin |
| `GET` | `/api/organizations/me/hospitals/:id/staff` | — | Jwt |
| `POST` | `/api/organizations/me/hospitals/:id/staff` | `{ user_id }` | OrgAdmin |
| `DELETE` | `/api/organizations/me/hospitals/:id/staff/:userId` | — | OrgAdmin |
| `POST` | `/api/organizations/me/hospitals/:id/members` | `{ name, email, password, role }` | OrgAdmin |

> ⚠️ Doctor/Pharmacist profile endpoints live in the Hospital module controller:

| Method | Path | Guard |
|--------|------|-------|
| `GET` | `/api/profiles/doctors/me` | Jwt |
| `PUT` | `/api/profiles/doctors/me` | Jwt |
| `GET` | `/api/profiles/doctors/hospital/:hospitalId` | OrgAdmin |
| `GET` | `/api/profiles/pharmacists/me` | Jwt |
| `PUT` | `/api/profiles/pharmacists/me` | Jwt |
| `GET` | `/api/profiles/pharmacists/hospital/:hospitalId` | OrgAdmin |

---

## 6. Prescription Module

Base path: `/api/prescriptions`

> ⚠️ All routes in this controller still use `@Res()` + Express directly — `ResponseInterceptor` is bypassed. Frontend reads `res.data` directly (not `res.data.data`).

---

### `CreatePrescriptionDto`
**Endpoint:** `POST /api/prescriptions`
**Auth:** JwtAuthGuard + `RolesGuard(DOCTOR)`
**Content-Type:** `multipart/form-data` · `image` field optional (max 10MB, image/* or PDF)

| Field | Type | Rules |
|-------|------|-------|
| `patient_name` | string | Required |
| `patient_phone` | string | Required |
| `language` | string | Optional |
| `notes` | string | Optional |

**Service note:**
- `userId`, `orgId` come from JWT — never from body
- Image uploaded to S3 if provided
- Checks `org_usage_counters` against plan limit

---

### `AddMedicineDto`
**Endpoint:** `POST /api/prescriptions/:id/medicines`
**Auth:** JwtAuthGuard + `RolesGuard(PHARMACIST)`

| Field | Type | Rules |
|-------|------|-------|
| `prescription_id` | string | Required · ⚠️ redundant — `:id` param is used |
| `name` | string | Required |
| `quantity` | string | Optional |
| `frequency` | string | Required |
| `course` | string | Required |
| `description` | string | Optional |

---

### Prescription Endpoints (inline body — no separate DTO file)

| Method | Path | Body | Auth |
|--------|------|------|------|
| `PUT` | `/api/prescriptions/:id/render` | `{ video_url? }` | Jwt + DOCTOR/PHARMACIST |
| `PUT` | `/api/prescriptions/:id/status` | `{ status }` | Jwt + DOCTOR/PHARMACIST |
| `PUT` | `/api/prescriptions/:id/interpreted-data` | `{ medicines: [...] }` | Jwt + DOCTOR/PHARMACIST |

---

### Prescription Endpoints (no body)

| Method | Path | Guard |
|--------|------|-------|
| `GET` | `/api/prescriptions` | Jwt |
| `GET` | `/api/prescriptions/:id` | Jwt |
| `GET` | `/api/prescriptions/public/:token` | Public |
| `DELETE` | `/api/prescriptions/:id` | Jwt + DOCTOR |
| `GET` | `/api/prescriptions/medicines/search?q=` | Jwt |

---

## 7. Medicine Library Module

Base path: `/api/medicine-prescriptions`
**Auth:** `JwtAuthGuard` on all routes.

> Entire module undocumented previously. Backed by MongoDB (not MySQL).

| Method | Path | Body | Notes |
|--------|------|------|-------|
| `GET` | `/api/medicine-prescriptions` | — | List with query filter support |
| `POST` | `/api/medicine-prescriptions` | `body: any` | Create medicine library entry |
| `GET` | `/api/medicine-prescriptions/:id` | — | Single entry |
| `PUT` | `/api/medicine-prescriptions/:id` | `body: any` | Update entry |
| `POST` | `/api/medicine-prescriptions/:id/image` | `multipart · image` | Upload image to S3 |
| `DELETE` | `/api/medicine-prescriptions/:id` | — | Delete entry |

---

## 8. Guard Reference

| Guard | Class | How it works |
|-------|-------|-------------|
| `JwtAuthGuard` | `jwt-auth.guard.ts` | Validates Bearer token · sets `req.user` · rejects SUPERADMIN tokens |
| `OrgAdminGuard` | `org-admin.guard.ts` | Checks `req.user.isOrgAdmin === true` |
| `SuperAdminAuthGuard` | `superadmin-auth.guard.ts` | Validates superadmin-specific JWT via `SUPERADMIN_JWT_SECRET` |
| `RolesGuard` | `roles.guard.ts` | Used with `@Roles(...)` decorator · checks `req.user.role` |

---

## 9. JWT Payload Reference

### User token (`type: "USER"`)
```typescript
interface AuthenticatedUser {
  type: 'USER';
  userId: string;
  name: string;
  email: string;
  role: string;           // ORG_ADMIN | DOCTOR | PHARMACIST
  baseRole: string;
  orgId: string | null;
  hospitalId: string | null;
  isOrgAdmin: boolean;
  customRoleId: string | null;
}
```

### Superadmin token (`type: "SUPERADMIN"`)
```typescript
{
  type: 'SUPERADMIN';
  superAdminId: string;
  name: string;
  email: string;
}
```

### Refresh token (`type: "REFRESH"`)
- Only hash stored in DB — raw token is never persisted
- Rotated on every use

---

## 10. Full Endpoint Index

### Auth (`/api/auth`)
| Method | Path | DTO | Auth |
|--------|------|-----|------|
| POST | `/api/auth/login` | `LoginDto` | Public |
| POST | `/api/auth/superadmin/login` | `SuperadminLoginDto` | Public |
| POST | `/api/auth/register` | `RegisterDto` | Public |
| GET | `/api/auth/me` | — | Jwt |
| POST | `/api/auth/refresh` | — | Public |
| POST | `/api/auth/logout` | — | Public |
| POST | `/api/auth/forgot-password` | `ForgotPasswordDto` | Public |
| POST | `/api/auth/reset-password` | `ResetPasswordDto` | Public |

### Platform (`/api/superadmin`, `/plans`)
| Method | Path | DTO | Auth |
|--------|------|-----|------|
| GET | `/api/superadmin/dashboard` | — | SuperAdmin |
| GET | `/api/superadmin/organizations` | — | SuperAdmin |
| POST | `/api/superadmin/organizations` | `CreateOrgDto` | SuperAdmin |
| GET | `/api/superadmin/organizations/:id` | — | SuperAdmin |
| PUT | `/api/superadmin/organizations/:id` | body: any | SuperAdmin |
| DELETE | `/api/superadmin/organizations/:id` | — | SuperAdmin |
| GET | `/api/superadmin/users` | — | SuperAdmin |
| GET | `/plans` | — | Public |
| GET | `/plans/:id` | — | Public |
| POST | `/plans` | `CreatePlanDto` | SuperAdmin |
| PUT | `/plans/:id` | `Partial<CreatePlanDto>` | SuperAdmin |

### Organizations (`/api/organizations`)
| Method | Path | DTO | Auth |
|--------|------|-----|------|
| GET | `/api/organizations/me` | — | Jwt |
| PUT | `/api/organizations/me` | `UpdateOrgDto` | OrgAdmin |
| GET | `/api/organizations/me/team` | — | Jwt |
| POST | `/api/organizations/me/members` | `CreateMemberDto` | OrgAdmin |
| DELETE | `/api/organizations/me/members/:memberId` | — | OrgAdmin |
| PUT | `/api/organizations/me/plan` | `ChangePlanDto` | OrgAdmin |

### Roles (`/api/roles`)
| Method | Path | DTO | Auth |
|--------|------|-----|------|
| GET | `/api/roles` | — | Jwt |
| POST | `/api/roles` | `CreateRoleDto` | OrgAdmin |
| PUT | `/api/roles/:id` | `UpdateRoleDto` | OrgAdmin |
| DELETE | `/api/roles/:id` | — | OrgAdmin |
| POST | `/api/roles/assign` | `AssignRoleDto` | OrgAdmin |

### Hospitals (`/api/organizations/me/hospitals`)
| Method | Path | DTO | Auth |
|--------|------|-----|------|
| GET | `/api/organizations/me/hospitals` | — | Jwt |
| POST | `/api/organizations/me/hospitals` | `CreateHospitalDto` | OrgAdmin |
| GET | `/api/organizations/me/hospitals/:id` | — | Jwt |
| PUT | `/api/organizations/me/hospitals/:id` | `UpdateHospitalDto` | OrgAdmin |
| PUT | `/api/organizations/me/hospitals/:id/address` | `UpsertAddressDto` | OrgAdmin |
| GET | `/api/organizations/me/hospitals/:id/staff` | — | Jwt |
| POST | `/api/organizations/me/hospitals/:id/staff` | `{ user_id }` | OrgAdmin |
| DELETE | `/api/organizations/me/hospitals/:id/staff/:userId` | — | OrgAdmin |
| POST | `/api/organizations/me/hospitals/:id/members` | `{ name, email, password, role }` | OrgAdmin |

### Profiles (`/api/profiles`)
| Method | Path | DTO | Auth |
|--------|------|-----|------|
| GET | `/api/profiles/doctors/me` | — | Jwt |
| PUT | `/api/profiles/doctors/me` | body: any | Jwt |
| GET | `/api/profiles/doctors/hospital/:hospitalId` | — | OrgAdmin |
| GET | `/api/profiles/pharmacists/me` | — | Jwt |
| PUT | `/api/profiles/pharmacists/me` | body: any | Jwt |
| GET | `/api/profiles/pharmacists/hospital/:hospitalId` | — | OrgAdmin |

### Prescriptions (`/api/prescriptions`)
| Method | Path | DTO | Auth |
|--------|------|-----|------|
| POST | `/api/prescriptions` | `CreatePrescriptionDto` + file | Jwt + DOCTOR |
| GET | `/api/prescriptions` | — | Jwt |
| GET | `/api/prescriptions/public/:token` | — | Public |
| GET | `/api/prescriptions/medicines/search?q=` | — | Jwt |
| GET | `/api/prescriptions/:id` | — | Jwt |
| PUT | `/api/prescriptions/:id/render` | `{ video_url? }` | Jwt + DOCTOR/PHARMACIST |
| PUT | `/api/prescriptions/:id/status` | `{ status }` | Jwt + DOCTOR/PHARMACIST |
| PUT | `/api/prescriptions/:id/interpreted-data` | `{ medicines }` | Jwt + DOCTOR/PHARMACIST |
| POST | `/api/prescriptions/:id/medicines` | `AddMedicineDto` | Jwt + PHARMACIST |
| PUT | `/api/prescriptions/:id/medicines/:medId` | body: any | Jwt + PHARMACIST |
| DELETE | `/api/prescriptions/:id/medicines/:medId` | — | Jwt + PHARMACIST |
| DELETE | `/api/prescriptions/:id` | — | Jwt + DOCTOR |

### Medicine Library (`/api/medicine-prescriptions`)
| Method | Path | DTO | Auth |
|--------|------|-----|------|
| GET | `/api/medicine-prescriptions` | — | Jwt |
| POST | `/api/medicine-prescriptions` | body: any | Jwt |
| GET | `/api/medicine-prescriptions/:id` | — | Jwt |
| PUT | `/api/medicine-prescriptions/:id` | body: any | Jwt |
| POST | `/api/medicine-prescriptions/:id/image` | multipart · image | Jwt |
| DELETE | `/api/medicine-prescriptions/:id` | — | Jwt |

---

## 11. Known Issues / TODOs

| # | Location | Issue |
|---|----------|-------|
| 1 | `SuperadminController` | Uses `@Res()` + Express — bypasses `ResponseInterceptor`. Needs same cleanup as org module. |
| 2 | `PrescriptionsController` | Uses `@Res()` + Express throughout — bypasses `ResponseInterceptor`. |
| 3 | `MedicinePrescriptionsController` | Uses `@Res()` + Express throughout. |
| 4 | `AddMedicineDto` | Has `prescription_id` field in body — redundant since `:id` param is already used. |
| 5 | Profile PUT endpoints | Accept `body: any` — no DTOs defined for `UpdateDoctorProfileDto` / `UpdatePharmacistProfileDto`. |
| 6 | `InviteDto` | DTO exists but `POST /api/organizations/me/invite` endpoint not wired in controller. |
| 7 | `CreateOrgDto` plan enum | Accepts `ENTERPRISE` as alias for `ENT` but `CreatePlanDto` only accepts `ENT`. Should be unified. |
