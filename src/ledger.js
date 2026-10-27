// The one place that decides what the money numbers mean.
//
// Every tab that shows revenue, orders, payment methods, discounts, expenses, shift totals or the cash
// drawer reads them from here, so two tabs can only ever disagree if they are asking different questions —
// never because they added things up differently. Pure functions over plain data: no React, no storage,
// no clock of their own (callers pass `nowMs`), so the same code runs in the app and in
// scripts/check-numbers.js against a restaurant's real records.
//
// THE DEFINITIONS (read these before changing anything):
//  * An order counts as SALES revenue when its status is "completed" — paid or still on a pay-later bill
//    ("unpaid" is listed separately). Cancelled and refunded orders are not sales.
//  * A sale belongs to the BUSINESS DAY of the moment it was created (the shift hours decide where a day
//    starts), never to a calendar month or to when it was paid.
//  * MONEY IN THE DRAWER moves when it is paid (paidAt), except delivery cash, which a rider holds until it
//    is settled; a cancelled/refunded order takes money back out at the moment it was returned, in the
//    method it was actually returned in.
//  * A cash EXPENSE leaves the drawer of the shift in which it was recorded (recordedAt), while a day's
//    expense TOTAL is by the expense's own date.
//  * A SHIFT belongs to the business day in which its midpoint falls. Its orders are the ones its employee
//    created between clock-in and clock-out. Orders created outside every shift are reported as such.
//  * Totals saved at clock-out are a historical record only; screens always recompute from the orders.
//  * An order paid through a DELIVERY APP (Talabat, Elmenus) is a sale like any other, but no money reaches the
//    drawer or the bank until the app pays the restaurant, usually at the end of the month. Until someone marks it
//    received (platformSettled) it is money the app OWES the restaurant — see platformOwed.

export const PAYMENT_METHODS = [
  { id: "cash", label: "Cash" },
  { id: "visa", label: "Visa" },
  { id: "instapay", label: "InstaPay" },
  { id: "wallet", label: "Wallet" },
  // Delivery apps pay the restaurant later (see platformOwed). Whole-order choices only: never split, never
  // part of the electronic-balance reconciliation.
  { id: "talabat", label: "Talabat", platform: true },
  { id: "elmenus", label: "Elmenus", platform: true },
];
export const DIRECT_METHODS = PAYMENT_METHODS.filter((m) => !m.platform);
export const PLATFORM_METHODS = PAYMENT_METHODS.filter((m) => m.platform);
export const isPlatformMethod = (id) => PLATFORM_METHODS.some((m) => m.id === id);

export const round2 = (n) => Math.round(n * 100) / 100;

// ---- dates ----
export const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export const DEFAULT_SHIFT_HOURS = Object.fromEntries(WEEKDAY_KEYS.map((k) => [k, { start: "00:00", end: "23:59" }]));
export const localDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// "YYYY-MM-DD" arithmetic via UTC so it never suffers from local-time / DST off-by-one.
export const addDaysStr = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const monthKeysInRange = (startStr, endStr) => {
  const [sy, sm] = startStr.split("-").map(Number);
  const [ey, em] = endStr.split("-").map(Number);
  const keys = [];
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return keys;
};
export const prevMonthKey = (monthKey) => {
  const [y, m] = monthKey.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};
export const nextMonthKey = (monthKey) => {
  const [y, m] = monthKey.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};
