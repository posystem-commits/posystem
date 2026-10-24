import assert from "node:assert/strict";
import { buildTicket, ticketBodyHtml, addToQueue, parseQueue, ticketsToPrint, countItems } from "./kitchenTicket.js";

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log("ok:", name); };
const labels = {
  title: "KITCHEN ORDER", ticketNumber: (x) => `Ticket #${x}`, takeaway: "Takeaway", pickup: "Pickup", delivery: (z) => `Delivery · ${z}`,
  added: "ADDED", total: (x) => `Total items: ${x}`, servedBy: (x) => `By ${x}`, eta: (x) => `Ready: ${x}`,
};
const t0 = Date.parse("2026-10-24T12:00:00Z");

ok("ticket carries no prices", () => {
  const t = buildTicket({ ticketNo: 7, table: "Table 3", items: [{ name: "Burger", qty: 2, price: 123.45, note: " no onion " }, { name: "Gone", qty: 0, price: 5 }], servedBy: "Mariem", now: t0, nonce: "a" });
  assert.equal(JSON.stringify(t).includes("123"), false);
  assert.equal(t.items.length, 1);
  assert.equal(t.items[0].note, "no onion");
  assert.equal(countItems(t), 2);
});
ok("html shows quantity, name, note, table; no price words", () => {
  const t = buildTicket({ ticketNo: 7, table: "Table 3", items: [{ name: "Burger <b>", qty: 2, price: 123.45, note: "no onion" }], now: t0, nonce: "a" });
  const h = ticketBodyHtml(t, labels, "14:02");
  assert.ok(h.includes("Table 3") && h.includes("2&times;") && h.includes("no onion") && h.includes("Ticket #7"));
  assert.ok(h.includes("Burger &lt;b&gt;"), "names are escaped");
  assert.ok(!h.includes("123"));
});
ok("takeaway, delivery and added-items banners", () => {
  const a = ticketBodyHtml(buildTicket({ ticketNo: 1, items: [{ name: "X", qty: 1 }], now: t0, nonce: "b" }), labels, "1");
  assert.ok(a.includes("Takeaway"));
  const d = ticketBodyHtml(buildTicket({ ticketNo: 1, items: [{ name: "X", qty: 1 }], deliveryMethod: "delivery", zoneLabel: "Maadi", customerName: "Sara", extra: true, now: t0, nonce: "c" }), labels, "1");
  assert.ok(d.includes("Delivery · Maadi") && d.includes("Sara") && d.includes("ADDED"));
});
ok("queue keeps new tickets, drops old and duplicates, stays short", () => {
  let q = [];
  const mk = (i, at) => ({ ...buildTicket({ ticketNo: i, items: [{ name: "X", qty: 1 }], now: at, nonce: String(i) }) });
  q = addToQueue(q, mk(1, t0 - 13 * 3600e3), t0 - 13 * 3600e3);
  q = addToQueue(q, mk(2, t0), t0);
  assert.equal(q.length, 1, "13h-old ticket is dropped");
  q = addToQueue(q, q[0], t0);
  assert.equal(q.length, 1, "same id is not added twice");
  for (let i = 10; i < 70; i++) q = addToQueue(q, mk(i, t0 + i), t0 + i);
  assert.equal(q.length, 40);
});
ok("station prints only new, unprinted tickets, oldest first", () => {
  const mk = (i, at) => buildTicket({ ticketNo: i, items: [{ name: "X", qty: 1 }], now: at, nonce: String(i) });
  const q = [mk(3, t0 + 3000), mk(1, t0 - 60e3), mk(2, t0 + 1000), mk(4, t0 - 8 * 3600e3)];
  const out = ticketsToPrint(q, [q[2].id], t0 - 30e3, t0 + 5000);
  assert.deepEqual(out.map((x) => x.ticketNo), [3], "1 is before the station was switched on, 2 already printed, 4 too old");
  const all = ticketsToPrint(q, [], t0 - 120e3, t0 + 5000);
  assert.deepEqual(all.map((x) => x.ticketNo), [1, 2, 3]);
});
ok("parseQueue survives junk", () => {
  assert.deepEqual(parseQueue(null), []);
  assert.deepEqual(parseQueue("not json"), []);
  assert.deepEqual(parseQueue('{"a":1}'), []);
  assert.equal(parseQueue('[{"id":"x","items":[]},{"nope":1}]').length, 1);
});
console.log(`${n} checks passed`);
