# MedScript — Product Documentation
### by Askim Technologies Pvt. Ltd.

> **A multi-tenant SaaS platform for digital prescription management.**
> Doctors upload prescriptions → Pharmacists add medicines & render multimedia → Patients receive via WhatsApp.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [User Roles & Hierarchy](#2-user-roles--hierarchy)
3. [Core Workflows](#3-core-workflows)
4. [Feature Set](#4-feature-set)
5. [Tech Stack](#5-tech-stack)
6. [Architecture](#6-architecture)
7. [Database Schema](#7-database-schema)
8. [API Reference](#8-api-reference)
9. [Frontend Routes](#9-frontend-routes)
10. [Subscription Plans & Limits](#10-subscription-plans--limits)
11. [Security & Auth](#11-security--auth)
12. [File Storage](#12-file-storage)
13. [Deployment Checklist](#13-deployment-checklist)
14. [Environment Variables](#14-environment-variables)
15. [SaaS Growth Considerations](#15-saas-growth-considerations)

---

## 1. Product Overview

**MedScript** is a B2B SaaS platform built for Indian healthcare providers — clinics, hospitals, and independent doctors — to manage prescriptions digitally and deliver them to patients via WhatsApp.

### The Problem
- Handwritten prescriptions are illegible, easily lost, and impossible to track
- Patients forget dosage instructions and medicine names
- Clinic teams (doctor + pharmacist) have no shared digital workspace
- No audit trail for prescriptions issued

### The Solution
A **3-role clinic platform**:
- **Admin** creates the clinic, manages the team
- **Doctor** uploads the prescription (photo) and patient details
- **Pharmacist** adds structured medicine data, renders a multimedia version, and sends it to the patient's WhatsApp

Patients get a unique QR-linked URL — viewable on any device, no app required.

---

## 2. User Roles & Hierarchy

```
Superadmin (Askim Technologies)
  └── Organization (Clinic / Hospital)
        ├── Admin (Org Owner)
        │     ├── Can invite / create Doctors & Pharmacists
        │     ├── Manages roles, settings, billing
        │     └── Cannot create prescriptions
        ├── Doctor
        │     ├── Uploads prescription image
        │     ├── Enters patient name + phone
        │     └── Views own prescriptions (read-only after upload)
        └── Pharmacist
              ├── Sees all org prescriptions
              ├── Adds medicines (name, dose, frequency, course)
              ├── Renders multimedia version
              ├── Downloads video
              └── Sends to patient via WhatsApp
```

### Role Detail

| Role | Base Role | Create Prescriptions | Add Medicines | Render/Send | Manage Team | Manage Billing |
|------|-----------|---------------------|---------------|-------------|-------------|----------------|
| Superadmin | — | — | — | — | All Orgs | All Orgs |
| Admin (Org Owner) | ADMIN | No | No | No | Yes | Yes |
| Doctor | DOCTOR | Yes | No | No | No | No |
| Pharmacist | PHARMACIST | No | Yes | Yes | No | No |

### Custom Roles
Org Admins can create **custom roles** on top of the 4 base roles:
- Custom display name + color
- Granular `permissions` (stored as JSON)
- Assigned per-user by org admin

---

## 3. Core Workflows

### 3.1 — Clinic Onboarding
```
1. Admin registers at /login → selects "Admin (Clinic Owner)" role
2. Backend auto-creates an Organization with FREE plan
3. Admin logs in → lands on /admin dashboard
4. Admin creates Doctor accounts (Team page → "Create Account" tab)
5. Admin creates Pharmacist accounts (same)
6. Team members log in with their credentials
```

### 3.2 — Prescription Lifecycle
```
DOCTOR:
  1. Navigates to /prescriptions/new
  2. Fills: Patient Name, Patient Phone, Language, Notes
  3. Uploads prescription image (photo or PDF)
  4. Submits → status: UPLOADED
  5. Redirected to /prescriptions list
  6. Notification text: "Prescription uploaded! Your pharmacist has been notified."

PHARMACIST:
  1. Sees new prescription in /pharmacist dashboard (5-second polling)
  2. Opens prescription → /pharmacist/prescriptions/:access_token
  3. Adds medicines: name, quantity, frequency, course, description
  4. Clicks "Render Multimedia" → status: RENDERED
  5. Downloads video (optional)
  6. Clicks "Send to Patient via WhatsApp" → opens wa.me link with message
  7. Status updates to: SENT

PATIENT:
  1. Receives WhatsApp message with a URL
  2. URL format: /public/:access_token (no login required)
  3. Sees: doctor name, patient name, language, prescription image, all medicines
```

### 3.3 — Prescription Status Flow
```
UPLOADED → RENDERED → SENT
```

### 3.4 — Invite Flow (Alternative to Direct Creation)
```
1. Admin goes to Team page → "Send Invite Link" tab
2. Enters email + selects role (Doctor / Pharmacist)
3. System generates 64-char token, stores in invitations table
4. Admin copies invite link: /login?invite={token}
5. Team member opens link → sees org name + role
6. Fills name + password to register
7. Joins org automatically, invite marked accepted
8. Invite expires after 7 days
```

---

## 4. Feature Set

### 4.1 — Prescription Management
- Upload prescription image (photo/PDF, max 10MB)
- Patient name, phone, language selection, notes
- Unique access token per prescription (16-char hex, used for public URLs)
- Full prescription detail view (doctor: read-only)
- List view with status badges (UPLOADED / RENDERED / SENT)
- Delete prescription (doctor only)
- Monthly usage counter per org

### 4.2 — Medicine Management
- Add medicines to prescription: name, quantity, frequency, course, description
- Optional medicine image upload (to S3)
- Edit / delete medicines
- Medicines auto-fetch on prescription detail
- Medicine reference catalog (MongoDB) for lookup

### 4.3 — Multimedia Rendering
- Pharmacist renders prescription (marks as RENDERED, stores video_url)
- Download rendered video
- Rendered content viewable on public page

### 4.4 — WhatsApp Delivery
- One-click WhatsApp send: `wa.me/91{phone}?text={message}`
- Message includes patient name + prescription URL
- Status auto-updates to SENT on click

### 4.5 — Public Prescription Page
- URL: `/public/:access_token`
- No login required
- Shows: doctor name, patient name, language, prescription image, all medicines
- QR code scannable to reach this URL

### 4.6 — Organisation Management
- Org profile: name, address, phone, website
- Usage dashboard: prescriptions this month, team count, plan
- Monthly usage bar with limit indicator
- Upgrade prompt when >80% usage reached

### 4.7 — Team Management
- Create team member directly (name, email, password, role)
- Send invite link (email-based)
- View all active members with roles + join dates
- View pending invites
- Cancel pending invite
- Remove member from org

### 4.8 — Roles & Permissions
- Create custom roles with display name, color, base role, JSON permissions
- Edit / delete custom roles
- Assign custom role to any org member
- Role color shown in team list

### 4.9 — Superadmin Portal
- Separate login (/superadmin/login)
- Dashboard: total orgs, total users, total prescriptions, monthly stats
- List all organizations (paginated)
- Create new organization with admin account
- View/edit any org (members, plan, status)
- Suspend / activate organization
- Delete organization
- Add members to any org

### 4.10 — Settings
- Profile settings (name, email, password)
- Organization settings (name, address, phone, website) — owner only
- Billing tab with plan upgrade options

### 4.11 — Medicine Reference Catalog
- MongoDB-backed medicine reference database
- Fields: medicine name, generic name, dosage, usage, drug category, alternatives, image
- Searchable, paginated list
- CRUD for catalog management
- Image upload per medicine entry

---

## 5. Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18 | UI framework |
| TypeScript | 5 | Type safety |
| React Router DOM | 6 | Client-side routing |
| React Hook Form | 7 | Form management |
| Axios (via api service) | — | HTTP client |
| React Hot Toast | — | Notifications |
| Tailwind CSS | 3 | Utility-first styling |
| Vite | 5 | Build tool / dev server |
| Canvas API | Native | Landing page animations |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| NestJS | 10 | Backend framework |
| TypeScript | 5 | Type safety |
| mysql2/promise | — | MySQL pool + raw SQL |
| Mongoose | — | MongoDB ODM |
| jsonwebtoken | — | JWT signing/verification |
| bcryptjs | — | Password hashing |
| @aws-sdk/client-s3 | — | S3 file upload |
| multer / multer-s3 | — | File upload middleware |
| helmet | — | Security headers |
| express-mongo-sanitize | — | NoSQL injection prevention |
| cookie-parser | — | Cookie parsing |
| class-validator | — | DTO validation |
| uuid | — | UUID generation |

### Databases
| Database | Usage |
|----------|-------|
| MySQL 8 | Users, orgs, prescriptions, medicines, invitations, roles, refresh tokens |
| MongoDB | Medicine reference catalog |

### Infrastructure
| Service | Purpose |
|---------|---------|
| AWS S3 | Prescription images, medicine images, video files |
| Any Node host | Backend (Render, Railway, EC2, etc.) |
| Any static host | Frontend (Vercel, Netlify, S3+CloudFront) |

---

## 6. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                    │
│  Landing → Login → Dashboard → Prescriptions → Settings  │
│  (Vite dev server / Static build → CDN)                  │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS REST API
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    BACKEND (NestJS)                       │
│                                                           │
│   ┌──────────┐  ┌───────────┐  ┌──────────┐             │
│   │   Auth   │  │Prescripts │  │  Orgs    │             │
│   └──────────┘  └───────────┘  └──────────┘             │
│   ┌──────────┐  ┌───────────┐  ┌──────────┐             │
│   │Medicines │  │  Roles   │  │Superadmin│             │
│   └──────────┘  └───────────┘  └──────────┘             │
│   ┌─────────────────────┐                                │
│   │  Medicine Catalog   │  (MongoDB module)              │
│   └─────────────────────┘                                │
│                                                           │
│   Global: JWT Guard │ Roles Guard │ OrgAdmin Guard        │
│           AllExceptionsFilter │ ValidationPipe            │
│           RequestIdInterceptor │ Helmet │ CORS            │
└───────────┬─────────────────────┬───────────────────────┘
            │                     │
    ┌───────▼──────┐    ┌─────────▼──────┐
    │   MySQL 8    │    │   MongoDB       │
    │  (Relational)│    │  (Medicine DB)  │
    └──────────────┘    └─────────────────┘
            │
    ┌───────▼──────┐
    │   AWS S3     │
    │  (Files)     │
    └──────────────┘
```

### Multi-Tenancy Model
- **Tenant = Organization** (a clinic or hospital)
- All data scoped by `org_id` on users, prescriptions tables
- Users belong to exactly one org
- Org admins see all org data; doctors see only their own prescriptions
- Pharmacists see all org prescriptions
- Superadmin crosses all tenant boundaries

---

## 7. Database Schema

### MySQL Tables

#### `superadmins`
```sql
id           VARCHAR(36) PRIMARY KEY
name         VARCHAR(255)
email        VARCHAR(255) UNIQUE
password     VARCHAR(255)           -- bcrypt hashed
created_at   TIMESTAMP
```

#### `organizations`
```sql
id                   VARCHAR(36) PRIMARY KEY
name                 VARCHAR(255)
slug                 VARCHAR(100) UNIQUE        -- URL-safe org identifier
plan                 ENUM('FREE','PRO','ENTERPRISE')  DEFAULT 'FREE'
prescription_limit   INT                        -- FREE:10, PRO:200, ENT:99999
team_limit           INT                        -- FREE:2, PRO:10, ENT:999
owner_id             VARCHAR(36)                -- FK → users.id
address              TEXT NULL
phone                VARCHAR(20) NULL
website              VARCHAR(255) NULL
status               ENUM('ACTIVE','SUSPENDED') DEFAULT 'ACTIVE'
created_at           TIMESTAMP
```

#### `users`
```sql
id             VARCHAR(36) PRIMARY KEY
name           VARCHAR(255)
email          VARCHAR(255) UNIQUE
password       VARCHAR(255)                     -- bcrypt hashed
role           ENUM('ADMIN','DOCTOR','PHARMACIST')  DEFAULT 'DOCTOR'
clinic_name    VARCHAR(255) NULL
org_id         VARCHAR(36) NULL                 -- FK → organizations.id
is_owner       TINYINT(1) DEFAULT 0             -- only 1 owner per org
is_org_admin   TINYINT(1) DEFAULT 0
custom_role_id VARCHAR(36) NULL                 -- FK → roles.id
created_at     TIMESTAMP
```

#### `roles`
```sql
id           VARCHAR(36) PRIMARY KEY
org_id       VARCHAR(36)              -- FK → organizations.id (CASCADE DELETE)
name         VARCHAR(100)             -- internal identifier
display_name VARCHAR(100)             -- shown in UI
base_role    ENUM('DOCTOR','PHARMACIST','VIEWER','ADMIN')
permissions  JSON
color        VARCHAR(20) DEFAULT '#1D9E75'
is_default   TINYINT(1) DEFAULT 0
created_at   TIMESTAMP
```

#### `prescriptions`
```sql
id             VARCHAR(36) PRIMARY KEY
doctor_id      VARCHAR(36)              -- FK → users.id (CASCADE DELETE)
doctor_name    VARCHAR(255)
patient_name   VARCHAR(255)
patient_phone  VARCHAR(20)
language       VARCHAR(50) DEFAULT 'English'
image_url      TEXT NULL                -- S3 URL
video_url      TEXT NULL                -- rendered video S3 URL
access_token   VARCHAR(50) UNIQUE       -- 16 hex chars for public URL
status         ENUM('UPLOADED','RENDERED','SENT') DEFAULT 'UPLOADED'
notes          TEXT NULL
org_id         VARCHAR(36) NULL         -- FK → organizations.id
created_at     TIMESTAMP
```

#### `medicines`
```sql
id               VARCHAR(36) PRIMARY KEY
prescription_id  VARCHAR(36)              -- FK → prescriptions.id (CASCADE)
name             VARCHAR(255)
quantity         VARCHAR(50) DEFAULT '1'
frequency        VARCHAR(255)
course           VARCHAR(100)
description      TEXT NULL
image_url        TEXT NULL                -- S3 URL
created_at       TIMESTAMP
```

#### `invitations`
```sql
id             VARCHAR(36) PRIMARY KEY
org_id         VARCHAR(36)              -- FK → organizations.id (CASCADE)
email          VARCHAR(255)
role           ENUM('ADMIN','DOCTOR','PHARMACIST')
custom_role_id VARCHAR(36) NULL         -- FK → roles.id
token          VARCHAR(64) UNIQUE
invited_by     VARCHAR(36)              -- FK → users.id
accepted_at    TIMESTAMP NULL
expires_at     TIMESTAMP                -- created_at + 7 days
created_at     TIMESTAMP
```

#### `refresh_tokens`
```sql
id         VARCHAR(36) PRIMARY KEY
user_id    VARCHAR(36)              -- FK → users.id (CASCADE)
token      VARCHAR(512) UNIQUE
expires_at TIMESTAMP
created_at TIMESTAMP
```

### MongoDB Collection

#### `medicine_prescriptions`
```js
{
  medicine_name:           String (required),
  generic_name:            String (required),
  dosage_description:      String (required),
  common_usage:            String (required),
  drug_category:           String (required),
  alternative_medicines:   [String],
  medicine_image:          String (optional, S3 URL),
  createdAt:               Date,
  updatedAt:               Date
}
```

---

## 8. API Reference

### Base URL
```
Development:  http://localhost:5000/api
Production:   https://your-backend.com/api
```

### Health Check
```
GET /api/health
→ { status: "ok", time: "...", env: "production" }
```

---

### Auth Endpoints

#### `POST /auth/register`
Register a new user. With `invite_token`: joins an existing org. Without: creates personal org (ADMIN/DOCTOR only).
```json
// Request
{
  "name": "Dr. Priya Sharma",
  "email": "priya@clinic.in",
  "password": "secure123",
  "role": "ADMIN",           // "ADMIN" | "DOCTOR" | "PHARMACIST"
  "clinic_name": "Sharma Clinic",
  "invite_token": null
}
// Response 201
{
  "token": "<access_jwt>",
  "refreshToken": "<refresh_jwt>",
  "user": { id, name, email, role, clinic_name, org_id, is_owner, is_org_admin }
}
```

#### `POST /auth/login`
```json
// Request
{ "email": "priya@clinic.in", "password": "secure123" }
// Response 200
{
  "token": "<access_jwt>",
  "refreshToken": "<refresh_jwt>",
  "user": { id, name, email, role, clinic_name, org_id, is_owner, is_org_admin, custom_role_id, role_display_name }
}
```

#### `GET /auth/me`  `🔒 JWT`
Returns full user profile with org and role metadata.

#### `GET /auth/check-invite?token=<64-char>`
Returns invite details before registration.
```json
{ "org_name": "Sharma Clinic", "email": "raj@example.com", "role": "DOCTOR", "role_display_name": null }
```

#### `POST /auth/refresh`
Rotates refresh token, issues new access + refresh pair.
```json
// Request
{ "refreshToken": "<old_refresh>" }
// Response
{ "token": "<new_access>", "refreshToken": "<new_refresh>" }
```

#### `POST /auth/logout`
Revokes refresh token from DB.

---

### Prescriptions Endpoints

#### `POST /prescriptions`  `🔒 JWT · DOCTOR`
Multipart form upload. Creates prescription with optional image.
```
Fields: patient_name*, patient_phone*, language, notes
File:   image (jpg/png/pdf, max 10MB) → uploaded to S3
```

#### `GET /prescriptions`  `🔒 JWT`
- **DOCTOR**: returns only own prescriptions
- **PHARMACIST/ADMIN**: returns all org prescriptions
```json
[{ id, access_token, patient_name, patient_phone, status, image_url, medicine_count, created_at }]
```

#### `GET /prescriptions/:id`  `🔒 JWT`
Accepts both UUID and `access_token` as `:id`.
```json
{
  "id": "uuid", "access_token": "a1b2c3d4e5f6...",
  "patient_name": "Ramesh Kumar", "status": "UPLOADED",
  "medicines": [{ id, name, quantity, frequency, course, description, image_url }]
}
```

#### `PUT /prescriptions/:id/render`  `🔒 JWT · DOCTOR | PHARMACIST`
Mark as rendered, optionally set video URL.
```json
{ "video_url": "https://s3.../video.mp4" }
```

#### `PUT /prescriptions/:id/status`  `🔒 JWT · DOCTOR | PHARMACIST`
Pharmacist can only set `SENT`. Doctor can set any.
```json
{ "status": "SENT" }
```

#### `DELETE /prescriptions/:id`  `🔒 JWT · DOCTOR`

#### `GET /prescriptions/public/:token`  _(public, no auth)_
Returns minimal prescription for patient view.

---

### Medicines Endpoints

#### `POST /medicines`  `🔒 JWT · DOCTOR | PHARMACIST`
Multipart. Adds medicine to a prescription.
```
Fields: prescription_id*, name*, quantity, frequency*, course*, description
File:   image (optional)
```

#### `PUT /medicines/:id`  `🔒 JWT · DOCTOR | PHARMACIST`
Update medicine. Same fields + optional new image.

#### `DELETE /medicines/:id`  `🔒 JWT · DOCTOR | PHARMACIST`

---

### Organizations Endpoints

#### `GET /organizations/me`  `🔒 JWT`
```json
{
  "id": "uuid", "name": "Sharma Clinic", "plan": "FREE",
  "prescription_limit": 10, "team_limit": 2,
  "usage_this_month": 4, "team_count": 2
}
```

#### `PUT /organizations/me`  `🔒 JWT · OrgAdmin`
```json
{ "name": "Sharma Clinic", "address": "...", "phone": "...", "website": "..." }
```

#### `GET /organizations/me/team`  `🔒 JWT`
```json
{
  "members": [{ id, name, email, role, is_owner, role_display_name, role_color, created_at }],
  "pending_invites": [{ id, email, role, created_at, expires_at }]
}
```

#### `POST /organizations/me/members`  `🔒 JWT · OrgAdmin`
Create account directly (no invite link needed).
```json
{ "name": "Rajesh Kumar", "email": "raj@clinic.in", "password": "pass123", "role": "PHARMACIST" }
```

#### `POST /organizations/me/invite`  `🔒 JWT · OrgAdmin`
Send invite link.
```json
{ "email": "new@clinic.in", "role": "DOCTOR", "custom_role_id": null }
// Response
{ "invite_link": "http://frontend/login?invite=...", "token": "...", "expires_at": "..." }
```

#### `DELETE /organizations/me/members/:memberId`  `🔒 JWT · OrgAdmin`
#### `DELETE /organizations/me/invites/:inviteId`  `🔒 JWT · OrgAdmin`

#### `PUT /organizations/me/plan`  `🔒 JWT · OrgAdmin (owner only)`
```json
{ "plan": "PRO" }
```

---

### Roles Endpoints

#### `GET /roles`  `🔒 JWT`
List all custom roles in current org.

#### `POST /roles`  `🔒 JWT · OrgAdmin`
```json
{
  "name": "senior-doctor",
  "display_name": "Senior Doctor",
  "base_role": "DOCTOR",
  "permissions": { "can_delete": true, "can_view_all": true },
  "color": "#1D9E75"
}
```

#### `PUT /roles/:id`  `🔒 JWT · OrgAdmin`
#### `DELETE /roles/:id`  `🔒 JWT · OrgAdmin`

#### `POST /roles/assign`  `🔒 JWT · OrgAdmin`
```json
{ "user_id": "uuid", "role_id": "uuid" }
```

---

### Superadmin Endpoints

#### `POST /auth/superadmin/login`
```json
{ "email": "admin@exato.in", "password": "..." }
```

#### `GET /superadmin/dashboard`  `🔒 SuperAdmin`
Global stats: total orgs, users, prescriptions, monthly counts.

#### `GET /superadmin/organizations`  `🔒 SuperAdmin`
Paginated list of all orgs.

#### `POST /superadmin/organizations`  `🔒 SuperAdmin`
Create org + admin account in one call.
```json
{
  "org_name": "Apollo Clinic", "org_address": "Mumbai",
  "admin_name": "Dr. Mehta", "admin_email": "mehta@apollo.in",
  "admin_password": "pass123", "plan": "PRO"
}
```

#### `GET /superadmin/organizations/:id`  `🔒 SuperAdmin`
Full org detail with members.

#### `PUT /superadmin/organizations/:id`  `🔒 SuperAdmin`
Update org or change status (ACTIVE / SUSPENDED).

#### `DELETE /superadmin/organizations/:id`  `🔒 SuperAdmin`

#### `POST /superadmin/organizations/:id/members`  `🔒 SuperAdmin`
Add a DOCTOR or PHARMACIST to any org.

---

## 9. Frontend Routes

| Path | Component | Access |
|------|-----------|--------|
| `/` | LandingPage | Public |
| `/login` | LoginPage | Public |
| `/public/:token` | PublicPage | Public |
| `/superadmin/login` | SuperAdminLoginPage | Public |
| `/superadmin/dashboard` | SuperAdminDashboard | SuperAdmin only |
| `/superadmin/organizations/:id` | SuperAdminOrgDetail | SuperAdmin only |
| `/admin` | OrgAdminDashboard | Admin / OrgAdmin |
| `/admin/team` | TeamPage | Admin / OrgAdmin |
| `/admin/roles` | RolesPage | Admin / OrgAdmin |
| `/home` | HomePage | Doctor / Pharmacist |
| `/prescriptions` | PrescriptionsListPage | Doctor |
| `/prescriptions/new` | NewPrescriptionPage | Doctor |
| `/prescriptions/:id` | PrescriptionDetailPage | Doctor (read-only) |
| `/pharmacist` | PharmacistDashboard | Pharmacist |
| `/pharmacist/prescriptions/:id` | PharmacistPrescriptionDetail | Pharmacist |
| `/medicine-prescriptions` | MedicinePrescriptionsPage | All logged-in |
| `/settings` | SettingsPage | All logged-in |

### Route Guards

| Guard | Logic |
|-------|-------|
| `PrivateRoute` | Redirect to `/login` if no user in localStorage |
| `OrgAdminRoute` | Redirect to `/home` if not admin/org-admin |
| `SuperAdminRoute` | Redirect to `/superadmin/login` if not superadmin token |
| `RootRedirect` | ADMIN/OrgAdmin → `/admin`, PHARMACIST → `/pharmacist`, else → `/home` |

---

## 10. Subscription Plans & Limits

| Feature | FREE | PRO | ENTERPRISE |
|---------|------|-----|------------|
| Price | ₹0 | ₹999/mo | ₹2,999/mo |
| Prescriptions/month | 10 | 200 | Unlimited |
| Team members | 2 | 10 | Unlimited |
| Digital prescriptions | ✅ | ✅ | ✅ |
| WhatsApp delivery | ✅ | ✅ | ✅ |
| QR code access | ✅ | ✅ | ✅ |
| Multi-language | ✅ | ✅ | ✅ |
| Custom roles | ✅ | ✅ | ✅ |
| Priority support | ❌ | ✅ | ✅ |
| Custom integrations | ❌ | ❌ | ✅ |
| Dedicated SLA | ❌ | ❌ | ✅ |

### Limit Enforcement
- **Prescription limit**: checked at `POST /prescriptions` creation time → throws 403 `LIMIT_EXCEEDED`
- **Team limit**: checked at `POST /organizations/me/invite` and `POST /organizations/me/members` → throws 403 `TEAM_LIMIT_EXCEEDED`
- **ENTERPRISE plan**: skips all limit checks (`plan === 'ENTERPRISE'`)

### Limit Error Response
```json
{
  "message": "Monthly limit of 10 prescriptions reached on your FREE plan. Please upgrade.",
  "errorCode": "LIMIT_EXCEEDED",
  "current": 10,
  "limit": 10,
  "plan": "FREE"
}
```

---

## 11. Security & Auth

### JWT Strategy
```
Access Token:   15 minutes  (env: JWT_EXPIRES_IN)
Refresh Token:  7 days      (env: JWT_REFRESH_EXPIRES)
SuperAdmin Token: 1 day

Secrets: JWT_SECRET, JWT_REFRESH_SECRET, SUPERADMIN_JWT_SECRET
```

### Token Rotation
- On every `/auth/refresh` call:
  1. Old refresh token deleted from DB
  2. New access + refresh token pair issued
- Logout explicitly revokes refresh token from DB

### Access Token Payload
```json
{
  "type": "USER",
  "userId": "uuid",
  "name": "Dr. Priya",
  "email": "priya@clinic.in",
  "role": "DOCTOR",
  "baseRole": "DOCTOR",
  "orgId": "uuid | null",
  "isOrgAdmin": false,
  "customRoleId": "uuid | null"
}
```

### Security Middleware
| Middleware | Purpose |
|-----------|---------|
| `helmet()` | 12 HTTP security headers (HSTS, XSS protection, etc.) |
| `express-mongo-sanitize` | Strips `$` and `.` from req.body/params/query |
| `CORS` | Restricted to `FRONTEND_URL` only |
| `class-validator` | DTO-level input validation |
| `AllExceptionsFilter` | Catches all errors, logs unknown ones, never exposes stack traces |

### Password Security
- bcrypt with 10 salt rounds
- Minimum 6 characters enforced at DTO + service layer
- Passwords never returned in any API response

### URL Security
- Prescriptions use `access_token` (16-char random hex) in public URLs
- Internal UUIDs never exposed in public-facing routes
- Backend accepts both UUID and access_token as lookup key for flexibility

---

## 12. File Storage

### AWS S3 Configuration
```
Bucket:       AWS_S3_BUCKET
Region:       AWS_REGION
Access Key:   AWS_ACCESS_KEY_ID
Secret Key:   AWS_SECRET_ACCESS_KEY
```

### Upload Rules
| Field | Max Size | Allowed Types | Key Pattern |
|-------|----------|---------------|-------------|
| Prescription image | 10 MB | image/*, application/pdf | `prescriptions/prescription-{timestamp}.{ext}` |
| Medicine image | 10 MB | image/*, application/pdf | `medicines/medicine-{timestamp}.{ext}` |
| Medicine catalog image | 10 MB | image/*, application/pdf | `medicine-prescriptions/...` |

### Error Handling
- `LIMIT_FILE_SIZE` → 400: "File too large. Max 10 MB allowed."
- Invalid type → 400: "Only images and PDFs are allowed"

---

## 13. Deployment Checklist

### Backend
```
□ Set all environment variables (see Section 14)
□ MySQL database created and accessible
□ MongoDB cluster accessible (or local)
□ AWS S3 bucket created with public read policy (or presigned URLs)
□ CORS origin set to production frontend URL
□ NODE_ENV=production
□ Run: npm run build && npm run start:prod
□ Health check passing: GET /api/health
```

### Frontend
```
□ Set VITE_API_URL to production backend URL
□ Run: npm run build
□ Deploy dist/ to Vercel / Netlify / S3+CloudFront
□ All routes fall back to index.html (SPA routing)
□ HTTPS enforced
```

### Database
```
□ Schema auto-creates on first backend start (initSchema)
□ ENUM migrations run automatically on startup
□ Superadmin seeded from SUPERADMIN_EMAIL + SUPERADMIN_PASSWORD env vars
□ Indexes created automatically
```

---

## 14. Environment Variables

### Backend (`.env`)
```env
# Server
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://medscript.in

# Database — MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=prescription_db

# Database — MongoDB
MONGO_URI=mongodb+srv://...

# JWT
JWT_SECRET=your_very_long_jwt_secret_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_REFRESH_EXPIRES=7d
SUPERADMIN_JWT_SECRET=your_superadmin_secret_here

# Superadmin seed
SUPERADMIN_EMAIL=admin@exato.in
SUPERADMIN_PASSWORD=your_super_secure_password

# AWS S3
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-south-1
AWS_S3_BUCKET=medscript-uploads
```

### Frontend (`.env`)
```env
VITE_API_URL=https://api.medscript.in
```

---

## 15. SaaS Growth Considerations

### Current State (MVP)
- Multi-tenant clinic platform ✅
- 3-tier role system ✅
- Subscription plan enforcement ✅
- WhatsApp delivery ✅
- Public prescription URLs ✅
- Superadmin control panel ✅

### Recommended Next Features (Phase 2)

#### Revenue
- **Stripe / Razorpay integration** — automated billing for PRO/Enterprise
- **Usage-based overage** — charge per prescription above limit instead of blocking
- **Annual billing discount** — 2 months free on annual plan

#### Product
- **Prescription templates** — save common medicine sets
- **Multi-language PDF export** — generate PDF in patient's language
- **SMS delivery** — fallback for patients without WhatsApp
- **Appointment booking** — tie prescriptions to appointments
- **Patient portal** — patients can see all their prescription history
- **Doctor signature / stamp** — legally valid digital signature on prescriptions
- **Expiry / refill reminders** — auto WhatsApp reminders when medicines run out

#### Platform
- **Webhook system** — notify external systems when prescription is SENT
- **API access tier** — Enterprise customers get API keys to integrate
- **Audit log** — track every action per org (for compliance)
- **HIPAA / IT Act compliance mode** — encrypted storage, access logs
- **Mobile app** — React Native app for doctors to upload from phone camera

#### Analytics
- **Org-level analytics** — most prescribed medicines, peak hours, patient return rate
- **Superadmin analytics** — MRR, churn, plan distribution, active orgs

### Key SaaS Metrics to Track
| Metric | How to Measure |
|--------|----------------|
| MRR | `SUM(plan_price)` across active paid orgs |
| Churn | Orgs downgraded from paid → FREE per month |
| Activation | % of registered orgs that upload first prescription |
| DAU/MAU | Daily/monthly unique user logins |
| NPS | In-app survey after 10th prescription sent |
| Feature adoption | % of orgs using custom roles, % using WhatsApp send |

---

## Contacts & Ownership

| | |
|---|---|
| **Product** | Askim Technologies Pvt. Ltd. |
| **Platform** | MedScript |
| **Target Market** | Indian clinics, hospitals, individual practitioners |
| **Primary Contact** | admin@exato.in |

---

*Document version: 1.0 — Generated March 2026*
