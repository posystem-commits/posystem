// node --no-warnings src/stock/importLogic.test.mjs
import { readItems, buildPlan, normalizeUnit, parseQty, convertQty, parseCsv } from "./importLogic.js";
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error("FAIL:", m); } else console.log("ok:", m); };
const ing = {
  a: { id: "a", name: "Lamb rack", unit: "kg", stock: 2 },
  b: { id: "b", name: "لبن", unit: "L", stock: 10 },
  c: { id: "c", name: "Lemons", unit: "pcs", stock: 15 },
  d: { id: "d", name: "Espresso beans", unit: "kg", stock: 0.06 },
};
// 1. English headers in the user's order: item, balance, unit
let r = readItems([["Item", "Current Balance", "Unit"], ["Lamb Rack ", 3.5, "KG"], ["Burrata", "4", "kg"], ["Cups", 200, "pieces"]]);
let p = buildPlan(r.items, ing);
ok(p.counts.update === 1 && p.counts.add === 2 && p.counts.error === 0, "English headers: 1 update, 2 new");
ok(p.rows[0].existingId === "a" && p.rows[0].qty === 3.5, "name matched ignoring case and spaces");
ok(p.rows[2].unit === "pcs", "'pieces' becomes pcs");
// 2. Arabic headers, Arabic digits, alef/ya variants, decimal comma
r = readItems([["الصنف", "الرصيد", "الوحدة"], ["لَبَن", "٢٥", "لتر"], ["ليمون", "١٢٫٥", "قطعة"], ["سكر", "3,5", "كيلو"]]);
p = buildPlan(r.items, ing);
ok(p.rows[0].action === "update" && p.rows[0].qty === 25, "Arabic: diacritics ignored, ٢٥ = 25 L");
ok(p.rows[1].qty === 12.5 && p.rows[1].unit === "pcs", "Arabic decimal ١٢٫٥ = 12.5, قطعة = pcs");
ok(p.rows[2].qty === 3.5 && p.rows[2].unit === "kg", "3,5 = 3.5, كيلو = kg");
// 3. no headers: recognised by content
r = readItems([["Lemons", 20, "pcs"], ["Flour", 12.5, "kg"], ["Milk", 8, "L"], ["Salt", 3, "kg"]]);
ok(r.detected && r.detected.headerRow === -1 && r.detected.cols.name === 0 && r.detected.cols.balance === 1 && r.detected.cols.unit === 2, "no-header sheet: name/balance/unit found by content");
// 4. conversions and mismatches
r = readItems([["name", "unit", "quantity"], ["Lamb rack", "g", 1500], ["Lemons", "kg", 2], ["Espresso beans", "kg", 0.06]]);
p = buildPlan(r.items, ing);
ok(p.rows[0].action === "update" && p.rows[0].qty === 1.5 && p.rows[0].unit === "kg", "1500 g converted to 1.5 kg");
ok(p.rows[1].action === "error" && /counted in pcs/.test(p.rows[1].note), "kg vs pcs is refused, not guessed");
ok(p.rows[2].action === "same", "unchanged balance is reported as same");
// 5. problems
r = readItems([["name", "balance", "unit"], ["X", "abc", "kg"], ["Y", -1, "kg"], ["Z", 5, ""], ["", 5, "kg"], ["Dup", 1, "kg"], ["dup", 2, "kg"]]);
p = buildPlan(r.items, {});
ok(p.rows[0].note === "balance is not a number", "text balance rejected");
ok(p.rows[1].note === "balance is negative", "negative rejected");
ok(p.rows[2].note === "no unit", "new item without unit rejected");
ok(p.rows[3].note === "no name", "row without name rejected");
ok(p.rows[4].action === "skip" && p.rows[5].action === "add" && p.rows[5].qty === 2, "duplicate name: the last row wins");
// 6. add-only mode
p = buildPlan(readItems([["name", "balance", "unit"], ["Lamb rack", 9, "kg"], ["New", 1, "kg"]]).items, ing, { updateExisting: false });
ok(p.counts.skip === 1 && p.counts.add === 1 && p.counts.update === 0, "add-only mode leaves existing items alone");
// 7. helpers
ok(parseQty("1,250") === 1250 && parseQty("2,5") === 2.5 && parseQty(" 7 ") === 7 && parseQty("a") === null, "parseQty");
ok(normalizeUnit("Kg.").known === false || true, "unit parsing does not crash on odd input");
ok(convertQty(500, "ml", "L") === 0.5 && convertQty(1, "kg", "pcs") === null, "convertQty");
// 8. csv
const csv = parseCsv("\uFEFFItem;Balance;Unit\r\n\"Olive oil, extra\";4,5;L\r\nSugar;10;kg\r\n");
ok(csv.length === 3 && csv[1][0] === "Olive oil, extra" && csv[1][1] === "4,5", "csv with ; delimiter, quotes and BOM");
p = buildPlan(readItems(csv).items, {});
ok(p.rows[0].qty === 4.5 && p.rows[0].unit === "L", "csv row parsed");
process.exit(fails ? 1 : 0);
