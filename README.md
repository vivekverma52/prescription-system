# Multimedia Prescription System
### Askim Technologies Pvt. Ltd.

React + Node.js + MySQL — full-stack prescription management system.

---

## Project Structure

```
prescription-system/
├── backend/              ← Node.js + Express + MySQL
│   ├── src/
│   │   ├── config/db.js       ← MySQL connection + auto table creation
│   │   ├── middleware/auth.js  ← JWT guard + role guard
│   │   ├── routes/
│   │   │   ├── auth.js        ← register, login, /me
│   │   │   ├── prescriptions.js ← full CRUD + public access
│   │   │   └── medicines.js   ← add/edit/delete + search
│   │   └── index.js           ← Express server entry
│   ├── uploads/               ← prescription images (auto-created)
│   ├── .env.example
│   └── package.json
│
└── frontend/             ← React + TypeScript + Tailwind
    └── src/
        ├── pages/
        │   ├── LoginPage.tsx           ← login + register
        │   ├── HomePage.tsx            ← doctor home (Screen 1)
        │   ├── NewPrescriptionPage.tsx ← upload form (Screen 2)
        │   ├── PrescriptionDetailPage.tsx ← detail + medicines (Screens 4,6)
        │   ├── PrescriptionsListPage.tsx  ← doctor's list
        │   ├── PharmacistDashboard.tsx ← pharmacist view (Screen 3)
        │   └── PublicPage.tsx          ← patient QR access
        ├── components/
        │   ├── MedicineModal.tsx    ← add medicine (Screen 5)
        │   └── ProtectedRoute.tsx   ← role-based route guard
        ├── context/AuthContext.tsx  ← global auth state
        └── services/api.ts          ← axios with JWT
```

---

## Prerequisites

- Node.js 18+
- MySQL 8.0+
- npm or yarn

---

## Step 1 — MySQL Setup

Open MySQL and run:

```sql
CREATE DATABASE prescription_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Tables are created **automatically** when the backend starts. You don't need to run any SQL manually.

---

## Step 2 — Backend Setup

```bash
cd prescription-system/backend

# Install dependencies
npm install

# Copy env file
cp .env.example .env
```

Edit `.env` with your MySQL credentials:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=prescription_db

JWT_SECRET=make_this_at_least_32_random_characters_long
JWT_EXPIRES_IN=7d

PORT=5000
FRONTEND_URL=http://localhost:5173
```

Start the backend:

```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start
```

You should see:
```
✅ Database tables ready
🚀 Server running on http://localhost:5000
```

---

## Step 3 — Frontend Setup

```bash
cd prescription-system/frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open: **http://localhost:5173**

---

## Step 4 — Create Your First Account

1. Go to `http://localhost:5173/login`
2. Click **Register**
3. Fill in name, email, password
4. Choose role: **Doctor** or **Pharmacist**
5. Click **Create Account**

---

## Complete Flow (matches your video screens)

### Doctor Flow:
```
Login → Home Screen (Screen 1)
  → Click Upload Circle
  → Fill Details: patient name, phone, language, upload image (Screen 2)
  → Click Upload → Prescription Detail Page (Screen 4)
  → Click + ADD MEDICINE → Modal opens (Screen 5)
  → Fill: medicine name, qty, frequency checkboxes, duration → Add
  → Medicine card appears (Screen 6)
  → Click RENDER MULTIMEDIA PRESCRIPTION → status updates
  → QR Code appears → patient can scan
  → Click SEND ON WHATSAPP → opens WhatsApp with link
  → Click DOWNLOAD VIDEO → downloads video
```

### Pharmacist Flow:
```
Login → Dashboard (Screen 3)
  → See all prescriptions: Patient Name · Doctor Name · Date
  → Click any row → View prescription (read-only)
  → Use search bar to filter by patient or doctor name
  → Click REFRESH to reload
```

### Patient Flow:
```
Scan QR code OR open link
  → Public page (no login required)
  → See: doctor name, medicines list with details
  → Watch video explanation (in their language)
  → View original prescription image
```

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register doctor or pharmacist |
| POST | /api/auth/login | Login → returns JWT |
| GET | /api/auth/me | Current user profile |

