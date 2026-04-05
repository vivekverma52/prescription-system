# DTO Mappings Reference

> All request DTOs with validation rules, endpoints, guards, and service notes.
> Updated to reflect latest clean design — user_roles junction, medicines in JSON,
> superadmin removed, all ENUM values aligned.
> Last updated: April 2026

---

## Table of Contents

1. [Auth Module](#1-auth-module)
2. [Platform Module (Superadmin)](#2-platform-module-superadmin)
3. [Organization Module](#3-organization-module)
4. [Role Module](#4-role-module)
5. [Hospital Module](#5-hospital-module)
6. [Profile Module](#6-profile-module)
7. [Prescription Module](#7-prescription-module)
8. [Guard Reference](#8-guard-reference)
9. [JWT Payload Reference](#9-jwt-payload-reference)
10. [Full Endpoint Index](#10-full-endpoint-index)

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

**Response:** `{ access_token, user }` + sets `refreshToken` HttpOnly cookie

**Service note:** Works for ALL roles including SUPERADMIN. No separate superadmin login endpoint needed.

---

### `RegisterDto`
**Endpoint:** `POST /api/auth/register`
**Auth:** Public

| Field | Type | Rules |
|-------|------|-------|
| `first_name` | string | Required · min 2 · max 100 |
| `last_name` | string | Required · min 1 · max 100 |
| `email` | string | Required · valid email |
| `password` | string | Required · min 6 |
| `role` | enum | Optional · `DOCTOR \| PHARMACIST` only (ORG_ADMIN via CreateOrg, SUPERADMIN never public) |
| `invite_token` | string | Optional · if present, role + org + hospital come from invitation |

**Response:** `{ access_token, user }` + sets `refreshToken` HttpOnly cookie

**Service note:**
- If `invite_token` present → look up `invitations` table → derive `org_id`, `hospital_id`, `role`
- Create `users` row → create profile row based on role → assign primary role via `user_roles`
- If no `invite_token` → defaults to `ORG_ADMIN` (self-registration for new org)

---

### Other Auth Endpoints (no DTO body)

| Method | Path | Notes | Auth |
|--------|------|-------|------|
| `GET` | `/api/auth/me` | Returns current user + primary role + permissions | JwtAuthGuard |
| `GET` | `/api/auth/check-invite` | `?token=<invite_token>` · returns invitation details | Public |
| `POST` | `/api/auth/refresh` | Reads `refreshToken` cookie · rotates token | Public |
| `POST` | `/api/auth/logout` | Revokes refresh token · clears cookie | Public |

---

## 2. Platform Module (Superadmin)

Base paths: `/api/superadmin`, `/plans`

**All `/api/superadmin/*` routes:** `JwtAuthGuard` + `RolesGuard(SUPERADMIN)`
**`/plans` GET routes:** Public

---

### `CreatePlanDto`
**Endpoints:** `POST /plans` · `PUT /plans/:id` (all fields optional for PUT)
**Auth:** SuperadminGuard

| Field | Type | Rules |
|-------|------|-------|
| `name` | enum | Required · `FREE \| PRO \| GROWTH \| ENTERPRISE` |
| `display_name` | string | Required · min 2 |
| `max_rx_per_month` | number | Required · min 0 (0 = unlimited) |
| `max_staff_per_hospital` | number | Required · min 0 |
| `max_hospitals` | number | Required · min 0 |
| `price_monthly` | number | Optional · min 0 |
| `price_yearly` | number | Optional · min 0 |
| `ocr_enabled` | boolean | Optional · default false |
| `overage_price_per_rx` | number | Optional · default 3.00 |

---

### `CreateOrgDto`
**Endpoint:** `POST /api/superadmin/organizations`
**Auth:** SuperadminGuard

| Field | Type | Rules |
|-------|------|-------|
| `org_name` | string | Required · min 2 |
| `plan` | enum | Optional · `FREE \| PRO \| GROWTH \| ENTERPRISE` |
| `admin_name` | string | Required · min 2 · split to first_name + last_name in service |
| `admin_email` | string | Required · valid email |
| `admin_password` | string | Required · min 6 |
| `address` | string | Optional |
| `phone` | string | Optional |
| `website` | string | Optional |

**Service effect (atomic):**
1. `INSERT organizations`
2. `INSERT users` with `role = ORG_ADMIN`
3. `INSERT org_admin_profiles` with `is_owner = 1`

---

### Superadmin Endpoints (no DTO body)

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/superadmin/dashboard` | Platform stats |
| `GET` | `/api/superadmin/organizations` | List all orgs |
| `GET` | `/api/superadmin/organizations/:id` | Single org with plan + hospitals |
| `PUT` | `/api/superadmin/organizations/:id` | Update org |
| `DELETE` | `/api/superadmin/organizations/:id` | Soft delete org |
| `GET` | `/api/superadmin/users` | List all users across all orgs |
| `GET` | `/plans` | Public · list active plans |
| `GET` | `/plans/:id` | Public · single plan |

---

## 3. Organization Module

Base path: `/api/organizations`
All routes: `JwtAuthGuard`. Write operations: `OrgAdminGuard`.

---

### `InviteDto`
**Endpoint:** `POST /api/organizations/me/invite`
**Auth:** OrgAdminGuard

| Field | Type | Rules |
|-------|------|-------|
| `email` | string | Required · valid email |
| `role` | enum | Optional · `DOCTOR \| PHARMACIST` |
| `hospital_id` | string | Optional · UUID · which hospital to assign to |
| `custom_role_id` | string | Optional · UUID · specific role from `roles` table to assign |

**Service effect:**
1. `INSERT invitations` with token (UUID) + expires_at (now + 48h)
2. Send invite email with link: `/register?token=<token>`

---

### Organization Endpoints (no DTO)

| Method | Path | Guard | Notes |
|--------|------|-------|-------|
| `GET` | `/api/organizations/me` | Jwt | Current org + plan + usage stats |
| `PUT` | `/api/organizations/me` | OrgAdmin | Update name / gstin / logo_key |
| `GET` | `/api/organizations/me/team` | Jwt | All members + pending invites |
| `POST` | `/api/organizations/me/members` | OrgAdmin | Add member directly without invite |
| `DELETE` | `/api/organizations/me/members/:userId` | OrgAdmin | Remove member (soft delete user) |
| `DELETE` | `/api/organizations/me/invites/:inviteId` | OrgAdmin | Cancel pending invite |
| `PUT` | `/api/organizations/me/plan` | OrgAdmin | Upgrade / change plan |

---

## 4. Role Module

Base path: `/api/roles`
All routes: `JwtAuthGuard`. Write operations: `OrgAdminGuard`.

---

### `CreateRoleDto`
**Endpoints:** `POST /api/roles` · `PUT /api/roles/:id` (all fields optional for PUT)
**Auth:** OrgAdminGuard

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | Required · min 2 · max 100 |
| `hospital_id` | string | Optional · UUID · if absent = org-level (legacy) |
| `permissions` | object | Optional · `RolePermissions` interface |

**Example permissions object:**
```json
{
  "write_rx": false,
  "read_rx": true,
  "claim_rx": true,
  "render_video": true,
  "send_whatsapp": true,
  "manage_staff": false,
  "view_analytics": false,
  "manage_hospital": false
}
```

---

### `AssignRoleDto`
**Endpoint:** `POST /api/roles/assign`
**Auth:** OrgAdminGuard

| Field | Type | Rules |
|-------|------|-------|
| `user_id` | string | Required · UUID |
| `role_id` | string | Required · UUID |
| `is_primary` | boolean | Optional · sets this as the JWT role |

**Service effect:**
1. `INSERT user_roles (user_id, role_id, is_primary)`
2. If `is_primary = true` → `UPDATE user_roles SET is_primary = 0 WHERE user_id = ? AND id != ?` first
3. `UNIQUE(user_id, role_id)` handles duplicate assignment gracefully

---

### Role Endpoints (no DTO)

| Method | Path | Guard | Notes |
|--------|------|-------|-------|
| `GET` | `/api/roles` | Jwt | List all roles for current hospital |
| `DELETE` | `/api/roles/:id` | OrgAdmin | Delete role (blocked if `is_system = 1`) |
| `GET` | `/api/roles/:id/users` | OrgAdmin | All users assigned to this role |
| `DELETE` | `/api/roles/:id/users/:userId` | OrgAdmin | Remove role from user (DELETE user_roles row) |

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
| `address_line` | string | Required · maps to `address_line1` |
| `city` | string | Required |
| `state` | string | Optional |
| `pincode` | string | Optional · max 10 |
| `admin_name` | string | Required · split to first_name + last_name in service |
| `admin_email` | string | Required · valid email |
| `admin_password` | string | Required · min 6 |
| `waba_phone_number` | string | Optional · set up later |
| `tts_language` | enum | Optional · `hi-IN \| ta-IN \| bn-IN \| te-IN \| mr-IN \| gu-IN \| kn-IN \| ml-IN` |

**Service effect (atomic):**
1. `INSERT hospitals`
2. `INSERT hospital_addresses`
3. `INSERT users` with `role = ORG_ADMIN`
4. `INSERT org_admin_profiles` with `org_id` + `is_owner = 0`
5. Create default system roles: DOCTOR role + PHARMACIST role in `roles` with `is_system = 1`

---

### `UpdateHospitalDto`
**Endpoint:** `PUT /api/organizations/me/hospitals/:id`
**Auth:** OrgAdminGuard

| Field | Type | Rules |
|-------|------|-------|
| `name` | string | Optional · min 2 · max 255 |
| `status` | enum | Optional · `ACTIVE \| SUSPENDED` |
| `tts_language` | string | Optional · language code |

---

### `UpsertAddressDto`
**Endpoint:** `PUT /api/organizations/me/hospitals/:id/address`
**Auth:** OrgAdminGuard

| Field | Type | Rules |
|-------|------|-------|
| `address_line` | string | Optional · maps to `address_line1` |
| `address_line2` | string | Optional |
| `city` | string | Optional |
| `state` | string | Optional |
| `pincode` | string | Optional · max 10 |
| `lat` | number | Optional · -90 to 90 |
| `lng` | number | Optional · -180 to 180 |

**Service note:** `INSERT ... ON DUPLICATE KEY UPDATE` on `hospital_id` (upsert).

---

### Hospital Endpoints (no DTO)

| Method | Path | Guard | Notes |
|--------|------|-------|-------|
| `GET` | `/api/organizations/me/hospitals` | Jwt | List all hospitals in org |
| `GET` | `/api/organizations/me/hospitals/:id` | Jwt | Single hospital + address |
| `DELETE` | `/api/organizations/me/hospitals/:id` | OrgAdmin | Soft delete |
| `GET` | `/api/organizations/me/hospitals/:id/staff` | Jwt | All staff in hospital |
| `DELETE` | `/api/organizations/me/hospitals/:id/staff/:userId` | OrgAdmin | Remove staff from hospital |

---

## 6. Profile Module

Base path: `/api/profiles`
All routes: `JwtAuthGuard`.

---

### `UpdateDoctorProfileDto`
**Endpoint:** `PUT /api/profiles/doctors/me`
**Auth:** JwtAuthGuard + `role = DOCTOR`

| Field | Type | Rules |
|-------|------|-------|
| `specialization` | string | Optional · max 200 |
| `registration_number` | string | Optional · max 100 |

**Note:** `signature_key` is set via file upload endpoint, not this DTO.

---

### `UpdatePharmacistProfileDto`
**Endpoint:** `PUT /api/profiles/pharmacists/me`
**Auth:** JwtAuthGuard + `role = PHARMACIST`

| Field | Type | Rules |
|-------|------|-------|
| `pharmacy_registration` | string | Optional · max 100 |

---

### Profile Endpoints (no DTO)

| Method | Path | Guard | Notes |
|--------|------|-------|-------|
| `GET` | `/api/profiles/doctors/me` | Jwt | Current doctor's profile |
| `GET` | `/api/profiles/doctors/hospital/:hospitalId` | OrgAdmin | All doctors in a hospital |
| `GET` | `/api/profiles/pharmacists/me` | Jwt | Current pharmacist's profile |
| `GET` | `/api/profiles/pharmacists/hospital/:hospitalId` | OrgAdmin | All pharmacists in hospital |
| `GET` | `/api/profiles/org-admins/me` | Jwt | Current org-admin profile |

---

## 7. Prescription Module

Base path: `/api/prescriptions`

---

### `CreatePrescriptionDto`
**Endpoint:** `POST /api/prescriptions`
**Auth:** JwtAuthGuard + `RolesGuard(DOCTOR)`
**Content-Type:** `multipart/form-data` · `image` field required

| Field | Type | Rules |
|-------|------|-------|
| `patient_name` | string | Required · min 2 · max 255 |
| `patient_phone` | string | Required · 10 digits · Indian format `/^[6-9]\d{9}$/` |
| `language` | string | Optional · default `hi-IN` |
| `notes` | string | Optional |

**Service note:**
- `hospital_id` and `org_id` come from JWT — never from request body
- `doctor_id` = `req.user.userId`
- Upload image → S3 → store `image_key` (not URL)
- If `plan.ocr_enabled = true` → call Azure OCR → save to `interpreted_data`
- Increment `org_usage_counters.rx_count` or `overage_count`
- Generate `access_token` (UUID) for public patient URL

---

### `ClaimPrescriptionDto`
**Endpoint:** `POST /api/prescriptions/:id/claim`
**Auth:** JwtAuthGuard + `RolesGuard(PHARMACIST)` + `permission: claim_rx`
**Body:** None — pharmacist_id comes from JWT

**Service note:**
- Verify `prescription.hospital_id === req.user.hospitalId` (tenant check)
- Verify `status = UPLOADED` else throw 409
- `UPDATE prescriptions SET status = 'CLAIMED'`

---

### `UpdateInterpretedDataDto`
**Endpoint:** `PUT /api/prescriptions/:id/interpreted-data`
**Auth:** JwtAuthGuard + `RolesGuard(DOCTOR, PHARMACIST)`

| Field | Type | Rules |
|-------|------|-------|
| `data` | object | Required · `InterpretedData` shape |

**Shape of `data`:**
```json
{
  "medicines": [
    {
      "name": "Paracetamol 500mg",
      "frequency": "1-0-1",
      "course": "5 days",
      "instructions": "After food",
      "image_key": "medicines/paracetamol.jpg",
      "sort_order": 1
    }
  ]
}
```

---

### `RenderAndSendDto`
**Endpoint:** `PUT /api/prescriptions/:id/render`
**Auth:** JwtAuthGuard + `RolesGuard(PHARMACIST)` + `permission: render_video`

| Field | Type | Rules |
|-------|------|-------|
| `language` | string | Optional · overrides `hospital.tts_language` |
| `test_phone` | string | Optional · dev/test only · send to this number instead |

**Service effect:**
1. Verify `status = CLAIMED`
2. `UPDATE status = 'PROCESSING'`
3. Push job to AWS SQS: `{ prescriptionId, hospitalId, orgId, idempotencyKey }`
4. Return immediately — pharmacist moves to next prescription
5. Lambda worker: FFmpeg + Azure TTS → MP4 → S3 → WhatsApp API → `status = SENT`

---

### `UpdatePrescriptionStatusDto`
**Endpoint:** `PUT /api/prescriptions/:id/status`
**Auth:** JwtAuthGuard + `RolesGuard(DOCTOR, PHARMACIST)`

| Field | Type | Rules |
|-------|------|-------|
| `status` | enum | Required · `UPLOADED \| CLAIMED \| PROCESSING \| RENDERED \| SENT` |

**Valid transitions:**
```
UPLOADED → CLAIMED → PROCESSING → RENDERED → SENT
CLAIMED  → UPLOADED (unclaim)
```

---

### Prescription Endpoints (no DTO)

| Method | Path | Guard | Notes |
|--------|------|-------|-------|
| `GET` | `/api/prescriptions` | Jwt | List Rx for current hospital (scoped by JWT.hospitalId) |
| `GET` | `/api/prescriptions/pending` | Jwt + PHARMACIST | All UPLOADED Rx for pharmacist queue |
| `GET` | `/api/prescriptions/public/:token` | Public | Patient-facing view · no auth |
| `GET` | `/api/prescriptions/:id` | Jwt | Full Rx + interpreted_data (all medicines) |
| `DELETE` | `/api/prescriptions/:id` | Jwt + DOCTOR | Soft delete |

---

## 8. Guard Reference

| Guard | How it works |
|-------|-------------|
| `JwtAuthGuard` | Validates Bearer token. Sets `req.user` as `JwtPayload`. |
| `RolesGuard` | Used with `@Roles(UserRole.DOCTOR)`. Checks `req.user.role` ENUM. |
| `PermissionGuard` | Used with `@Permission('render_video')`. Checks `req.user.permissions`. |
| `OrgAdminGuard` | Checks `req.user.role === ORG_ADMIN`. Used for org management routes. |
| `SuperadminGuard` | Checks `req.user.role === SUPERADMIN`. Used for platform routes. |
| `HospitalScopeGuard` | Checks resource `hospital_id === req.user.hospitalId`. Prevents cross-hospital access. |

**Guard stacking example:**
```typescript
@Post(':id/render')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
@Roles(UserRole.PHARMACIST)
@Permission('render_video')
async renderAndSend(...) {}
```

---

## 9. JWT Payload Reference

```typescript
interface JwtPayload {
  userId:      string;           // users.id
  orgId:       string;           // organization id
  hospitalId:  string;           // hospital id (empty for ORG_ADMIN / SUPERADMIN)
  role:        UserRole;         // SUPERADMIN | ORG_ADMIN | DOCTOR | PHARMACIST
  profileId:   string;           // primary user_roles.id
  roleId:      string | null;    // primary roles.id
  permissions: RolePermissions;  // merged from ALL assigned roles
  iat:         number;
  exp:         number;
}
```

**Key rule:** `hospitalId` in JWT means every query is automatically hospital-scoped. Never accept `hospital_id` in request body — always read from `req.user.hospitalId`.

**Access pattern:**
```typescript
// System access
if (req.user.role === UserRole.SUPERADMIN)  // full platform
if (req.user.role === UserRole.ORG_ADMIN)   // full org

// Feature access
if (req.user.permissions.render_video)      // can trigger video
if (req.user.permissions.send_whatsapp)     // can send WhatsApp
if (req.user.permissions.view_analytics)    // can see dashboards
```

---

## 10. Full Endpoint Index

### Auth (`/api/auth`)
| Method | Path | DTO | Auth |
|--------|------|-----|------|
| POST | `/api/auth/login` | `LoginDto` | Public |
| POST | `/api/auth/register` | `RegisterDto` | Public |
| GET | `/api/auth/me` | — | Jwt |
| GET | `/api/auth/check-invite` | `?token=` | Public |
| POST | `/api/auth/refresh` | — | Public |
| POST | `/api/auth/logout` | — | Public |

### Platform (`/api/superadmin`, `/plans`)
| Method | Path | DTO | Auth |
|--------|------|-----|------|
| GET | `/api/superadmin/dashboard` | — | Superadmin |
| GET | `/api/superadmin/organizations` | — | Superadmin |
| POST | `/api/superadmin/organizations` | `CreateOrgDto` | Superadmin |
| GET | `/api/superadmin/organizations/:id` | — | Superadmin |
| PUT | `/api/superadmin/organizations/:id` | — | Superadmin |
| DELETE | `/api/superadmin/organizations/:id` | — | Superadmin |
| GET | `/api/superadmin/users` | — | Superadmin |
| GET | `/plans` | — | Public |
| GET | `/plans/:id` | — | Public |
| POST | `/plans` | `CreatePlanDto` | Superadmin |
| PUT | `/plans/:id` | `UpdatePlanDto` | Superadmin |

### Organizations (`/api/organizations`)
| Method | Path | DTO | Auth |
|--------|------|-----|------|
| GET | `/api/organizations/me` | — | Jwt |
| PUT | `/api/organizations/me` | — | OrgAdmin |
| GET | `/api/organizations/me/team` | — | Jwt |
| POST | `/api/organizations/me/invite` | `InviteDto` | OrgAdmin |
| POST | `/api/organizations/me/members` | — | OrgAdmin |
| DELETE | `/api/organizations/me/members/:userId` | — | OrgAdmin |
| DELETE | `/api/organizations/me/invites/:inviteId` | — | OrgAdmin |
| PUT | `/api/organizations/me/plan` | — | OrgAdmin |

### Roles (`/api/roles`)
| Method | Path | DTO | Auth |
|--------|------|-----|------|
| GET | `/api/roles` | — | Jwt |
| POST | `/api/roles` | `CreateRoleDto` | OrgAdmin |
| PUT | `/api/roles/:id` | `UpdateRoleDto` | OrgAdmin |
| DELETE | `/api/roles/:id` | — | OrgAdmin |
| POST | `/api/roles/assign` | `AssignRoleDto` | OrgAdmin |
| GET | `/api/roles/:id/users` | — | OrgAdmin |
| DELETE | `/api/roles/:id/users/:userId` | — | OrgAdmin |

### Hospitals (`/api/organizations/me/hospitals`)
| Method | Path | DTO | Auth |
|--------|------|-----|------|
| GET | `/api/organizations/me/hospitals` | — | Jwt |
| POST | `/api/organizations/me/hospitals` | `CreateHospitalDto` | OrgAdmin |
| GET | `/api/organizations/me/hospitals/:id` | — | Jwt |
| PUT | `/api/organizations/me/hospitals/:id` | `UpdateHospitalDto` | OrgAdmin |
| DELETE | `/api/organizations/me/hospitals/:id` | — | OrgAdmin |
| PUT | `/api/organizations/me/hospitals/:id/address` | `UpsertAddressDto` | OrgAdmin |
| GET | `/api/organizations/me/hospitals/:id/staff` | — | Jwt |
| DELETE | `/api/organizations/me/hospitals/:id/staff/:userId` | — | OrgAdmin |

### Profiles (`/api/profiles`)
| Method | Path | DTO | Auth |
|--------|------|-----|------|
| GET | `/api/profiles/doctors/me` | — | Jwt |
| PUT | `/api/profiles/doctors/me` | `UpdateDoctorProfileDto` | Jwt |
| GET | `/api/profiles/doctors/hospital/:id` | — | OrgAdmin |
| GET | `/api/profiles/pharmacists/me` | — | Jwt |
| PUT | `/api/profiles/pharmacists/me` | `UpdatePharmacistProfileDto` | Jwt |
| GET | `/api/profiles/pharmacists/hospital/:id` | — | OrgAdmin |
| GET | `/api/profiles/org-admins/me` | — | Jwt |

### Prescriptions (`/api/prescriptions`)
| Method | Path | DTO | Auth |
|--------|------|-----|------|
| POST | `/api/prescriptions` | `CreatePrescriptionDto` + file | Jwt + DOCTOR |
| GET | `/api/prescriptions` | — | Jwt |
| GET | `/api/prescriptions/pending` | — | Jwt + PHARMACIST |
| GET | `/api/prescriptions/public/:token` | — | Public |
| GET | `/api/prescriptions/:id` | — | Jwt |
| POST | `/api/prescriptions/:id/claim` | — (no body) | Jwt + PHARMACIST |
| PUT | `/api/prescriptions/:id/interpreted-data` | `UpdateInterpretedDataDto` | Jwt + DOCTOR/PHARMACIST |
| PUT | `/api/prescriptions/:id/render` | `RenderAndSendDto` (optional) | Jwt + PHARMACIST |
| PUT | `/api/prescriptions/:id/status` | `UpdatePrescriptionStatusDto` | Jwt + DOCTOR/PHARMACIST |
| DELETE | `/api/prescriptions/:id` | — | Jwt + DOCTOR |
