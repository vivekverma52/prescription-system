# Database Entities Reference

> Auto-generated from latest clean design.
> All legacy tables removed. All relations verified.
> Last updated: April 2026

---

## Table of Contents

1. [Shared Types](#1-shared-types)
2. [users](#2-users)
3. [user_roles](#3-user_roles)
4. [roles](#4-roles)
5. [doctor_profiles](#5-doctor_profiles)
6. [pharmacist_profiles](#6-pharmacist_profiles)
7. [org_admin_profiles](#7-org_admin_profiles)
8. [refresh_tokens](#8-refresh_tokens)
9. [plans](#9-plans)
10. [organizations](#10-organizations)
11. [hospitals](#11-hospitals)
12. [hospital_addresses](#12-hospital_addresses)
13. [invitations](#13-invitations)
14. [prescriptions](#14-prescriptions)
15. [org_usage_counters](#15-org_usage_counters)
16. [Entity Relationships](#16-entity-relationships)
17. [Removed Tables](#17-removed-tables)

---

## 1. Shared Types

> File: `src/shared/types/index.ts`
> Single source of truth for all enums and interfaces. Import from here everywhere.

### UserRole ENUM
| Value | Description |
|-------|-------------|
| `SUPERADMIN` | Platform owner (Askim Tech). No profile table needed. |
| `ORG_ADMIN` | Manages one organization and all its hospitals. |
| `DOCTOR` | Uploads prescriptions. Scoped to one hospital. |
| `PHARMACIST` | Processes prescriptions, triggers video. Scoped to one hospital. |

### UserStatus ENUM
`ACTIVE` | `SUSPENDED` | `INVITED`

### OrgStatus ENUM
`ACTIVE` | `SUSPENDED` | `TRIAL`

### BillingCycle ENUM
`MONTHLY` | `YEARLY`

### HospitalStatus ENUM
`ACTIVE` | `SUSPENDED`

### PrescriptionStatus ENUM
| Value | Meaning |
|-------|---------|
| `UPLOADED` | Doctor uploaded scan. Waiting for pharmacist. |
| `CLAIMED` | Pharmacist claimed it. Locked to that pharmacist. |
| `PROCESSING` | Video render job queued in SQS. |
| `RENDERED` | Video generated. Ready to send. |
| `SENT` | WhatsApp delivered to patient. Terminal state. |

### MedicineFrequency ENUM
| Value | Meaning |
|-------|---------|
| `1-0-0` | Morning only |
| `0-1-0` | Afternoon only |
| `0-0-1` | Night only |
| `1-1-0` | Morning + Afternoon |
| `1-0-1` | Morning + Night |
| `0-1-1` | Afternoon + Night |
| `1-1-1` | Three times a day |
| `1-1-1-1` | Four times a day |

### RolePermissions Interface
```typescript
interface RolePermissions {
  write_rx?:        boolean; // upload / create prescriptions
  read_rx?:         boolean; // view prescriptions
  claim_rx?:        boolean; // pharmacist claim workflow
  render_video?:    boolean; // trigger video generation
  send_whatsapp?:   boolean; // send WhatsApp to patient
  manage_staff?:    boolean; // invite / remove staff
  view_analytics?:  boolean; // org / hospital analytics
  manage_hospital?: boolean; // update hospital settings
}
```

### JwtPayload Interface
```typescript
interface JwtPayload {
  userId:      string;           // users.id
  orgId:       string;           // from org or profile
  hospitalId:  string;           // from profile
  role:        UserRole;         // system-level ENUM
  profileId:   string;           // primary user_roles.id
  roleId:      string | null;    // primary roles.id
  permissions: RolePermissions;  // merged from ALL assigned roles
  iat:         number;
  exp:         number;
}
```

### InterpretedData Interface
> Stored in `prescriptions.interpreted_data` JSON column.
> Medicines live here — no separate medicines table.

```typescript
interface InterpretedData {
  doctor?: {
    name?:           string;
    specialization?: string;
    registration?:   string;
  };
  hospital?: {
    name?:    string;
    address?: string;
  };
  patient?: {
    name?:   string;
    age?:    string;
    gender?: string;
  };
  medicines?: Array<{
    name?:         string;
    dosage?:       string;
    frequency?:    MedicineFrequency | string;
    course?:       string;
    instructions?: string;
    image_key?:    string;   // S3 key for medicine image
    sort_order?:   number;   // video slide sequence
  }>;
}
```

---

## 2. users

Central auth table. Every person in the system — superadmin, org admin, doctor, pharmacist — has exactly one row here.

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) | PK · UUID |
| `email` | VARCHAR(255) | UNIQUE |
| `password_hash` | VARCHAR(255) | bcryptjs |
| `role` | ENUM(UserRole) | System-level role |
| `org_id` | VARCHAR(36) | FK → organizations.id · SET NULL · denormalised for fast lookup |
| `hospital_id` | VARCHAR(36) | FK → hospitals.id · SET NULL · denormalised for fast lookup |
| `first_name` | VARCHAR(100) | Nullable |
| `last_name` | VARCHAR(100) | Nullable |
| `phone` | VARCHAR(20) | Nullable |
| `status` | ENUM(UserStatus) | Default: `INVITED` |
| `last_login_at` | TIMESTAMP | Nullable |
| `created_at` | TIMESTAMP | Auto |
| `deleted_at` | TIMESTAMP | Soft delete |

**Relations:**
- `user_roles` → OneToMany via `user_roles.user_id`
- `doctorProfile` → OneToOne via `doctor_profiles.user_id`
- `pharmacistProfile` → OneToOne via `pharmacist_profiles.user_id`
- `refreshTokens` → OneToMany via `refresh_tokens.user_id`

**Entity file:** `src/database/entities/user.entity.ts`

---

## 3. user_roles

**Junction table — the User ↔ Role mapping.**
One row = one user has one role. A user can have multiple roles across hospitals.

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) | PK · UUID |
| `user_id` | VARCHAR(36) | FK → users.id · CASCADE |
| `role_id` | VARCHAR(36) | FK → roles.id · CASCADE |
| `is_primary` | TINYINT(1) | 1 = this role loaded into JWT. Default: 0 |
| `created_at` | TIMESTAMP | Auto |

**Constraints:**
- `UNIQUE(user_id, role_id)` — one user cannot have same role twice
- `INDEX(user_id)` — fast: all roles for a user
- `INDEX(role_id)` — fast: all users with a role

**Relations:**
- `user` → ManyToOne → `users`
- `role` → ManyToOne → `roles`

**How it works:**
- Assign role: INSERT into user_roles
- Set primary: UPDATE is_primary = 1 (unset others first)
- Get permissions: load with `relations: ['role']`, merge `role.permissions`
- JWT build: find `is_primary = 1`, merge all permissions into flat object

**Entity file:** `src/database/entities/user-role.entity.ts`

---

## 4. roles

Hospital-scoped custom roles with permissions JSON.
Not to be confused with `users.role` (system-level ENUM).

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) | PK · UUID |
| `hospital_id` | VARCHAR(36) | FK → hospitals.id · CASCADE · always scoped |
| `name` | VARCHAR(100) | e.g. "Senior Doctor", "Head Pharmacist" |
| `permissions` | JSON | `RolePermissions` interface |
| `is_system` | TINYINT(1) | 1 = cannot be deleted (default DOCTOR / PHARMACIST roles) |
| `created_at` | TIMESTAMP | Auto |

**Relations:**
- `hospital` → ManyToOne → `hospitals`
- `userRoles` → OneToMany → `user_roles`

**Entity file:** `src/database/entities/role.entity.ts`

---

## 5. doctor_profiles

Extra metadata for users with `role = DOCTOR`.
Permissions come from `user_roles → roles`, not from this table.

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) | PK · UUID |
| `user_id` | VARCHAR(36) | FK → users.id · CASCADE · UNIQUE |
| `hospital_id` | VARCHAR(36) | FK → hospitals.id · SET NULL |
| `specialization` | VARCHAR(200) | Nullable |
| `registration_number` | VARCHAR(100) | MCI / state council number |
| `signature_key` | VARCHAR(500) | S3 key for digital signature image |
| `created_at` | TIMESTAMP | Auto |

> Note: `role_id` column removed. Permissions managed via `user_roles` junction.

**Relations:**
- `user` → OneToOne → `users`
- `hospital` → ManyToOne → `hospitals`

**Entity file:** `src/database/entities/doctor-profile.entity.ts`

---

## 6. pharmacist_profiles

Extra metadata for users with `role = PHARMACIST`.
Permissions come from `user_roles → roles`, not from this table.

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) | PK · UUID |
| `user_id` | VARCHAR(36) | FK → users.id · CASCADE · UNIQUE |
| `hospital_id` | VARCHAR(36) | FK → hospitals.id · SET NULL |
| `pharmacy_registration` | VARCHAR(100) | Nullable |
| `created_at` | TIMESTAMP | Auto |

> Note: `role_id` column removed. Permissions managed via `user_roles` junction.

**Relations:**
- `user` → OneToOne → `users`
- `hospital` → ManyToOne → `hospitals`

**Entity file:** `src/database/entities/pharmacist-profile.entity.ts`

---

## 7. org_admin_profiles

Extended profile for users with `role = ORG_ADMIN`.
No custom role assigned — ORG_ADMIN has full org access by default.

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) | PK · UUID |
| `user_id` | VARCHAR(36) | FK → users.id · CASCADE · UNIQUE |
| `org_id` | VARCHAR(36) | FK → organizations.id · CASCADE |
| `is_owner` | TINYINT(1) | 1 = can delete org / transfer ownership |
| `created_at` | TIMESTAMP | Auto |

**Relations:**
- `user` → OneToOne → `users`
- `organization` → ManyToOne → `organizations`

**Entity file:** `src/database/entities/org-admin-profile.entity.ts`

---

## 8. refresh_tokens

JWT refresh token storage with rotation support.

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) | PK · UUID |
| `user_id` | VARCHAR(36) | FK → users.id · CASCADE |
| `token_hash` | VARCHAR(255) | SHA-256 hash · UNIQUE · never store raw token |
| `expires_at` | TIMESTAMP | 30 days from issue |
| `ip_address` | VARCHAR(45) | IPv4 or IPv6 |
| `revoked_at` | TIMESTAMP | Nullable · set on logout or rotation |
| `created_at` | TIMESTAMP | Auto |

**Relations:**
- `user` → ManyToOne → `users`

**Entity file:** `src/database/entities/refresh-token.entity.ts`

---

## 9. plans

Subscription plans. Managed by superadmin only.

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) | PK · UUID |
| `name` | VARCHAR(50) | UNIQUE · `FREE \| PRO \| GROWTH \| ENTERPRISE` |
| `display_name` | VARCHAR(100) | Human-readable label |
| `price_monthly` | DECIMAL(10,2) | INR |
| `price_yearly` | DECIMAL(10,2) | INR |
| `max_hospitals` | INT | 0 = unlimited |
| `max_staff_per_hospital` | INT | 0 = unlimited |
| `max_rx_per_month` | INT | 0 = unlimited |
| `ocr_enabled` | TINYINT(1) | 1 = AI OCR extraction enabled |
| `overage_price_per_rx` | DECIMAL(5,2) | Per Rx above quota. Default ₹3.00 |
| `is_active` | TINYINT(1) | 1 = visible/selectable |
| `created_at` | TIMESTAMP | Auto |

**Relations:**
- `organizations` → OneToMany → `organizations.plan_id`

**Entity file:** `src/database/entities/plan.entity.ts`

---

## 10. organizations

Top-level tenant. All hospitals and staff belong to one organization.

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) | PK · UUID |
| `name` | VARCHAR(200) | Display name |
| `slug` | VARCHAR(100) | UNIQUE · URL-safe |
| `plan_id` | VARCHAR(36) | FK → plans.id · SET NULL |
| `billing_cycle` | ENUM(BillingCycle) | `MONTHLY \| YEARLY` |
| `plan_started_at` | TIMESTAMP | Nullable |
| `plan_expires_at` | TIMESTAMP | Nullable |
| `status` | ENUM(OrgStatus) | Default: `TRIAL` |
| `gstin` | VARCHAR(20) | GST number for invoicing |
| `logo_key` | VARCHAR(500) | S3 key (not URL) |
| `created_at` | TIMESTAMP | Auto |
| `deleted_at` | TIMESTAMP | Soft delete |

**Relations:**
- `plan` → ManyToOne → `plans`
- `hospitals` → OneToMany → `hospitals.org_id`
- `orgAdmins` → OneToMany → `org_admin_profiles.org_id`
- `prescriptions` → OneToMany → `prescriptions.org_id`
- `usageCounters` → OneToMany → `org_usage_counters.org_id`
- `invitations` → OneToMany → `invitations.org_id`

**Entity file:** `src/database/entities/organization.entity.ts`

---

## 11. hospitals

A physical hospital/clinic owned by an organization.
Each hospital has one WhatsApp Business number for sending prescriptions.

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) | PK · UUID |
| `org_id` | VARCHAR(36) | FK → organizations.id · CASCADE |
| `name` | VARCHAR(200) | |
| `slug` | VARCHAR(100) | UNIQUE per org: `UNIQUE(org_id, slug)` |
| `waba_phone_number` | VARCHAR(20) | WhatsApp Business number |
| `waba_token` | VARCHAR(500) | ⚠ Move to AWS Secrets Manager in production |
| `waba_phone_id` | VARCHAR(100) | Meta phone_id for API calls |
| `tts_language` | VARCHAR(20) | Default `hi-IN` · Azure TTS language code |
| `status` | ENUM(HospitalStatus) | Default: `ACTIVE` |
| `created_at` | TIMESTAMP | Auto |
| `deleted_at` | TIMESTAMP | Soft delete |

**Relations:**
- `organization` → ManyToOne → `organizations`
- `address` → OneToOne → `hospital_addresses`
- `roles` → OneToMany → `roles.hospital_id`
- `doctorProfiles` → OneToMany → `doctor_profiles.hospital_id`
- `pharmacistProfiles` → OneToMany → `pharmacist_profiles.hospital_id`

**Entity file:** `src/database/entities/hospital.entity.ts`

---

## 12. hospital_addresses

One-to-one address record for each hospital. Normalized out of hospitals table.

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) | PK · UUID |
| `hospital_id` | VARCHAR(36) | FK → hospitals.id · CASCADE · UNIQUE |
| `address_line1` | VARCHAR(255) | Nullable |
| `address_line2` | VARCHAR(255) | Nullable |
| `city` | VARCHAR(100) | Nullable |
| `state` | VARCHAR(100) | Nullable |
| `pincode` | VARCHAR(10) | Nullable |
| `lat` | DECIMAL(10,8) | GPS latitude |
| `lng` | DECIMAL(11,8) | GPS longitude |
| `created_at` | TIMESTAMP | Auto |

**Relations:**
- `hospital` → OneToOne (owning side, JoinColumn here) → `hospitals`

**Entity file:** `src/database/entities/hospital-address.entity.ts`

---

## 13. invitations

Token-based staff onboarding. Org admins invite doctors and pharmacists.

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) | PK · UUID |
| `org_id` | VARCHAR(36) | FK → organizations.id · CASCADE |
| `hospital_id` | VARCHAR(36) | FK → hospitals.id · SET NULL · Nullable |
| `token` | VARCHAR(255) | UNIQUE · one-time token |
| `role` | ENUM | `DOCTOR \| PHARMACIST` |
| `email` | VARCHAR(255) | Invitee's email |
| `expires_at` | TIMESTAMP | 48 hours from creation |
| `accepted_at` | TIMESTAMP | Nullable · set when accepted |
| `created_at` | TIMESTAMP | Auto |

**Relations:**
- `organization` → ManyToOne → `organizations`
- `hospital` → ManyToOne → `hospitals`

**Entity file:** `src/database/entities/invitation.entity.ts`

---

## 14. prescriptions

Core transaction entity. One row per prescription.

> **Medicines are stored inside `interpreted_data` JSON — no separate medicines table.**

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) | PK · UUID |
| `org_id` | VARCHAR(36) | FK → organizations.id · SET NULL |
| `hospital_id` | VARCHAR(36) | FK → hospitals.id · SET NULL · **Required for isolation** |
| `doctor_id` | VARCHAR(36) | FK → users.id · CASCADE |
| `patient_name` | VARCHAR(255) | Nullable · from OCR or manual |
| `patient_phone` | VARCHAR(20) | Nullable · WhatsApp delivery target |
| `image_key` | VARCHAR(500) | S3 key of scanned prescription image |
| `video_key` | VARCHAR(500) | S3 key of generated MP4 video |
| `access_token` | VARCHAR(64) | UNIQUE · public URL token for patient |
| `status` | ENUM(PrescriptionStatus) | Default: `UPLOADED` |
| `rx_year` | SMALLINT | For usage counting |
| `rx_month` | TINYINT | For usage counting |
| `whatsapp_message_id` | VARCHAR(200) | Meta message ID for delivery tracking |
| `interpreted_data` | JSON | OCR output + medicines array (InterpretedData) |
| `language` | VARCHAR(20) | TTS language. Default `hi-IN` |
| `notes` | TEXT | Doctor notes |
| `created_at` | TIMESTAMP | Auto |

**Critical indexes:**
```sql
INDEX idx_rx_hospital_status (hospital_id, status, created_at DESC)
INDEX idx_rx_org_month       (org_id, rx_year, rx_month)
UNIQUE INDEX idx_rx_token    (access_token)
```

**Relations:**
- `organization` → ManyToOne → `organizations`
- `hospital` → ManyToOne → `hospitals`
- `doctor` → ManyToOne → `users`

**Entity file:** `src/database/entities/prescription.entity.ts`

---

## 15. org_usage_counters

Monthly prescription usage tracking per org (and optionally per hospital).
Used for plan enforcement and overage billing.

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) | PK · UUID |
| `org_id` | VARCHAR(36) | FK → organizations.id · CASCADE |
| `hospital_id` | VARCHAR(36) | Nullable · per-hospital breakdown |
| `rx_year` | SMALLINT | e.g. 2026 |
| `rx_month` | TINYINT | 1–12 |
| `rx_count` | INT UNSIGNED | Prescriptions within plan limit |
| `overage_count` | INT UNSIGNED | Prescriptions above plan limit |
| `created_at` | TIMESTAMP | Auto |

**Constraint:** `UNIQUE(org_id, hospital_id, rx_year, rx_month)`

**Relations:**
- `organization` → ManyToOne → `organizations`

**Entity file:** `src/database/entities/org-usage-counter.entity.ts`

---

## 16. Entity Relationships

```
plans (1)
  └── organizations (plan_id)
        ├── org_admin_profiles (org_id)
        │     └── users (user_id) ────────────────────────────────
        ├── hospitals (org_id)                                    │
        │     ├── hospital_addresses (hospital_id) [1:1]          │
        │     ├── roles (hospital_id)                             │
        │     │     └── user_roles (role_id) ──────────────── users (user_id)
        │     ├── doctor_profiles (hospital_id)                   │
        │     │     └── users (user_id) ──────────────────────────┘
        │     └── pharmacist_profiles (hospital_id)
        │           └── users (user_id)
        ├── invitations (org_id)
        ├── prescriptions (org_id + hospital_id)
        └── org_usage_counters (org_id)

users (centralized)
  ├── user_roles (user_id) ──── roles (role_id) [M:M via junction]
  ├── doctor_profiles (user_id)     [1:1]
  ├── pharmacist_profiles (user_id) [1:1]
  └── refresh_tokens (user_id)      [1:M]
```

---

## 17. Removed Tables

| Table | Why removed |
|-------|-------------|
| `superadmins` | Legacy standalone login. `users.role = SUPERADMIN` is sufficient. |
| `superadmin_profiles` | No extra fields needed for superadmin. Role ENUM is enough. |
| `medicines` | Medicines live in `prescriptions.interpreted_data` JSON. No JOIN needed. |
| `users.custom_role_id` | Replaced by `user_roles` junction table. |
| `users.org_id` (legacy) | Kept as denormalised column but no longer the source of truth. |
| `roles.org_id` | Roles are hospital-scoped only. No org-level roles. |
| `doctor_profiles.role_id` | Replaced by `user_roles` junction table. |
| `pharmacist_profiles.role_id` | Replaced by `user_roles` junction table. |

---

*Total tables: 14 (including user_roles junction)*
*Legacy tables removed: 3*
*Columns cleaned: 6*
