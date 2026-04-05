# Frontend Architecture

**Stack:** React 18 · TypeScript · Vite · Tailwind CSS · React Router v6 · Axios · React Hook Form · React Hot Toast

---

## Folder Structure

```
src/
├── main.tsx                 ← app entry, mounts <App /> into #root
├── index.css                ← global styles, Tailwind imports, reusable CSS classes
├── App.tsx                  ← providers + BrowserRouter + all route definitions
│
├── context/                 ← global state (React Context API)
├── services/                ← axios HTTP instances
├── components/              ← shared reusable UI pieces
└── pages/                   ← one file per screen, grouped by portal
    ├── (public)
    ├── (doctor)
    ├── (pharmacist)
    ├── admin/               ← org admin portal
    └── superadmin/          ← exato superadmin portal
```

---

## Architecture Rules

### 1. One File = One Screen
Every route has exactly one page file. No page file renders another page file.
Pages live in `src/pages/` and are grouped by portal:

| Folder | Who uses it |
|--------|-------------|
| `pages/*.tsx` | Public, Doctor, Pharmacist, shared |
| `pages/admin/` | Org Admin (purple theme, `is_org_admin = true`) |
| `pages/superadmin/` | Exato superadmin only (separate JWT) |

---

### 2. Providers Wrap Everything — Order Matters

```
SuperAdminProvider          ← outermost — separate auth state for superadmin
  └── AuthProvider          ← user auth (login, org, token)
        └── BrowserRouter
              └── Routes
```

`SuperAdminProvider` is outside `AuthProvider` because the two auth systems are completely independent — different JWT secrets, different localStorage keys, different contexts.

---

### 3. Two Separate API Clients

Never mix `api.ts` and `saApi.ts`.

| File | Token used | On 401 |
|------|-----------|--------|
| `services/api.ts` | `localStorage.token` | redirect `/login` |
| `services/saApi.ts` | `localStorage.sa_token` | redirect `/superadmin/login` |

All API calls go through one of these two axios instances — never raw `fetch` or inline `axios`.

---

### 4. Route Guards

Three types of route guards in `App.tsx`:

```tsx
// Any authenticated user
<ProtectedRoute>

// Specific role only
<ProtectedRoute role="DOCTOR">
<ProtectedRoute role="PHARMACIST">

// Org admin (is_org_admin = true)
<OrgAdminRoute>

// Superadmin (separate SA JWT)
<SuperAdminRoute>
```

`ProtectedRoute` lives in `src/components/ProtectedRoute.tsx`.
`OrgAdminRoute` and `SuperAdminRoute` are inline components inside `App.tsx`.
All guards show a spinner while loading — never a flash of wrong content.

---

### 5. Context = Auth State Only

Context is used **only** for auth state and theme. Not for server data.

**`AuthContext` provides:**
- `user` — logged-in user object
- `org` — user's organization with usage stats
- `token` — JWT
- `login()`, `register()`, `logout()`, `refreshOrg()`
- `loading` — prevents flash before session restore

**`SuperAdminContext` provides:**
- `superAdmin` — logged-in superadmin object
- `login()`, `logout()`
- `theme` (`'dark' | 'light'`) + `toggleTheme()` — persisted to `localStorage.sa_theme`

Everything else (prescriptions, medicines, team, roles) is fetched inside the page component that needs it using `useEffect` + `useState`.

---

### 6. No Shared Page State

Pages do not pass data to each other via props or context. Each page fetches its own data on mount. Navigation between pages happens via `useNavigate()` with route params.

```tsx
// navigate with an ID — the target page fetches its own data
navigate(`/prescriptions/${id}`)
```

---

### 7. Three Portals — Three Themes

Each portal has a completely different visual theme applied via Tailwind + inline styles:

| Portal | Color | CSS approach |
|--------|-------|-------------|
| Doctor / Pharmacist | Teal `#1D9E75` | Tailwind classes (`btn-teal`, `input-field`) |
| Org Admin | Purple `#7C3AED` | Inline `style={{ color: purpleAccent }}` |
| Superadmin dark | Indigo `#6366F1` on navy `#0F172A` | Theme object `DARK` / `LIGHT` |
| Superadmin light | Indigo `#6366F1` on white `#F8FAFC` | Theme object toggled via context |

The superadmin portal has a **dark/light toggle** — theme tokens are defined as plain objects (`DARK`, `LIGHT`) inside each superadmin page and switched by reading `theme` from `SuperAdminContext`.

---

### 8. Forms

Forms use `react-hook-form` for:
- `LoginPage` (sign in + register)
- `SettingsPage` (profile update, org update)
- `NewPrescriptionPage` (create prescription)

Simple one-off inputs (search, invite email, medicine fields inside modal) use plain `useState` — not `react-hook-form`.

---

### 9. Notifications

All user feedback (success, error) goes through `react-hot-toast`:

```tsx
toast.success('Prescription created')
toast.error(err.response?.data?.message || 'Something went wrong')
```

`<Toaster />` is placed once in `App.tsx` — top-right position, 14px DM Sans font.

---

### 10. Global CSS Classes

Defined in `src/index.css`. Used across all doctor/pharmacist pages:

| Class | Usage |
|-------|-------|
| `.btn-teal` | Primary action button |
| `.btn-outline` | Secondary button |
| `.input-field` | Text input with teal focus ring |
| `.card` | White rounded container |

Org Admin and Superadmin pages use inline styles instead — they have different color themes that don't match the teal system.

---

### 11. File Uploads

Handled in `PrescriptionDetailPage` — the user picks a file, the page POSTs it to `/api/prescriptions/:id/upload`. The backend returns a URL (`/uploads/filename.jpg`) which is stored on the prescription and rendered as an `<img>`.

QR codes are generated client-side using the `qrcode.react` package — they encode the prescription's public URL (`/public/:access_token`).

---

### 12. Public Prescription Viewer

`/public/:token` (`PublicPage.tsx`) requires no login. It calls the backend with the access token and displays the prescription to the patient. This is the page linked from WhatsApp messages and QR codes.

---

## Data Flow Summary

```
User action
  └── useState / react-hook-form
        └── api.ts or saApi.ts (axios)
              └── /api/* (backend)
                    └── response → setState → re-render
                          └── errors → toast.error()
```

---

## Scripts

```bash
npm run dev       # Vite dev server → http://localhost:5173
npm run build     # TypeScript check + Vite build → /dist
npm run preview   # Serve /dist locally
```

All `/api/*` and `/uploads/*` requests are proxied to `http://localhost:5000` during dev — configured in `vite.config.ts`.
