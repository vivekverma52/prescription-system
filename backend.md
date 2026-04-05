# Backend Architecture

**Stack:** Node.js · Express · MySQL (mysql2/promise) · JWT (jsonwebtoken) · bcryptjs · Multer · dotenv

---

## Folder Structure

```
src/
├── index.js          ← app entry — Express setup, middleware, route mounting, server start
├── seed.js           ← standalone script — seed or reset superadmin credentials
│
├── config/
│   └── db.js         ← MySQL pool + initDB() — table creation and migrations
│
├── middleware/
│   └── auth.js       ← JWT verification — authMiddleware, superAdminMiddleware, requireOrgAdmin
│
└── routes/
    ├── auth.js            ← /api/auth
    ├── prescriptions.js   ← /api/prescriptions
    ├── medicines.js       ← /api/medicines
    ├── organizations.js   ← /api/organizations
    ├── roles.js           ← /api/roles
    └── superadmin.js      ← /api/superadmin
```

---

## Architecture Rules

### 1. Flat Route Structure

All business logic lives directly in route files. There are no separate controller files, service files, or repository layers. Each route file owns one resource:

| Route file | Resource it owns |
|------------|-----------------|
| `auth.js` | Login, register, token issuing |
| `prescriptions.js` | Prescription CRUD + file upload + plan limit |
| `medicines.js` | Medicine CRUD + autocomplete |
| `organizations.js` | Org info, team management, invitations |
| `roles.js` | Custom role CRUD + assignment |
| `superadmin.js` | Platform-level org management (Exato only) |

---

### 2. Two Separate JWT Systems

The superadmin portal is completely isolated from the regular user system — different secret, different token type, different middleware.

**User tokens** — signed with `JWT_SECRET`:
```js
{ type: 'USER', userId, name, email, role, baseRole, orgId, isOrgAdmin, customRoleId }
```

**Superadmin tokens** — signed with `SUPERADMIN_JWT_SECRET`:
```js
{ type: 'SUPERADMIN', superAdminId, name, email }
```

`authMiddleware` explicitly **rejects** superadmin tokens:
```js
if (decoded.type === 'SUPERADMIN') return res.status(403).json(...)
```

This prevents a superadmin token from ever being used on regular user routes.

---

### 3. Middleware Chain

Every protected route runs middleware in this order:

```
Request
  ├── authMiddleware          ← verify JWT, attach req.user
  │     ├── requireOrgAdmin   ← optional: blocks non-admins
  │     └── requireRole()     ← optional: blocks wrong base role
  │
  └── superAdminMiddleware    ← verify SA JWT, attach req.superAdmin
        (superadmin routes only)
```

`req.user` shape after `authMiddleware`:
```js
{
  type: 'USER',
  userId, name, email,
  role,           // DOCTOR | PHARMACIST
  baseRole,       // effective role (may come from custom role)
  orgId,          // null if no org
  isOrgAdmin,     // true | false
  customRoleId    // null if no custom role
}
```

---

### 4. Database — Single Pool, No ORM

All queries use raw SQL via `mysql2/promise`. A single connection pool (`connectionLimit: 10`) is created once in `db.js` and imported by every route file.

```js
const { pool } = require('../config/db')

// Simple query
const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id])

// Transaction (for multi-step operations)
const conn = await pool.getConnection()
await conn.beginTransaction()
// ... queries ...
await conn.commit()
conn.release()
```

Transactions are used in:
- `POST /superadmin/organizations` — creates org + admin user + default roles atomically
- `POST /auth/register` — creates user + org (if no invite) atomically

---

### 5. Database Initialization — `initDB()`

Runs on every server start. Uses `CREATE TABLE IF NOT EXISTS` — safe to run repeatedly.

For columns added after initial release, uses `addColumnIfMissing()`:
```js
await addColumnIfMissing(conn, 'users', 'org_id', 'VARCHAR(36) NULL')
```

This means the DB migrates itself automatically on startup — no separate migration runner needed.

**Tables created:**
```
superadmins       ← Exato platform owners
organizations     ← hospitals / clinics / practices
users             ← doctors, pharmacists (belong to an org)
prescriptions     ← created by doctors, visible to pharmacists in same org
medicines         ← line items on a prescription
roles             ← custom roles defined per org
invitations       ← pending team invites (expire in 7 days)
```

---

### 6. Multi-Tenancy — `org_id` on Everything

Every user belongs to an organization via `org_id`. Every prescription is tagged with `org_id`. This is how data is scoped:

- **Doctors** see only their own prescriptions (`WHERE doctor_id = ?`)
- **Pharmacists** see all prescriptions in their org (`WHERE org_id = ?`)
- **Org Admins** manage team and roles within their org only
- **Superadmin** sees everything across all orgs — no org scoping

---

### 7. Subscription Limit Enforcement

Before creating a prescription, `checkSubscriptionLimit` middleware runs:

