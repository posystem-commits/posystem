// A finding is one thing the monitor noticed. Severity: "red" = needs attention now, "amber" = worth knowing
// (goes into the weekly report and /status), "info" = context only.
export const SEVERITY_RANK = { red: 3, amber: 2, info: 1 };

export function finding({ tenant, code, key = "", severity, topic, title, detail = "", tenantName }) {
  return {
    fp: `${tenant || "system"}|${code}|${key}`,
    tenant: tenant || null,
    tenantName: tenantName || null,
    code,
    severity,
    topic, // calculations | cash | orders | data | availability | capacity | cost | backups | security | subscription
    title,
    detail,
  };
}

export const worst = (list) => list.reduce((w, f) => (SEVERITY_RANK[f.severity] > SEVERITY_RANK[w] ? f.severity : w), "info");
