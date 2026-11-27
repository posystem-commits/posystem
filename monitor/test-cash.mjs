// node --no-warnings monitor/test-cash.mjs
// The cash-count rules: a mistyped closing count, delivery cash settled into an uncounted drawer, and a shift that lasted days.
import assert from "node:assert/strict";
import { businessChecks } from "./checks/business.mjs";

const cfg = { testTenants: [], cashPickupsExpected: [], thresholds: { shiftGapAmber: 20, shiftGapRed: 100, handoverAmber: 20, handoverRed: 100, openShiftHoursAmber: 14, openShiftHoursRed: 24, countsRequiredFrom: "2026-01-01T00:00:00Z", noSalesZeroHours: 2, revenueDropPercent: 50, pendingOrderMinutesAmber: 10, pendingOrderMinutesRed: 20, subscriptionDaysAmber: 7, subscriptionDaysRed: 2 } };
const now = Date.parse("2026-11-27T12:00:00Z");
const tenant = { id: "T1", restaurant_name: "R", status: "active", paid_until: "2027-01-01" };
const drawer = (o) => ({ loading: false, key: o.key, name: o.name, clockIn: o.clockIn, clockOut: o.clockOut, opening: o.opening ?? 0, counted: o.counted ?? null, expected: o.expected ?? 0, gap: o.gap ?? null, solve: o.solve ?? null, impliedCollection: null, handover: o.handover ?? null, between: o.between ?? null, prevName: o.prevName ?? null, prevCounted: o.prevCounted ?? null, prevOut: o.prevOut ?? null });
const run = (drawersByDay, shifts = []) => {
  const ledger = {
    bizDay: () => "2026-11-27",
    allShifts: () => shifts,
    period: () => ({ orders: 0, revenue: 0 }),
    closeDay: (day) => ({ drawers: drawersByDay[day] || [], outside: [], revenue: 0 }),
  };
  return businessChecks({ L: {}, ledger, data: { tenant, openShifts: {}, pendingOrders: [], dayClosings: {}, receiptsByMonth: {}, expensesByMonth: {} }, nowMs: now, cfg, isTest: false });
};
const codes = (f) => f.map((x) => `${x.code}:${x.severity}`).sort();
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log("ok:", name); };

ok("a count the next shift contradicts is one amber 'mistyped' note, not a shortage plus cash appearing", () => {
  const a = drawer({ key: "a", name: "Ghazel", clockIn: "2026-11-25T07:00:00Z", clockOut: "2026-11-25T15:00:00Z", opening: 200, counted: 1, expected: 1334, gap: -1333 });
  const b = drawer({ key: "b", name: "Hesham", clockIn: "2026-11-25T15:01:00Z", clockOut: "2026-11-26T01:00:00Z", opening: 1334, counted: 2769, expected: 2769, gap: 0, handover: 1333, between: { residual: 1333 }, prevName: "Ghazel", prevCounted: 1, prevOut: "2026-11-25T15:00:00Z" });
  const f = run({ "2026-11-25": [a, b] });
  assert.deepEqual(codes(f), ["COUNT_MISTYPED:amber"]);
});
ok("a real shortage stays red when the next shift opened with the short count", () => {
  const a = drawer({ key: "a", name: "A", clockIn: "2026-11-26T07:00:00Z", clockOut: "2026-11-26T15:00:00Z", opening: 100, counted: 500, expected: 1000, gap: -500 });
  const b = drawer({ key: "b", name: "B", clockIn: "2026-11-26T15:01:00Z", clockOut: "2026-11-27T01:00:00Z", opening: 500, counted: 900, expected: 900, gap: 0, handover: 0, prevName: "A", prevCounted: 500, prevOut: "2026-11-26T15:00:00Z" });
  assert.deepEqual(codes(run({ "2026-11-26": [a, b] })), ["CASH_GAP:red"]);
});
ok("a gap that is exactly delivery cash settled into the drawer is amber and says so", () => {
  const solve = { type: "exact", explained: -280, rest: 0, items: [{ kind: "settledCash", n: "2", amount: -280 }] };
  const f = run({ "2026-11-26": [drawer({ key: "s", name: "Ahmed", clockIn: "2026-11-27T02:19:00Z", clockOut: "2026-11-27T02:27:00Z", counted: 0, expected: 280, gap: -280, solve })] });
  assert.deepEqual(codes(f), ["CASH_GAP:amber"]);
  assert.ok(f[0].detail.includes("marked settled into this drawer"));
});
ok("a settled-cash explanation mixed with other causes is not downgraded", () => {
  const solve = { type: "exact", explained: -380, rest: 0, items: [{ kind: "settledCash", n: "2", amount: -280 }, { kind: "discountDown", n: "4", amount: -100 }] };
  const f = run({ "2026-11-26": [drawer({ key: "s", name: "Ahmed", clockIn: "2026-11-26T07:00:00Z", clockOut: "2026-11-26T15:00:00Z", counted: 0, expected: 380, gap: -380, solve })] });
  assert.deepEqual(codes(f), ["CASH_GAP:red"]);
});
ok("a shift that lasted more than a day is reported, and noted on its gap", () => {
  const sh = { key: "L", name: "Doaa", clockIn: "2026-11-25T12:17:00Z", clockOut: "2026-11-27T02:18:00Z", counted: 23220 };
  const d = drawer({ key: "L", name: "Doaa", clockIn: sh.clockIn, clockOut: sh.clockOut, counted: 23220, expected: 11390, gap: 11830 });
  const f = run({ "2026-11-25": [d] }, [sh]);
  assert.deepEqual(codes(f), ["CASH_GAP:red", "LONG_SHIFT:amber"]);
  assert.ok(f.find((x) => x.code === "CASH_GAP").detail.includes("covers more than one day"));
});
console.log(n, "checks passed");
