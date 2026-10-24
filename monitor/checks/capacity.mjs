import { finding } from "../lib/findings.mjs";

// Space on the free database plan, and whether the nightly safety copies are still being made.
export function capacityChecks({ usage, cfg, nowMs }) {
  const th = cfg.thresholds;
  const out = [];
  const mb = usage.totalBytes / 1048576;
  const pct = (mb / th.dbLimitMB) * 100;
  if (pct >= th.dbPercentAmber) {
    out.push(finding({ code: "DB_SPACE", severity: pct >= th.dbPercentRed ? "red" : "amber", topic: "capacity", title: `Database space is ${pct.toFixed(0)}% used (${mb.toFixed(0)} of ${th.dbLimitMB} MB)`, detail: "The free Supabase plan restricts the whole project when it is full, which would stop every restaurant. Archive old safety copies or move to Supabase Pro." }));
  }
  usage.perTenant.forEach((t) => {
    if (!t.latestSnapshotAt) return;
    const hrs = (nowMs - new Date(t.latestSnapshotAt).getTime()) / 3600000;
    // A snapshot is only taken when something changed, so an idle restaurant legitimately has an old one.
    if (hrs > th.snapshotStaleHours && t.snapshotCount > 0) {
      out.push(finding({ tenant: t.id, tenantName: t.name, code: "SNAPSHOT_OLD", severity: "info", topic: "backups", title: `${t.name}: the latest in-database safety copy is ${Math.round(hrs)} hours old`, detail: "Normal if nothing changed; otherwise check the nightly snapshot job." }));
    }
  });
  return { findings: out, mb, pct };
}
