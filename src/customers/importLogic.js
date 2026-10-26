// Turning a spreadsheet of customers (name, phone, address ...) into a safe plan for the Customers screen, and the
// other way round for export. Pure functions: no screen, no storage — so they can be tested on their own.
//
// The rules, in plain words:
//  * Columns may come in any order and be named in English or Arabic; without headers they are recognised by their
//    content (a column of phone numbers, a column of long text = the address, the other text = the name).
//  * A customer is identified by their phone number. +20 101 234 5678, 0101 234 5678 and 1012345678 are one customer.
//  * New phones are added. Customers who already exist are only touched if "update existing" is on, and then only
//    the fields the sheet actually has (a blank cell never erases what is stored); their order count and last-order
//    date are kept. A sheet exported from this app brings the counts and dates back for new customers.
//  * Nothing is ever deleted.
import { normalizeDigits, normalizeText } from "../stock/importLogic.js";

const HEADERS = {
  name: ["name", "customer", "customer name", "full name", "client", "الاسم", "اسم", "اسم العميل", "العميل", "اسم الزبون", "الزبون"],
  phone: ["phone", "phone number", "mobile", "mobile number", "tel", "telephone", "cell", "whatsapp", "number", "contact", "الهاتف", "رقم الهاتف", "الموبايل", "رقم الموبايل", "موبايل", "تليفون", "رقم", "جوال", "رقم الجوال", "واتساب"],
  address: ["address", "delivery address", "location", "street", "العنوان", "عنوان", "الموقع", "عنوان التوصيل"],
  orders: ["orders", "order count", "orders count", "number of orders", "total orders", "عدد الطلبات", "الطلبات", "طلبات"],
  lastOrder: ["last order", "last order date", "last ordered", "آخر طلب", "تاريخ آخر طلب", "اخر طلب"],
};
const HEADER_LOOKUP = Object.fromEntries(Object.entries(HEADERS).map(([k, list]) => [k, new Set(list.map(normalizeText))]));

// The digits of a phone number, as typed in any script.
export const phoneDigits = (raw) => normalizeDigits(String(raw ?? "")).replace(/\D/g, "");

// The same customer however the number is written: compare the last ten digits (mobile numbers), or all of them for
// shorter numbers such as landlines.
export const phoneKey = (raw) => {
  const d = phoneDigits(raw);
  return d.length >= 10 ? d.slice(-10) : d;
};

// What gets stored for a new customer: digits only, with the leading 0 that Excel drops from numbers put back
// (1012345678 → 01012345678) and a +20 country code turned into the local 0.
export function tidyPhone(raw) {
  let d = phoneDigits(raw);
  if (d.startsWith("0020")) d = "0" + d.slice(4);
  else if (d.length === 12 && d.startsWith("20")) d = "0" + d.slice(2);
  else if (d.length === 10 && d.startsWith("1")) d = "0" + d;
  return d;
}
export const looksLikePhone = (raw) => {
  const s = String(raw ?? "").trim();
  if (!s || /[a-zA-Z؀-ۿ]/.test(s.replace(/[٠-٩۰-۹]/g, ""))) return false;
  const d = phoneDigits(s);
  return d.length >= 7 && d.length <= 15 && !/^\d{1,3}\s+\D/.test(s);
};

const cellText = (v) => (v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v).trim());

// Which column is which. Returns { map: {name, phone, address, orders, lastOrder -> column index}, headerRow }.
export function detectColumns(rows) {
  const sample = rows.slice(0, 8);
  const map = {};
  let headerRow = -1;
  sample.forEach((r, ri) => {
    const found = {};
    r.forEach((cell, ci) => {
      const n = normalizeText(cellText(cell));
      Object.entries(HEADER_LOOKUP).forEach(([field, set]) => {
        if (n && set.has(n) && found[field] === undefined) found[field] = ci;
      });
    });
    if (headerRow < 0 && Object.keys(found).length >= 1 && (found.phone !== undefined || Object.keys(found).length >= 2)) {
      headerRow = ri;
      Object.assign(map, found);
    }
  });
  const body = rows.slice(headerRow + 1, headerRow + 1 + 40);
  const width = Math.max(0, ...rows.slice(0, 40).map((r) => r.length));
  if (map.phone === undefined) {
    // the column where most cells look like phone numbers
    let best = -1;
    let bestScore = 0;
    for (let c = 0; c < width; c++) {
      const cells = body.map((r) => cellText(r[c])).filter(Boolean);
      const score = cells.length ? cells.filter(looksLikePhone).length / cells.length : 0;
      if (score > bestScore && !Object.values(map).includes(c)) {
        best = c;
        bestScore = score;
      }
    }
    if (bestScore >= 0.6) map.phone = best;
  }
  const free = [];
  for (let c = 0; c < width; c++) if (!Object.values(map).includes(c)) free.push(c);
  const textCols = free.filter((c) => body.some((r) => /[a-zA-Z؀-ۿ]/.test(cellText(r[c]))));
  if (map.name === undefined && textCols.length > 0) map.name = textCols[0];
  if (map.address === undefined) {
    // the remaining text column with the longest cells
    const rest = textCols.filter((c) => c !== map.name);
    if (rest.length > 0) map.address = rest.map((c) => [c, body.reduce((s, r) => s + cellText(r[c]).length, 0)]).sort((a, b) => b[1] - a[1])[0][0];
  }
  return { map, headerRow };
}

