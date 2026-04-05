# Prescription System
### Askim Technologies Pvt. Ltd.

A full-stack, multi-tenant prescription management platform for hospitals, doctors, and pharmacists.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Backend | NestJS (Node.js) |
| Primary DB | MySQL 8 + TypeORM (migrations) |
| Medicine DB | MongoDB Atlas (medicine catalog & autocomplete) |
| Auth | JWT (access token 15m) + Refresh token (7d, HTTP-only cookie) |
| File Storage | AWS S3 |
| HTTP Client | Axios with JWT interceptor + auto-refresh |
| Forms | React Hook Form |
| Notifications | react-hot-toast |

---

## Project Structure

```
prescription-system/
├── backend-nest/               ← NestJS API server
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/           ← Login, register, refresh, JWT guards
│   │   │   ├── platform/       ← Superadmin (plans, orgs)
│   │   │   ├── organization/   ← Org management, team, roles
│   │   │   ├── hospital/       ← Hospitals, staff (doctors/pharmacists)
│   │   │   └── prescription/   ← Prescriptions, medicines
│   │   ├── database/
│   │   │   ├── entities/       ← TypeORM entities
│   │   │   └── migrations/     ← SQL migrations (source of truth)
│   │   └── common/
│   │       ├── guards/         ← JwtAuthGuard, OrgAdminGuard, SuperAdminGuard
│   │       ├── interceptors/   ← ResponseInterceptor, LoggingInterceptor
│   │       ├── filters/        ← Global exception filter
│   │       └── s3/             ← AWS S3 upload service
│   ├── .env.example
│   └── package.json
│
└── frontend/                   ← React + TypeScript + Vite
    └── src/
        ├── pages/
        │   ├── LoginPage.tsx
        │   ├── LandingPage.tsx
        │   ├── HomePage.tsx                    ← Doctor home
        │   ├── NewPrescriptionPage.tsx
        │   ├── PrescriptionDetailPage.tsx
        │   ├── PrescriptionsListPage.tsx
        │   ├── PharmacistDashboard.tsx
        │   ├── PharmacistPrescriptionDetail.tsx
        │   ├── ProfilePage.tsx
        │   ├── SettingsPage.tsx
        │   ├── MedicinePrescriptionsPage.tsx
        │   ├── PublicPage.tsx                  ← Patient QR access (no login)
        │   ├── admin/
        │   │   ├── OrgAdminDashboard.tsx
        │   │   ├── HospitalsPage.tsx
        │   │   ├── HospitalDetailPage.tsx
        │   │   ├── TeamPage.tsx
        │   │   └── RolesPage.tsx
        │   ├── hospital/
        │   │   └── HospitalAdminPage.tsx
        │   └── superadmin/
        │       ├── SuperAdminLoginPage.tsx
        │       ├── SuperAdminDashboard.tsx
        │       └── SuperAdminOrgDetail.tsx
        ├── context/AuthContext.tsx
        ├── services/api.ts                     ← Axios + JWT auto-refresh
        └── components/
            └── layout/AppShell.tsx
```

---

## Prerequisites

- Node.js 18+
- MySQL 8.0+
- MongoDB Atlas account (or local MongoDB)
- AWS S3 bucket (for prescription image uploads)
- npm

---

## Step 1 — MySQL Setup

```sql
CREATE DATABASE prescription_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Tables are created automatically via TypeORM migrations on backend startup.

---

## Step 2 — Backend Setup

```bash
cd prescription-system/backend-nest

npm install

cp .env.example .env
```

Edit `.env` with your credentials (see `.env.example` for all required variables):

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=prescription_db

MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/

JWT_SECRET=your_64_char_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_64_char_refresh_secret
JWT_REFRESH_EXPIRES=7d

SUPERADMIN_JWT_SECRET=your_superadmin_secret
SUPERADMIN_EMAIL=admin@yourdomain.com
SUPERADMIN_PASSWORD=YourPassword

PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=ap-south-1
AWS_S3_BUCKET=your_bucket_name
```

Start the backend:

```bash
# Development (watch mode)
npm run start:dev

# Production
npm run build
npm run start:prod
```

Server starts at **http://localhost:5000**

---

## Step 3 — Frontend Setup

```bash
cd prescription-system/frontend

npm install

npm run dev
```

Open: **http://localhost:5173**

---

## Roles & Access

| Role | Access |
|------|--------|
| **SUPERADMIN** | Platform-wide — manage organizations and plans |
| **ORG_ADMIN** | Manage their organization — hospitals, team, roles |
| **HOSPITAL_ADMIN** | Manage their hospital — staff assignment |
| **DOCTOR** | Create/manage prescriptions, view medicine DB |
| **PHARMACIST** | View prescriptions, dispense medicines |

