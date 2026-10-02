// Restores a restaurant deleted from the admin panel, from the copy DELETE /api/admin/tenants/:id
// saved in `tenant_backups`. Re-creates the tenant row (same id, so its POS link works again) and
// all of its tenant_pos_kv rows. Refuses to run if a tenant with that id exists already.
//
//   List backups:   node --env-file=.env.local scripts/restore-tenant-backup.js
//   Restore one:    node --env-file=.env.local scripts/restore-tenant-backup.js <backup-id>
//   From a file:    node --env-file=.env.local scripts/restore-tenant-backup.js "backups\<date>\Name.json"
//                   (a file made by scripts/export-backup.js)
const { createClient } = require("@supabase/supabase-js");

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (pass --env-file=.env.local)");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });
  const backupId = process.argv[2];

  if (!backupId) {
    const { data, error } = await db
      .from("tenant_backups")
      .select("id, restaurant_name, tenant_id, kv_row_count, deleted_at")
      .order("deleted_at", { ascending: false });
    if (error) throw error;
    if (!data.length) console.log("No backups found.");
    data.forEach((b) => console.log(`${b.id}  ${b.deleted_at}  ${b.restaurant_name}  (${b.kv_row_count} data rows)`));
    return;
  }

  let backup;
  if (backupId.toLowerCase().endsWith(".json")) {
    const f = JSON.parse(require("fs").readFileSync(backupId, "utf8"));
    backup = { tenant_id: f.tenant_row.id, restaurant_name: f.tenant_row.restaurant_name, tenant_row: f.tenant_row, kv_rows: f.kv_rows };
  } else {
    const { data, error } = await db.from("tenant_backups").select("*").eq("id", backupId).single();
    if (error || !data) throw new Error(`Backup not found: ${error?.message || backupId}`);
    backup = data;
  }

  const { data: existing } = await db.from("tenants").select("id").eq("id", backup.tenant_id).maybeSingle();
  if (existing) throw new Error("A tenant with this id already exists — refusing to overwrite it.");

  const { error: tErr } = await db.from("tenants").insert(backup.tenant_row);
  if (tErr) throw new Error(`Could not restore tenant row: ${tErr.message}`);

  const rows = backup.kv_rows.map((r) => ({ tenant_id: backup.tenant_id, key: r.key, value: r.value }));
  for (let i = 0; i < rows.length; i += 200) {
    const { error: kErr } = await db.from("tenant_pos_kv").insert(rows.slice(i, i + 200));
    if (kErr) throw new Error(`Restored the tenant row but data insert failed at row ${i}: ${kErr.message}`);
  }
  console.log(`Restored "${backup.restaurant_name}" (${rows.length} data rows). POS link works again.`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