const toIsoDate = (v) => {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString();
  const s = String(v).trim();
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
};

// Rows of cells → [{ row, name, phoneRaw, address, orders, lastOrder }]
export function readCustomers(rows) {
  const { map, headerRow } = detectColumns(rows);
  const out = [];
  if (map.phone === undefined) return { customers: out, detected: map };
  rows.slice(headerRow + 1).forEach((r, i) => {
    const cells = r || [];
    if (cells.every((c) => cellText(c) === "")) return;
    const orders = map.orders !== undefined ? Number(normalizeDigits(cellText(cells[map.orders]))) : NaN;
    out.push({
      row: headerRow + 2 + i,
      name: map.name !== undefined ? cellText(cells[map.name]) : "",
      phoneRaw: cellText(cells[map.phone]),
      address: map.address !== undefined ? cellText(cells[map.address]) : "",
      orders: Number.isFinite(orders) && orders >= 0 ? Math.round(orders) : null,
      lastOrder: map.lastOrder !== undefined ? toIsoDate(cells[map.lastOrder]) : null,
    });
  });
  return { customers: out, detected: map };
}

// What would happen for every row. `existing` is the stored directory: { [phone]: { name, phone, address, orderCount, lastOrder } }.
// action: "add" | "update" | "same" | "skip" | "error"
export function buildPlan(customers, existing, { updateExisting = true } = {}) {
  const byKey = new Map();
  Object.values(existing || {}).forEach((c) => c && c.phone && byKey.set(phoneKey(c.phone), c));
  // the same phone twice in the sheet: the later row wins
  const lastRowOfKey = new Map();
  customers.forEach((c) => {
    const k = phoneKey(c.phoneRaw);
    if (k) lastRowOfKey.set(k, c.row);
  });
  const rows = customers.map((c) => {
    const base = { row: c.row, name: c.name, phone: tidyPhone(c.phoneRaw), address: c.address, orders: c.orders, lastOrder: c.lastOrder, action: "error", level: "error", note: "", code: "", existingKey: null, changes: [] };
    const key = phoneKey(c.phoneRaw);
    if (!key || phoneDigits(c.phoneRaw).length < 7) return { ...base, note: "no valid phone number", code: "bad_phone" };
    if (lastRowOfKey.get(key) !== c.row) return { ...base, action: "skip", level: "warn", note: "listed again further down — the last one is used", code: "dup" };
    const found = byKey.get(key);
    if (!found) return { ...base, action: "add", level: "ok" };
    if (!updateExisting) return { ...base, action: "skip", level: "ok", note: "already a customer (not changed)", code: "exists", existingKey: found.phone };
    const changes = [];
    if (c.name && c.name !== (found.name || "")) changes.push("name");
    if (c.address && c.address !== (found.address || "")) changes.push("address");
    if (changes.length === 0) return { ...base, action: "same", level: "ok", note: "no change", code: "same", existingKey: found.phone };
    return { ...base, action: "update", level: "ok", existingKey: found.phone, changes, existingName: found.name || "", existingAddress: found.address || "" };
  });
  const counts = { add: 0, update: 0, same: 0, skip: 0, error: 0 };
  rows.forEach((r) => (counts[r.action] += 1));
  return { rows, counts };
}

// The new directory after applying a plan to the stored one. Returns { directory, added, updated }.
export function applyPlan(plan, existing) {
  const next = { ...(existing || {}) };
  let added = 0;
  let updated = 0;
  plan.rows.forEach((r) => {
    if (r.action === "add") {
      next[r.phone] = { name: r.name || "", phone: r.phone, address: r.address || "", orderCount: r.orders || 0, lastOrder: r.lastOrder || null };
      added += 1;
    } else if (r.action === "update" && next[r.existingKey]) {
      const cur = next[r.existingKey];
      next[r.existingKey] = { ...cur, name: r.name || cur.name || "", address: r.address || cur.address || "" };
      updated += 1;
    }
  });
  return { directory: next, added, updated };
}

// Export: one row per customer, most recent first.
export function exportRows(directory) {
  return Object.values(directory || {})
    .filter((c) => c && c.phone)
    .sort((a, b) => (b.lastOrder || "").localeCompare(a.lastOrder || ""))
    .map((c) => ({ name: c.name || "", phone: c.phone, address: c.address || "", orders: c.orderCount || 0, lastOrder: c.lastOrder ? c.lastOrder.slice(0, 10) : "" }));
}