---

## User Flows

### Superadmin
```
/superadmin/login → Dashboard
  → View all organizations
  → Create / suspend orgs
  → Assign plans (controls hospital limits)
```

### Org Admin
```
/admin → Dashboard
  → /admin/hospitals    → Add hospitals, assign staff
  → /admin/team         → Manage org members
  → /admin/roles        → Create custom roles with colors
```

### Doctor
```
/home → New Prescription
  → Upload prescription image (S3)
  → Add medicines (autocomplete from MongoDB)
  → Generate QR code for patient
  → Send via WhatsApp
```

### Pharmacist
```
/pharmacist → View all prescriptions
  → Search by patient / doctor
  → Mark medicines as dispensed
```

### Patient
```
Scan QR code → /p/:token (no login required)
  → View prescription details + medicines
```

---

## API Overview

All responses are wrapped: `{ success: boolean, data: any }`

### Auth — `/api/auth`
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Login → JWT + refresh cookie |
| POST | `/auth/register` | Register user |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Clear refresh cookie |
| GET | `/auth/me` | Current user |

### Platform (Superadmin) — `/api/platform`
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/platform/organizations` | List all orgs |
| POST | `/platform/organizations` | Create org |
| PUT | `/platform/organizations/:id` | Update org |
| GET | `/platform/plans` | List plans |

### Organizations — `/api/organizations`
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/organizations/me` | Get own org |
| PUT | `/organizations/me` | Update org |
| GET | `/organizations/me/team` | List members |
| POST | `/organizations/me/members` | Add member |
| DELETE | `/organizations/me/members/:id` | Remove member |
| GET | `/organizations/me/roles` | List roles |
| POST | `/organizations/me/roles` | Create role |

### Hospitals — `/api/organizations/me/hospitals`
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/hospitals` | List hospitals |
| POST | `/hospitals` | Create hospital + admin account |
| PUT | `/hospitals/:id` | Update name / status |
| PUT | `/hospitals/:id/address` | Update address |
| GET | `/hospitals/:id/staff` | List doctors & pharmacists |
| POST | `/hospitals/:id/staff` | Assign existing member |
| DELETE | `/hospitals/:id/staff/:userId` | Remove staff |

### Prescriptions — `/api/prescriptions`
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/prescriptions` | List (doctor: own, pharmacist: all) |
| POST | `/prescriptions` | Create + upload image |
| GET | `/prescriptions/:id` | Full detail + medicines |
| PUT | `/prescriptions/:id` | Update status |
| POST | `/prescriptions/:id/medicines` | Add medicine |
| PUT | `/prescriptions/:id/medicines/:mid` | Update medicine |
| DELETE | `/prescriptions/:id/medicines/:mid` | Remove medicine |
| GET | `/prescriptions/public/:token` | Patient access (no auth) |

---

## Database (MySQL — TypeORM Migrations)

Key entities:

- **plans** — subscription plans with limits (max_hospitals, etc.)
- **organizations** — tenants, each on a plan
- **users** — all users (org admin, doctor, pharmacist)
- **roles** — custom org-level roles with colors
- **hospitals** — belong to an org
- **hospital_addresses** — one-to-one with hospital
- **doctor_profiles** / **pharmacist_profiles** — extended profiles
- **prescriptions** — belong to a doctor + hospital
- **refresh_tokens** — stored for rotation

Medicine catalog is stored in **MongoDB Atlas** (separate from relational data).

---

## Troubleshooting

**MySQL connection refused**
```bash
# Check MySQL is running
sudo service mysql start
# Verify credentials in .env
```

**Migrations not running**
```bash
cd backend-nest
npm run typeorm migration:run
```

**CORS error**
- Ensure `FRONTEND_URL=http://localhost:5173` in backend `.env`

**S3 upload failing**
- Check AWS credentials and bucket region in `.env`
- Ensure the S3 bucket has the correct CORS policy

**401 on every request**
- JWT secret mismatch between `.env` and what the token was signed with
- Clear `localStorage` and log in again

---

## Deployment

### Backend (e.g. Railway / Render)
```bash
npm run build
# Set all .env variables in the platform dashboard
# Entry: node dist/main.js
```

### Frontend (Vercel / Netlify)
```bash
npm run build
# Set VITE_API_URL if needed
# Deploy the dist/ folder
```

Update `FRONTEND_URL` in backend `.env` to your production frontend URL.

---

*Askim Technologies Pvt. Ltd. © 2026*
