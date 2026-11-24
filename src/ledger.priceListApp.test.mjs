// An order rung up on a price list is paid through that list's app: never drawer cash, owed by the app:
//   node --no-warnings src/ledger.priceListApp.test.mjs
import assert from "node:assert/strict";
process.env.TZ = "Africa/Cairo";
const L = await import("./ledger.js");

const shiftHours = Object.fromEntries(["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((d) => [d, { start: "08:00", end: "04:00" }]));
const ts = "2026-10-20T09:00:00.000Z";
const order = (id, method, total, extra = {}) => ({ id, ticketNo: id, timestamp: ts, servedBy: { id: "A", name: "A" }, tableId: null, status: "completed", paid: true, paidAt: ts, items: [{ id: "x", name: "X", qty: 1, price: total }], subtotal: total, discount: null, discountAmount: 0, serviceRate: 0, serviceAmount: 0, vatRate: 0, vatAmount: 0, deliveryFee: 0, total, paymentMethod: method, ...extra });
const listId = "x_lprofile1abc";
const receipts = [
  order("1", "cash", 100),
  order("2", "talabat", 200, { appPayment: "cash", priceList: { id: "p1", name: "Talabat" } }),
  order("3", listId, 300, { appPayment: "visa", priceList: { id: "profile_1abc", name: "Jahez" } }),
];
const ledger = L.createLedger({ receiptsByMonth: { "2026-09": [], "2026-10": receipts, "2026-11": [] }, expensesByMonth: {}, shiftLog: [{ id: "s", employeeId: "A", employeeName: "A", clockIn: "2026-10-20T08:00:00.000Z", clockOut: "2026-10-20T18:00:00.000Z", openingCash: 50, openingCounted: true, countedCash: 150 }], openShifts: {}, shiftHours, menu: {}, labels: { methodByLabel: {}, isPayLabel: () => false } });
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log("ok:", name); };

ok("the id a price list gets is a valid custom method id", () => assert.equal(L.isCustomMethodId(listId), true));
ok("only the restaurant's own cash order reaches the drawer", () => {
  const d = ledger.closeDay("2026-10-20", Date.parse("2026-10-21T00:00:00Z")).drawers[0];
  assert.equal(d.cashIn, 100);
  assert.equal(d.expected, 150);
  assert.equal(d.gap, 0);
});
ok("each app owes the restaurant what was sold through it", () => {
  const apps = [...L.PLATFORM_METHODS, { id: listId, label: "Jahez" }];
  const owed = Object.fromEntries(L.platformOwed(receipts, apps).map((a) => [a.id, a.owed]));
  assert.equal(owed.talabat, 200);
  assert.equal(owed[listId], 300);
  assert.equal(owed.elmenus, 0);
});
console.log(`${n} checks passed`);
