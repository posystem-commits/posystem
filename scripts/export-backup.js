// Saves a complete copy of every restaurant's data to files on THIS computer — an off-Supabase
// backup, since the free Supabase plan has no automatic backups. One JSON file per restaurant,
// in backups/<date-time>/. Read-only: it never writes to the database. Run it regularly (e.g.
// weekly) and keep the backups folder somewhere safe — it contains customers' business data.
//
//   node --env-file=.env.local scripts/export-backup.js
//   node --env-file=.env.local scripts/export-backup.js "D:\SomewhereElse"     (custom folder)
//
// After each run it keeps only the newest 8 dated folders in that location and deletes older ones
// (only folders named like 2026-10-02T12-54-24 — it never touches anything else).
//
// Restore a restaurant that no longer exists from one of these files:
//   node --env-file=.env.local scripts/restore-tenant-backup.js "backups\...\Kaivo.json"
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const KEEP = 8;

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (pass --env-file=.env.local)");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = path.join(process.argv[2] || "backups", stamp);
  fs.mkdirSync(outDir, { recursive: true });

  const { data: tenants, error } = await db.from("tenants").select("*");
  if (error) throw error;

  for (const tenant of tenants) {
    const kv_rows = [];
    for (let from = 0; ; from += 500) {
      const { data, error: kErr } = await db
        .from("tenant_pos_kv")
        .select("key, value, updated_at")
        .eq("tenant_id", tenant.id)
        .order("key")
        .range(from, from + 499);
      if (kErr) throw kErr;
      kv_rows.push(...data);
      if (data.length < 500) break;
    }
    const safeName = tenant.restaurant_name.replace(/[^\w\- ]+/g, "_").trim() || tenant.id;
    const file = path.join(outDir, `${safeName}.json`);
    fs.writeFileSync(file, JSON.stringify({ exported_at: new Date().toISOString(), tenant_row: tenant, kv_rows }, null, 1));

    // Read it back from disk and confirm it matches before calling it done.
    const check = JSON.parse(fs.readFileSync(file, "utf8"));
    if (check.kv_rows.length !== kv_rows.length) throw new Error(`Verification failed for ${tenant.restaurant_name}`);
    console.log(`${tenant.restaurant_name}: ${kv_rows.length} data rows, ${Math.round(fs.statSync(file).size / 1024)} KB -> ${file}`);
  }
  console.log(`\nDone. Backup folder: ${path.resolve(outDir)}`);

  const root = path.dirname(outDir);
  const dated = fs.readdirSync(root).filter((d) => /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/.test(d)).sort().reverse();
  for (const old of dated.slice(KEEP)) {
    fs.rmSync(path.join(root, old), { recursive: true, force: true });
    console.log(`Removed old backup ${old}`);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
