import { ICON, esc } from "./lib/format.mjs";
import { openFindings, shortId } from "./lib/state.mjs";
import { SEVERITY_RANK } from "./lib/findings.mjs";

const money = (n) => `${(Math.round(n * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP`;
const addDays = (day, n) => new Date(new Date(`${day}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
const pctChange = (a, b) => (b > 0 ? `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)}%` : "n/a");

// The Thursday report. Plain and complete: how each restaurant did, whether the cash added up, what went
// wrong and what is still open, where the system is heading (space, subscriptions), and what the monitor
// would like to ask.
export function buildWeeklyReport({ contexts, usage, capacity, state, cfg, nowMs, L }) {
  const today = contexts[0]?.ledger.bizDay(new Date(nowMs).toISOString());
  const end = addDays(today, -1); // last full business day
  const start = addDays(end, -6);
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -6);
  const open = openFindings(state);
  const lines = [];
  const worst = open.reduce((w, f) => (SEVERITY_RANK[f.severity] > (SEVERITY_RANK[w] || 0) ? f.severity : w), "ok");
  const overall = worst === "red" ? "🔴 Needs attention" : worst === "amber" ? "🟡 Mostly fine — a few things to look at" : "🟢 Everything is working as it should";
  lines.push(`<b>📋 Weekly report — ${start} to ${end}</b>`);
  lines.push(`<b>${overall}</b>`);

  contexts.filter((c) => !c.isTest).forEach((c) => {
    const p = c.ledger.period(start, end);
    const pp = c.ledger.period(prevStart, prevEnd);
    lines.push("");
    lines.push(`<b>🍽 ${esc(c.data.tenant.restaurant_name)}</b>`);
    if (!p) {
      lines.push("Couldn't load this week's orders.");
      return;
    }
    const avg = p.orders ? p.revenue / p.orders : 0;
    lines.push(`Sales ${money(p.revenue)} (${pctChange(p.revenue, pp ? pp.revenue : 0)} vs last week) · ${p.orders} orders · average ${money(avg)}`);
    const m = L.PAYMENT_METHODS.map((x) => [x.id, p.byMethod[x.id]]).filter(([, v]) => v > 0).map(([id, v]) => `${id} ${money(v)}`).join(" · ");
    if (m) lines.push(`By payment: ${m}`);
    lines.push(`Expenses ${money(p.expenseTotal)} · discounts ${money(p.discounts.total)} (${p.discounts.n} orders) · cancelled/refunded ${p.voided.length} (${money(p.voidedTotal)})`);
    // cash
    let counted = 0;
    let gapSum = 0;
    let biggest = null;
    let uncounted = 0;
    let outsideN = 0;
    let pickups = 0;
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const cd = c.ledger.closeDay(d, nowMs);
      if (!cd) continue;
      outsideN += cd.outside.length;
      cd.drawers.forEach((dr) => {
        if (dr.gap === null) {
          if (dr.clockOut && dr.counted === null && !dr.auto && dr.clockIn >= cfg.thresholds.countsRequiredFrom) uncounted++;
          return;
        }
        counted++;
        gapSum += dr.gap;
        if (dr.handover !== null && dr.handover < 0 && Math.abs(dr.handover) >= cfg.thresholds.handoverAmber) pickups += Math.abs(dr.handover);
        if (!biggest || Math.abs(dr.gap) > Math.abs(biggest.gap)) biggest = { ...dr, day: d };
      });
    }
    lines.push(`Cash: ${counted} shift counts checked · net difference ${gapSum >= 0 ? "+" : ""}${money(gapSum)}${biggest && Math.abs(biggest.gap) >= 1 ? ` · biggest ${biggest.gap < 0 ? "short" : "over"} ${money(Math.abs(biggest.gap))} (${esc(biggest.name)}, ${biggest.day})` : ""}`);
    if (pickups) lines.push(`Cash taken out between shifts (pickups): ${money(pickups)}`);
    if (uncounted) lines.push(`⚠️ ${uncounted} shift(s) ended without a count`);
    if (outsideN) lines.push(`⚠️ ${outsideN} order(s) were rung up when nobody was clocked in`);
    const t = c.data.tenant;
    if (t.paid_until) {
      const days = Math.ceil((new Date(`${t.paid_until}T23:59:59Z`).getTime() - nowMs) / 86400000);
      lines.push(`Subscription paid until ${t.paid_until} (${days} days left)`);
    }
  });

  // what the monitor caught
  const weekAgo = new Date(nowMs - 7 * 86400000).toISOString();
  const all = Object.values(state.findings);
  const openedThisWeek = all.filter((f) => f.first >= weekAgo);
  const resolvedThisWeek = all.filter((f) => f.resolvedAt && f.resolvedAt >= weekAgo);
  lines.push("");
  lines.push(`<b>🔎 What I watched</b>`);
  const runs = state.history.filter((h) => h.at >= weekAgo);
  const checks = runs.reduce((s, h) => s + (h.checks || 0), 0);
  const failed = runs.reduce((s, h) => s + (h.failed || 0), 0);
  lines.push(`${runs.length} check rounds this week, ${checks.toLocaleString("en-US")} number rules tested${failed ? `, ${failed} failures seen` : ", none failed"}.`);
  lines.push(`${openedThisWeek.length} problem(s) noticed · ${resolvedThisWeek.length} resolved · ${open.length} open now.`);

  const rank = (f) => -SEVERITY_RANK[f.severity];
  const list = open.slice().sort((a, b) => rank(a) - rank(b));
  if (list.length) {
    lines.push("");
    lines.push(`<b>⚠️ Open items</b>`);
    list.slice(0, 12).forEach((f) => {
      const exp = state.explanations[shortId(f.fp)];
      lines.push(`${ICON[f.severity]} ${f.tenantName ? esc(f.tenantName) + ": " : ""}${esc(f.title)}${exp ? ` — <i>you said: ${esc(exp.text)}</i>` : ""} <code>${shortId(f.fp)}</code>`);
    });
    if (list.length > 12) lines.push(`…and ${list.length - 12} more (/status).`);
  }

  // system and risks
  lines.push("");
  lines.push(`<b>🛡 System & risks</b>`);
  lines.push(`Database space: ${capacity.mb.toFixed(1)} of ${cfg.thresholds.dbLimitMB} MB (${capacity.pct.toFixed(1)}%).`);
  const hist = state.history.filter((h) => h.dbBytes).slice(-200);
  if (hist.length >= 2) {
    const a = hist[0];
    const b = hist[hist.length - 1];
    const days = (new Date(b.at) - new Date(a.at)) / 86400000;
    if (days >= 3) {
      const perDay = (b.dbBytes - a.dbBytes) / days;
      if (perDay > 0) {
        const left = (cfg.thresholds.dbLimitMB * 1048576 - b.dbBytes) / perDay;
        lines.push(`At the current growth (${(perDay / 1048576).toFixed(2)} MB/day) the free database fills in about ${left > 3650 ? "10+ years" : Math.round(left / 30) > 24 ? `${(left / 365).toFixed(1)} years` : `${Math.round(left / 30)} months`}.`);
      }
    }
  }
  lines.push(`Backups: nightly copy to Google Drive and in-database safety copies are being checked.`);
  const u = state.usage && state.usage.values;
  if (u) {
    const parts = [];
    if (u.vercel_calls !== undefined) parts.push(`Vercel function calls ${u.vercel_calls.toLocaleString("en-US")} (${((u.vercel_calls / 1000000) * 100).toFixed(0)}% of the free plan's 1 M — Pro has no hard cap)`);
    if (u.vercel_gb !== undefined) parts.push(`Vercel transfer ${u.vercel_gb} GB (Pro includes 1,000 GB)`);
    if (u.supabase_egress_gb !== undefined) parts.push(`Supabase egress ${u.supabase_egress_gb} GB of 5 GB (${((u.supabase_egress_gb / 5) * 100).toFixed(0)}%)`);
    lines.push(`Usage you sent on ${state.usage.at.slice(0, 10)}: ${parts.join(" · ")}.`);
    if (u.supabase_egress_gb !== undefined && u.supabase_egress_gb / 5 > 0.6) lines.push("⚠️ Supabase transfer is above 60% of the free limit — time to think about Supabase Pro.");
  } else {
    lines.push(`Limits to keep an eye on: Vercel usage (function calls, data transfer, spend) and Supabase data transfer — I can't read those dashboards on my own.`);
  }

  lines.push("");
  lines.push(`<b>❓ Questions for you</b>`);
  const gaps = list.filter((f) => f.code === "CASH_GAP" && !state.explanations[shortId(f.fp)]);
  gaps.slice(0, 5).forEach((f) => lines.push(`• ${esc(f.title)} — do you know why? Reply <code>/explain ${shortId(f.fp)} …</code>`));
  const usageAge = state.usage ? (nowMs - new Date(state.usage.at).getTime()) / 86400000 : Infinity;
  if (usageAge > 25) lines.push(`• Please send this month's Vercel and Supabase usage numbers (reply <code>/usage vercel_calls=… vercel_gb=… supabase_egress_gb=…</code>) so I can tell you how close you are to the limits.`);
  return lines.join("\n");
}
