-- Support access (the hidden "Support" sign-in on every POS terminal). Run once in the Supabase SQL editor.
-- Only ever touched with the service-role key; RLS with no policies keeps both tables closed to the public API.

-- One row holding the 4-digit support PIN (stored as a bcrypt hash, never the PIN itself). Set it from
-- /admin/support.
create table if not exists support_settings (
  id          integer primary key default 1 check (id = 1),
  pin_hash    text,
  updated_at  timestamptz not null default now()
);

-- Every attempt to use the support sign-in, successful or not. Also what the lock-out after repeated wrong
-- codes is worked out from. Append-only.
create table if not exists support_access_log (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null,
  outcome     text not null check (outcome in ('ok', 'fail', 'locked', 'exit')),
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists support_access_log_created_idx on support_access_log (created_at desc);
create index if not exists support_access_log_ip_idx on support_access_log (ip, created_at desc);

alter table support_settings enable row level security;
alter table support_access_log enable row level security;
