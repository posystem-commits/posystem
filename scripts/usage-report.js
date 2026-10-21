// How much of the free Supabase plan's database space is being used, per restaurant. READ ONLY.
//
//   node --env-file=.env.local scripts/usage-report.js
//
// (Data TRANSFER — Supabase's other free-plan limit, 5 GB a month — can only be read in the Supabase
// dashboard under Settings > Usage; check it after a week of normal traffic and divide it by the number
// of restaurants to see how many more fit.)
const { createClient } = require("@supabase/supabase-js");
const mb = (n) => (n / 1048576).toFixed(2) + " MB";
(async () => {
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: tenants } = await db.from("tenants").select("id, restaurant_name");
  let live = 0;
  for (const t of tenants) {
    let size = 0, rows = 0;
    for (let from = 0; ; from += 500) {
      const { data } = await db.from("tenant_pos_kv").select("value").eq("tenant_id", t.id).range(from, from + 499);
      size += data.reduce((s, r) => s + r.value.length, 0);
      rows += data.length;
      if (data.length < 500) break;
    }
    live += size;
    const { data: snaps } = await db.from("tenant_snapshots").select("size_bytes").eq("tenant_id", t.id);
    const snapSize = (snaps || []).reduce((s, r) => s + r.size_bytes, 0);
    console.log(`${t.restaurant_name.padEnd(28)} live ${mb(size).padStart(9)} (${rows} records)   safety copies ${mb(snapSize).padStart(9)} (${(snaps || []).length})`);
  }
  const { data: all } = await db.from("tenant_snapshots").select("size_bytes");
  const snapTotal = (all || []).reduce((s, r) => s + r.size_bytes, 0);
  const total = live + snapTotal;
  console.log(`\nTotal ${mb(total)} of the 500 MB free limit (${((total / 524288000) * 100).toFixed(1)}%)`);
})();
