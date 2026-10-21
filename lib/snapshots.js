import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Periodic safety-net copies of every tenant's complete POS data (all tenant_pos_kv rows) into
// tenant_snapshots. A snapshot is skipped when nothing changed since the tenant's latest one, so
// the retained history spans real changes rather than idle days. Snapshots deliberately have no
// foreign key to tenants — they outlive a deleted tenant. Restore with scripts/restore-snapshot.js.
// Retention: the newest KEEP_RECENT copies, plus the newest copy from each of the previous KEEP_WEEKLY weeks.
// (A snapshot is only taken when something changed, so "a week" of copies is at most 7.) This holds about
// a third fewer full copies than the old flat 21, without losing the ability to go back several weeks.
export const KEEP_RECENT = 7;
export const KEEP_WEEKLY = 5;
export const DEFAULT_KEEP = KEEP_RECENT + KEEP_WEEKLY;

// Which snapshot ids to keep, given every snapshot of one restaurant newest first ({ id, taken_at }).
export function snapshotsToKeep(all, recent = KEEP_RECENT, weekly = KEEP_WEEKLY) {
  const keep = new Set(all.slice(0, recent).map((s) => s.id));
  const oldest = all.slice(recent);
  const seenWeeks = new Set();
  for (const s of oldest) {
    const week = Math.floor(new Date(s.taken_at).getTime() / (7 * 24 * 3600 * 1000));
    if (seenWeeks.has(week)) continue;
    if (seenWeeks.size >= weekly) break;
    seenWeeks.add(week);
    keep.add(s.id);
  }
  return keep;
}
const PAGE = 500;

// Must stay identical to the hash in scripts/restore-snapshot.js.
export function hashRows(rows) {
  const canon = [...rows].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).map((r) => [r.key, r.value]);
  return crypto.createHash("sha256").update(JSON.stringify(canon)).digest("hex");
}

async function readAllRows(db, tenantId) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("tenant_pos_kv")
      .select("key, value, updated_at")
      .eq("tenant_id", tenantId)
      .order("key")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

async function snapshotOne(db, tenant, keep, reason) {
  const rows = await readAllRows(db, tenant.id);
  if (rows.length === 0) return { tenant: tenant.restaurant_name, status: "skipped-empty" };

  const contentHash = hashRows(rows);
  const { data: latest, error: latestErr } = await db
    .from("tenant_snapshots")
    .select("content_hash")
    .eq("tenant_id", tenant.id)
    .order("taken_at", { ascending: false })
    .limit(1);
  if (latestErr) throw new Error(latestErr.message);
  if (latest?.[0]?.content_hash === contentHash) return { tenant: tenant.restaurant_name, status: "unchanged" };

  const { data: inserted, error: insErr } = await db
    .from("tenant_snapshots")
    .insert({
      tenant_id: tenant.id,
      restaurant_name: tenant.restaurant_name,
      content_hash: contentHash,
      kv_rows: rows,
      kv_row_count: rows.length,
      size_bytes: rows.reduce((s, r) => s + r.value.length, 0),
      reason,
    })
    .select("id, kv_row_count")
    .single();
  if (insErr || !inserted) throw new Error(insErr?.message || "snapshot insert returned no row");

  // Prune only AFTER the new snapshot is safely written, and never below `keep` copies.
  const { data: all, error: listErr } = await db
    .from("tenant_snapshots")
    .select("id, taken_at")
    .eq("tenant_id", tenant.id)
    .order("taken_at", { ascending: false });
  if (listErr) throw new Error(listErr.message);
  // An explicit ?keep=<n> on the cron URL still means "the newest n"; the default is the tiered rule above.
  const keepIds = keep === DEFAULT_KEEP ? snapshotsToKeep(all) : new Set(all.slice(0, keep).map((r) => r.id));
  const stale = all.filter((r) => !keepIds.has(r.id)).map((r) => r.id);
  if (stale.length > 0) {
    const { error: delErr } = await db.from("tenant_snapshots").delete().in("id", stale);
    if (delErr) throw new Error(`snapshot saved but pruning failed: ${delErr.message}`);
  }
  return { tenant: tenant.restaurant_name, status: "saved", rows: rows.length, pruned: stale.length };
}

// Snapshots every tenant (or just `tenantId`). One tenant failing never stops the others.
export async function takeSnapshots({ tenantId, keep = DEFAULT_KEEP, reason = "scheduled" } = {}) {
  const db = supabaseAdmin();
  let q = db.from("tenants").select("id, restaurant_name");
  if (tenantId) q = q.eq("id", tenantId);
  const { data: tenants, error } = await q;
  if (error) throw new Error(error.message);

  const results = [];
  for (const tenant of tenants) {
    try {
      results.push(await snapshotOne(db, tenant, keep, reason));
    } catch (e) {
      results.push({ tenant: tenant.restaurant_name, status: "FAILED", error: e.message });
    }
  }
  return results;
}