```
POST /prescriptions
  └── checkSubscriptionLimit
        ├── fetch org.plan and org.prescription_limit
        ├── count prescriptions this calendar month for org_id
        └── if count >= limit → 403 LIMIT_EXCEEDED
              else → next()
```

ENTERPRISE plan (`prescription_limit = 99999`) is treated as unlimited — the check is skipped if plan is ENTERPRISE.

---

### 8. Three Access Levels

| Level | How it's checked | `req.*` set |
|-------|-----------------|-------------|
| Any logged-in user | `authMiddleware` | `req.user` |
| Org Admin | `authMiddleware` + `requireOrgAdmin` | `req.user.isOrgAdmin === true` |
| Superadmin | `superAdminMiddleware` | `req.superAdmin` |

Owner-only actions (invite members, change plan, update org) check the DB directly:
```js
const [owners] = await pool.execute(
  'SELECT id FROM users WHERE id = ? AND org_id = ? AND is_owner = 1',
  [req.user.userId, req.user.orgId]
)
if (owners.length === 0) return res.status(403).json(...)
```

---

### 9. Invitation Flow

```
Org admin → POST /organizations/me/invite
  └── validates team limit
  └── generates 64-char random hex token
  └── inserts into invitations table (expires 7 days)
  └── returns invite_link: {FRONTEND_URL}/register?invite={token}

User opens invite link → GET /auth/check-invite?token=
  └── validates token exists + not accepted + not expired
  └── returns org_name, email, role for banner display

User registers → POST /auth/register { invite_token }
  └── validates invite token again
  └── creates user with org_id, role, custom_role_id from invitation
  └── marks invitation accepted_at = NOW()
```

---

### 10. File Uploads

Handled by `multer` in `prescriptions.js`:

```
POST /prescriptions/:id/upload
  └── multer (diskStorage)
        ├── saves to backend/uploads/prescription-{timestamp}.{ext}
        ├── allowed: .jpg .jpeg .png .pdf .webp
        └── max size: 10 MB
              └── returns { image_url: '/uploads/filename.jpg' }
```

The `uploads/` directory is served as static files by Express:
```js
app.use('/uploads', express.static(uploadsDir))
```

---

### 11. Error Handling Pattern

All route handlers use `try/catch`. Errors are returned as JSON with a `message` field:

```js
try {
  // ... logic
} catch (err) {
  console.error(err)
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Already exists' })
  res.status(500).json({ message: 'Server error' })
}
```

A global error handler in `index.js` catches anything that slips through:
```js
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' })
})
```

---

### 12. Password Security

All passwords hashed with `bcryptjs` at salt rounds = 10:
```js
const hashed = await bcrypt.hash(password, 10)
await bcrypt.compare(plaintext, hashed) // returns bool
```

Never stored in plain text anywhere. `.env` contains plain text only for the initial seed — immediately hashed before DB insert.

---

### 13. Default Roles Per Org

When a new org is created (via superadmin), three default roles are seeded automatically in a transaction:

```
Doctor      → DOCTOR base,      { create_prescription, delete_prescription, manage_medicines }
Pharmacist  → PHARMACIST base,  { view_all_prescriptions }
Admin       → ADMIN base,       { all permissions + manage_team }
```

Org admins can edit, delete, or add more custom roles via `/api/roles`.

---

## Request Lifecycle

```
HTTP Request
  │
  ├── cors middleware          (check origin)
  ├── express.json()           (parse body)
  │
  ├── route matched
  │     ├── authMiddleware     (verify JWT → req.user)
  │     ├── [requireOrgAdmin]  (check is_org_admin)
  │     ├── [requireRole]      (check role)
  │     └── route handler
  │           ├── pool.execute() → MySQL
  │           └── res.json()
  │
  └── error handler            (catch-all 500)
```

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DB_HOST` | `localhost` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | `root` | MySQL username |
| `DB_PASSWORD` | `vivek123` | MySQL password |
| `DB_NAME` | `prescription_db` | Database name |
| `JWT_SECRET` | `prescription_system_secret_key_32chars` | Signs user JWT |
| `JWT_EXPIRES_IN` | `7d` | User token lifetime |
| `SUPERADMIN_JWT_SECRET` | `superadmin_exato_secret_key_64chars_2024` | Signs superadmin JWT |
| `SUPERADMIN_EMAIL` | `admin@exato.in` | Superadmin email (seeded once) |
| `SUPERADMIN_PASSWORD` | `Exato@2024` | Superadmin password (seeded once) |
| `PORT` | `5000` | Express listen port |
| `FRONTEND_URL` | `http://localhost:5173` | CORS origin + invite link base |

---

## Scripts

```bash
npm run dev      # nodemon src/index.js  (hot reload for development)
npm run start    # node src/index.js     (production)
npm run seed     # node src/seed.js      (seed/reset superadmin credentials)
```
