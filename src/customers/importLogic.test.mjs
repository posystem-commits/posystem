// node --no-warnings src/customers/importLogic.test.mjs
import assert from "node:assert/strict";
import { phoneKey, tidyPhone, looksLikePhone, readCustomers, buildPlan, applyPlan, exportRows } from "./importLogic.js";
import { parseCsv } from "../stock/importLogic.js";
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log("ok:", name); };

ok("one customer, however the number is written", () => {
  const k = phoneKey("01012345678");
  for (const v of ["+20 101 234 5678", "0020 101 234 5678", "201012345678", 1012345678, "٠١٠١٢٣٤٥٦٧٨", "010-1234-5678"]) assert.equal(phoneKey(v), k, String(v));
  assert.notEqual(phoneKey("01112345678"), k);
  assert.equal(phoneKey("2345678"), "2345678", "short numbers keep all digits");
});
ok("tidying a phone for storage", () => {
  assert.equal(tidyPhone(1012345678), "01012345678");
  assert.equal(tidyPhone("+201012345678"), "01012345678");
  assert.equal(tidyPhone("0101 234 5678"), "01012345678");
  assert.equal(tidyPhone("٠١٠١٢٣٤٥٦٧٨"), "01012345678");
});
ok("phone detection", () => {
  assert.ok(looksLikePhone("0101 234 5678") && looksLikePhone(1012345678) && looksLikePhone("+20 10 1234 5678"));
  assert.ok(!looksLikePhone("Sara") && !looksLikePhone("12") && !looksLikePhone("12 Nile Street"));
});
ok("English and Arabic headings in any order", () => {
  const en = readCustomers([["Address", "Mobile", "Customer name"], ["Maadi 9", "0101 234 5678", "Sara"], ["Zamalek", 1112345678, "Omar"]]);
  assert.deepEqual(en.customers.map((c) => [c.name, c.phoneRaw, c.address]), [["Sara", "0101 234 5678", "Maadi 9"], ["Omar", "1112345678", "Zamalek"]]);
  const ar = readCustomers([["اسم العميل", "رقم الموبايل", "العنوان"], ["سارة", "٠١٠١٢٣٤٥٦٧٨", "المعادي"]]);
  assert.equal(ar.customers[0].name, "سارة");
  assert.equal(ar.customers[0].address, "المعادي");
});
ok("no headings: columns recognised by content", () => {
  const r = readCustomers([["Sara Ali", "01012345678", "12 Nile Street, Maadi"], ["Omar", "01112345678", "Zamalek"]]);
  assert.deepEqual(r.customers.map((c) => [c.name, c.phoneRaw, c.address]), [["Sara Ali", "01012345678", "12 Nile Street, Maadi"], ["Omar", "01112345678", "Zamalek"]]);
});
ok("a phone column is needed", () => {
  assert.equal(readCustomers([["Name", "City"], ["Sara", "Cairo"]]).customers.length, 0);
});
ok("csv with ; and quotes", () => {
  const rows = parseCsv('Name;Phone;Address\nSara;01012345678;"Maadi, street 9"\n');
  const r = readCustomers(rows);
  assert.equal(r.customers[0].address, "Maadi, street 9");
});
const existing = {
  "01012345678": { name: "Sara", phone: "01012345678", address: "", orderCount: 5, lastOrder: "2026-10-20T10:00:00.000Z" },
  "01112345678": { name: "Omar", phone: "01112345678", address: "Zamalek", orderCount: 2, lastOrder: "2026-10-01T10:00:00.000Z" },
};
ok("plan: new, update, same, skip, error", () => {
  const sheet = readCustomers([["Name", "Phone", "Address"], ["Sara A.", "+201012345678", "Maadi 9"], ["Omar", "01112345678", "Zamalek"], ["Layla", "0122 222 2222", ""], ["Nobody", "", "x"], ["Dup1", "01555555555", ""], ["Dup2", "01555555555", "Giza"]]).customers;
  const plan = buildPlan(sheet, existing, { updateExisting: true });
  assert.deepEqual(plan.rows.map((r) => r.action), ["update", "same", "add", "error", "skip", "add"]);
  assert.equal(plan.rows[0].existingKey, "01012345678");
  assert.deepEqual(plan.rows[0].changes, ["name", "address"]);
  assert.equal(plan.rows[5].name, "Dup2", "the later duplicate wins");
  const off = buildPlan(sheet, existing, { updateExisting: false });
  assert.equal(off.rows[0].action, "skip");
  assert.equal(off.rows[2].action, "add");
});
ok("apply: keeps counts, never blanks a field, adds with tidy phones", () => {
  const sheet = readCustomers([["Name", "Phone", "Address"], ["Sara A.", "+201012345678", ""], ["Layla", 1222222222, "Nasr City"]]).customers;
  const { directory, added, updated } = applyPlan(buildPlan(sheet, existing), existing);
  assert.equal(added, 1);
  assert.equal(updated, 1);
  assert.equal(directory["01012345678"].name, "Sara A.");
  assert.equal(directory["01012345678"].orderCount, 5);
  assert.equal(directory["01012345678"].address, "", "a blank cell does not erase");
  assert.equal(directory["01222222222"].name, "Layla");
  assert.equal(directory["01222222222"].orderCount, 0);
  assert.equal(Object.keys(directory).length, 3, "nothing deleted");
  assert.equal(existing["01012345678"].name, "Sara", "the input is not mutated");
});
ok("export then import brings counts and dates back", () => {
  const rows = exportRows(existing);
  assert.equal(rows[0].name, "Sara");
  assert.equal(rows[0].lastOrder, "2026-10-20");
  const cells = [["Name", "Phone", "Address", "Orders", "Last order"], ...rows.map((r) => [r.name, r.phone, r.address, r.orders, r.lastOrder])];
  const back = readCustomers(cells).customers;
  const { directory } = applyPlan(buildPlan(back, {}), {});
  assert.equal(directory["01012345678"].orderCount, 5);
  assert.ok(directory["01012345678"].lastOrder.startsWith("2026-10-20"));
});
console.log(`${n} checks passed`);
