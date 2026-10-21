// Cross-checks a restaurant's money numbers. READ ONLY — it never writes anything.
//
//   node scripts/check-numbers.js <tenant-id> [--from YYYY-MM-DD] [--tz Africa/Cairo] [--json] [--gate]
//
// --gate: the exit code reflects only the money rules (day, shift, drawer, month, leaderboard); problems in the
// data itself (a shift logged twice, an order whose lines do not add up) are still listed but do not fail it.
//
// It loads the tenant's real receipts, expenses and shifts, builds the same ledger (src/ledger.js) every
// screen of the app uses, and verifies the rules that must hold between the numbers different tabs show:
// the Dashboard's day equals Close the day's, equals what the shifts plus "outside any shift" add up to;
// payment methods add up to revenue; the month equals its days; the leaderboard equals the Dashboard; a
// shift's drawer is opening + cash in - paid out; every receipt's total follows from its own lines; and so on.
// A failing line names the day or order to look at. Run it before every deploy.
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const args = process.argv.slice(2);
const tenantId = args.find((a) => !a.startsWith("--"));
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
if (!tenantId) {
  console.error("usage: node scripts/check-numbers.js <tenant-id> [--from YYYY-MM-DD] [--tz Africa/Cairo] [--json]");
  process.exit(2);
}
process.env.TZ = opt("tz", "Africa/Cairo");

const root = path.resolve(__dirname, "..");
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const { createClient } = require(path.join(root, "node_modules/@supabase/supabase-js"));
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const get = async (k) => {
  const { data } = await db.from("tenant_pos_kv").select("value").eq("tenant_id", tenantId).eq("key", k).maybeSingle();
  return data ? JSON.parse(data.value) : null;
};
const listKeys = async (prefix) => {
  const { data } = await db.from("tenant_pos_kv").select("key").eq("tenant_id", tenantId).like("key", `${prefix}%`);
  return (data || []).map((r) => r.key);
};

const eq = (a, b) => Math.abs(a - b) < 0.011;
const fmt = (n) => (Math.round(n * 100) / 100).toFixed(2);

(async () => {
  const L = await import(pathToFileURL(path.join(root, "src/ledger.js")).href);
  const receiptsByMonth = {};
  for (const k of await listKeys("receipts:")) receiptsByMonth[k.slice("receipts:".length)] = (await get(k)) || [];
  const expensesByMonth = {};
  for (const k of await listKeys("expenses:")) expensesByMonth[k.slice("expenses:".length)] = (await get(k)) || [];
  const shiftLog = (await get("shift-log")) || [];
  const openShifts = (await get("open-shifts")) || {};
  const shiftHours = (await get("shift-hours-config")) || L.DEFAULT_SHIFT_HOURS;
  const menuCfg = (await get("menu-config")) || {};
  // Months with no stored record are empty, not "not loaded".
  const months = Object.keys(receiptsByMonth).sort();
  if (months.length === 0) {
    console.log("No receipts stored for this tenant — nothing to check.");
    return;
  }
  for (let mk = L.prevMonthKey(months[0]); mk <= L.nextMonthKey(months[months.length - 1]); mk = L.nextMonthKey(mk)) {
    if (receiptsByMonth[mk] === undefined) receiptsByMonth[mk] = [];
  }
  const ledger = L.createLedger({ receiptsByMonth, expensesByMonth, shiftLog, openShifts, shiftHours, menu: menuCfg.menu || {}, labels: { methodByLabel: {}, isPayLabel: () => false } });
  const nowMs = Date.now();

  const { runNumberChecks } = await import(pathToFileURL(path.join(root, "src/numbers-check.js")).href);
  const { days, results } = runNumberChecks({ L, ledger, receiptsByMonth, shiftLog, expensesByMonth, nowMs, from: opt("from", "0000-00-00") });
  // ---- report ----
  const failed = results.filter((r) => !r.ok);
  if (args.includes("--json")) {
    console.log(JSON.stringify({ tenantId, checks: results.length, failed }, null, 1));
  } else {
    const groups = {};
    results.forEach((r) => { (groups[r.group] ||= { pass: 0, fail: 0 })[r.ok ? "pass" : "fail"]++; });
    console.log(`Checked ${days.length} business days for ${tenantId}\n`);
    Object.entries(groups).forEach(([g, c]) => console.log(`  ${g.padEnd(12)} ${String(c.pass).padStart(4)} passed   ${c.fail ? String(c.fail) + " FAILED" : ""}`));
    if (failed.length) {
      console.log("\nFAILED:");
      failed.forEach((f) => console.log(`  [${f.group}] ${f.name}\n      ${f.detail}`));
    } else {
      console.log("\nEvery check passed.");
    }
  }
  const gated = args.includes("--gate") ? failed.filter((f) => ["day", "shift", "drawer", "month", "leaderboard"].includes(f.group)) : failed;
  process.exit(gated.length ? 1 : 0);
})().catch((e) => {
  console.error("check-numbers failed to run:", e.message);
  process.exit(2);
});
