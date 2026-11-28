// A Talabat/Elmenus order the customer paid in CASH to the delivery agent is cash the agent holds (from AGENT_CASH_FROM on):
//   node --no-warnings src/ledger.agentCash.test.mjs
import assert from "node:assert/strict";
process.env.TZ = "Africa/Cairo";
const L = await import("./ledger.js");

const shiftHours = Object.fromEntries(["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((d) => [d, { start: "08:00", end: "04:00" }]));
const after = "2026-11-29T10:00:00.000Z";
const before = "2026-11-27T10:00:00.000Z";
const settledAt = "2026-11-29T14:00:00.000Z";
const rider = { id: "R", name: "Bal7a", role: "delivery" };
const appAgent = { id: "T", name: "Talabat", role: "delivery" };
const elmenus = { id: "p2", name: "Elmenus" };
const talabat = { id: "p1", name: "Talabat" };
const order = (id, total, extra = {}) => ({ id, ticketNo: id, timestamp: after, servedBy: { id: "A", name: "A" }, tableId: "delivery", assignedTo: rider, status: "completed", paid: true, paidAt: after, items: [{ id: "x", name: "X", qty: 1, price: total }], subtotal: total, discount: null, discountAmount: 0, serviceRate: 0, serviceAmount: 0, vatRate: 0, vatAmount: 0, deliveryFee: 0, total, paymentMethod: "elmenus", ...extra });
const receipts = [
  order("1", 200, { priceList: elmenus, appPayment: "cash", deliveryFee: 30 }), // customer paid cash to the restaurant's own rider
  order("2", 300, { priceList: talabat, appPayment: "cash", paymentMethod: "talabat", assignedTo: appAgent }), // ... to the app's own agent
  order("3", 400, { priceList: talabat, appPayment: "visa", paymentMethod: "talabat" }), // paid the app by card: the app owes it
  order("4", 150, { priceList: talabat, appPayment: "cash", paymentMethod: "talabat", assignedTo: undefined }), // nobody holds it yet
  order("5", 250, { priceList: talabat, appPayment: "cash", paymentMethod: "talabat", timestamp: before, paidAt: before }), // before the change
  order("6", 120, { priceList: talabat, appPayment: "cash", paymentMethod: "talabat", tableId: null }), // not a delivery
  order("7", 100, { paymentMethod: "cash" }), // the restaurant's own delivery order, cash
];
const build = (rs) => L.createLedger({ receiptsByMonth: { "2026-10": [], "2026-11": rs, "2026-12": [] }, expensesByMonth: {}, shiftLog: [], openShifts: {}, shiftHours, menu: {}, labels: { methodByLabel: {}, isPayLabel: () => false } });
const cash = (r) => L.receiptMethodAmounts(r).filter((a) => a.method === "cash").reduce((s, a) => s + a.amount, 0);
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log("ok:", name); };

ok("cash paid to either kind of agent counts as cash; everything else keeps its old treatment", () => {
  assert.equal(cash(receipts[0]), 200);
  assert.equal(cash(receipts[1]), 300);
  [2, 3, 4, 5].forEach((i) => assert.equal(cash(receipts[i]), 0, `order ${receipts[i].id}`));
  assert.equal(cash(receipts[6]), 100);
});
ok("the sale still belongs to the app", () => {
  assert.equal(L.receiptMethodOf(receipts[0]), "elmenus");
  assert.equal(L.receiptMethodOf(receipts[1]), "talabat");
});
ok("the app no longer owes what an agent holds", () => {
  const owed = (id) => L.platformOwed(receipts).find((x) => x.id === id);
  assert.equal(owed("elmenus").owed, 0);
  assert.equal(owed("talabat").owed, 400 + 150 + 250 + 120);
});
ok("the delivery report counts that cash for each agent", () => {
  const rep = build(receipts).deliveryReport("2026-11-29", "2026-11-29", (fee) => fee - 5);
  const by = Object.fromEntries(rep.agents.map((a) => [a.name, a]));
  assert.equal(by.Bal7a.cash, 300); // #1 (200) and the restaurant's own #7 (100)
  assert.equal(by.Talabat.cash, 300);
});
ok("the drawer receives it when the agent settles up (minus the rider's fee share), not before", () => {
  const flows = (rs) => L.cashFlows(rs, [], () => true);
  assert.equal(flows(receipts).cashIn, 0);
  const settled = receipts.map((r) => (r.id === "1" || r.id === "2" ? { ...r, deliverySettled: true, deliverySettledAt: settledAt, riderFeeShare: r.id === "1" ? 25 : 0 } : r));
  const f = flows(settled);
  assert.equal(f.cashIn, 500);
  assert.equal(f.riderPay, 25);
});
ok("settling an app's agent for cash held is not flagged as unusual", () => {
  const settled = receipts.map((r) => (r.id === "2" || r.id === "5" ? { ...r, assignedTo: appAgent, deliverySettled: true, deliverySettledAt: settledAt, riderFeeShare: 0 } : r));
  const shiftLog = [{ id: "s", employeeId: "A", employeeName: "A", clockIn: "2026-11-29T08:00:00.000Z", clockOut: "2026-11-29T18:00:00.000Z", openingCash: 0, openingCounted: true, countedCash: 300 }];
  const lg = L.createLedger({ receiptsByMonth: { "2026-10": [], "2026-11": settled, "2026-12": [] }, expensesByMonth: {}, shiftLog, openShifts: {}, shiftHours, menu: {}, labels: { methodByLabel: {}, isPayLabel: () => false } });
  const flags = Object.fromEntries(lg.closeDay("2026-11-29", Date.parse("2026-11-30T00:00:00Z")).drawers[0].settled.orders.map((o) => [o.n, o.flags]));
  assert.deepEqual(flags["2"], []);
  assert.deepEqual(flags["5"], ["old", "app", "noCash"]); // older order: unchanged
});
console.log(n, "checks passed");
