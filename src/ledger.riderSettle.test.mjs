// A rider settling up moves only what the rider hands over (or what the restaurant pays them) through the drawer:
//   node --no-warnings src/ledger.riderSettle.test.mjs
import assert from "node:assert/strict";
process.env.TZ = "Africa/Cairo";
const L = await import("./ledger.js");

const shiftHours = Object.fromEntries(["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((d) => [d, { start: "08:00", end: "04:00" }]));
const day = "2026-10-20";
const delivery = (id, method, total, fee, extra = {}) => ({
  id, ticketNo: id, timestamp: "2026-10-20T09:00:00.000Z", servedBy: { id: "A", name: "A" }, assignedTo: { id: "rider1", name: "Ali" }, tableId: "delivery", status: "completed", paid: true, paidAt: "2026-10-20T09:00:00.000Z",
  items: [{ id: "x", name: "X", qty: 1, price: total - fee }], subtotal: total - fee, discount: null, discountAmount: 0, serviceRate: 0, serviceAmount: 0, vatRate: 0, vatAmount: 0, deliveryFee: fee, total, paymentMethod: method, ...extra,
});
const closeDay = (receipts, counted) =>
  L.createLedger({
    receiptsByMonth: { "2026-09": [], "2026-10": receipts, "2026-11": [] }, expensesByMonth: {},
    shiftLog: [{ id: "s", employeeId: "A", employeeName: "A", clockIn: "2026-10-20T08:00:00.000Z", clockOut: "2026-10-20T18:00:00.000Z", openingCash: 100, openingCounted: true, countedCash: counted }],
    openShifts: {}, shiftHours, menu: {}, labels: { methodByLabel: {}, isPayLabel: () => false },
  }).closeDay(day, Date.parse("2026-10-21T00:00:00Z")).drawers[0];
const at = "2026-10-20T14:00:00.000Z";
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log("ok:", name); };

// Ali collected 200 in cash (fee 20) and a 100 card order (fee 20). He keeps 15 of each fee. He hands over 200 - 30 = 170.
const settled = [
  delivery("1", "cash", 200, 20, { deliverySettled: true, deliverySettledAt: at, riderFeeShare: 15 }),
  delivery("2", "visa", 100, 20, { deliverySettled: true, deliverySettledAt: at, riderFeeShare: 15 }),
];
ok("settling brings in the cash collected and takes out the rider's share: the drawer gets what is handed over", () => {
  const d = closeDay(settled, 270);
  assert.equal(d.cashIn, 200);
  assert.equal(d.riderPay, 30);
  assert.equal(d.paidOut, 30);
  assert.equal(d.expected, 270, "100 opening + 200 collected - 30 rider's share");
  assert.equal(d.gap, 0);
});
ok("without the saved share (older settlements) nothing changes", () => {
  const old = settled.map(({ riderFeeShare, ...r }) => r);
  const d = closeDay(old, 300);
  assert.equal(d.riderPay, 0);
  assert.equal(d.expected, 300);
});
ok("orders not settled yet are still with the rider: nothing enters or leaves the drawer", () => {
  const open = [delivery("1", "cash", 200, 20), delivery("2", "visa", 100, 20)];
  const d = closeDay(open, 100);
  assert.equal(d.cashIn, 0);
  assert.equal(d.riderPay, 0);
  assert.equal(d.expected, 100);
});
ok("when the restaurant owes the rider (card orders only) the payout leaves the drawer", () => {
  const cardOnly = [delivery("2", "visa", 100, 20, { deliverySettled: true, deliverySettledAt: at, riderFeeShare: 15 })];
  const d = closeDay(cardOnly, 85);
  assert.equal(d.cashIn, 0);
  assert.equal(d.paidOut, 15);
  assert.equal(d.expected, 85);
});
ok("a settlement outside the shift's hours is not charged to it", () => {
  const late = settled.map((r) => ({ ...r, deliverySettledAt: "2026-10-20T20:00:00.000Z" }));
  const d = closeDay(late, 100);
  assert.equal(d.cashIn, 0);
  assert.equal(d.riderPay, 0);
});
console.log(`${n} checks passed`);
