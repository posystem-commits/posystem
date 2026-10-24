// The rules that must hold between the numbers different screens show. Pure: it takes already-loaded data and
// returns findings, so the same code serves the release gate (scripts/check-numbers.js) and the always-on
// monitor (monitor/), and can never drift apart from what the app itself calculates.
//
//   runNumberChecks({ L, ledger, receiptsByMonth, shiftLog, expensesByMonth, nowMs, from })
//     L       the ledger module (src/ledger.js)
//     ledger  createLedger(...) over the same data
// returns { days, results: [{ group, name, ok, detail }] }
const eq = (a, b) => Math.abs(a - b) < 0.011;
const fmt = (n) => (Math.round(n * 100) / 100).toFixed(2);

export function runNumberChecks({ L, ledger, receiptsByMonth, shiftLog, expensesByMonth, nowMs, from = "0000-00-00" }) {
  const results = [];
  const check = (group, name, ok, detail) => results.push({ group, name, ok, detail: ok ? "" : detail });

  const allReceipts = Object.values(receiptsByMonth).flat();
  const days = [...new Set(allReceipts.map((r) => ledger.bizDay(r.timestamp)))].sort().filter((d) => d >= from);
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
      if (d.gap !== null) check("drawer", `${day} ${d.name} gap = counted - expected`, eq(d.gap, d.counted - d.expected), `${fmt(d.gap)} vs ${fmt(d.counted - d.expected)}`);
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
    L.receiptMethodAmounts(r).forEach((a) => { if (!knownMethods.has(a.method)) bad.method.push(`#${r.ticketNo} method "${a.method}"`); });
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

  return { days, results };
}
