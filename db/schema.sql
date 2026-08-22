-- Multi-tenant POS admin schema. Run this in the Supabase SQL editor (or via `supabase db push`)
-- against a fresh project. Requires pgcrypto for gen_random_uuid().
create extension if not exists pgcrypto;

-- You (and any future admin staff). Not Supabase Auth users on purpose — kept as a plain table
-- with its own password hash so admin login is fully controlled by our own API route (see
-- app/api/admin/login/route.js), independent of Supabase's auth product.
create table if not exists admins (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  password_hash text not null,
  created_at    timestamptz default now()
);

-- Your customers — each restaurant.
create table if not exists tenants (
  id              uuid primary key default gen_random_uuid(),
  restaurant_name text not null,
  contact_name    text,
  contact_email   text,
  contact_phone   text,
  status          text not null default 'active' check (status in ('active', 'paused')),
  paid_until      date not null,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists tenants_status_idx on tenants (status);
create index if not exists tenants_paid_until_idx on tenants (paid_until);

-- Keeps updated_at current on every tenant edit, so the admin list can show "last changed".
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tenants_set_updated_at on tenants;
create trigger tenants_set_updated_at
  before update on tenants
  for each row
  execute function set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- POS data store (section 7 migration): src/pos.jsx originally kept every piece of restaurant
-- data — menu, stock, tables, receipts, staff, shift log, customers, expenses, delivery zones,
-- the pending-orders inbox, branding, the ticket counter — behind a single Claude-artifact-only
-- key/value API (`window.storage.get/set/list/delete`), each value a JSON string under a string
-- key like "menu-config" or "receipts:2026-08".
--
-- Rather than hand-designing a couple dozen bespoke tables (one per key) for what was already a
-- working key/value shape, this single table reproduces that same shape for real: one row per
-- (tenant, key), value stored as the same JSON string the app already produces. Every tenant POS
-- API route in app/api/pos/[tenantId]/storage/ is a thin, tenant-scoped, access-gated
-- (requireActiveTenant) wrapper around it — see lib/tenantStorage.js for the client-side shim
-- that replaced window.storage in src/pos.jsx call sites, keeping the swap mechanical.
--
-- Two keys intentionally do NOT round-trip through this table even though the original prototype
-- read/wrote them via window.storage: "current-employee", "shift-start", and "ui-lang" are kept
-- in the browser's own localStorage instead (see the DEVICE_LOCAL_KEYS allowlist in
-- lib/tenantStorage.js) — they describe which employee is clocked in on THIS terminal and this
-- device's language choice, not restaurant-wide state, so there's no reason to round-trip them to
-- the server at all.
--
-- One deliberate behavior change from the original prototype: "receipts:*" and
-- "customers-directory" were originally written with shared=false (i.e., kept device-local, not
-- synced). That looks like a bug carried over from a single-browser demo context — a real
-- multi-terminal restaurant needs every register to see the same receipt history and customer
-- list (the existing "Register totals (all staff)" feature on the Shift tab is meaningless
-- otherwise). The storage shim treats every key as server-backed by default, with only the three
-- keys above kept local — so this table is effectively "shared" for all restaurant data now.
create table if not exists tenant_pos_kv (
  tenant_id  uuid not null references tenants(id) on delete cascade,
  key        text not null,
  value      text not null,
  updated_at timestamptz default now(),
  primary key (tenant_id, key)
);

drop trigger if exists tenant_pos_kv_set_updated_at on tenant_pos_kv;
create trigger tenant_pos_kv_set_updated_at
  before update on tenant_pos_kv
  for each row
  execute function set_updated_at();

-- Note on reminders: there's no reminder_log / cron table here. The 7/3/1-day expiry reminder is
-- a popup shown directly in each tenant's own POS terminal (app/api/pos/[tenantId]/status,
-- computed live from tenants.paid_until) rather than a server-dispatched email, so there's no
-- "did we send this yet" state to persist — the terminal just checks its own status on load.

-- ---------------------------------------------------------------------------------------------
-- Packages: which tenants (see tenants.package below) can use which big features. You define the
-- Basic/Standard/Premium split yourself in /admin/packages — package_features just stores your
-- toggle choices. lib/packageFeatures.js has the fixed list of toggleable feature keys and a
-- default matrix used to seed a package the first time it's read with no rows yet, so this starts
-- usable out of the box and you adjust from there rather than configuring from a blank slate.
alter table tenants add column if not exists package text not null default 'basic' check (package in ('basic', 'standard', 'premium'));

create table if not exists package_features (
  package     text not null check (package in ('basic', 'standard', 'premium')),
  feature_key text not null,
  enabled     boolean not null default true,
  primary key (package, feature_key)
);
