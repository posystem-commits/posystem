// The monitor's entry point.
//
//   node monitor/run.mjs check  [--dry] [--state <file>] [--no-confirm]   run every check, alert on what is new
//   node monitor/run.mjs weekly [--dry] [--force] [--state <file>]        send the Thursday report (when it is due)
//   node monitor/run.mjs status [--state <file>]                          print what is currently open
//
// Read-only against the restaurants' data. It writes only its own small state file and sends Telegram
// messages. Needs SUPABASE_URL and MONITOR_SUPABASE_KEY (and TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_IDS to send).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const args = process.argv.slice(2);
const mode = args[0] || "check";
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const cfg = JSON.parse(fs.readFileSync(path.join(here, "config.json"), "utf8"));
process.env.TZ = cfg.timezone; // the ledger's business days follow local (Cairo) time

if (fs.existsSync(path.join(root, ".env.local")) && !process.env.SUPABASE_URL) {
  for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const { connect, loadTenants, loadTenantData, loadUsage, loadSupportLog } = await import("./lib/data.mjs");
const { loadState, saveState, reconcile, openFindings, shortId } = await import("./lib/state.mjs");
const { broadcast } = await import("./lib/telegram.mjs");
const { alertText, ICON, esc } = await import("./lib/format.mjs");
const { numbersChecks } = await import("./checks/numbers.mjs");
const { businessChecks } = await import("./checks/business.mjs");
const { capacityChecks } = await import("./checks/capacity.mjs");
const { securityChecks, supportWeekly } = await import("./checks/security.mjs");
const { buildWeeklyReport } = await import("./weekly.mjs");
const { processInbox } = await import("./inbox.mjs");
const { proposeFixes, tidyProposals, buttonsFor, suggestionText } = await import("./fixes.mjs");
const { ackQueue } = await import("./lib/worker.mjs");
const L = await import(pathToFileURL(path.join(root, "src/ledger.js")).href);
const N = await import(pathToFileURL(path.join(root, "src/numbers-check.js")).href);

const stateFile = opt("state", path.join(here, "state", "state.json"));
const dry = flag("dry");
const state = loadState(stateFile);
// What the owner has taught me by chat is merged into the settings.
cfg.cashPickupsExpected = Array.from(new Set([...(cfg.cashPickupsExpected || []), ...(state.cashPickupsExpected || [])]));
const labels = { methodByLabel: {}, isPayLabel: () => false };

async function runChecks(db, nowMs) {
  const tenants = await loadTenants(db);
  const contexts = [];
  const findings = [];
  const summary = { checks: 0, failed: 0 };
  for (const tenant of tenants) {
    const data = await loadTenantData(db, tenant, nowMs);
    const ledger = L.createLedger({ receiptsByMonth: data.receiptsByMonth, expensesByMonth: data.expensesByMonth, shiftLog: data.shiftLog, openShifts: data.openShifts, shiftHours: data.shiftHours || L.DEFAULT_SHIFT_HOURS, menu: {}, labels, collections: data.collections });
    const isTest = cfg.testTenants.includes(tenant.id);
    const nc = numbersChecks({ L, N, ledger, data, nowMs, cfg });
    summary.checks += nc.summary.checks;
    summary.failed += nc.summary.failed;
    const found = [...nc.findings, ...businessChecks({ L, ledger, data, nowMs, cfg, isTest })];
    // The test restaurant should never wake anyone: its problems are real but not urgent.
    found.forEach((f) => findings.push(isTest && f.severity === "red" ? { ...f, severity: "amber", title: `[test] ${f.title}` } : f));
    contexts.push({ data, ledger, isTest });
  }
  const usage = await loadUsage(db);
  const capacity = capacityChecks({ usage, cfg, nowMs });
  findings.push(...capacity.findings);
  const supportLog = await loadSupportLog(db, new Date(nowMs - 8 * 86400000).toISOString());
  findings.push(...securityChecks({ log: supportLog, tenants, cfg, nowMs }));
  return { findings, contexts, usage, capacity, summary, supportLine: supportWeekly({ log: supportLog, tenants, nowMs }) };
}

async function main() {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  if (mode === "status") {
    const open = openFindings(state);
    if (!open.length) console.log("Nothing open.");
    open.forEach((f) => console.log(`${f.severity.padEnd(5)} ${f.tenantName || "system"}: ${f.title} [${shortId(f.fp)}] since ${f.first}`));
    return;
  }

  // People may have written to the bot since the last round: answer them first (new explanations change the checks).
  const { handled, ackKeys } = await processInbox({ state, dry, nowIso });
  if (handled) console.log(`Handled ${handled} message(s) or button tap(s) from Telegram.`);
  tidyProposals(state, nowIso);
  // "relay" only answers what people sent (messages and button taps), without running the checks: the Worker starts
  // it the moment something arrives. The saved state is acknowledged to the Worker only after it has been written.
  if (mode === "relay") {
    saveState(stateFile, state);
    if (!dry) await ackQueue(ackKeys);
    return;
  }
  cfg.cashPickupsExpected = Array.from(new Set([...(cfg.cashPickupsExpected || []), ...(state.cashPickupsExpected || [])]));

  const db = connect();
  let result = await runChecks(db, nowMs);

  if (mode === "check") {
    // New urgent findings are checked once more a minute later, so a momentary read race never raises an alarm.
    const known = (f) => state.findings[f.fp] && !state.findings[f.fp].resolvedAt;
    const fresh = result.findings.filter((f) => f.severity === "red" && !known(f));
    if (fresh.length && !flag("no-confirm")) {
      console.log(`${fresh.length} new urgent finding(s); confirming in 60 s…`);
      await new Promise((r) => setTimeout(r, 60000));
      const again = await runChecks(db, Date.now());
      const stillThere = new Set(again.findings.map((f) => f.fp));
      result = { ...again, findings: again.findings.filter((f) => f.severity !== "red" || known(f) || stillThere.has(f.fp)) };
    }
    const { newAlerts, reminders, resolved } = reconcile(state, result.findings, nowIso, cfg.remindHours);
    // Fixes the monitor knows for what is open now. A fix for something being announced rides on that alert as buttons;
    // the others are offered in a message of their own. (In a dry run nothing is remembered.)
    const savedProposals = dry ? JSON.parse(JSON.stringify(state.proposals || {})) : null;
    const offered = proposeFixes(state, openFindings(state), nowIso);
    const attached = new Set();
    for (const f of newAlerts) {
      const mine = offered.filter((p) => p.fp === f.fp);
      mine.forEach((p) => attached.add(p.id));
      await broadcast(state, alertText(f, "new", nowMs), { roles: ["owner"], dry, buttons: mine.length ? mine.flatMap(buttonsFor) : null });
      f.notifiedAt = nowIso;
      f.notifiedSeverity = "red";
    }
    for (const p of offered.filter((x) => !attached.has(x.id))) await broadcast(state, suggestionText(p), { roles: ["owner"], dry, buttons: buttonsFor(p) });
    if (dry) state.proposals = savedProposals;
    for (const f of reminders) {
      await broadcast(state, alertText(f, "reminder", nowMs), { roles: ["owner"], dry });
      f.notifiedAt = nowIso;
    }
    for (const f of resolved) await broadcast(state, alertText(f, "resolved", nowMs), { roles: ["owner"], dry });
    state.history.push({ at: nowIso, dbBytes: result.usage.totalBytes, checks: result.summary.checks, failed: result.summary.failed });
    state.lastMonitorError = null;
    const open = openFindings(state);
    console.log(`Checked ${result.contexts.length} restaurant(s): ${result.summary.checks} rules, ${result.summary.failed} failed. Open: ${open.filter((f) => f.severity === "red").length} red, ${open.filter((f) => f.severity === "amber").length} amber, ${open.filter((f) => f.severity === "info").length} info. Alerts sent: ${newAlerts.length} new, ${reminders.length} reminders, ${resolved.length} resolved.`);
    if (!dry && process.env.HEALTHCHECK_URL) await fetch(process.env.HEALTHCHECK_URL).catch(() => {});
  }

  // The weekly report: Thursday 10:00 Cairo time (the workflow runs at both possible UTC hours; this decides).
  const local = new Date(nowMs);
  // Due from 10:00 on Thursday until sent — a late scheduler run sends it late rather than skipping it.
  const weeklyDue = (local.getDay() === cfg.weeklyReport.weekday && local.getHours() >= cfg.weeklyReport.hour && state.lastWeekly !== local.toDateString()) || state.reportRequested === true;
  if (mode === "weekly" || (mode === "check" && weeklyDue)) {
    if (mode === "weekly" && !flag("force") && !weeklyDue) {
      console.log("Not due yet (use --force to send now).");
    } else {
      const text = buildWeeklyReport({ contexts: result.contexts, usage: result.usage, capacity: result.capacity, supportLine: result.supportLine, state, cfg, nowMs, L });
      await broadcast(state, text, { roles: ["owner", "viewer"], dry });
      if (!dry) {
        state.lastWeekly = local.toDateString();
        state.reportRequested = false;
      }
    }
  }
  saveState(stateFile, state);
  if (!dry) await ackQueue(ackKeys);
}

main().catch(async (e) => {
  console.error("monitor error:", e.message);
  try {
    const sixH = state.lastMonitorError && Date.now() - new Date(state.lastMonitorError).getTime() < 6 * 3600000;
    if (!sixH && !dry) {
      await broadcast(state, `🟠 <b>The monitor itself hit a problem</b>\n${esc(e.message)}\nIt will keep retrying. If this repeats, the checks are not running.`, { roles: ["owner"], dry });
      state.lastMonitorError = new Date().toISOString();
      saveState(stateFile, state);
    }
  } catch (e2) {
    // nothing more we can do
  }
  process.exit(1);
});
