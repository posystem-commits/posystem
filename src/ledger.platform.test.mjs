// Orders sold through a delivery app (Talabat, Elmenus) are sales that put no money in the drawer, and are owed by the app until marked received:
//   node --no-warnings src/ledger.platform.test.mjs
import assert from "node:assert/strict";
process.env.TZ = "Africa/Cairo";
const L = await import("./ledger.js");

const shiftHours = Object.fromEntries(["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((d) => [d, { start: "08:00", end: "04:00" }]));
const day = "2026-10-20";
const order = (id, method, total, extra = {}) => ({
  id, ticketNo: id, timestamp: "2026-10-20T09:00:00.000Z", servedBy: { id: "A", name: "A" }, tableId: null, status: "completed", paid: true, paidAt: "2026-10-20T09:00:00.000Z",
  items: [{ id: "x", name: "X", qty: 1, price: total }], subtotal: total, discount: null, discountAmount: 0, serviceRate: 0, serviceAmount: 0, vatRate: 0, vatAmount: 0, deliveryFee: 0, total, paymentMethod: method, ...extra,
});
const ledgerOf = (receipts) =>
  L.createLedger({
    receiptsByMonth: { "2026-09": [], "2026-10": receipts, "2026-11": [] }, expensesByMonth: {},
    shiftLog: [{ id: "s", employeeId: "A", employeeName: "A", clockIn: "2026-10-20T08:00:00.000Z", clockOut: "2026-10-20T18:00:00.000Z", openingCash: 100, openingCounted: true, countedCash: 150 }],
    openShifts: {}, shiftHours, menu: {}, labels: { methodByLabel: {}, isPayLabel: () => false },
  });
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log("ok:", name); };

const receipts = [
  order("1", "cash", 50),
  order("2", "talabat", 200),
  order("3", "talabat", 100, { platformSettled: true, platformSettledAt: "2026-11-01T10:00:00.000Z" }),
  order("4", "elmenus", 80),
  order("5", "talabat", 60, { status: "cancelled", cancelledAt: "2026-10-20T10:00:00.000Z", returnedAmounts: [{ method: "talabat", amount: 60 }] }),
];

ok("a delivery-app order is a normal sale in revenue and in the payment-method totals", () => {
  const p = ledgerOf(receipts).period(day, day);
  assert.equal(p.revenue, 430);
  assert.equal(p.byMethod.talabat, 300);
  assert.equal(p.byMethod.elmenus, 80);
  assert.equal(p.byMethod.cash, 50);
  assert.equal(Object.values(p.byMethod).reduce((s, v) => s + v, 0), p.revenue);
});

ok("a delivery-app order puts no money in the drawer", () => {
  const d = ledgerOf(receipts).closeDay(day, Date.parse("2026-10-21T00:00:00Z")).drawers[0];
  assert.equal(d.cashIn, 50);
  assert.equal(d.cashReturned, 0);
});

ok("each app owes only its paid, completed orders that are not yet marked received", () => {
  const owed = Object.fromEntries(L.platformOwed(receipts).map((x) => [x.id, x]));
  assert.equal(owed.talabat.owed, 200);
  assert.deepEqual(owed.talabat.orders.map((x) => x.r.id), ["2"]);
  assert.equal(owed.elmenus.owed, 80);
});

ok("marking an order received removes it from what is owed", () => {
  const settled = receipts.map((r) => (r.id === "2" ? { ...r, platformSettled: true } : r));
  assert.equal(L.platformOwed(settled).find((x) => x.id === "talabat").owed, 0);
});

ok("only the delivery apps are kept out of split payments and electronic reconciliation", () => {
  assert.deepEqual(L.DIRECT_METHODS.map((m) => m.id), ["cash", "visa", "instapay", "wallet"]);
  assert.deepEqual(L.PLATFORM_METHODS.map((m) => m.id), ["talabat", "elmenus"]);
  assert.ok(L.isPlatformMethod("talabat") && !L.isPlatformMethod("cash"));
});

console.log(`${n} checks passed`);
