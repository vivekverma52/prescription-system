1. Remove Duplicate Columns (CRITICAL)
❌ Remove address_line → keep address_line1, address_line2
❌ Remove month, year → keep only rx_month, rx_year
❌ Remove organizations.plan → keep only plan_id
❌ Remove users.password → keep only password_hash
❌ Avoid name + first_name + last_name duplication → choose one structure


2. Fix Naming Consistency
Use snake_case everywhere
Keep consistent naming:
password_hash ✅
NOT password
Standardize:
created_at, updated_at, deleted_at
Avoid mixed fields like:
name vs display_name (define clear purpose)

🔗 3. Add Foreign Key Constraints

Add FK for ALL relations:

hospitals.org_id → organizations.id
hospital_addresses.hospital_id → hospitals.id
users.org_id → organizations.id
users.hospital_id → hospitals.id
pharmacist_profiles.user_id → users.id
roles.hospital_id → hospitals.id
user_roles.user_id → users.id

Add UNIQUE Constraints (VERY IMPORTANT)
organizations.slug UNIQUE
users.email UNIQUE
hospitals.slug UNIQUE (per org)
org_usage_counters (org_id, rx_year, rx_month) UNIQUE
plans.slug UNIQUE


Fix Plan System (Single Source of Truth)
❌ Remove:
organizations.plan

✅ Use:

organizations.plan_id → plans.id


Fix Usage Tracking Table

✅ Keep:

org_id, rx_month, rx_year, rx_count
❌ Remove duplicates (month, year)

✅ Add:

UNIQUE (org_id, rx_month, rx_year)
✅ Use UPSERT for updates


Introduce DTO Validation (NestJS)

Use:

class-validator
class-transformer

Replace manual checks like:

if (!dto.city)

Clean users Table (BIG FIX)

Split responsibilities:

❌ Too many fields in one table

✅ Keep only:

id, email, password_hash, org_id, status

Move:

roles → user_roles
hospital → mapping table if needed

Normalize Roles System

Keep:

roles
user_roles
❌ Remove:
duplicate role field in users
Use only one role system

Fix Hospital Address Design

Choose ONE:

✅ Recommended:
address_line1
address_line2
city
state
pincode

Add Migration System

Use:

TypeORM migrations OR
Prisma migrations

👉 NEVER manually change schema in production

Add Logging + Error Handling
Catch DB errors (like missing table)
Convert to proper API errors
