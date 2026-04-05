---
name: prescription-system-saas-transformation
description: SaaS transformation of the prescription management system - what was added
type: project
---

Transformed the prescription management system (Askim Technologies) into a proper SaaS product.

**Why:** User requested a proper SaaS architecture with multi-tenancy, subscriptions, team management.

**What was added:**

### Backend:
- `organizations` table: id, name, slug, plan (FREE/PRO/ENTERPRISE), prescription_limit, team_limit, owner_id, address, phone, website
- `invitations` table: invite-by-link team member flow with 7-day expiry
- Safe DB migration: added `org_id` and `is_owner` to `users`; added `org_id` to `prescriptions`
- New `/api/organizations` route: GET/PUT org, GET/POST/DELETE team members, invite management, plan upgrade
- Updated `/api/auth` routes: doctors auto-create org on register, invite token support in register, `GET /check-invite`
- Updated `/api/prescriptions`: subscription limits enforced (FREE=10/mo, PRO=200/mo), org-scoped pharmacist view
- JWT now includes `orgId`

### Frontend:
- `LandingPage.tsx`: marketing page with hero, features grid, pricing (₹0/₹999/₹2999), CTA, footer
- `SettingsPage.tsx`: 4-tab settings (Profile, Organization, Team, Billing) with invite link generation, usage bars, plan upgrade
- `AuthContext.tsx`: added `Organization` type, `org` state, `refreshOrg()` function
- `HomePage.tsx`: plan badge, usage progress bar, near-limit warning banner, Settings in dropdown
- `App.tsx`: `/` now shows LandingPage (not redirect), added `/settings` route
- `LoginPage.tsx`: invite token from URL (`?invite=`), pre-fills email, shows org name banner

### Plan Tiers:
- FREE: 10 prescriptions/month, 2 team members
- PRO: 200 prescriptions/month, 10 team members (₹999/month)
- ENTERPRISE: Unlimited (₹2,999/month)

**How to apply:** When working on this project, be aware of the org/subscription model. All new features should be org-scoped. Billing is a demo (no real payment integration yet).
