// Close the day: the delivery cash settled during a shift (with warnings), the split of cash paid out, and the handover
// after a shift that was left open for days:
//   node --no-warnings src/ledger.settledBlock.test.mjs
import assert from "node:assert/strict";
process.env.TZ = "Africa/Cairo";
const L = await import("./ledger.js");

const shiftHours = Object.fromEntries(["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((d) => [d, { start: "08:00", end: "04:00" }]));
const delivery = (id, ts, rider, method, total, fee, extra = {}) => ({
  id, ticketNo: id, timestamp: ts, servedBy: { id: "A", name: "A" }, assignedTo: rider, tableId: "delivery", status: "completed", paid: true, paidAt: ts,
  items: [{ id: "x", name: "X", qty: 1, price: total - fee }], subtotal: total - fee, discount: null, discountAmount: 0, serviceRate: 0, serviceAmount: 0, vatRate: 0, vatAmount: 0, deliveryFee: fee, total, paymentMethod: method, ...extra,
});
const ali = { id: "r1", name: "Ali" };
const app = { id: "r2", name: "Talabat" };
const settleAt = "2026-10-20T14:00:00.000Z";
const receipts = [
  delivery("1", "2026-10-20T09:00:00.000Z", ali, "cash", 200, 20, { deliverySettled: true, deliverySettledAt: settleAt, riderFeeShare: 15 }),
  delivery("2", "2026-10-15T09:00:00.000Z", ali, "cash", 180, 20, { deliverySettled: true, deliverySettledAt: settleAt, riderFeeShare: 15 }), // ordered days before
  delivery("3", "2026-10-20T10:00:00.000Z", app, "cash", 220, 20, { deliverySettled: true, deliverySettledAt: settleAt, riderFeeShare: 15 }),
  delivery("4", "2026-10-20T11:00:00.000Z", ali, "visa", 100, 20, { deliverySettled: true, deliverySettledAt: settleAt, riderFeeShare: 15 }),
];
const expenses = [{ id: "e1", status: "paid", paymentMethod: "cash", amount: 40, category: "x", date: "2026-10-20", recordedAt: "2026-10-20T12:00:00.000Z" }];
const make = (shiftLog) => L.createLedger({ receiptsByMonth: { "2026-09": [], "2026-10": receipts, "2026-11": [] }, expensesByMonth: { "2026-10": expenses }, shiftLog, openShifts: {}, shiftHours, menu: {}, labels: { methodByLabel: {}, isPayLabel: () => false } });
const shift = { id: "s", employeeId: "A", employeeName: "A", clockIn: "2026-10-20T08:00:00.000Z", clockOut: "2026-10-20T18:00:00.000Z", openingCash: 100, openingCounted: true, countedCash: 0 };
const cd = make([shift]).closeDay("2026-10-20", Date.parse("2026-10-21T00:00:00Z"));
const d = cd.drawers[0];
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log("ok:", name); };

ok("the shift lists the settlements made during it, with cash and agents' share", () => {
  assert.equal(d.settled.n, 4);
  assert.equal(d.settled.cash, 600, "200 + 180 + 220 (the card order brings no cash)");
  assert.equal(d.settled.share, 60);
});
ok("old orders, delivery-app riders and no-cash orders are flagged", () => {
  const f = Object.fromEntries(d.settled.flagged.map((o) => [o.n, o.flags]));
  assert.deepEqual(Object.keys(f).sort(), ["2", "3", "4"]);
  assert.deepEqual(f["2"], ["old"]);
  assert.deepEqual(f["3"], ["app"]);
  assert.deepEqual(f["4"], ["noCash"]);
});
ok("flagged settlements that brought cash are offered to the gap explainer as a shortage", () => {
  const ev = d.events.filter((e) => e.kind === "settledCash");
  assert.deepEqual(ev.map((e) => [e.n, e.amount]).sort(), [["2", -180], ["3", -220]]);
});
ok("cash paid out is split: expenses, delivery agents' share (returns are separate)", () => {
  assert.equal(d.cashExpenses, 40);
  assert.equal(d.riderPay, 60);
  assert.equal(d.paidOut, 100);
  assert.equal(cd.dayTotals.expenses, 40);
  assert.equal(cd.dayTotals.riderPay, 60);
  assert.equal(cd.dayTotals.paidOut, 100);
});
ok("a gap of exactly one flagged settlement's cash is explained by it", () => {
  // expected 100 + 600 - 100 = 600; counted 380 => gap -220 (the Talabat order)
  const g = make([{ ...shift, countedCash: 380 }]).closeDay("2026-10-20", Date.parse("2026-10-21T00:00:00Z")).drawers[0];
  assert.equal(g.gap, -220);
  assert.equal(g.solve.type, "exact");
  assert.deepEqual(g.solve.items.map((e) => e.n), ["3"]);
});
ok("a shift left open for days and closed today is compared with the next opening today", () => {
  const long = { id: "L", employeeId: "B", employeeName: "Doaa", clockIn: "2026-10-16T12:00:00.000Z", clockOut: "2026-10-20T07:00:00.000Z", openingCash: 100, openingCounted: true, countedCash: 110 };
  const next = { id: "N", employeeId: "A", employeeName: "Bakri", clockIn: "2026-10-20T07:05:00.000Z", clockOut: "2026-10-20T18:00:00.000Z", openingCash: 235, openingCounted: true, countedCash: 235 };
  const led = make([long, next]);
  const dd = led.closeDay("2026-10-20", Date.parse("2026-10-21T00:00:00Z")).drawers[0];
  assert.equal(dd.prevName, "Doaa");
  assert.equal(dd.prevCounted, 110);
  assert.equal(dd.handover, 125);
  assert.equal(led.closedOnDay(long, "2026-10-20", Date.parse("2026-10-21T00:00:00Z")), true);
  assert.equal(led.closedOnDay({ ...long, clockIn: "2026-10-19T20:00:00.000Z" }, "2026-10-20", Date.parse("2026-10-21T00:00:00Z")), false, "a normal overnight shift of the day before is not carried over");
});
console.log(`${n} checks passed`);
