// The end-of-day cash collection on Close the day:  node --no-warnings src/ledger.collection.test.mjs
import assert from "node:assert/strict";
process.env.TZ = "Africa/Cairo";
const L = await import("./ledger.js");

const shiftHours = Object.fromEntries(["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((d) => [d, { start: "08:00", end: "04:00" }]));
const day = "2026-10-20";
const cash = (id, who, at, total) => ({ id, ticketNo: id, timestamp: at, servedBy: { id: who, name: who }, status: "completed", paid: true, paidAt: at, items: [{ id: "x", name: "X", qty: 1, price: total }], subtotal: total, discount: null, discountAmount: 0, serviceRate: 0, serviceAmount: 0, vatRate: 0, vatAmount: 0, deliveryFee: 0, total, paymentMethod: "cash" });
const receipts = [cash("1", "A", "2026-10-20T10:00:00.000Z", 200), cash("2", "B", "2026-10-20T20:00:00.000Z", 500)];
const shiftLog = (bCounted) => [
  { id: "sa", employeeId: "A", employeeName: "A", clockIn: "2026-10-20T08:00:00.000Z", clockOut: "2026-10-20T16:00:00.000Z", openingCash: 100, openingCounted: true, countedCash: 300 },
  { id: "sb", employeeId: "B", employeeName: "B", clockIn: "2026-10-20T16:05:00.000Z", clockOut: "2026-10-20T23:30:00.000Z", openingCash: 300, openingCounted: true, countedCash: bCounted },
];
const closeDay = (bCounted, collections) =>
  L.createLedger({ receiptsByMonth: { "2026-09": [], "2026-10": receipts, "2026-11": [] }, expensesByMonth: {}, shiftLog: shiftLog(bCounted), openShifts: {}, shiftHours, menu: {}, labels: { methodByLabel: {}, isPayLabel: () => false }, collections }).closeDay(day, Date.parse("2026-10-21T12:00:00Z"));
const col = (amount) => ({ [day]: { amount, by: { id: "m", name: "Manager" }, at: "2026-10-20T23:40:00.000Z" } });
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log("ok:", name); };

ok("no collection typed, last shift counted after collecting: it is an implied collection, not a plain shortage", () => {
  const cd = closeDay(0, {});
  const [a, b] = cd.drawers;
  assert.equal(a.gap, 0);
  assert.equal(a.impliedCollection, null, "only the last shift of the day can imply a collection");
  assert.equal(b.expected, 800);
  assert.equal(b.gap, -800);
  assert.equal(b.impliedCollection, 800);
  assert.equal(cd.dayTotals.impliedCollection, 800);
  assert.equal(cd.collection, null);
});
ok("the exact amount recorded: the drawer checks out", () => {
  const cd = closeDay(0, col(800));
  const b = cd.drawers[1];
  assert.equal(b.collected, 800);
  assert.equal(b.gap, 0);
  assert.equal(b.impliedCollection, null);
  assert.equal(cd.dayTotals.collected, 800);
  assert.equal(cd.dayTotals.gap, 0);
  assert.equal(cd.collection.amount, 800);
});
ok("a smaller amount recorded than the drawer lost: the difference is a real shortage", () => {
  const cd = closeDay(0, col(790));
  assert.equal(cd.drawers[1].gap, -10);
  assert.equal(cd.dayTotals.gap, -10);
});
ok("counted more than should remain after the collection: shown as over", () => {
  const cd = closeDay(5, col(800));
  assert.equal(cd.drawers[1].gap, 5);
});
ok("the first shift of the day is never given the collection", () => {
  const cd = closeDay(0, col(800));
  assert.equal(cd.drawers[0].collected, 0);
});
ok("whole-day difference always equals the shifts' differences plus the unexplained handovers", () => {
  [closeDay(0, {}), closeDay(0, col(800)), closeDay(0, col(790)), closeDay(5, col(800)), closeDay(800, {})].forEach((cd) => {
    assert.equal(Math.round((cd.dayTotals.shiftGaps + cd.dayTotals.residuals) * 100), Math.round(cd.dayTotals.gap * 100));
  });
});
ok("a day with no collection and no shortage is unchanged", () => {
  const cd = closeDay(800, {});
  assert.equal(cd.drawers[1].gap, 0);
  assert.equal(cd.drawers[1].impliedCollection, null);
  assert.equal(cd.dayTotals.gap, 0);
});
console.log(`${n} checks passed`);
