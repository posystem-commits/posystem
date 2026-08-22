# POS Admin

Multi-tenant admin backend for the POS system: activate/pause restaurant customers, track a
manual `paid_until` date, and warn each restaurant in their own POS terminal 7/3/1 days before
access lapses. Built with Next.js (App Router, deployed on Vercel) + Supabase (Postgres,
service-role access).

## What's here

- `db/schema.sql` — `admins`, `tenants` (the admin side), plus `tenant_pos_kv` (the POS side —
  see below).
- `app/api/admin/*` — admin-only API routes (login, tenant CRUD, reminders-due-today), gated by
  `middleware.js` checking a signed session cookie.
- `app/admin/*` — the dashboard pages (login, customer list, customer detail, reminders preview).
- `lib/requireActiveTenant.js` — the server-side access gate, called by every tenant-facing POS
  route below.
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
    shim now treats them as shared/server-backed like everything else.
  - The in-app help chatbot no longer calls `api.anthropic.com` straight from the browser (that
    only ever worked inside the Claude-artifact sandbox) — it now goes through
    `app/api/pos/[tenantId]/help`, a small server-side proxy holding the real API key.
- **The 7/3/1-day expiry reminder is a popup inside each tenant's own POS terminal**, not an
  email. `app/api/pos/[tenantId]/status` reports the tenant's live `status`/`paid_until`; the
  terminal computes days-remaining itself and shows a dismissible popup when it lands on 7, 3, or
  1 — dismissal is scoped to that specific `(paid_until, days_remaining)` pair in `localStorage`,
  so it reappears on the next threshold and re-arms automatically if you extend their date. There
  is no server-dispatched email/cron for this (an earlier pass built one via Resend; it was
  removed in favor of the popup, which is what the actual users — restaurant staff — see every
  day, rather than an inbox they may not check).

## A real bug worth knowing about

While building the popup, `/api/pos/[tenantId]/status` was observed serving a tenant's
`paid_until` from the very first request after a server start, forever — completely ignoring
later updates, confirmed via a direct call to Supabase's REST API showing the fresh value while
this app's own route kept returning stale data. Root cause: Next.js's App Router patches the
global `fetch` and caches GET results by default, and that applies to any fetch a library makes
internally — including the ones `@supabase/supabase-js` makes — not just fetches a route calls
directly. Per-route `export const dynamic = "force-dynamic"` (present on every route here as
belt-and-suspenders) did **not** reliably fix it on its own. The actual fix lives in
`lib/supabaseAdmin.js`, which passes a custom `fetch` to `createClient()` that forces
`cache: "no-store"` on every request the client makes, at the client level rather than trusting
per-route config. If you add new Supabase-backed routes elsewhere in this codebase (or copy this
pattern into a different project), make sure whatever Supabase client you're using has the same
guard — it's easy to silently reintroduce this.

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
   hash as `password_hash` — or use `node --env-file=.env.local scripts/create-admin.js "email" "password"`
   once `.env.local` is filled in (below), which does the insert for you via the service-role key.
3. **Copy `.env.example` to `.env.local`** and fill in:
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API.
   - `ADMIN_JWT_SECRET` — any long random string (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
   - `ANTHROPIC_API_KEY` (optional) — powers the in-app help chatbot; leave blank to disable it.
4. **Run it locally:**
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000/admin/login`.
5. **Deploy to Vercel:** connect the repo, set the same env vars in the Vercel project settings,
   deploy.

## Manual payment workflow

1. Customer pays you outside the system.
2. Open `/admin`, find them, click **Edit**, update `paid_until` (there's a "+ Extend 30 days"
   shortcut that adds from today or from their current `paid_until`, whichever is later).
3. Optionally add a note for your own record-keeping.
4. Save. Enforcement (their POS terminal at `/t/<tenantId>` starts 403ing on their very next
   request) and the 7/3/1-day renewal popup both key off that one date automatically from here.
