// Turning a spreadsheet of stock items (name, current balance, measuring unit) into a safe plan for the Stock
// screen. Pure functions: no screen, no storage — so they can be tested on their own.
//
// The rules, in plain words:
//  * Columns may come in any order and be named in English or Arabic; without headers they are recognised by
//    their content (a column of numbers is the balance, a column of unit words is the unit).
//  * Items are matched to existing stock by name (case, spaces and Arabic spelling variants ignored).
//  * An existing item keeps its unit — recipes are written in it. If the sheet uses a compatible unit
//    (g/kg, ml/L) the balance is converted; any other mismatch is reported and skipped.
//  * Nothing is ever deleted: items missing from the sheet are left alone.

export const STOCK_UNITS = ["g", "kg", "ml", "L", "pcs", "dozen", "bottle", "can", "box", "pack", "slice", "portion"];

const ARABIC_DIGITS = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9", "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9" };
export const normalizeDigits = (s) => String(s).replace(/[٠-٩۰-۹]/g, (d) => ARABIC_DIGITS[d]).replace(/٫/g, ".").replace(/٬/g, "");

// For matching names and headers: lower case, no diacritics, one spelling of alef / ya / ta marbuta, single spaces.
export const normalizeText = (s) =>
  normalizeDigits(String(s ?? ""))
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[_\-–—./\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const UNIT_SYNONYMS = {
  kg: ["kg", "kgs", "kilo", "kilos", "kilogram", "kilograms", "كجم", "كيلو", "كيلوجرام", "كغ", "كغم", "كيلوغرام"],
  g: ["g", "gr", "gm", "gms", "gram", "grams", "جم", "جرام", "غرام", "غم", "غ"],
  L: ["l", "lt", "ltr", "litre", "liter", "litres", "liters", "لتر", "ليتر", "لترات"],
  ml: ["ml", "mls", "milliliter", "millilitre", "milliliters", "مل", "ملل", "مليلتر"],
  pcs: ["pc", "pcs", "piece", "pieces", "unit", "units", "each", "ea", "no", "قطعه", "قطع", "عدد", "حبه", "حبات", "وحده"],
  dozen: ["dozen", "doz", "dz", "دسته", "دزينه", "دستة"],
  bottle: ["bottle", "bottles", "btl", "bot", "زجاجه", "زجاجات", "قزازه", "قزايز", "قارورة", "قارورة"],
  can: ["can", "cans", "tin", "tins", "كانز", "كان", "علبه معدن"],
  box: ["box", "boxes", "carton", "cartons", "case", "صندوق", "كرتونه", "كرتون", "علبه", "علب"],
  pack: ["pack", "packs", "packet", "packets", "pkt", "pk", "bag", "bags", "عبوه", "عبوات", "باكيت", "كيس", "اكياس", "شكاره"],
  slice: ["slice", "slices", "شريحه", "شرائح", "ريشه"],
  portion: ["portion", "portions", "serving", "servings", "حصه", "حصص", "وجبه"],
};
const SYNONYM_LOOKUP = (() => {
  const map = new Map();
  Object.entries(UNIT_SYNONYMS).forEach(([unit, list]) => list.forEach((w) => map.set(normalizeText(w), unit)));
  STOCK_UNITS.forEach((u) => map.set(normalizeText(u), u));
  return map;
})();

// -> { unit, known }. An unrecognised word is kept as the unit exactly as typed (the app supports custom units).
export function normalizeUnit(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return { unit: "", known: false };
  const hit = SYNONYM_LOOKUP.get(normalizeText(text));
  if (hit) return { unit: hit, known: true };
  return { unit: text.slice(0, 16), known: false };
}

const FACTORS = { "g>kg": 0.001, "kg>g": 1000, "ml>L": 0.001, "L>ml": 1000 };
// The balance expressed in another unit, or null when the two units are not compatible.
export function convertQty(qty, from, to) {
  if (from === to) return qty;
  const f = FACTORS[`${from}>${to}`];
  return f === undefined ? null : Math.round(qty * f * 1000) / 1000;
}

// A balance cell -> number, or null when it is not a number. Accepts "2.5", "2,5", "1,250", Arabic digits.
export function parseQty(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v === null || v === undefined) return null;
  let s = normalizeDigits(String(v)).replace(/\s+/g, "");
  if (!s) return null;
  if (/^-?\d+,\d{1,2}$/.test(s)) s = s.replace(",", "."); // 2,5 = two and a half
  else s = s.replace(/,/g, ""); // 1,250 = one thousand two hundred fifty
  return /^-?(\d+\.?\d*|\.\d+)$/.test(s) ? parseFloat(s) : null;
}

const HEADERS = {
  name: ["name", "item", "items", "item name", "ingredient", "ingredients", "product", "material", "stock item", "الاسم", "اسم", "اسم الصنف", "الصنف", "صنف", "المادة", "اسم المادة", "المنتج", "البند", "الخامة"],
  unit: ["unit", "units", "uom", "measure", "measuring unit", "unit of measure", "unit of measurement", "الوحدة", "وحدة", "وحدة القياس", "وحدة القياس", "القياس"],
  balance: ["balance", "stock", "qty", "quantity", "current", "current balance", "current stock", "on hand", "amount", "count", "الرصيد", "رصيد", "الكمية", "كمية", "الرصيد الحالي", "المخزون", "المتاح", "الكميه", "العدد"],
};
const HEADER_LOOKUP = (() => {
  const map = new Map();
  Object.entries(HEADERS).forEach(([col, list]) => list.forEach((w) => map.set(normalizeText(w), col)));
  return map;
})();

const isBlank = (v) => v === null || v === undefined || String(v).trim() === "";

