import { finding } from "../lib/findings.mjs";

// Runs the same rules as the release gate (src/numbers-check.js) over a restaurant's recent days and turns
// any failure into a finding. Failures are grouped (one finding per kind of rule) so a single bad record
// doesn't produce a flood of messages.
const RED_GROUPS = new Set(["day", "shift", "drawer", "month", "leaderboard"]);
const TITLES = {
  day: "A day's numbers don't add up between screens",
  shift: "A shift's totals can't be worked out",
  drawer: "A cash drawer's arithmetic is off",
  month: "A month doesn't equal the sum of its days",
  leaderboard: "Staff leaderboard doesn't match the Dashboard",
  receipt: "Some orders have lines that don't add up",
  data: "Stored data looks inconsistent",
};

export function numbersChecks({ L, N, ledger, data, nowMs, cfg }) {
  const t = data.tenant;
  // Whole months, so the month-equals-its-days rule has every day of the month to add up.
  const from = `${ledger.bizDay(new Date(nowMs - 14 * 86400000).toISOString()).slice(0, 7)}-01`;
  const { days, results } = N.runNumberChecks({ L, ledger, receiptsByMonth: data.receiptsByMonth, shiftLog: data.shiftLog, expensesByMonth: data.expensesByMonth, nowMs, from });
  const acks = (cfg.acknowledged || []).filter((a) => !a.tenant || a.tenant === t.id);
  const failed = results.filter((r) => !r.ok && !acks.some((a) => `${r.name} ${r.detail}`.includes(a.contains)));
  const byGroup = {};
  failed.forEach((r) => (byGroup[r.group] ||= []).push(r));
  const out = Object.entries(byGroup).map(([group, list]) =>
    finding({
      tenant: t.id,
      tenantName: t.restaurant_name,
      code: `NUM_${group}`,
      severity: RED_GROUPS.has(group) ? "red" : "amber",
      topic: group === "data" || group === "receipt" ? "data" : "calculations",
      title: `${TITLES[group] || group} (${list.length})`,
      detail: list.slice(0, 5).map((r) => `${r.name}: ${r.detail}`).join("\n"),
    })
  );
  return { findings: out, summary: { days: days.length, checks: results.length, failed: failed.length } };
}
