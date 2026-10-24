import { createClient } from "@supabase/supabase-js";

// Read-only access to a restaurant's stored records. It only ever calls select. (Production should use a
// key that is itself read-only — see monitor/README.md — but even with a broader key this file cannot write.)
export function connect() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.MONITOR_SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and MONITOR_SUPABASE_KEY must be set");
  return createClient(url, key, { auth: { persistSession: false } });
}

const monthKey = (ms) => new Date(ms).toISOString().slice(0, 7);
const prevMonth = (k) => {
  const [y, m] = k.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};
const nextMonth = (k) => {
  const [y, m] = k.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};

export async function loadTenants(db) {
  const { data, error } = await db.from("tenants").select("id, restaurant_name, status, paid_until, package");
  if (error) throw new Error(error.message);
  return data || [];
}

const parse = (v, fallback) => {
  try {
    return v ? JSON.parse(v) : fallback;
  } catch (e) {
    return fallback;
  }
};

// The records the checks need for one restaurant: recent months of receipts and expenses (plus the months on
// either side, which can hold orders that belong to a neighbouring business day), the shift log, open shifts,
// hours, pending customer orders and day sign-offs. `monthsBack` keeps each run small.
export async function loadTenantData(db, tenant, nowMs, monthsBack = 2) {
  const cur = monthKey(nowMs);
  const months = [cur];
  for (let i = 0; i < monthsBack; i++) months.unshift(prevMonth(months[0]));
  const wanted = new Set(months);
  months.forEach((m) => {
    wanted.add(prevMonth(m));
    wanted.add(nextMonth(m));
  });
  const keys = [
    ...[...wanted].flatMap((m) => [`receipts:${m}`, `expenses:${m}`]),
    "shift-log",
    "open-shifts",
    "shift-hours-config",
    "pending-orders",
    "day-closings",
    "day-collections",
  ];
  const { data, error } = await db.from("tenant_pos_kv").select("key, value, updated_at").eq("tenant_id", tenant.id).in("key", keys);
  if (error) throw new Error(`${tenant.restaurant_name}: ${error.message}`);
  const byKey = new Map((data || []).map((r) => [r.key, r]));
  const receiptsByMonth = {};
  const expensesByMonth = {};
  [...wanted].forEach((m) => {
    receiptsByMonth[m] = parse(byKey.get(`receipts:${m}`)?.value, []);
    expensesByMonth[m] = parse(byKey.get(`expenses:${m}`)?.value, []);
  });
  return {
    tenant,
    receiptsByMonth,
    expensesByMonth,
    shiftLog: parse(byKey.get("shift-log")?.value, []),
    openShifts: parse(byKey.get("open-shifts")?.value, {}),
    shiftHours: parse(byKey.get("shift-hours-config")?.value, null),
    pendingOrders: parse(byKey.get("pending-orders")?.value, []),
    dayClosings: parse(byKey.get("day-closings")?.value, {}),
    collections: parse(byKey.get("day-collections")?.value, {}),
  };
}

// Recent sign-ins to the hidden support access (table support_access_log). Empty if that table doesn't exist yet.
export async function loadSupportLog(db, sinceIso) {
  const { data, error } = await db.from("support_access_log").select("id, tenant_id, outcome, ip, created_at").gte("created_at", sinceIso).order("created_at", { ascending: false }).limit(500);
  return error ? [] : data || [];
}

// Whole-database size per restaurant (live records and safety copies), for the free-plan space limit.
export async function loadUsage(db) {
  const tenants = await loadTenants(db);
  const perTenant = [];
  let live = 0;
  for (const t of tenants) {
    let size = 0;
    for (let from = 0; ; from += 500) {
      const { data, error } = await db.from("tenant_pos_kv").select("value").eq("tenant_id", t.id).range(from, from + 499);
      if (error) throw new Error(error.message);
      size += data.reduce((s, r) => s + r.value.length, 0);
      if (data.length < 500) break;
    }
    const { data: snaps } = await db.from("tenant_snapshots").select("size_bytes, taken_at").eq("tenant_id", t.id).order("taken_at", { ascending: false });
    const snapBytes = (snaps || []).reduce((s, r) => s + r.size_bytes, 0);
    live += size;
    perTenant.push({ id: t.id, name: t.restaurant_name, liveBytes: size, snapshotBytes: snapBytes, snapshotCount: (snaps || []).length, latestSnapshotAt: snaps && snaps[0] ? snaps[0].taken_at : null });
  }
  const totalBytes = perTenant.reduce((s, p) => s + p.liveBytes + p.snapshotBytes, 0);
  return { perTenant, totalBytes, liveBytes: live };
}
