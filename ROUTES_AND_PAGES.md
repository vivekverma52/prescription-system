# Routes & Pages Reference

> **Three-tier SaaS:** Exato (Superadmin) → Organizations (Org Admin) → Users (Doctor / Pharmacist)

---

## Frontend Routes

### Public Routes (no login required)

| Route | Page File | What It Does |
|-------|-----------|--------------|
| `/` | `LandingPage.tsx` | Marketing landing page. Shows features, pricing tiers (Free/Pro/Enterprise), and CTA buttons to login/register. |
| `/login` | `LoginPage.tsx` | Sign In / Register toggle. Detects `?invite=TOKEN` in URL — if present, shows "You've been invited to join [Org]" banner and auto-fills email, skips role selection. |
| `/register` | `LoginPage.tsx` | Same component as `/login`, defaults to Register tab. |
| `/public/:token` | `PublicPage.tsx` | Public prescription viewer — accessible without login via a unique token. Shows patient name, doctor, medicines, image/video if rendered. Used for QR code sharing and WhatsApp links. |

---

### Doctor Routes (requires login + role = DOCTOR)

| Route | Page File | What It Does |
|-------|-----------|--------------|
| `/home` | `HomePage.tsx` | Doctor home dashboard. Shows greeting, org plan badge, monthly usage progress bar, quick action cards (New Prescription, My Prescriptions, Settings), and warning if near plan limit. |
| `/prescriptions` | `PrescriptionsListPage.tsx` | Lists all prescriptions created by this doctor. Has search by patient name, stats cards (Total / Rendered / Sent), and a card per prescription showing patient, phone, language, medicine count, status. Click any card to open detail. |
| `/prescriptions/new` | `NewPrescriptionPage.tsx` | Create new prescription form. Fields: patient name, phone, language. Add medicines via modal (with autocomplete from 60+ common Indian medicines). Saves and navigates to detail page. |
| `/prescriptions/:id` | `PrescriptionDetailPage.tsx` | Full prescription detail. Shows all medicines, renders AI video/image, displays QR code, sends WhatsApp message to patient, shows access token link. Status progresses: UPLOADED → RENDERED → SENT. |

---

### Pharmacist Routes (requires login + role = PHARMACIST)

| Route | Page File | What It Does |
|-------|-----------|--------------|
| `/pharmacist` | `PharmacistDashboard.tsx` | Sidebar dashboard showing ALL prescriptions across the org (not just own). Table view with patient name, doctor name, date, status. Search by patient or doctor name. Refresh button. Click row to open prescription detail. |

---

### Org Admin Routes (requires login + `is_org_admin = true`)

| Route | Page File | What It Does |
|-------|-----------|--------------|
| `/admin` | `admin/OrgAdminDashboard.tsx` | Purple-themed sidebar dashboard. Stats: total prescriptions, this month, team members, sent via WhatsApp. Monthly usage bar with upgrade prompt if near limit. Quick action cards to new prescription / manage team / manage roles. Recent prescriptions list. |
| `/admin/team` | `admin/TeamPage.tsx` | Invite team members by email + role (Doctor/Pharmacist) + optional custom role. Generates a shareable invite link. Lists current members with badges (Owner/Admin/Custom Role). Assign roles to members, remove members. Shows pending invitations with cancel option. |
| `/admin/roles` | `admin/RolesPage.tsx` | Create/edit/delete custom roles for the organization. Each role has: slug, display name, base role (DOCTOR/PHARMACIST/VIEWER/ADMIN), permission checkboxes, color picker. Permissions: Create Prescriptions, View All Prescriptions, Delete Prescriptions, Manage Medicines, Render Videos, Send via WhatsApp, Manage Team. |

---

### Shared Authenticated Routes (any logged-in user)

| Route | Page File | What It Does |
|-------|-----------|--------------|
| `/settings` | `SettingsPage.tsx` | Four tabs: **Profile** (name, email, password change), **Organization** (org name, address, phone, website — owner only), **Team** (invite members, manage team), **Billing** (current plan details, upgrade buttons for Free→Pro→Enterprise). |
| `/app` | *(redirect)* | Smart redirect based on role: org admin → `/admin`, pharmacist → `/pharmacist`, doctor → `/home`. |

---

### Superadmin Portal (Exato internal — separate JWT)

| Route | Page File | What It Does |
|-------|-----------|--------------|
| `/superadmin/login` | `superadmin/SuperAdminLoginPage.tsx` | Dark navy login page for Exato platform admins. Uses a separate JWT secret (`SA_SECRET`), stored as `sa_token` in localStorage. |
| `/superadmin/dashboard` | `superadmin/SuperAdminDashboard.tsx` | Platform-level dashboard. 6 stat cards (total orgs, active, suspended, users, all prescriptions, this month). Filterable table of all organizations (by name, plan, status). Create org modal. Inline plan change dropdown. Suspend/Activate buttons. Click org name to open detail. |
| `/superadmin/organizations/:id` | `superadmin/SuperAdminOrgDetail.tsx` | Deep-dive into a single organization. Header shows name, plan badge, status badge. 4 stat cards. 4 tabs: **Overview** (org details + admin account), **Users** (all members with roles), **Roles** (custom roles defined), **Prescriptions** (recent 10). Change plan dropdown and Suspend/Activate button in header. |

---

## Backend API Routes

### Auth — `/api/auth`

