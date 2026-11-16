// The Dashboard's delivery report: day by day, for each delivery agent:
//   node --no-warnings src/ledger.deliveryReport.test.mjs
import assert from "node:assert/strict";
process.env.TZ = "Africa/Cairo";
const L = await import("./ledger.js");

const shiftHours = Object.fromEntries(["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((d) => [d, { start: "08:00", end: "04:00" }]));
const order = (id, ts, agent, method, total, fee, extra = {}) => ({
  id, ticketNo: id, timestamp: ts, servedBy: { id: "A", name: "A" }, assignedTo: agent, tableId: "delivery", status: "completed", paid: true, paidAt: ts,
  items: [{ id: "x", name: "X", qty: 1, price: total - fee }], subtotal: total - fee, discount: null, discountAmount: 0, serviceRate: 0, serviceAmount: 0, vatRate: 0, vatAmount: 0, deliveryFee: fee, total, paymentMethod: method, ...extra,
});
const ali = { id: "r1", name: "Ali" };
const omar = { id: "r2", name: "Omar" };
const receipts = [
  order("1", "2026-10-20T09:00:00.000Z", ali, "cash", 200, 20, { deliverySettled: true, deliverySettledAt: "2026-10-21T01:00:00.000Z", riderFeeShare: 15 }),
  order("2", "2026-10-20T10:00:00.000Z", ali, "visa", 100, 20),
  order("3", "2026-10-21T09:00:00.000Z", ali, "cash", 150, 10),
  order("4", "2026-10-21T10:00:00.000Z", omar, "cash", 300, 30),
  order("5", "2026-10-21T11:00:00.000Z", undefined, "cash", 80, 0),
  order("6", "2026-10-21T12:00:00.000Z", ali, "cash", 90, 10, { status: "cancelled" }),
  { ...order("7", "2026-10-21T13:00:00.000Z", ali, "cash", 60, 0), tableId: "3" },
];
const ledger = L.createLedger({ receiptsByMonth: { "2026-09": [], "2026-10": receipts, "2026-11": [] }, expensesByMonth: {}, shiftLog: [], openShifts: {}, shiftHours, menu: {}, labels: { methodByLabel: {}, isPayLabel: () => false } });
const share = (fee) => Math.round(fee * 0.75 * 100) / 100; // the agent keeps 75% of a fee
const rep = ledger.deliveryReport("2026-10-20", "2026-10-21", share);
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log("ok:", name); };

ok("only completed delivery orders are counted, grouped by agent (unassigned last)", () => {
  assert.deepEqual(rep.agents.map((a) => a.id), ["r1", "r2", "none"]);
  assert.equal(rep.totals.orders, 5, "the cancelled order and the dine-in order are left out");
});
ok("each agent has one row per day, oldest first", () => {
  const a = rep.agents[0];
  assert.deepEqual(a.days.map((d) => [d.day, d.orders]), [["2026-10-20", 2], ["2026-10-21", 1]]);
});
ok("fees, order amount (without the fee) and cash add up", () => {
  const d = rep.agents[0].days[0];
  assert.equal(d.fees, 40);
  assert.equal(d.orderAmount, 260, "180 + 80");
  assert.equal(d.cash, 200, "only the cash order");
  assert.equal(rep.agents[0].fees, 50);
});
ok("a settled order uses the share saved at settlement; an open one uses the current setting", () => {
  const d = rep.agents[0].days[0];
  assert.equal(d.riderShare, 15 + 15, "order 1 saved 15; order 2 is open: 75% of 20 = 15");
  assert.equal(d.restaurantShare, 10);
  assert.equal(d.settled, 1);
  assert.equal(rep.agents[0].days[1].riderShare, 7.5);
});
ok("the totals are the sum of the agents", () => {
  assert.equal(rep.totals.fees, 50 + 30 + 0);
  assert.equal(round(rep.agents.reduce((s, a) => s + a.riderShare, 0)), rep.totals.riderShare);
});
ok("a day or an agent with no deliveries does not appear; a month that is not loaded gives null", () => {
  assert.equal(ledger.deliveryReport("2026-10-22", "2026-10-22", share).agents.length, 0);
  assert.equal(ledger.deliveryReport("2027-01-01", "2027-01-02", share), null);
});
function round(x) { return Math.round(x * 100) / 100; }
console.log(`${n} checks passed`);
