import { finding } from "../lib/findings.mjs";

const money = (n) => `${(Math.round(n * 100) / 100).toFixed(2)} EGP`;
const round2 = (n) => Math.round(n * 100) / 100;

// Operational checks: is the restaurant working normally, and does the cash add up? `isTest` restaurants (the
// owner's test tenant) skip the ones that only make sense for a real business.
export function businessChecks({ L, ledger, data, nowMs, cfg, isTest }) {
  const t = data.tenant;
  const th = cfg.thresholds;
  const base = { tenant: t.id, tenantName: t.restaurant_name };
  const out = [];
  const nowIso = new Date(nowMs).toISOString();

  // ---- subscription (the POS stops working when this lapses) ----
  if (t.status !== "active") {
    out.push(finding({ ...base, code: "TENANT_PAUSED", severity: "red", topic: "subscription", title: `${t.restaurant_name} is paused — its POS is blocked`, detail: `Status: ${t.status}` }));
  } else if (t.paid_until) {
    const days = Math.ceil((new Date(`${t.paid_until}T23:59:59Z`).getTime() - nowMs) / 86400000);
    if (days <= th.subscriptionDaysRed) out.push(finding({ ...base, code: "SUBSCRIPTION", severity: "red", topic: "subscription", title: `${t.restaurant_name}'s subscription ${days < 0 ? "has expired" : `expires in ${days} day(s)`}`, detail: `Paid until ${t.paid_until}. The POS stops for them the day after.` }));
    else if (days <= th.subscriptionDaysAmber) out.push(finding({ ...base, code: "SUBSCRIPTION", severity: "amber", topic: "subscription", title: `${t.restaurant_name}'s subscription expires in ${days} days`, detail: `Paid until ${t.paid_until}.` }));
  }
  if (isTest) return out;

  const shifts = ledger.allShifts();

  // ---- customer orders waiting too long for staff ----
  const waiting = (data.pendingOrders || [])
    .filter((o) => o.status !== "confirmed" && o.submittedAt)
    .map((o) => ({ o, mins: (nowMs - new Date(o.submittedAt).getTime()) / 60000 }))
    .filter((x) => x.mins >= th.pendingOrderMinutesAmber && x.mins < 180);
  if (waiting.length) {
    const oldest = Math.max(...waiting.map((x) => x.mins));
    out.push(finding({ ...base, code: "STALE_PENDING", severity: oldest >= th.pendingOrderMinutesRed ? "red" : "amber", topic: "orders", title: `${waiting.length} customer order(s) waiting for staff, oldest ${Math.round(oldest)} min`, detail: "Customers sent these from the ordering link and nobody has confirmed them. Is a terminal open and sound on?" }));
  }

  // ---- shifts left open ----
  Object.values(data.openShifts || {}).forEach((s) => {
    const hrs = (nowMs - new Date(s.clockIn).getTime()) / 3600000;
    if (hrs >= th.openShiftHoursAmber) {
      out.push(finding({ ...base, code: "LONG_OPEN_SHIFT", key: s.employeeId, severity: hrs >= th.openShiftHoursRed ? "red" : "amber", topic: "cash", title: `${s.employeeName} has been clocked in for ${Math.round(hrs)} hours`, detail: "A forgotten clock-out leaves the cash drawer open and skews the shift's numbers." }));
    }
  });

  // ---- the last few business days ----
  const today = ledger.bizDay(nowIso);
  const days = [0, 1, 2].map((i) => new Date(new Date(`${today}T00:00:00Z`).getTime() - i * 86400000).toISOString().slice(0, 10));
  days.forEach((day) => {
    const cd = ledger.closeDay(day, nowMs);
    if (!cd) return;
    cd.drawers.forEach((d) => {
      if (d.loading) return;
      if (d.gap !== null && Math.abs(d.gap) >= th.shiftGapAmber) {
        const sev = Math.abs(d.gap) >= th.shiftGapRed ? "red" : "amber";
        const why = d.solve && d.solve.items.length
          ? d.solve.type === "exact" ? `Recorded changes explain it exactly (${d.solve.items.length}): ${d.solve.items.map((e) => e.kind + (e.n ? ` #${e.n}` : "")).join(", ")}.` : `Recorded changes explain ${money(Math.abs(d.solve.explained))} of it; ${money(Math.abs(d.solve.rest))} is unexplained.`
          : "No recorded cause was found (no edits, cash expenses or returns account for it).";
        out.push(finding({ ...base, code: "CASH_GAP", key: d.key, severity: sev, topic: "cash", title: `${d.name}'s drawer was ${d.gap < 0 ? "short" : "over"} by ${money(Math.abs(d.gap))} (${day})`, detail: `Counted ${money(d.counted)}, should have been ${money(d.expected)}. ${why}` }));
      }
      if (d.handover !== null && Math.abs(d.handover) >= th.handoverAmber && (!d.between || Math.abs(d.between.residual) >= th.handoverAmber)) {
        const diff = d.between ? d.between.residual : d.handover;
        if (diff < 0) {
          // Less cash in the drawer at the start than was left at the end: money was taken out in between. For many
          // restaurants that is the owner's regular cash pickup, so it is reported as a pickup (and only flagged
          // when the restaurant has not been confirmed as doing this) rather than as an alarm.
          const expectedPickups = (cfg.cashPickupsExpected || []).includes(t.id);
          out.push(finding({ ...base, code: "CASH_PICKUP", key: d.key, severity: expectedPickups ? "info" : "amber", topic: "cash", title: `${money(Math.abs(diff))} was taken out of the drawer between ${d.prevName}'s close and ${d.name}'s open`, detail: `${d.prevName} counted ${money(d.prevCounted)}; ${d.name} opened with ${money(d.opening)}. If this is the usual cash pickup, tell me and I will stop flagging it.` }));
        } else {
          out.push(finding({ ...base, code: "HANDOVER", key: d.key, severity: Math.abs(diff) >= th.handoverRed ? "red" : "amber", topic: "cash", title: `More cash than expected appeared between shifts: ${d.prevName} left ${money(d.prevCounted)}, ${d.name} opened with ${money(d.opening)}`, detail: `Unexplained extra ${money(Math.abs(diff))} after counting the cash received and paid out in between.` }));
        }
      }
    });
    if (cd.outside.length) {
      const total = cd.outside.reduce((s, r) => s + r.total, 0);
      out.push(finding({ ...base, code: "OUTSIDE_SHIFT", key: day, severity: "amber", topic: "orders", title: `${cd.outside.length} order(s) worth ${money(total)} were rung up when nobody was clocked in (${day})`, detail: `Rung up by: ${[...new Set(cd.outside.map((r) => r.servedBy?.name || "—"))].join(", ")}. They count toward the day but not toward any shift's cash.` }));
    }
  });

  // ---- shifts without a count, and forgotten clock-outs ----
  const recentCut = nowMs - 7 * 86400000;
  shifts.forEach((s) => {
    if (!s.clockOut) return;
    const out_ = new Date(s.clockOut).getTime();
    if (out_ < recentCut) return;
    if (s.auto && out_ > nowMs - 3 * 86400000) out.push(finding({ ...base, code: "AUTO_CLOSED", key: s.key, severity: "amber", topic: "cash", title: `${s.name}'s shift was closed automatically (forgot to clock out)`, detail: "An auto-closed shift has no closing cash count." }));
    else if (s.counted === null && !s.auto && s.clockIn >= cfg.thresholds.countsRequiredFrom) out.push(finding({ ...base, code: "UNCOUNTED_SHIFT", key: s.key, severity: "amber", topic: "cash", title: `${s.name}'s shift ended without a cash count`, detail: `Shift ${s.clockIn.slice(0, 16)} → ${s.clockOut.slice(0, 16)}` }));
  });

  // ---- expenses recorded without a time ----
  const missing = Object.values(data.expensesByMonth).flat().filter((e) => !e.recordedAt && e.date >= new Date(nowMs - 7 * 86400000).toISOString().slice(0, 10));
  if (missing.length) out.push(finding({ ...base, code: "EXPENSE_NO_TIME", severity: "amber", topic: "data", title: `${missing.length} recent expense(s) have no recorded time`, detail: "Without a time the cash drawer can't tell which shift paid them." }));

  // ---- is it selling like it normally does? ----
  const completed = Object.values(data.receiptsByMonth).flat().filter((r) => r.status === "completed");
  const local = (iso) => new Date(iso);
  const hourStats = {}; // key `${weekday}-${hour}` -> counts per distinct day
  const seenDay = new Set();
  completed.forEach((r) => {
    const d = local(r.timestamp);
    if (nowMs - d.getTime() > 28 * 86400000 || nowMs - d.getTime() < 3600000) return;
    const k = `${d.getDay()}-${d.getHours()}`;
    (hourStats[k] ||= {});
    const day = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    hourStats[k][day] = (hourStats[k][day] || 0) + 1;
    seenDay.add(day);
  });
  const nowD = new Date(nowMs);
  const recentOrders = completed.some((r) => nowMs - new Date(r.timestamp).getTime() < 7 * 86400000);
  if (recentOrders) {
    let zero = 0;
    let expectedSum = 0;
    for (let i = 1; i <= cfg.thresholds.noSalesZeroHours; i++) {
      const h = new Date(nowMs - i * 3600000);
      const k = `${h.getDay()}-${h.getHours()}`;
      const days_ = Object.values(hourStats[k] || {});
      const expected = days_.length ? days_.reduce((s, v) => s + v, 0) / Math.max(days_.length, 3) : 0;
      const actual = completed.filter((r) => { const d = local(r.timestamp); return d.getFullYear() === h.getFullYear() && d.getMonth() === h.getMonth() && d.getDate() === h.getDate() && d.getHours() === h.getHours(); }).length;
      if (expected >= 2 && actual === 0) {
        zero++;
        expectedSum += expected;
      }
    }
    if (zero === cfg.thresholds.noSalesZeroHours) out.push(finding({ ...base, code: "NO_SALES", severity: "amber", topic: "orders", title: `No orders for the last ${zero} hours, which is unusual for this time`, detail: `At this time of the week it normally takes about ${Math.round(expectedSum / zero)} orders an hour. Is the restaurant closed, or is the POS not working?` }));
  }
  // yesterday against the same weekday over the last weeks
  const yesterday = days[1];
  const ys = ledger.period(yesterday, yesterday);
  if (ys) {
    const sameDay = [1, 2, 3, 4].map((w) => new Date(new Date(`${yesterday}T00:00:00Z`).getTime() - w * 7 * 86400000).toISOString().slice(0, 10)).map((d) => ledger.period(d, d)).filter((p) => p && p.orders > 0).map((p) => p.revenue).sort((a, b) => a - b);
    if (sameDay.length >= 3) {
      const median = sameDay[Math.floor(sameDay.length / 2)];
      if (ys.revenue < (median * cfg.thresholds.revenueDropPercent) / 100) out.push(finding({ ...base, code: "REVENUE_DROP", key: yesterday, severity: "amber", topic: "orders", title: `Sales on ${yesterday} were ${money(ys.revenue)}, much lower than the usual ${money(median)} for that weekday`, detail: "A quiet day, a closure, or orders not being recorded? Worth a quick check." }));
    }
  }

  // ---- days not signed off (only if the restaurant normally does) ----
  const signed = Object.keys(data.dayClosings || {}).filter((d) => d >= new Date(nowMs - 14 * 86400000).toISOString().slice(0, 10));
  if (signed.length) {
    const d2 = days[2];
    const p = ledger.period(d2, d2);
    if (p && p.orders > 0 && !(data.dayClosings || {})[d2]) out.push(finding({ ...base, code: "UNSIGNED_DAY", key: d2, severity: "info", topic: "cash", title: `${d2} was never signed off in Close the day`, detail: "" }));
  }
  return out;
}