| Method | Endpoint | Auth | What It Does |
|--------|----------|------|--------------|
| `POST` | `/auth/superadmin/login` | None | Superadmin login. Returns `sa_token` (signed with `SA_SECRET`) + superAdmin object. |
| `POST` | `/auth/register` | None | Register new user. If `invite_token` present: joins that org with that role. If DOCTOR without invite: auto-creates a FREE organization for them. |
| `POST` | `/auth/login` | None | Login. Returns JWT + user object including `org_id`, `is_org_admin`, `role_display_name`. |
| `GET` | `/auth/me` | User JWT | Returns full current user profile with role details. |
| `GET` | `/auth/check-invite?token=` | None | Validates an invite token. Returns org name, email, role — shown on the invite registration banner. |

---

### Prescriptions — `/api/prescriptions`

| Method | Endpoint | Auth | What It Does |
|--------|----------|------|--------------|
| `GET` | `/prescriptions` | User JWT | List prescriptions. Doctors see only their own. Pharmacists see all in the org. |
| `POST` | `/prescriptions` | DOCTOR | Create new prescription. Checks monthly limit against org plan before allowing. |
| `GET` | `/prescriptions/:id` | User JWT | Get single prescription with all medicines and access token. |
| `PUT` | `/prescriptions/:id` | User JWT | Update prescription (status, image_url, video_url, notes). |
| `DELETE` | `/prescriptions/:id` | DOCTOR | Delete prescription and its medicines. |
| `POST` | `/prescriptions/:id/upload` | User JWT | Upload image/PDF file (max 10 MB) to the prescription. |

---

### Medicines — `/api/medicines`

| Method | Endpoint | Auth | What It Does |
|--------|----------|------|--------------|
| `GET` | `/medicines/search?q=` | User JWT | Autocomplete search from 60+ common Indian medicine names. |
| `POST` | `/medicines` | User JWT | Add a medicine to a prescription (name, quantity, frequency, course, description). |
| `PUT` | `/medicines/:id` | User JWT | Update a medicine entry. |
| `DELETE` | `/medicines/:id` | User JWT | Remove a medicine from a prescription. |

---

### Organizations — `/api/organizations`

| Method | Endpoint | Auth | What It Does |
|--------|----------|------|--------------|
| `GET` | `/organizations/me` | User JWT | Get current user's org with `usage_this_month` and `team_count`. |
| `PUT` | `/organizations/me` | Owner only | Update org name, address, phone, website. |
| `GET` | `/organizations/me/team` | User JWT | List team members (with role display name/color) + pending invitations. |
| `POST` | `/organizations/me/invite` | Owner only | Create invite link for a new member. Checks team limit. Returns 7-day expiry invite link. |
| `DELETE` | `/organizations/me/members/:userId` | Owner only | Remove a member from the org. |
| `DELETE` | `/organizations/me/invites/:inviteId` | User JWT | Cancel a pending invitation. |
| `PUT` | `/organizations/me/plan` | Owner only | Change org plan (FREE / PRO / ENTERPRISE). Updates prescription and team limits. |

---

### Roles — `/api/roles`

| Method | Endpoint | Auth | What It Does |
|--------|----------|------|--------------|
| `GET` | `/roles` | User JWT | List all custom roles for the current org. |
| `POST` | `/roles` | Org Admin | Create a new custom role with permissions JSON and color. |
| `PUT` | `/roles/:id` | Org Admin | Update a role's display name, base role, permissions, color, default flag. |
| `DELETE` | `/roles/:id` | Org Admin | Delete a role. Removes the role from any users who had it. |
| `POST` | `/roles/assign` | Org Admin | Assign a custom role to a user. Also syncs the user's base `role` field. |

---

### Superadmin — `/api/superadmin` (SA JWT required)

| Method | Endpoint | Auth | What It Does |
|--------|----------|------|--------------|
| `GET` | `/superadmin/dashboard` | SA JWT | Platform stats: org counts, user count, total prescriptions, this month count. |
| `GET` | `/superadmin/organizations` | SA JWT | List all orgs with filters (search, plan, status). Includes user count, prescription counts, owner info. |
| `POST` | `/superadmin/organizations` | SA JWT | Create a new org + its admin user in one transaction. Also seeds 3 default roles (Doctor, Pharmacist, Admin). |
| `GET` | `/superadmin/organizations/:id` | SA JWT | Full org detail: info + all users + all roles + last 10 prescriptions. |
| `PUT` | `/superadmin/organizations/:id` | SA JWT | Update org plan (auto-adjusts limits), status (ACTIVE/SUSPENDED), name, address. |
| `DELETE` | `/superadmin/organizations/:id` | SA JWT | Delete an org (cascades to users, prescriptions, roles). |
| `GET` | `/superadmin/users` | SA JWT | List all users across all orgs with org name and role info. |

---

## Plan Limits

| Plan | Prescriptions/month | Team Members | Price |
|------|--------------------|--------------| ------|
| FREE | 10 | 2 | ₹0 |
| PRO | 200 | 10 | ₹999/month |
| ENTERPRISE | Unlimited | Unlimited | ₹2,999/month |

---

## Auth Flow Summary

```
Doctor self-registers  →  auto-creates FREE org  →  becomes owner + org_admin  →  /admin
Invite flow            →  org admin sends link   →  invitee opens /register?invite=TOKEN  →  joins org with assigned role
Superadmin             →  /superadmin/login       →  separate sa_token stored  →  /superadmin/dashboard
```
