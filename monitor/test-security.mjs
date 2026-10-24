// node --no-warnings monitor/test-security.mjs
import assert from "node:assert/strict";
import { securityChecks, supportWeekly } from "./checks/security.mjs";
import { reconcile, emptyState } from "./lib/state.mjs";

const cfg = { testTenants: ["T-TEST"], thresholds: { supportEventWindowHours: 3, supportFailAlertCount: 3 } };
const tenants = [{ id: "T-KAIVO", restaurant_name: "Kaivo" }, { id: "T-TEST", restaurant_name: "G&B Test" }];
const now = Date.parse("2026-10-24T12:00:00Z");
const at = (minsAgo) => new Date(now - minsAgo * 60000).toISOString();
const row = (id, tenant_id, outcome, ip, minsAgo) => ({ id, tenant_id, outcome, ip, created_at: at(minsAgo) });
let n = 0;
const ok = (name, fn) => { fn(); n++; console.log("ok:", name); };

ok("a sign-in on a real restaurant is urgent; on the test restaurant it is only informational", () => {
  const f = securityChecks({ log: [row(1, "T-KAIVO", "ok", "1.1.1.1", 20), row(2, "T-TEST", "ok", "1.1.1.1", 30)], tenants, cfg, nowMs: now });
  assert.equal(f.length, 2);
  assert.equal(f.find((x) => x.tenant === "T-KAIVO").severity, "red");
  assert.equal(f.find((x) => x.tenant === "T-TEST").severity, "info");
  assert.ok(f.every((x) => x.event === true));
  assert.ok(f[0].title.includes("Support sign-in used"));
});
ok("old entries and sign-outs are not reported", () => {
  const f = securityChecks({ log: [row(1, "T-KAIVO", "ok", "1.1.1.1", 400), row(2, "T-KAIVO", "exit", "1.1.1.1", 5)], tenants, cfg, nowMs: now });
  assert.equal(f.length, 0);
});
ok("three wrong codes from one device are reported once; two are not", () => {
  const two = securityChecks({ log: [row(1, "T-KAIVO", "fail", "9.9.9.9", 5), row(2, "T-KAIVO", "fail", "9.9.9.9", 4)], tenants, cfg, nowMs: now });
  assert.equal(two.length, 0);
  const three = securityChecks({ log: [row(1, "T-KAIVO", "fail", "9.9.9.9", 5), row(2, "T-KAIVO", "fail", "9.9.9.9", 4), row(3, "T-KAIVO", "fail", "9.9.9.9", 3), row(4, "T-KAIVO", "fail", "8.8.8.8", 3)], tenants, cfg, nowMs: now });
  assert.equal(three.length, 1);
  assert.equal(three[0].code, "SUPPORT_WRONG_CODES");
});
ok("a lock-out is reported", () => {
  const f = securityChecks({ log: [row(5, "T-KAIVO", "locked", "9.9.9.9", 2)], tenants, cfg, nowMs: now });
  assert.equal(f[0].code, "SUPPORT_LOCKED");
});
ok("an event is announced once, then drops off without a 'resolved' message", () => {
  const state = emptyState();
  const f = securityChecks({ log: [row(1, "T-KAIVO", "ok", "1.1.1.1", 20)], tenants, cfg, nowMs: now });
  let r = reconcile(state, f, new Date(now).toISOString(), 24);
  assert.equal(r.newAlerts.length, 1);
  state.findings[f[0].fp].notifiedAt = new Date(now).toISOString();
  state.findings[f[0].fp].notifiedSeverity = "red";
  r = reconcile(state, f, new Date(now + 3600000).toISOString(), 24);
  assert.equal(r.newAlerts.length, 0, "not announced twice");
  r = reconcile(state, [], new Date(now + 4 * 3600000).toISOString(), 24);
  assert.equal(r.resolved.length, 0, "no resolved message for an event");
});
ok("weekly line counts sign-ins per restaurant and wrong codes", () => {
  const line = supportWeekly({ log: [row(1, "T-KAIVO", "ok", "a", 60), row(2, "T-KAIVO", "ok", "a", 3000), row(3, "T-TEST", "ok", "a", 4000), row(4, "T-KAIVO", "fail", "b", 100), row(5, "T-KAIVO", "ok", "a", 20000)], tenants, nowMs: now });
  assert.equal(line, "Support sign-ins this week: 3 (Kaivo ×2, G&B Test ×1) · wrong codes: 1.");
});
console.log(`${n} checks passed`);
