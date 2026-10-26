// node --no-warnings src/menu/mainCategories.test.mjs
import assert from "node:assert/strict";
import { orderCategoriesByMain, mainTabsFor, addSubToMain, removeSubFromMain, removeSubEverywhere, moveSubInMain, moveMain, cleanMains, OTHER_MAIN_ID } from "./mainCategories.js";
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log("ok:", name); };
const cats = ["Cow Burger", "Doner Burger", "Bomb Burger", "Butterfly Chicken", "Crispy Chicken", "Drinks"];
const mains = [{ id: "m1", name: "Beef", subs: ["Bomb Burger", "Cow Burger"] }, { id: "m2", name: "Chicken", subs: ["Crispy Chicken", "Butterfly Chicken"] }];

ok("no main categories: nothing changes", () => {
  assert.deepEqual(orderCategoriesByMain(cats, []), cats);
  assert.deepEqual(mainTabsFor(cats, [], "Other"), []);
});
ok("tabs: each main with its categories, then Other for the rest", () => {
  const tabs = mainTabsFor(cats, mains, "Other");
  assert.deepEqual(tabs.map((t) => t.name), ["Beef", "Chicken", "Other"]);
  assert.deepEqual(tabs[0].subs, ["Bomb Burger", "Cow Burger"]);
  assert.deepEqual(tabs[2].subs, ["Doner Burger", "Drinks"]);
  assert.equal(tabs[2].id, OTHER_MAIN_ID);
});
ok("a category can sit in two mains; empty mains and missing categories are skipped", () => {
  const m = [...mains, { id: "m3", name: "Best sellers", subs: ["Bomb Burger", "Gone Category"] }, { id: "m4", name: "Empty", subs: [] }];
  const tabs = mainTabsFor(cats, m, "Other");
  assert.deepEqual(tabs.map((t) => t.name), ["Beef", "Chicken", "Best sellers", "Other"]);
  assert.deepEqual(tabs[2].subs, ["Bomb Burger"]);
});
ok("no Other tab when everything is grouped", () => {
  const all = [{ id: "a", name: "All", subs: cats }];
  assert.deepEqual(mainTabsFor(cats, all, "Other").map((t) => t.name), ["All"]);
});
ok("customer ordering follows the mains, then the rest in their own order", () => {
  assert.deepEqual(orderCategoriesByMain(cats, mains), ["Bomb Burger", "Cow Burger", "Crispy Chicken", "Butterfly Chicken", "Doner Burger", "Drinks"]);
  assert.equal(orderCategoriesByMain(cats, mains).length, cats.length);
});
ok("adding, removing, reordering", () => {
  let m = addSubToMain(mains, "m1", "Doner Burger");
  assert.deepEqual(m[0].subs, ["Bomb Burger", "Cow Burger", "Doner Burger"]);
  assert.equal(addSubToMain(m, "m1", "Doner Burger")[0].subs.length, 3, "no duplicates");
  m = removeSubFromMain(m, "m1", "Cow Burger");
  assert.deepEqual(m[0].subs, ["Bomb Burger", "Doner Burger"]);
  m = moveSubInMain(m, "m1", "Doner Burger", -1);
  assert.deepEqual(m[0].subs, ["Doner Burger", "Bomb Burger"]);
  assert.deepEqual(moveSubInMain(m, "m1", "Doner Burger", -1)[0].subs, ["Doner Burger", "Bomb Burger"], "can't move past the start");
  assert.deepEqual(moveMain(mains, "m2", -1).map((x) => x.id), ["m2", "m1"]);
  assert.deepEqual(moveMain(mains, "m1", -1).map((x) => x.id), ["m1", "m2"]);
});
ok("deleting a category removes it from every main", () => {
  const m = removeSubEverywhere([...mains, { id: "m3", name: "BS", subs: ["Bomb Burger"] }], "Bomb Burger");
  assert.ok(m.every((x) => !x.subs.includes("Bomb Burger")));
});
ok("stored junk is tolerated", () => {
  assert.deepEqual(cleanMains(undefined), []);
  assert.deepEqual(cleanMains("x"), []);
  assert.deepEqual(cleanMains([{ id: "a", name: "A", subs: ["x", 3] }, { nope: 1 }]), [{ id: "a", name: "A", subs: ["x"] }]);
});
console.log(`${n} checks passed`);
