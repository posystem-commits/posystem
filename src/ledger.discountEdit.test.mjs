// A discount added to an order after it was paid must show up in Close the day as an event that explains the
// cash gap — worked out with the real ledger on a made-up shift.
//   node --no-warnings src/ledger.discountEdit.test.mjs
import assert from "node:assert/strict";
process.env.TZ = "Africa/Cairo";
const L = await import("./ledger.js");

const shiftHours = Object.fromEntries(["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((d) => [d, { start: "08:00", end: "04:00" }]));
const day = "2026-10-20";
const clockIn = "2026-10-20T08:00:00.000Z";
const clockOut = "2026-10-20T16:00:00.000Z";
const orderAt = "2026-10-20T10:00:00.000Z";
const editAt = "2026-10-20T11:00:00.000Z";

const receipt = (extra = {}) => ({
  id: "1-1", ticketNo: 1, timestamp: orderAt, servedBy: { id: "e1", name: "Mariem" }, status: "completed", paid: true, paidAt: orderAt,
  items: [{ id: "a", name: "Burger", qty: 2, price: 100 }], subtotal: 200, discount: null, discountAmount: 0, serviceRate: 0, serviceAmount: 0, vatRate: 0, vatAmount: 0, deliveryFee: 0,
  total: 200, paymentMethod: "cash", ...extra,
});
const build = (r) => L.createLedger({
  receiptsByMonth: { "2026-10": [r], "2026-09": [], "2026-11": [] },
  expensesByMonth: {},
  shiftLog: [{ id: "s1", employeeId: "e1", employeeName: "Mariem", clockIn, clockOut, openingCash: 100, countedCash: 360, openingCounted: true }],
  openShifts: {}, shiftHours, menu: {}, labels: { methodByLabel: {}, isPayLabel: () => false },
});
const events = (r) => build(r).closeDay(day, Date.parse("2026-10-21T00:00:00Z")).drawers[0].events;

// the discount was added after payment: 20 off a 200 bill, the customer paid the full 200 in cash earlier
const edited = receipt({
  discount: { type: "fixed", value: 20, reason: "regular customer" }, discountAmount: 20, total: 180,
  editHistory: [{ timestamp: editAt, editedBy: { id: "m", name: "Manager" }, reason: "", totalBefore: 200, totalAfter: 180, changes: [{ name: "Discount", from: 0, to: 20, kind: "discount", detail: "EGP 20 — regular customer" }] }],
});
const ev = events(edited);
assert.equal(ev.length, 1, "one event explains the discount");
assert.equal(ev[0].kind, "discountDown");
assert.equal(ev[0].amount, 20, "the bill is 20 lower, so 20 extra cash may sit in the drawer");
assert.ok(ev[0].list.includes("Discount"), "names the discount");
assert.equal(ev[0].by, "Manager");

// the discount was removed: bill goes up
const removed = receipt({
  total: 200,
  editHistory: [{ timestamp: editAt, editedBy: { id: "m", name: "Manager" }, reason: "", totalBefore: 180, totalAfter: 200, changes: [{ name: "Discount", from: 20, to: 0, kind: "discount", detail: "removed" }] }],
});
const ev2 = events(removed);
assert.equal(ev2[0].kind, "discountUp");
assert.equal(ev2[0].amount, -20);

// dishes AND a discount in one edit are still one event, worded as a quantity edit
const mixed = receipt({
  items: [{ id: "a", name: "Burger", qty: 1, price: 100 }], subtotal: 100, discount: { type: "fixed", value: 10, reason: "x y z" }, discountAmount: 10, total: 90,
  editHistory: [{ timestamp: editAt, editedBy: { id: "m", name: "Manager" }, reason: "", totalBefore: 200, totalAfter: 90, changes: [{ name: "Burger", from: 2, to: 1 }, { name: "Discount", from: 0, to: 10, kind: "discount" }] }],
});
const ev3 = events(mixed);
assert.equal(ev3.length, 1);
assert.equal(ev3[0].kind, "qtyDown");
assert.equal(ev3[0].amount, 110);
assert.ok(ev3[0].list.includes("Burger") && ev3[0].list.includes("Discount"));

// an edit before payment is not an after-payment event (nothing changes for orders without edits)
assert.equal(events(receipt()).length, 0);
console.log("4 checks passed");
