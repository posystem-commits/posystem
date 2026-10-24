// Kitchen tickets: what the kitchen needs to cook an order — quantities, dish names and notes, never prices.
// Pure functions (no screen, no storage) so they can be tested on their own.
//
// A ticket is plain data: it can be printed on the device that created it, or put in the shared "kitchen-queue"
// list so the device sitting next to the kitchen printer prints it.

export const KITCHEN_MODES = ["off", "here", "send", "station"];

const QUEUE_MAX = 40;
const QUEUE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
export const STATION_MAX_AGE_MS = 6 * 60 * 60 * 1000;

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Only these fields ever leave the till — prices, totals, discounts and payment details are deliberately not here.
export const buildTicket = ({ ticketNo, table, items, customerName, deliveryMethod, zoneLabel, eta, servedBy, extra, now = Date.now(), nonce }) => ({
  id: `k${now.toString(36)}${nonce || Math.random().toString(36).slice(2, 7)}`,
  at: new Date(now).toISOString(),
  ticketNo: ticketNo ?? null,
  table: table || null,
  items: (items || [])
    .filter((it) => it && Number(it.qty) > 0)
    .map((it) => ({ name: String(it.name || ""), qty: Number(it.qty), note: String(it.note || "").trim() })),
  customerName: String(customerName || "").trim(),
  deliveryMethod: deliveryMethod || null,
  zoneLabel: zoneLabel || "",
  eta: String(eta || "").trim(),
  servedBy: servedBy || "",
  extra: !!extra,
});

export const countItems = (ticket) => ticket.items.reduce((s, it) => s + it.qty, 0);

// labels: { title, ticketNumber(n), takeaway, pickup, delivery(zone), added, total(n), servedBy(name), eta(text) }
export const ticketBodyHtml = (ticket, labels, timeText) => {
  const where = ticket.table || labels.takeaway;
  const fulfilment = ticket.deliveryMethod === "pickup" ? labels.pickup : ticket.deliveryMethod === "delivery" ? labels.delivery(ticket.zoneLabel) : "";
  const rows = ticket.items
    .map(
      (it) => `
      <div style="display:flex;gap:10px;align-items:baseline;font-size:19px;font-weight:700;margin-bottom:${it.note ? 1 : 8}px;">
        <span style="min-width:46px;">${esc(it.qty)}&times;</span>
        <span style="flex:1;">${esc(it.name)}</span>
      </div>
      ${it.note ? `<div style="font-size:15px;font-weight:700;margin:0 0 8px 56px;">&#9998; ${esc(it.note)}</div>` : ""}`
    )
    .join("");
  return `
    <div class="center" style="font-size:12px;font-weight:700;letter-spacing:2px;">${esc(labels.title)}</div>
    <div class="center" style="font-size:28px;font-weight:700;margin:6px 0 2px;">${esc(where)}</div>
    <div class="center" style="font-size:12px;">${ticket.ticketNo !== null ? esc(labels.ticketNumber(ticket.ticketNo)) + " &middot; " : ""}${esc(timeText)}</div>
    ${fulfilment ? `<div class="center" style="font-size:13px;font-weight:700;margin-top:4px;">${esc(fulfilment)}</div>` : ""}
    ${ticket.customerName ? `<div class="center" style="font-size:13px;margin-top:2px;">${esc(ticket.customerName)}</div>` : ""}
    ${ticket.eta ? `<div class="center" style="font-size:13px;margin-top:2px;">${esc(labels.eta(ticket.eta))}</div>` : ""}
    ${ticket.extra ? `<div class="center" style="font-size:14px;font-weight:700;margin-top:8px;border:2px solid #000;padding:4px;">${esc(labels.added)}</div>` : ""}
    <div class="dashed" style="margin-top:10px;padding-top:10px;">${rows}</div>
    <div class="dashed" style="font-size:12px;">
      <div class="row"><span>${esc(labels.total(countItems(ticket)))}</span>${ticket.servedBy ? `<span>${esc(labels.servedBy(ticket.servedBy))}</span>` : "<span></span>"}</div>
    </div>`;
};

// ---- the shared queue (key "kitchen-queue") ----
export const parseQueue = (value) => {
  try {
    const list = value ? JSON.parse(value) : [];
    return Array.isArray(list) ? list.filter((t) => t && t.id && Array.isArray(t.items)) : [];
  } catch (e) {
    return [];
  }
};

// Adds one ticket, drops old ones, and keeps the list short — the queue is a hand-over spot, not a history.
export const addToQueue = (list, ticket, nowMs = Date.now()) => {
  const kept = list.filter((t) => t.id !== ticket.id && nowMs - Date.parse(t.at) < QUEUE_MAX_AGE_MS);
  return [...kept, ticket].slice(-QUEUE_MAX);
};

// What the kitchen printer still has to print: tickets created after the station was switched on, not printed yet,
// oldest first.
export const ticketsToPrint = (list, printedIds, sinceMs, nowMs = Date.now()) => {
  const printed = new Set(printedIds);
  return list
    .filter((t) => !printed.has(t.id) && Date.parse(t.at) >= (sinceMs || 0) && nowMs - Date.parse(t.at) < STATION_MAX_AGE_MS)
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
};
