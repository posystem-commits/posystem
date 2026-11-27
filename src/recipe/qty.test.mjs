// node --no-warnings src/recipe/qty.test.mjs
import assert from "node:assert/strict";
import { parseQty, fmtRecipeQty, isCountUnit, QUICK_FRACTIONS } from "./qty.js";
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log("ok:", name); };

ok("typing decimals, commas and fractions", () => {
  assert.equal(parseQty("0.5"), 0.5);
  assert.equal(parseQty(".5"), 0.5);
  assert.equal(parseQty("0,5"), 0.5);
  assert.equal(parseQty("1/2"), 0.5);
  assert.equal(parseQty("3/4"), 0.75);
  assert.equal(parseQty("1 1/2"), 1.5);
  assert.equal(parseQty("1/3"), 0.3333);
  assert.equal(parseQty("2"), 2);
  assert.equal(parseQty("0.05"), 0.05);
});
ok("fraction glyphs and Arabic digits", () => {
  assert.equal(parseQty("½"), 0.5);
  assert.equal(parseQty("1½"), 1.5);
  assert.equal(parseQty("¼"), 0.25);
  assert.equal(parseQty("٠٫٥"), 0.5);
  assert.equal(parseQty("١/٢"), 0.5);
});
ok("junk is rejected", () => {
  for (const bad of ["", "abc", "1/0", "1//2", "--1", "1.2.3", null, undefined, "½½"]) assert.ok(Number.isNaN(parseQty(bad)), `rejects ${bad}`);
});
ok("showing amounts: fractions for counted units, trimmed decimals for weights", () => {
  assert.equal(fmtRecipeQty(0.5, "pcs"), "½");
  assert.equal(fmtRecipeQty(1.5, "pcs"), "1½");
  assert.equal(fmtRecipeQty(0.25, "slice"), "¼");
  assert.equal(fmtRecipeQty(0.3333, "pcs"), "⅓");
  assert.equal(fmtRecipeQty(2, "pcs"), "2");
  assert.equal(fmtRecipeQty(0.3, "kg"), "0.3");
  assert.equal(fmtRecipeQty(0.5, "kg"), "0.5");
  assert.equal(fmtRecipeQty(0.35, "pcs"), "0.35");
  assert.equal(fmtRecipeQty(125.5, "g"), "125.5");
});
ok("a typed fraction survives a round trip through the display", () => {
  for (const text of ["1/2", "1/4", "1/3", "2/3", "3/4", "1 1/4"]) {
    const q = parseQty(text);
    assert.equal(parseQty(fmtRecipeQty(q, "pcs")), q, text);
  }
});
ok("three servings of a third use up exactly one piece (no crumbs left)", () => {
  const third = parseQty("1/3");
  const used = Math.round(3 * third * 1000) / 1000;
  assert.equal(Math.max(0, Math.round((1 - used) * 1000) / 1000), 0);
  assert.equal(Math.floor(1 / third), 3);
});
ok("counted vs weighed units", () => {
  assert.ok(isCountUnit("pcs") && isCountUnit("slice"));
  assert.ok(!isCountUnit("kg") && !isCountUnit("ml"));
  assert.equal(QUICK_FRACTIONS.length, 7);
});
console.log(`${n} checks passed`);
