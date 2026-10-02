// Inspect and restore periodic snapshots (tenant_snapshots) — see lib/snapshots.js.
// A restore only ever OVERWRITES/ADDS the keys you choose; it never deletes live keys. Before any
// write it saves a fresh "pre-restore" snapshot of the live data, so a restore can be undone.
//
//   List snapshots:         node --env-file=.env.local scripts/restore-snapshot.js
//   Compare to live (dry):  node --env-file=.env.local scripts/restore-snapshot.js <snapshot-id>
//   Restore chosen keys:    node --env-file=.env.local scripts/restore-snapshot.js <snapshot-id> --keys menu-config,ingredients-config --yes
//   Restore everything:     node --env-file=.env.local scripts/restore-snapshot.js <snapshot-id> --all --yes
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

// Must stay identical to hashRows in lib/snapshots.js.
function hashRows(rows) {
  const canon = [...rows].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).map((r) => [r.key, r.value]);
  return crypto.createHash("sha256").update(JSON.stringify(canon)).digest("hex");
}

async function readLive(db, tenantId) {
  const rows = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await db.from("tenant_pos_kv").select("key, value, updated_at").eq("tenant_id", tenantId).order("key").range(from, from + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) break;
  }
  return rows;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (pass --env-file=.env.local)");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const args = process.argv.slice(2);
  const snapshotId = args.find((a) => !a.startsWith("--"));
  const yes = args.includes("--yes");
  const all = args.includes("--all");
  const keysArg = args.includes("--keys") ? args[args.indexOf("--keys") + 1] : null;

  if (!snapshotId) {
    const { data, error } = await db
      .from("tenant_snapshots")
      .select("id, restaurant_name, taken_at, kv_row_count, size_bytes, reason")
      .order("taken_at", { ascending: false });
    if (error) throw error;
    if (!data.length) console.log("No snapshots yet.");
    data.forEach((s) => console.log(`${s.id}  ${s.taken_at}  ${s.restaurant_name}  (${s.kv_row_count} keys, ${Math.round(s.size_bytes / 1024)} KB, ${s.reason})`));
    return;
  }

  const { data: snap, error } = await db.from("tenant_snapshots").select("*").eq("id", snapshotId).single();
  if (error || !snap) throw new Error(`Snapshot not found: ${error?.message || snapshotId}`);
  const { data: tenant } = await db.from("tenants").select("id").eq("id", snap.tenant_id).maybeSingle();
  if (!tenant) throw new Error("This restaurant no longer exists. Use restore-tenant-backup.js to bring the tenant back first.");

  const live = await readLive(db, snap.tenant_id);
  const liveMap = new Map(live.map((r) => [r.key, r.value]));
  const snapMap = new Map(snap.kv_rows.map((r) => [r.key, r.value]));
  const changed = [], missingLive = [], onlyLive = [];
  for (const [k, v] of snapMap) {
    if (!liveMap.has(k)) missingLive.push(k);
    else if (liveMap.get(k) !== v) changed.push(k);
  }
  for (const k of liveMap.keys()) if (!snapMap.has(k)) onlyLive.push(k);

  console.log(`Snapshot of "${snap.restaurant_name}" taken ${snap.taken_at}`);
  console.log(`  differs from live now:   ${changed.join(", ") || "(none)"}`);
  console.log(`  in snapshot, gone live:  ${missingLive.join(", ") || "(none)"}`);
  console.log(`  live only (untouched):   ${onlyLive.join(", ") || "(none)"}`);

  const wanted = all ? [...changed, ...missingLive] : keysArg ? keysArg.split(",").map((s) => s.trim()).filter(Boolean) : [];
  if (!wanted.length || !yes) {
    console.log("\nDry run — nothing written. Add --keys a,b (or --all) and --yes to restore.");
    return;
  }
  const unknown = wanted.filter((k) => !snapMap.has(k));
  if (unknown.length) throw new Error(`Not in this snapshot: ${unknown.join(", ")}`);

  const { error: preErr } = await db.from("tenant_snapshots").insert({
    tenant_id: snap.tenant_id,
    restaurant_name: snap.restaurant_name,
    content_hash: hashRows(live),
    kv_rows: live,
    kv_row_count: live.length,
    size_bytes: live.reduce((s, r) => s + r.value.length, 0),
    reason: "pre-restore",
  });
  if (preErr) throw new Error(`Could not save a pre-restore snapshot, nothing was changed: ${preErr.message}`);
  console.log("Saved a pre-restore snapshot of the live data first.");

  const { error: upErr } = await db
    .from("tenant_pos_kv")
    .upsert(wanted.map((k) => ({ tenant_id: snap.tenant_id, key: k, value: snapMap.get(k) })), { onConflict: "tenant_id,key" });
  if (upErr) throw new Error(`Restore failed: ${upErr.message}`);
  console.log(`Restored ${wanted.length} key(s): ${wanted.join(", ")}`);
  console.log("Tell staff to refresh their terminals so no open tab re-saves older data over it.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
