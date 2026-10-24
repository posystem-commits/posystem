import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// The monitor's memory between runs: which problems are open (so they are announced once, reminded
// occasionally, and announced again when resolved), who receives messages, the owner's explanations, and a
// short history for trends. A plain JSON file; in production it lives on a private branch of the repository.
export const emptyState = () => ({
  findings: {}, // fp -> { first, last, severity, title, detail, tenant, tenantName, code, topic, notifiedAt, resolvedAt, notifiedSeverity }
  recipients: [], // { chatId, name, role: "owner" | "viewer" }
  explanations: {}, // short id -> { text, by, at }
  history: [], // { at, dbBytes, checks, failed }
  lastWeekly: null,
  lastMonitorError: null,
});

export function loadState(file) {
  try {
    return { ...emptyState(), ...JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch (e) {
    return emptyState();
  }
}

export function saveState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  state.history = state.history.slice(-600);
  fs.writeFileSync(file, JSON.stringify(state, null, 1));
}

export const shortId = (fp) => crypto.createHash("sha1").update(fp).digest("hex").slice(0, 6);

// Compares what the checks found now with what was already open. Returns what to tell people.
export function reconcile(state, current, nowIso, remindHours) {
  const nowMs = new Date(nowIso).getTime();
  const seen = new Set();
  const newAlerts = [];
  const reminders = [];
  const resolved = [];
  current.forEach((f) => {
    seen.add(f.fp);
    const prev = state.findings[f.fp];
    if (!prev || prev.resolvedAt) {
      state.findings[f.fp] = { ...f, first: nowIso, last: nowIso, notifiedAt: null, resolvedAt: null, notifiedSeverity: null };
      if (f.severity === "red") newAlerts.push(state.findings[f.fp]);
    } else {
      const wasRed = prev.severity === "red";
      state.findings[f.fp] = { ...prev, ...f, first: prev.first, last: nowIso, resolvedAt: null };
      const cur = state.findings[f.fp];
      if (f.severity === "red" && !wasRed) newAlerts.push(cur); // got worse
      else if (f.severity === "red" && cur.notifiedAt && nowMs - new Date(cur.notifiedAt).getTime() > remindHours * 3600000) reminders.push(cur);
      else if (f.severity === "red" && !cur.notifiedAt) newAlerts.push(cur);
    }
  });
  Object.values(state.findings).forEach((f) => {
    if (!seen.has(f.fp) && !f.resolvedAt) {
      f.resolvedAt = nowIso;
      // One-off events (a support sign-in, say) are announced once and simply drop off — no "resolved" message.
      if (f.notifiedAt && f.notifiedSeverity === "red" && !f.event) resolved.push(f);
    }
  });
  return { newAlerts, reminders, resolved };
}

export const openFindings = (state) => Object.values(state.findings).filter((f) => !f.resolvedAt);
