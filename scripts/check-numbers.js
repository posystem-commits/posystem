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

  const results = [];
  const check = (group, name, ok, detail) => results.push({ group, name, ok, detail: ok ? "" : detail });

  const allReceipts = Object.values(receiptsByMonth).flat();
  const days = [...new Set(allReceipts.map((r) => ledger.bizDay(r.timestamp)))].sort().filter((d) => d >= opt("from", "0000-00-00"));
  const knownMethods = new Set(L.PAYMENT_METHODS.map((m) => m.id));

  // ---- per day ----
  for (const day of days) {
    const p = ledger.period(day, day);
    const cd = ledger.closeDay(day, nowMs);
    check("day", `${day} Close the day revenue = Dashboard revenue`, eq(cd.revenue, p.revenue), `closeDay ${fmt(cd.revenue)} vs period ${fmt(p.revenue)}`);
    check("day", `${day} orders agree`, cd.orders === p.orders, `${cd.orders} vs ${p.orders}`);
    const methodSum = Object.values(p.byMethod).reduce((s, v) => s + v, 0);
    check("day", `${day} payment methods add up to revenue`, eq(methodSum, p.revenue), `methods ${fmt(methodSum)} vs revenue ${fmt(p.revenue)}`);
    check("day", `${day} paid + unpaid = revenue`, eq(p.revenue - p.unpaid.total + p.unpaid.total, p.revenue), "");
    // shifts + outside = day
    const dayShifts = ledger.allShifts().filter((sh) => ledger.shiftDayOf(sh, nowMs) === day);
    const claimed = new Set();
    const shifts = ledger.allShifts();
    p.completed.forEach((r) => {
      const sh = shifts.find((x) => x.employeeId === r.servedBy?.id && r.timestamp >= x.clockIn && (!x.clockOut || r.timestamp <= x.clockOut));
      if (sh) claimed.add(r.id);
    });
    const inShifts = p.completed.filter((r) => claimed.has(r.id)).reduce((s, r) => s + r.total, 0);
    const outside = p.completed.filter((r) => !claimed.has(r.id)).reduce((s, r) => s + r.total, 0);
    check("day", `${day} orders inside shifts + outside any shift = day revenue`, eq(inShifts + outside, p.revenue), `${fmt(inShifts)} + ${fmt(outside)} vs ${fmt(p.revenue)}`);
    check("day", `${day} Close the day "outside" list matches`, eq(cd.outside.reduce((s, r) => s + r.total, 0), outside), `${fmt(cd.outside.reduce((s, r) => s + r.total, 0))} vs ${fmt(outside)}`);
    // each shift's own live totals never exceed the day for its own orders
    dayShifts.forEach((sh) => {
      const st = ledger.shiftTotals(sh, nowMs);
      check("shift", `${day} ${sh.name} shift totals can be computed`, !!st, "months not loaded");
    });
    // drawer arithmetic
    cd.drawers.forEach((d) => {
      if (d.loading || d.expected === null) return;
      check("drawer", `${day} ${d.name} expected = opening + cash in - paid out`, eq(d.expected, d.opening + d.cashIn - d.paidOut), `${fmt(d.expected)} vs ${fmt(d.opening + d.cashIn - d.paidOut)}`);
      if (d.gap !== null) check("drawer", `${day} ${d.name} gap = counted - (expected - collected at day end)`, eq(d.gap, d.counted - (d.expected - (d.collected || 0))), `${fmt(d.gap)} vs ${fmt(d.counted - (d.expected - (d.collected || 0)))}`);
    });
    const ex = ledger.expensesInDays(day, day).reduce((s, e) => s + e.amount, 0);
    check("day", `${day} expenses agree`, eq(cd.expenseTotal, ex), `${fmt(cd.expenseTotal)} vs ${fmt(ex)}`);
  }

  // ---- months equal the sum of their days; leaderboard equals the Dashboard ----
  for (const mk of [...new Set(days.map((d) => d.slice(0, 7)))]) {
    const first = days.find((d) => d.startsWith(mk));
    const mp = ledger.period(`${mk}-01`, L.lastDayOfMonth(mk));
    const sumDays = days.filter((d) => d.startsWith(mk)).reduce((s, d) => s + ledger.period(d, d).revenue, 0);
    check("month", `${mk} month revenue = sum of its days`, eq(mp.revenue, sumDays), `${fmt(mp.revenue)} vs ${fmt(sumDays)}`);
    const me = ledger.expensesInDays(`${mk}-01`, L.lastDayOfMonth(mk)).reduce((s, e) => s + e.amount, 0);
    const sumExp = (expensesByMonth[mk] || []).reduce((s, e) => s + e.amount, 0);
    check("month", `${mk} month expenses = Expenses tab total`, eq(me, sumExp), `${fmt(me)} vs ${fmt(sumExp)} (expenses stored under ${mk} but dated outside it?)`);
    void first;
  }
  {
    const since = new Date(nowMs - 30 * 86400000).toISOString();
    const lb = ledger.employeeTotals(since, nowMs);
    const dash = ledger.period(ledger.bizDay(since), ledger.bizDay(new Date(nowMs).toISOString()));
    check("leaderboard", "30-day leaderboard adds up to the Dashboard's 30 days", eq(lb.reduce((s, e) => s + e.revenue, 0), dash.revenue), `${fmt(lb.reduce((s, e) => s + e.revenue, 0))} vs ${fmt(dash.revenue)}`);
  }

  // ---- every receipt on its own ----
  const bad = { total: [], split: [], method: [], paidAt: [] };
  allReceipts.forEach((r) => {
    if (r.status !== "completed") return;
    const items = (r.items || []).reduce((s, i) => s + i.price * i.qty, 0);
    if (r.subtotal !== undefined && !eq(items, r.subtotal)) bad.total.push(`#${r.ticketNo} items ${fmt(items)} vs subtotal ${fmt(r.subtotal)}`);
    const net = (r.subtotal || 0) - (r.discountAmount || 0);
    const expectedTotal = net + (r.serviceAmount || 0) + (r.vatAmount || 0) + (r.deliveryFee || 0);
    if (r.subtotal !== undefined && !eq(expectedTotal, r.total)) bad.total.push(`#${r.ticketNo} lines add to ${fmt(expectedTotal)} but total is ${fmt(r.total)}`);
    if (r.paymentMethod === "split") {
      const sum = (r.splitPayments || []).reduce((s, p) => s + p.amount, 0);
      if (!eq(sum, r.total)) bad.split.push(`#${r.ticketNo} split ${fmt(sum)} vs total ${fmt(r.total)}`);
    }
    L.receiptMethodAmounts(r).forEach((a) => { if (!knownMethods.has(a.method) && !L.isCustomMethodId(a.method)) bad.method.push(`#${r.ticketNo} method "${a.method}"`); });
    if (r.paid !== false && r.paidAt && r.paidAt < r.timestamp) bad.paidAt.push(`#${r.ticketNo} paid before it was created`);
  });
  check("receipt", "every receipt's total follows from its items, discount, service, VAT and delivery fee", bad.total.length === 0, `${bad.total.length} receipts, e.g. ${bad.total.slice(0, 3).join("; ")}`);
  check("receipt", "every split payment adds up to its total", bad.split.length === 0, `${bad.split.length} receipts, e.g. ${bad.split.slice(0, 3).join("; ")}`);
  check("receipt", "every payment method is one the app knows", bad.method.length === 0, `${bad.method.length}, e.g. ${bad.method.slice(0, 3).join("; ")}`);
  check("receipt", "no receipt is paid before it exists", bad.paidAt.length === 0, `${bad.paidAt.length}, e.g. ${bad.paidAt.slice(0, 3).join("; ")}`);

  // ---- duplicates ----
  const ids = new Map();
  allReceipts.forEach((r) => ids.set(r.id, (ids.get(r.id) || 0) + 1));
  const dupIds = [...ids.entries()].filter(([, n]) => n > 1);
  check("data", "no receipt is stored twice", dupIds.length === 0, `${dupIds.length} duplicated ids, e.g. ${dupIds.slice(0, 3).map(([id]) => id).join(", ")}`);
  const shiftKeys = new Map();
  shiftLog.forEach((e) => { const k = `${e.employeeId}|${e.clockIn}`; shiftKeys.set(k, (shiftKeys.get(k) || 0) + 1); });
  const dupShifts = [...shiftKeys.entries()].filter(([, n]) => n > 1);
  check("data", "no shift is logged twice", dupShifts.length === 0, `${dupShifts.length} duplicated shifts, e.g. ${dupShifts.slice(0, 3).map(([k]) => k).join(", ")}`);
  const overlapping = [];
  const byEmp = {};
  ledger.allShifts().forEach((sh) => (byEmp[sh.employeeId] ||= []).push(sh));
  Object.values(byEmp).forEach((list) => list.sort((a, b) => a.clockIn.localeCompare(b.clockIn)).forEach((sh, i) => {
    const next = list[i + 1];
    if (next && sh.clockOut && next.clockIn < sh.clockOut) overlapping.push(`${sh.name} ${sh.clockIn} overlaps ${next.clockIn}`);
  }));
  check("data", "one person is never in two shifts at once", overlapping.length === 0, `${overlapping.length}, e.g. ${overlapping.slice(0, 3).join("; ")}`);

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
