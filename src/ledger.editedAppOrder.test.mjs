// A price-list order whose payment method staff edited to cash/visa/wallet is still paid through its app:
//   node --no-warnings src/ledger.editedAppOrder.test.mjs
import assert from "node:assert/strict";
process.env.TZ = "Africa/Cairo";
const L = await import("./ledger.js");

const shiftHours = Object.fromEntries(["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((d) => [d, { start: "08:00", end: "04:00" }]));
const ts = "2026-10-20T09:00:00.000Z";
const order = (id, method, total, extra = {}) => ({ id, ticketNo: id, timestamp: ts, servedBy: { id: "A", name: "A" }, tableId: null, status: "completed", paid: true, paidAt: ts, items: [{ id: "x", name: "X", qty: 1, price: total }], subtotal: total, discount: null, discountAmount: 0, serviceRate: 0, serviceAmount: 0, vatRate: 0, vatAmount: 0, deliveryFee: 0, total, paymentMethod: method, ...extra });
const list = { id: "p1", name: "Talabat" };
const receipts = [
  order("1", "cash", 100),
  order("2", "cash", 270, { appPayment: "cash", priceList: list }), // created on the Talabat list, then edited to cash
  order("3", "visa", 535, { appPayment: "visa", priceList: list }),
  order("4", "cash", 50, { priceList: list }), // an older price-list order (no appPayment): untouched
];
const ledger = L.createLedger({ receiptsByMonth: { "2026-09": [], "2026-10": receipts, "2026-11": [] }, expensesByMonth: {}, shiftLog: [{ id: "s", employeeId: "A", employeeName: "A", clockIn: "2026-10-20T08:00:00.000Z", clockOut: "2026-10-20T18:00:00.000Z", openingCash: 50, openingCounted: true, countedCash: 200 }], openShifts: {}, shiftHours, menu: {}, labels: { methodByLabel: {}, isPayLabel: () => false } });
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log("ok:", name); };

ok("receiptMethodOf reads the app, not the edited method", () => {
  assert.equal(L.receiptMethodOf(receipts[1]), "talabat");
  assert.equal(L.receiptMethodOf(receipts[2]), "talabat");
  assert.equal(L.receiptMethodOf(receipts[0]), "cash");
  assert.equal(L.receiptMethodOf(receipts[3]), "cash");
});
ok("only the restaurant's own cash reaches the drawer", () => {
  const d = ledger.closeDay("2026-10-20", Date.parse("2026-10-21T00:00:00Z")).drawers[0];
  assert.equal(d.cashIn, 150); // #1 and the old #4
  assert.equal(d.expected, 200);
});
ok("the app owes both edited orders", () => {
  const owed = L.platformOwed(receipts).find((x) => x.id === "talabat");
  assert.equal(owed.owed, 805);
  assert.equal(owed.orders.length, 2);
});
ok("the delivery report counts no cash for them", () => {
  const dl = receipts.map((r) => ({ ...r, tableId: "delivery", assignedTo: { id: "T", name: "Talabat" } }));
  const lg = L.createLedger({ receiptsByMonth: { "2026-09": [], "2026-10": dl, "2026-11": [] }, expensesByMonth: {}, shiftLog: [], openShifts: {}, shiftHours, menu: {}, labels: { methodByLabel: {}, isPayLabel: () => false } });
  const rep = lg.deliveryReport("2026-10-20", "2026-10-20");
  assert.equal(rep.totals.orders, 4);
  assert.equal(rep.totals.cash, 150);
});
console.log(n, "checks passed");
