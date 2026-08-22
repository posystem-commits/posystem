# POS Admin

Multi-tenant admin backend for the POS system: activate/pause restaurant customers, track a
manual `paid_until` date, and send automatic 7/3/1-day expiry reminder emails. Built with
Next.js (App Router, deployed on Vercel) + Supabase (Postgres, service-role access, cron).

## What's here

- `db/schema.sql` — `admins`, `tenants`, `reminder_log` (the admin side), plus `tenant_pos_kv` (the
  POS side — see below).
- `app/api/admin/*` — admin-only API routes (login, tenant CRUD, reminders-due-today), gated by
  `middleware.js` checking a signed session cookie.
- `app/api/cron/reminders` — the daily sweep that emails tenants hitting a 7/3/1-day mark.
  Triggered by Vercel Cron (`vercel.json`) or Supabase `pg_cron` (see the commented block at the
  bottom of `db/schema.sql`), guarded by a `CRON_SECRET` bearer token.
- `app/admin/*` — the dashboard pages (login, customer list, customer detail, reminders preview).
- `lib/requireActiveTenant.js` — the server-side access gate, now actually called by every
  tenant-facing POS route below (previously just a standalone helper with no callers).
- **`src/pos.jsx` is migrated onto this backend.** It no longer uses the Claude-artifact-only
  `window.storage` API — every call site goes through `lib/tenantStorage.js`, a same-shaped client
  shim that talks to `app/api/pos/[tenantId]/storage/*` (a tenant-scoped key/value store,
  `tenant_pos_kv`, mirroring the original storage shape 1:1 so the swap stayed mechanical rather
  than a schema redesign). `app/t/[tenantId]/page.jsx` is the real entry point — the link staff
  bookmark on their terminal, and the base URL table QR codes / the online-ordering link build on
  top of (`?table=`, `?order=1`, unchanged from the original).
  - Three keys (`current-employee`, `shift-start`, `ui-lang`) stay in the browser's own
    `localStorage` instead — they describe this device/session, not restaurant-wide state.
  - `receipts:*` and the customer directory were originally written `shared=false` (device-local,
    never synced) — almost certainly a bug carried over from single-browser testing, since
    "Register totals (all staff)" only makes sense if every terminal sees the same receipts. The
    shim now treats them as shared/server-backed like everything else; see the comment in
    `db/schema.sql` above `tenant_pos_kv`.
  - The in-app help chatbot no longer calls `api.anthropic.com` straight from the browser (that
    only ever worked inside the Claude-artifact sandbox) — it now goes through
    `app/api/pos/[tenantId]/help`, a small server-side proxy holding the real API key.

## What's not here yet

- **Tenant onboarding is manual and link-based.** There's no signup flow for restaurants — you
  create a tenant in `/admin`, then hand them their `https://yourapp.vercel.app/t/<tenantId>` link
  to bookmark on their POS device. That's the same trust model the app already used for table QR
  codes (a shareable link, no separate device login) — every request is still checked server-side
  against `paid_until`/`status`, so pausing them or letting access lapse takes effect immediately
  even if they keep the link. Hardening this (e.g. a real signed tenant session) is a reasonable
  future improvement, not required for the spec as written.
- **Delivery-platform ingestion** (Talabat/Elmenus webhooks, build-spec section 8) — not started.
- The `tenant_pos_kv` table is a faithful key/value port, not a normalized relational schema —
  fine for how this app already worked, but if you outgrow it (e.g. wanting to run real SQL
  reports across orders), receipts/expenses are the two keys most worth eventually breaking out
  into real tables.

## Setup

1. **Create a Supabase project**, then in the SQL editor run `db/schema.sql`.
2. **Create your admin login.** There's no signup flow on purpose — insert yourself directly:
   ```bash
   npm install
   node scripts/hash-password.js "your-password-here"
   ```
   Then in the Supabase table editor, insert a row into `admins` with your email and the printed
   hash as `password_hash`.
3. **Copy `.env.example` to `.env.local`** and fill in:
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API.
   - `ADMIN_JWT_SECRET` — any long random string (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
   - `RESEND_API_KEY` / `REMINDER_FROM_EMAIL` — from [resend.com](https://resend.com); a verified
     sending domain is required before Resend will actually deliver.
   - `CRON_SECRET` — any long random string; set the same value in Vercel's project env vars once
     deployed (Vercel automatically sends it as `Authorization: Bearer <CRON_SECRET>` when the
     cron job fires).
4. **Run it locally:**
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000/admin/login`.
5. **Deploy to Vercel:** connect the repo, set the same env vars in the Vercel project settings,
   deploy. `vercel.json` registers the daily cron hit to `/api/cron/reminders` automatically.

## Manual payment workflow

1. Customer pays you outside the system.
2. Open `/admin`, find them, click **Edit**, update `paid_until` (there's a "+ Extend 30 days"
   shortcut that adds from today or from their current `paid_until`, whichever is later).
3. Optionally add a note for your own record-keeping.
4. Save. Enforcement (their POS terminal at `/t/<tenantId>` starts 403ing on their very next
   request) and reminders both key off that one date automatically from here — extending
   `paid_until` re-arms the 7/3/1-day reminders under the new cycle without any manual reset, since
   `reminder_log` is keyed on `(tenant_id, paid_until, type)`.