export const lastDayOfMonth = (monthKey) => {
  const [y, m] = monthKey.split("-").map(Number);
  return `${monthKey}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
};
// The "business date" an order counts toward — its own calendar day, unless it landed before that
// day's configured start, in which case it still belongs to the day before. Local wall-clock time.
export const businessDateForTimestamp = (isoTimestamp, shiftHours) => {
  const d = new Date(isoTimestamp);
  const startTime = shiftHours?.[WEEKDAY_KEYS[d.getDay()]]?.start || "00:00";
  const timeOfDay = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (timeOfDay >= startTime) return localDateStr(d);
  return localDateStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
};
// Receipts are stored per UTC month of their timestamp.
export const storageMonthOf = (iso) => new Date(iso).toISOString().slice(0, 7);
// A business period can spill into the neighbouring storage months, so reads widen by one month each side.
export const storageMonthKeysFor = (reportingMonthKeys) => Array.from(new Set(reportingMonthKeys.flatMap((mk) => [prevMonthKey(mk), mk, nextMonthKey(mk)])));

// ---- one receipt ----
// A receipt paid across more than one method stores paymentMethod "split" plus a breakdown; every other
// receipt effectively has one "split" of just its own total. Always read amounts through this.
export const receiptMethodAmounts = (r) =>
  r.paymentMethod === "split" && Array.isArray(r.splitPayments) && r.splitPayments.length > 0
    ? r.splitPayments
    : [{ method: r.paymentMethod, amount: r.total }];
export const returnTimeOf = (r) => (r.status === "cancelled" ? r.cancelledAt : r.status === "refunded" ? r.refundedAt : null);
export const returnAmountsOf = (r) => r.returnedAmounts || (r.paid === false ? [] : receiptMethodAmounts(r));
export const notHeldByRider = (r) => !(r.tableId === "delivery" && !r.deliverySettled);
// When an order's cash actually reached the drawer: when it was paid — except delivery cash, which a rider
// holds until they settle up, so it arrives at the settlement.
export const cashTimeOf = (r) => (r.tableId === "delivery" && r.deliverySettledAt ? r.deliverySettledAt : r.paidAt || r.timestamp);

// ---- a set of orders ----
// What a list of COMPLETED orders adds up to. The only place revenue, order counts, payment-method
// totals and discounts are summed.
export const summarize = (completed) => {
  const methodAmounts = completed.flatMap(receiptMethodAmounts);
  const byMethod = {};
  PAYMENT_METHODS.forEach((m) => {
    byMethod[m.id] = methodAmounts.filter((a) => a.method === m.id).reduce((s, a) => s + a.amount, 0);
  });
  const discounted = completed.filter((r) => (r.discountAmount || 0) > 0);
  const unpaid = completed.filter((r) => r.paid === false);
  return {
    orders: completed.length,
    revenue: completed.reduce((s, r) => s + r.total, 0),
    byMethod,
    methodAmounts,
    discounts: { n: discounted.length, total: discounted.reduce((s, r) => s + (r.discountAmount || 0), 0), orders: discounted },
    unpaid: { n: unpaid.length, total: unpaid.reduce((s, r) => s + r.total, 0), orders: unpaid },
  };
};

// ---- money owed by delivery apps ----
// For each delivery app: the paid, completed orders sold through it that it has not yet paid the restaurant for,
// with the amount each one carries for that app, and the total owed. `orders` is any list of receipts.
export const platformOwed = (orders) =>
  PLATFORM_METHODS.map((m) => {
    const list = orders
      .filter((r) => r.status === "completed" && r.paid !== false && !r.platformSettled)
      .map((r) => ({ r, amount: round2(receiptMethodAmounts(r).filter((a) => a.method === m.id).reduce((s, a) => s + a.amount, 0)) }))
      .filter((x) => x.amount > 0);
    return { id: m.id, label: m.label, orders: list, owed: round2(list.reduce((s, x) => s + x.amount, 0)) };
  });

// ---- the cash drawer ----
// Cash that moved inside a time window: received (paid in the window), paid back out to customers, and
// paid out as expenses. `inWin` decides whether a timestamp is inside the window.
export const cashFlows = (pool, expensePool, inWin) => {
  const cashOrders = pool.filter((r) => r.paid !== false && (r.status === "completed" || returnTimeOf(r)) && notHeldByRider(r) && inWin(cashTimeOf(r)));
  const cashIn = cashOrders.flatMap(receiptMethodAmounts).filter((a) => a.method === "cash").reduce((s, a) => s + a.amount, 0);
  const cashReturned = pool.filter((r) => returnTimeOf(r) && inWin(returnTimeOf(r)) && r.paid !== false && notHeldByRider(r)).flatMap(returnAmountsOf).filter((a) => a.method === "cash").reduce((s, a) => s + a.amount, 0);
  const cashExpenses = expensePool.filter((e) => e.status === "paid" && e.paymentMethod === "cash" && inWin(e.recordedAt || `${e.date}T00:00:00.000Z`)).reduce((s, e) => s + e.amount, 0);
  // When a delivery rider settles up, the drawer receives what they collected MINUS what they keep as their share of
  // the delivery fees (and pays them out of the drawer when the restaurant owes them). The share is saved on each
  // settled order (riderFeeShare) at that moment; settlements made before it was saved leave the drawer as they were.
  const riderPay = Math.round(pool.filter((r) => r.tableId === "delivery" && r.deliverySettled && r.status === "completed" && r.paid !== false && Number(r.riderFeeShare) > 0 && r.deliverySettledAt && inWin(r.deliverySettledAt)).reduce((s, r) => s + Number(r.riderFeeShare), 0) * 100) / 100;
  const who = {};
  cashOrders.forEach((r) => {
    const cash = receiptMethodAmounts(r).filter((a) => a.method === "cash").reduce((s, a) => s + a.amount, 0);
    if (cash > 0) who[r.servedBy?.name || "—"] = (who[r.servedBy?.name || "—"] || 0) + cash;
  });
  return { cashIn, cashReturned, cashExpenses, riderPay, paidOut: cashReturned + cashExpenses + riderPay, who };
};

// Finds the set of recorded events whose combined effect best accounts for a gap.
export const solveGap = (gap, items) => {
  const list = items.filter((i) => Math.abs(i.amount) >= 0.01).slice(0, 14);
  let best = null;
  for (let mask = 1; mask < 1 << list.length; mask++) {
    let sum = 0;
    let count = 0;
    let approx = false;
    for (let i = 0; i < list.length; i++) {
      if (mask & (1 << i)) { sum += list[i].amount; count++; if (list[i].approx) approx = true; }
    }
    const diff = Math.abs(gap - sum);
    const tol = approx ? 0.03 * Math.abs(gap) + 0.05 : 0.015;
    const score = diff + count * 0.001;
    if (!best || score < best.score) best = { mask, sum, diff, exact: diff <= tol, score };
  }
  if (!best) return { type: "none", items: [], explained: 0, rest: gap };
  const chosen = list.filter((_, i) => best.mask & (1 << i));
  const sameDirection = Math.sign(best.sum) === Math.sign(gap);
  if (best.exact) return { type: "exact", items: chosen, explained: round2(best.sum), rest: 0 };
  if (sameDirection && Math.abs(best.sum) >= 0.4 * Math.abs(gap)) return { type: "partial", items: chosen, explained: round2(best.sum), rest: round2(gap - best.sum) };
  return { type: "none", items: [], explained: 0, rest: gap };
};

// ---- edits made to an order after it was paid (used to explain cash gaps) ----
const sortedEdits = (r, notBefore) => [...(r.editHistory || [])].filter((h) => h.timestamp >= notBefore).sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));

// ---- the ledger ----
// data: { receiptsByMonth, expensesByMonth, shiftLog, openShifts, shiftHours, menu, labels, collections }
//   collections: { "YYYY-MM-DD": { amount, by, at } } — the cash taken out of the drawer at the end of that business day,
//   typed in on Close the day. It belongs to the day's LAST shift: that shift's drawer should hold (opening + cash in -
//   paid out - collected) when it is counted.
//   labels: { methodByLabel: {"Cash": "cash", ...}, isPayLabel: (name) => bool } — how an edit history names
//   the "payment method" field, in whichever language it was written.
export function createLedger(data) {
  const { receiptsByMonth = {}, expensesByMonth = {}, shiftLog = [], openShifts = {}, shiftHours, menu = {}, labels = { methodByLabel: {}, isPayLabel: () => false }, collections = {} } = data;
  const bizDay = (iso) => businessDateForTimestamp(iso, shiftHours);

  const monthsLoaded = (keys) => keys.every((k) => receiptsByMonth[k] !== undefined);
  const flatMonths = (keys) => keys.flatMap((k) => receiptsByMonth[k] || []);

  // All orders (any status) whose business day is in [startDay, endDay]; null until the months they can
  // be stored in have loaded.
  const ordersInDays = (startDay, endDay) => {
    const reporting = monthKeysInRange(startDay.slice(0, 7), endDay.slice(0, 7));
    const storage = storageMonthKeysFor(reporting);
    if (!monthsLoaded(storage)) return null;
    return flatMonths(storage).filter((r) => {
      const d = bizDay(r.timestamp);
      return d >= startDay && d <= endDay;
    });
  };
  const expensesInDays = (startDay, endDay) => monthKeysInRange(startDay.slice(0, 7), endDay.slice(0, 7)).flatMap((k) => expensesByMonth[k] || []).filter((e) => e.date >= startDay && e.date <= endDay);

  // Sales summary for a run of business days. The Dashboard, the Receipts footer, Close the day and the
  // Staff tab all use this, so they cannot differ.
  const period = (startDay, endDay) => {
    const all = ordersInDays(startDay, endDay);
    if (!all) return null;
    const completed = all.filter((r) => r.status === "completed");
    const voided = all.filter((r) => r.status === "cancelled" || r.status === "refunded");
    const expenses = expensesInDays(startDay, endDay);
    return { startDay, endDay, all, completed, voided, ...summarize(completed), voidedTotal: voided.reduce((s, r) => s + r.total, 0), expenses, expenseTotal: expenses.reduce((s, e) => s + e.amount, 0) };
  };

  // ---- shifts ----
  const allShifts = () => {
    const logged = shiftLog.map((e) => ({ key: e.id, employeeId: e.employeeId, name: e.employeeName, clockIn: e.clockIn, clockOut: e.clockOut, auto: !!e.autoClosed, opening: typeof e.openingCash === "number" && e.openingCounted !== false ? e.openingCash : null, counted: typeof e.countedCash === "number" ? e.countedCash : null, savedExpected: typeof e.expectedCash === "number" ? e.expectedCash : null, saved: e }));
    const open = Object.values(openShifts)
      .filter((e) => !logged.some((l) => l.employeeId === e.employeeId && l.clockIn === e.clockIn))
      .map((e) => ({ key: `open_${e.employeeId}`, employeeId: e.employeeId, name: e.employeeName, clockIn: e.clockIn, clockOut: null, auto: false, opening: typeof e.openingCash === "number" ? e.openingCash : null, counted: null, savedExpected: null, saved: null }));
    return [...logged, ...open].sort((a, b) => a.clockIn.localeCompare(b.clockIn));
  };
  // A shift belongs to the business day that most of it falls in — the day of its midpoint.
  const shiftDayOf = (sh, nowMs) => bizDay(new Date((new Date(sh.clockIn).getTime() + new Date(sh.clockOut || new Date(nowMs).toISOString()).getTime()) / 2).toISOString());

  // Receipts a shift's own employee created during it. Null until the months it touches have loaded.
  const shiftTotals = (sh, nowMs) => {
    const end = sh.clockOut || new Date(nowMs).toISOString();
    const keys = monthKeysInRange(storageMonthOf(sh.clockIn), storageMonthOf(end));
    if (!monthsLoaded(keys)) return null;
    const all = flatMonths(keys).filter((r) => r.servedBy?.id === sh.employeeId && r.timestamp >= sh.clockIn && r.timestamp <= end);
    const completed = all.filter((r) => r.status === "completed");
    const s = summarize(completed);
    return { all, completed, cancelled: all.filter((r) => r.status === "cancelled"), refunded: all.filter((r) => r.status === "refunded"), orders: s.orders, revenue: s.revenue, byMethod: s.byMethod };
  };

  // Everything created by one employee in the last N days, whether or not it happened inside a clocked-in
  // shift — used for the leaderboard, so it equals what the Dashboard counts.
  const employeeTotals = (sinceIso, nowMs) => {
    const startDay = bizDay(sinceIso);
    const endDay = bizDay(new Date(nowMs).toISOString());
    const p = period(startDay, endDay);
    if (!p) return null;
    const totals = {};
    p.completed.forEach((r) => {
      const id = r.servedBy?.id || "?";
      if (!totals[id]) totals[id] = { id, name: r.servedBy?.name || "—", revenue: 0, orders: 0 };
      totals[id].revenue += r.total;
      totals[id].orders += 1;
    });
    return Object.values(totals);
  };

  // ---- Close the day ----
  const priceMaps = () => {
    const priceByName = new Map();
    Object.values(menu).flat().forEach((i) => priceByName.set(i.name, i.price));
    Object.values(receiptsByMonth).flat().forEach((r) => (r.items || []).forEach((i) => priceByName.set(i.name, i.price)));
    return (name, r) => ((r.items || []).find((i) => i.name === name) || {}).price || priceByName.get(name) || 0;
  };
  // The payment method an order had when it was paid vs the one it ends up with, ignoring edits that cancel
  // each other out. Only edits made AFTER the money was collected matter to a drawer.
  const netPaymentChange = (r, notBefore) => {
    let first = null;
    let last = null;
    let by = null;
    let at = null;
    sortedEdits(r, notBefore).forEach((h) => {
      (h.changes || []).forEach((c) => {
        if (!labels.isPayLabel(c.name)) return;
        const f = labels.methodByLabel[c.from];
        const to = labels.methodByLabel[c.to];
        if (!f || !to) return;
        if (!first) first = f;
        last = to;
        by = h.editedBy?.name || null;
        at = h.timestamp;
      });
    });
    return first && last && first !== last ? { from: first, to: last, by, at } : null;
  };
  // Dishes added or removed from an order after it was paid, and what that did to the bill. Edits made from
  // now on carry the order's exact total before and after; older ones are estimated from the dish price.
  const itemEdits = (r, notBefore, priceOf) => {
    const nets = {};
    const discountNets = {}; // a discount added/changed/removed after payment (kind: "discount"), kept apart from dishes
    let value = 0;
    let exact = true;
    let by = null;
    let at = null;
    let any = false;
    const factor = r.subtotal > 0 ? (r.total - (r.deliveryFee || 0)) / r.subtotal : 1;
    sortedEdits(r, notBefore).forEach((h) => {
      const item = (h.changes || []).filter((c) => !labels.isPayLabel(c.name) && Number.isFinite(Number(c.from)) && Number.isFinite(Number(c.to)) && Number(c.from) !== Number(c.to));
      if (item.length === 0) return;
      any = true;
      by = h.editedBy?.name || by;
      at = h.timestamp;
      item.forEach((c) => {
        const target = c.kind === "discount" ? discountNets : nets;
        target[c.name] = (target[c.name] || 0) + (Number(c.to) - Number(c.from));
      });
      if (typeof h.totalBefore === "number" && typeof h.totalAfter === "number") {
        value += h.totalAfter - h.totalBefore;
      } else {
        exact = false;
        value += item.reduce((sum, c) => sum + (Number(c.to) - Number(c.from)) * (priceOf(c.name, r) || 0), 0) * factor;
      }
    });
    if (!any) return null;
    const parts = Object.entries(nets).filter(([, d]) => d !== 0);
    const discountParts = Object.entries(discountNets).filter(([, d]) => round2(d) !== 0);
    if (parts.length === 0 && discountParts.length === 0) return null;
    // More discount lowers the bill (like removing dishes); less discount raises it.
    const down = [...parts.filter(([, d]) => d < 0).map(([name, d]) => `${name} ×${-d}`), ...discountParts.filter(([, d]) => d > 0).map(([name, d]) => `${name} ${round2(d)}`)].join(", ");
    const up = [...parts.filter(([, d]) => d > 0).map(([name, d]) => `${name} ×${d}`), ...discountParts.filter(([, d]) => d < 0).map(([name, d]) => `${name} ${round2(-d)}`)].join(", ");
    return { by, at, value: round2(value), down, up, exact, discountOnly: parts.length === 0 };
  };

  const closeDay = (day, nowMs) => {
    const p = period(day, day);
    if (!p) return null;
    const nowIso = new Date(nowMs).toISOString();
    const { completed, voided, expenseTotal } = p;
    const dayCompleted = completed;
    const byMethod = PAYMENT_METHODS.map((m) => ({ id: m.id, total: p.byMethod[m.id] })).filter((m) => m.total > 0);
    const priceOf = priceMaps();
    const poolFor = (a, b) => {
      const keys = monthKeysInRange(storageMonthOf(a), storageMonthOf(b));
      if (!monthsLoaded(keys)) return null;
      return { pool: flatMonths(keys), expenses: keys.flatMap((k) => expensesByMonth[k] || []) };
    };

    const shifts = allShifts();
    const dayShifts = shifts.filter((sh) => shiftDayOf(sh, nowMs) === day);
    const collectionRow = collections[day];
    const collectionAmount = collectionRow && Number.isFinite(Number(collectionRow.amount)) && Number(collectionRow.amount) >= 0 ? round2(Number(collectionRow.amount)) : null;
    const dayCollection = collectionAmount === null ? null : { amount: collectionAmount, by: collectionRow.by || null, at: collectionRow.at || null };
    const lastShiftOfDay = dayShifts[dayShifts.length - 1];
    const coverShift = (r) => shifts.find((x) => x.employeeId === r.servedBy?.id && r.timestamp >= x.clockIn && (!x.clockOut || r.timestamp <= x.clockOut));
    const insideAnyShift = (iso) => shifts.some((x) => iso >= x.clockIn && iso <= (x.clockOut || nowIso));

    const drawers = dayShifts.map((sh) => {
      const end = sh.clockOut || nowIso;
      const inWin = (iso) => iso >= sh.clockIn && iso <= end;
      const src = poolFor(sh.clockIn, end);
      if (!src) return { ...sh, loading: true };
      const { pool, expenses } = src;
      const flows = cashFlows(pool, expenses, inWin);
      const expected = sh.opening !== null ? round2(sh.opening + flows.cashIn - flows.paidOut) : null;
      // The day's cash collection comes out of the last shift's drawer after (or just before) its count.
      const isLast = sh === lastShiftOfDay;
      const dayCollected = isLast && dayCollection ? dayCollection.amount : 0;
      const gap = expected !== null && sh.counted !== null ? round2(sh.counted - (expected - dayCollected)) : null;
      const gapAtClosing = sh.savedExpected !== null && sh.counted !== null ? round2(sh.counted - (sh.savedExpected - dayCollected)) : null;
      // No amount typed yet: whatever the last shift is short by is most likely the collection — shown as that, not as
      // a shortage, until the real amount is recorded and it can be checked.
      const impliedCollection = isLast && !dayCollection && gap !== null && gap < -0.005 ? round2(-gap) : null;

      // Recorded events that could explain a difference between the drawer and the books.
      const events = [];
      const collected = pool.filter((r) => r.paid !== false && r.status === "completed" && inWin(r.paidAt || r.timestamp));
      collected.forEach((r) => {
        const since = r.paidAt || r.timestamp;
        const pay = netPaymentChange(r, since);
        if (pay && (pay.from === "cash" || pay.to === "cash")) {
          events.push({ kind: "pay", n: r.ticketNo, amount: pay.from === "cash" ? r.total : -r.total, orderTotal: r.total, from: pay.from, to: pay.to, by: pay.by, at: pay.at, paidAt: since, afterClose: !!sh.clockOut && pay.at > sh.clockOut });
        }
        if (r.paymentMethod === "cash") {
          const ed = itemEdits(r, since, priceOf);
          if (ed && Math.abs(ed.value) >= 0.01) events.push({ kind: ed.discountOnly ? (ed.value < 0 ? "discountDown" : "discountUp") : ed.value < 0 ? "qtyDown" : "qtyUp", n: r.ticketNo, amount: round2(-ed.value), approx: !ed.exact, by: ed.by, at: ed.at, list: ed.value < 0 ? ed.down : ed.up, afterClose: !!sh.clockOut && ed.at > sh.clockOut });
        }
      });
      pool.filter((r) => (r.status === "cancelled" || r.status === "refunded") && !returnTimeOf(r) && r.paid !== false && inWin(r.paidAt || r.timestamp)).forEach((r) => {
        const cash = receiptMethodAmounts(r).filter((a) => a.method === "cash").reduce((s, a) => s + a.amount, 0);
        if (cash > 0) events.push({ kind: "legacyVoid", n: r.ticketNo, amount: cash, status: r.status });
      });
      expenses.filter((e) => e.status === "paid" && e.paymentMethod === "cash" && e.date === day && !insideAnyShift(e.recordedAt || `${e.date}T00:00:00.000Z`)).forEach((e) => {
        events.push({ kind: "looseExpense", what: e.category, amount: -e.amount });
      });
      const solve = gap !== null && Math.abs(gap) >= 0.01 ? solveGap(gap, events) : null;
      return { ...sh, ...flows, expected, gap, gapAtClosing, events, solve, collected: dayCollected, impliedCollection };
    });

    // The cash that moved between one shift's closing count and the next one's opening count — but only within
    // one business day. Cash is often collected when the day ends, so the first shift of a day is deliberately NOT
    // compared with the last shift of the day before.
    drawers.forEach((d) => {
      const prev = [...shifts].reverse().find((x) => x.clockOut && x.clockOut <= d.clockIn && x.counted !== null && shiftDayOf(x, nowMs) === day);
      d.prevName = prev ? prev.name : null;
      d.prevCounted = prev ? prev.counted : null;
      d.prevOut = prev ? prev.clockOut : null;
      d.handover = prev && d.opening !== null ? round2(d.opening - prev.counted) : null;
      d.between = null;
      if (prev && d.opening !== null && !d.loading) {
        const src = poolFor(prev.clockOut, d.clockIn);
        if (src) {
          const f = cashFlows(src.pool, src.expenses, (iso) => iso > prev.clockOut && iso < d.clockIn);
          const expectedOpening = round2(prev.counted + f.cashIn - f.paidOut);
          d.between = { ...f, expectedOpening, residual: round2(d.opening - expectedOpening) };
        }
      }
    });

    // Whole-day cash chain: the first shift's opening, every cash movement from then until the last shift
    // closed (inside shifts AND in the gaps between them), against the final count.
    const first = drawers[0];
    const last = drawers[drawers.length - 1];
    let dayTotals = { opening: null, cashIn: 0, paidOut: 0, finalCounted: null, expectedEnd: null, gap: null, shiftGaps: 0, residuals: 0, collected: 0, impliedCollection: null };
    if (first && last && !first.loading) {
      const lastEnd = last.clockOut || nowIso;
      const src = poolFor(first.clockIn, lastEnd);
      if (src) {
        const f = cashFlows(src.pool, src.expenses, (iso) => iso >= first.clockIn && iso <= lastEnd);
        dayTotals = {
          opening: first.opening,
          cashIn: f.cashIn,
          paidOut: f.paidOut,
          finalCounted: last.counted,
          expectedEnd: first.opening !== null ? round2(first.opening + f.cashIn - f.paidOut) : null,
          gap: null,
          shiftGaps: round2(drawers.reduce((s, d) => s + (d.gap || 0), 0)),
          residuals: round2(drawers.slice(1).reduce((s, d) => s + (d.between ? d.between.residual : d.handover || 0), 0)),
        };
        dayTotals.collected = dayCollection ? dayCollection.amount : 0;
        dayTotals.gap = dayTotals.expectedEnd !== null && dayTotals.finalCounted !== null ? round2(dayTotals.finalCounted - (dayTotals.expectedEnd - dayTotals.collected)) : null;
        dayTotals.impliedCollection = !dayCollection && dayTotals.gap !== null && dayTotals.gap < -0.005 && last.impliedCollection ? last.impliedCollection : null;
      }
    }

    const outside = dayCompleted.filter((r) => !coverShift(r));
    const unpaid = p.unpaid.orders;
    return { day, collection: dayCollection, revenue: p.revenue, orders: p.orders, byMethod, discounts: { n: p.discounts.n, total: p.discounts.total }, voided: { n: voided.length, total: p.voidedTotal }, expenseTotal, drawers, dayTotals, outside, unpaid };
  };

  return { bizDay, monthsLoaded, ordersInDays, expensesInDays, period, allShifts, shiftDayOf, shiftTotals, employeeTotals, closeDay, cashFlows };
}
