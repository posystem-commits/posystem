// Main categories group the menu's categories (which then act as sub categories): "Beef" can hold Cow Burger, Doner
// Burger and Bomb Burger. Pure functions (no screen, no storage) so they can be tested on their own.
//
// mains: [{ id, name, subs: [categoryName, ...] }]   — a category may sit in several mains; categories in none are
// shown under "Other" on the Order screen. With no mains defined everything behaves exactly as before.

// The categories in an order that follows the main categories (each main's own order first), then the rest — what
// customer menus use, since they list categories one after the other.
export function orderCategoriesByMain(categories, mains) {
  if (!Array.isArray(mains) || mains.length === 0) return categories;
  const seen = new Set();
  const out = [];
  mains.forEach((m) => (m.subs || []).forEach((c) => { if (categories.includes(c) && !seen.has(c)) { seen.add(c); out.push(c); } }));
  categories.forEach((c) => { if (!seen.has(c)) out.push(c); });
  return out;
}

export const OTHER_MAIN_ID = "__other__";

// The first row of tabs on the Order screen: each main with the categories it holds (only ones that exist), then
// "Other" for categories that are in no main. Empty mains are left out.
export function mainTabsFor(categories, mains, otherLabel) {
  if (!Array.isArray(mains) || mains.length === 0) return [];
  const tabs = mains
    .map((m) => ({ id: m.id, name: m.name, subs: (m.subs || []).filter((c) => categories.includes(c)) }))
    .filter((m) => m.subs.length > 0);
  const assigned = new Set(mains.flatMap((m) => m.subs || []));
  const rest = categories.filter((c) => !assigned.has(c));
  if (rest.length > 0) tabs.push({ id: OTHER_MAIN_ID, name: otherLabel, subs: rest });
  return tabs;
}

export const addSubToMain = (mains, mainId, category) => mains.map((m) => (m.id === mainId && !(m.subs || []).includes(category) ? { ...m, subs: [...(m.subs || []), category] } : m));
export const removeSubFromMain = (mains, mainId, category) => mains.map((m) => (m.id === mainId ? { ...m, subs: (m.subs || []).filter((c) => c !== category) } : m));
export const removeSubEverywhere = (mains, category) => mains.map((m) => ({ ...m, subs: (m.subs || []).filter((c) => c !== category) }));
export const moveSubInMain = (mains, mainId, category, dir) =>
  mains.map((m) => {
    if (m.id !== mainId) return m;
    const subs = [...(m.subs || [])];
    const i = subs.indexOf(category);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= subs.length) return m;
    [subs[i], subs[j]] = [subs[j], subs[i]];
    return { ...m, subs };
  });
export function moveMain(mains, mainId, dir) {
  const i = mains.findIndex((m) => m.id === mainId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= mains.length) return mains;
  const next = [...mains];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
// Reads what was stored, tolerating anything odd (older menus have no mains at all).
export const cleanMains = (value) =>
  Array.isArray(value)
    ? value.filter((m) => m && m.id && typeof m.name === "string").map((m) => ({ id: String(m.id), name: m.name, subs: Array.isArray(m.subs) ? m.subs.filter((c) => typeof c === "string") : [] }))
    : [];
