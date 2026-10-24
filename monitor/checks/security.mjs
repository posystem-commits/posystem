import { finding } from "../lib/findings.mjs";

const cairo = (iso) => new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Cairo", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// The hidden support sign-in (see /admin/support in the app). Every sign-in is reported, because only the owner
// should ever use it; repeated wrong codes and lock-outs are reported too. These are events, not conditions:
// each is announced once and then quietly drops off (`event: true`), with no "resolved" message.
// `log` rows: { id, tenant_id, outcome: ok|fail|locked|exit, ip, created_at }.
export function securityChecks({ log, tenants, cfg, nowMs }) {
  const th = cfg.thresholds;
  const nameOf = (id) => tenants.find((t) => t.id === id)?.restaurant_name || "a restaurant";
  const isTest = (id) => (cfg.testTenants || []).includes(id);
  const windowMs = th.supportEventWindowHours * 3600000;
  const recent = log.filter((l) => nowMs - Date.parse(l.created_at) < windowMs);
  const event = (f) => ({ ...finding(f), event: true });
  const out = [];

  recent.filter((l) => l.outcome === "ok").forEach((l) => {
    out.push(event({
      tenant: l.tenant_id, tenantName: nameOf(l.tenant_id), code: "SUPPORT_SIGNIN", key: String(l.id), topic: "security",
      severity: isTest(l.tenant_id) ? "info" : "red",
      title: `Support sign-in used on ${nameOf(l.tenant_id)} at ${cairo(l.created_at)}`,
      detail: `Device IP ${l.ip || "unknown"}. If this was you, nothing to do. If not, change the support code now in the admin page (Support access).`,
    }));
  });

  // Wrong codes: reported once a device reaches the threshold within the window.
  const failsByIp = {};
  recent.filter((l) => l.outcome === "fail").forEach((l) => {
    const ip = l.ip || "unknown";
    failsByIp[ip] = [...(failsByIp[ip] || []), l];
  });
  Object.entries(failsByIp).forEach(([ip, rows]) => {
    if (rows.length < th.supportFailAlertCount) return;
    const last = rows.reduce((a, b) => (a.created_at > b.created_at ? a : b));
    out.push(event({
      tenant: last.tenant_id, tenantName: nameOf(last.tenant_id), code: "SUPPORT_WRONG_CODES", key: `${ip}|${Math.floor(Date.parse(rows[0].created_at) / windowMs)}`, topic: "security",
      severity: isTest(last.tenant_id) ? "info" : "red",
      title: `${rows.length} wrong support codes entered on ${nameOf(last.tenant_id)} (last at ${cairo(last.created_at)})`,
      detail: `Device IP ${ip}. Someone may be guessing the code. A device is locked out after 5 tries; if this wasn't you, consider changing the code.`,
    }));
  });

  recent.filter((l) => l.outcome === "locked").slice(0, 1).forEach((l) => {
    out.push(event({
      tenant: l.tenant_id, tenantName: nameOf(l.tenant_id), code: "SUPPORT_LOCKED", key: String(Math.floor(Date.parse(l.created_at) / windowMs)), topic: "security",
      severity: isTest(l.tenant_id) ? "info" : "red",
      title: `Support sign-in locked out on ${nameOf(l.tenant_id)} after repeated wrong codes`,
      detail: `Device IP ${l.ip || "unknown"}. It stays locked for 15 minutes (everyone for an hour if 20 wrong codes came from anywhere).`,
    }));
  });
  return out;
}

// One line for the weekly report.
export function supportWeekly({ log, tenants, nowMs }) {
  const week = log.filter((l) => nowMs - Date.parse(l.created_at) < 7 * 86400000);
  const ok = week.filter((l) => l.outcome === "ok");
  const fails = week.filter((l) => l.outcome === "fail").length;
  const names = {};
  ok.forEach((l) => {
    const n = tenants.find((t) => t.id === l.tenant_id)?.restaurant_name || "a restaurant";
    names[n] = (names[n] || 0) + 1;
  });
  const who = Object.entries(names).map(([n, c]) => `${n} ×${c}`).join(", ");
  return `Support sign-ins this week: ${ok.length}${who ? ` (${who})` : ""} · wrong codes: ${fails}.`;
}