// Finds which column is the name, the balance and the unit. -> { headerRow, cols: { name, balance, unit } } | null
export function detectColumns(rows) {
  for (let r = 0; r < Math.min(rows.length, 8); r++) {
    const cols = {};
    (rows[r] || []).forEach((cell, c) => {
      const kind = HEADER_LOOKUP.get(normalizeText(cell));
      if (kind && cols[kind] === undefined) cols[kind] = c;
    });
    if (cols.name !== undefined && (cols.balance !== undefined || cols.unit !== undefined)) return { headerRow: r, cols };
  }
  // No headers: recognise the columns by what is in them.
  const sample = rows.filter((row) => row && row.some((c) => !isBlank(c))).slice(0, 40);
  if (!sample.length) return null;
  const width = Math.max(...sample.map((r) => r.length));
  const stats = Array.from({ length: width }, (_, c) => {
    const vals = sample.map((r) => r[c]).filter((v) => !isBlank(v));
    const n = vals.length || 1;
    return { c, numeric: vals.filter((v) => parseQty(v) !== null).length / n, unitLike: vals.filter((v) => normalizeUnit(v).known && parseQty(v) === null).length / n, filled: vals.length };
  });
  const balance = [...stats].sort((a, b) => b.numeric - a.numeric)[0];
  const unit = [...stats].filter((s) => s.c !== balance.c).sort((a, b) => b.unitLike - a.unitLike)[0];
  const name = [...stats].filter((s) => s.c !== balance.c && (!unit || s.c !== unit.c)).sort((a, b) => b.filled - a.filled || a.numeric - b.numeric)[0];
  if (!name || balance.numeric < 0.6) return null;
  return { headerRow: -1, cols: { name: name.c, balance: balance.c, unit: unit && unit.unitLike >= 0.5 ? unit.c : undefined } };
}

// Spreadsheet rows -> the items in it. Rows are numbered as in Excel (first row = 1).
export function readItems(rows) {
  const det = detectColumns(rows);
  if (!det) return { items: [], detected: null };
  const items = [];
  rows.forEach((row, i) => {
    if (i <= det.headerRow || !row || !row.some((c) => !isBlank(c))) return;
    items.push({ row: i + 1, name: String(row[det.cols.name] ?? "").trim(), balance: det.cols.balance === undefined ? undefined : row[det.cols.balance], unit: det.cols.unit === undefined ? "" : row[det.cols.unit] });
  });
  return { items, detected: det };
}

const r3 = (n) => Math.round(n * 1000) / 1000;

// Items + the current stock -> what would happen to each row. `ingredients` is { id: { id, name, unit, stock } }.
//   action: "add" | "update" | "same" | "skip" | "error"      level: "ok" | "warn" | "error"
export function buildPlan(items, ingredients, { updateExisting = true } = {}) {
  const byName = new Map();
  Object.values(ingredients || {}).forEach((ing) => {
    const k = normalizeText(ing.name);
    if (!byName.has(k)) byName.set(k, ing);
  });
  const lastIndex = new Map();
  items.forEach((it, i) => lastIndex.set(normalizeText(it.name), i));
  const rows = items.map((it, i) => {
    const base = { row: it.row, name: it.name, qty: null, unit: "", action: "error", level: "error", note: "", existingId: null, existingUnit: "", existingStock: null };
    if (!it.name) return { ...base, note: "no name", code: "no_name" };
    const key = normalizeText(it.name);
    if (lastIndex.get(key) !== i) return { ...base, action: "skip", level: "warn", note: "listed again further down — the last one is used", code: "dup" };
    const q = parseQty(it.balance);
    if (q === null) return it.balance === undefined || isBlank(it.balance) ? { ...base, note: "no balance", code: "no_balance" } : { ...base, note: "balance is not a number", code: "bad_balance" };
    if (q < 0) return { ...base, note: "balance is negative", code: "negative" };
    const u = normalizeUnit(it.unit);
    const existing = byName.get(key);
    if (existing) {
      const out = { ...base, existingId: existing.id, existingUnit: existing.unit, existingStock: existing.stock, name: existing.name };
      let qty = r3(q);
      let note = "";
      if (u.unit && u.unit !== existing.unit) {
        const c = convertQty(qty, u.unit, existing.unit);
        if (c === null) return { ...out, qty, unit: u.unit, note: `sheet says ${u.unit} but the item is counted in ${existing.unit}`, code: "unit_mismatch", vars: { sheet: u.unit, item: existing.unit } };
        note = `${qty} ${u.unit} = ${c} ${existing.unit}`;
        qty = c;
      }
      if (!updateExisting) return { ...out, qty, unit: existing.unit, action: "skip", level: "ok", note: "already in stock (not changed)", code: "exists" };
      if (qty === existing.stock) return { ...out, qty, unit: existing.unit, action: "same", level: "ok", note: note || "no change", code: note ? undefined : "same" };
      return { ...out, qty, unit: existing.unit, action: "update", level: note ? "warn" : "ok", note };
    }
    if (!u.unit) return { ...base, qty: r3(q), note: "no unit", code: "no_unit" };
    return { ...base, qty: r3(q), unit: u.unit, action: "add", level: u.known ? "ok" : "warn", note: u.known ? "" : `new unit "${u.unit}"`, code: u.known ? undefined : "custom_unit", vars: { unit: u.unit } };
  });
  const counts = { add: 0, update: 0, same: 0, skip: 0, error: 0 };
  rows.forEach((r) => (counts[r.action] += 1));
  return { rows, counts };
}

// ---- CSV (for files saved as .csv) ----
export function parseCsv(text) {
  const clean = String(text).replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] || "";
  const delim = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cur); rows.push(row); row = []; cur = "";
    } else cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