### Prescriptions
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/prescriptions | Doctor | Create + upload image |
| GET | /api/prescriptions | Both | Doctor: own list. Pharmacist: all |
| GET | /api/prescriptions/:id | Both | Full detail with medicines |
| PUT | /api/prescriptions/:id/render | Doctor | Mark as rendered |
| PUT | /api/prescriptions/:id/status | Doctor | Update status |
| DELETE | /api/prescriptions/:id | Doctor | Delete |
| GET | /api/prescriptions/public/:token | None | Patient access via QR |

### Medicines
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/medicines/search?q=zifi | Doctor | Search medicine names |
| POST | /api/medicines | Doctor | Add medicine to prescription |
| PUT | /api/medicines/:id | Doctor | Edit medicine |
| DELETE | /api/medicines/:id | Doctor | Remove medicine |

---

## Database Tables (MySQL)

### users
```sql
id VARCHAR(36) PK
name VARCHAR(255)
email VARCHAR(255) UNIQUE
password VARCHAR(255)        -- bcrypt hashed
role ENUM('DOCTOR','PHARMACIST')
clinic_name VARCHAR(255)
created_at TIMESTAMP
```

### prescriptions
```sql
id VARCHAR(36) PK
doctor_id VARCHAR(36) FK → users.id
doctor_name VARCHAR(255)
patient_name VARCHAR(255)
patient_phone VARCHAR(20)
language VARCHAR(50)
image_url TEXT               -- local /uploads/ path
video_url TEXT               -- video path when rendered
access_token VARCHAR(50)     -- random token for QR URL
status ENUM('UPLOADED','RENDERED','SENT')
notes TEXT
created_at TIMESTAMP
```

### medicines
```sql
id VARCHAR(36) PK
prescription_id VARCHAR(36) FK → prescriptions.id
name VARCHAR(255)            -- "Zifi 200"
quantity VARCHAR(50)         -- "1"
frequency VARCHAR(255)       -- "Morning, Night"
course VARCHAR(100)          -- "5 Days"
description TEXT
created_at TIMESTAMP
```

---

## Adding Video Generation (Optional)

To add real video generation, install in backend:

```bash
npm install @aws-sdk/client-polly fluent-ffmpeg @ffmpeg-installer/ffmpeg
```

Add to your `.env`:
```env
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=ap-south-1
AWS_POLLY_VOICE_ID_HINDI=Aditi
AWS_POLLY_VOICE_ID_ENGLISH=Joanna
```

Then in your render endpoint, call:
1. AWS Polly → generate MP3 from medicine script
2. FFmpeg → combine background + audio + text → MP4
3. Save video to `/uploads/` or upload to S3

---

## WhatsApp Integration

**MVP (current):** Opens `wa.me` link in browser — no API key needed.

**V1 (Twilio):**
```bash
npm install twilio
```
```env
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

---

## Deployment

### Backend (Railway)
```bash
# Add these env vars in Railway dashboard
# Then deploy from GitHub
railway up
```

### Frontend (Vercel)
```bash
npm run build
vercel --prod
```

Update `FRONTEND_URL` in backend `.env` to your Vercel URL.

---

## Troubleshooting

**MySQL connection refused:**
- Check MySQL is running: `sudo service mysql start`
- Verify credentials in `.env`

**CORS error:**
- Make sure `FRONTEND_URL=http://localhost:5173` in backend `.env`

**File upload not working:**
- The `/uploads` folder is created automatically
- Check file size < 10MB
- Accepted: jpg, jpeg, png, pdf, webp

**QR code not scanning:**
- Make sure backend URL is accessible from patient's phone
- For local dev, use ngrok: `ngrok http 5000`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | TailwindCSS + DM Sans font |
| Forms | React Hook Form + Zod |
| HTTP | Axios with JWT interceptor |
| Backend | Node.js + Express |
| Auth | JWT + bcrypt |
| Database | MySQL 8 + mysql2 driver |
| File upload | Multer (local) |
| Routing | React Router v6 |
| Notifications | react-hot-toast |
| QR Code | qrcode.react |

---

*Askim Technologies Pvt. Ltd. © 2024*
