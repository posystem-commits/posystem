import crypto from "node:crypto";
import { esc } from "./lib/format.mjs";

// Fixes the monitor can suggest and, once the owner taps "Fix it" in Telegram, carry out.
//
// Rules that never bend:
//  * Only the fix types listed in FIX_TYPES exist. Each is a small, fixed, tested action; nothing is improvised.
//  * Nothing happens until an OWNER taps its button. A proposal works once and expires after 24 hours.
//  * Every outcome is written to state.fixLog, and a fix that can be undone gets an Undo button.
//  * Fixes that change a restaurant's records (added in later steps) must show before/after, re-read the record
//    first and refuse if it changed, save the old value, and verify the result. The ones below change only the
//    monitor's own notes.
export const PROPOSAL_TTL_HOURS = 24;
const HOUR = 3600000;
const plus = (iso, hours) => new Date(new Date(iso).getTime() + hours * HOUR).toISOString();

export const FIX_TYPES = {
  // Stop the daily "still open" reminders for something the owner already knows about.
  acknowledge: {
    button: "Acknowledge (7 days)",
    eligible: (f) => f.severity === "red" && !f.event && !f.snoozedUntil,
    text: () => "If you already know about this, I'll stop reminding you about it for 7 days. It stays open and is still in /status and the weekly report.",
    apply: ({ state, p, nowIso }) => {
      const f = state.findings[p.fp];
      if (!f || f.resolvedAt) return { ok: false, message: "That item is no longer open, so there is nothing to acknowledge." };
      const before = f.snoozedUntil || null;
      f.snoozedUntil = plus(nowIso, 7 * 24);
      return { ok: true, message: "Done. I won't remind you about this for 7 days.", undo: { before } };
    },
    undo: ({ state, p }) => {
      const f = state.findings[p.fp];
      if (f) f.snoozedUntil = p.undo?.before || null;
      return { ok: true, message: "Undone. I'll remind you about it again." };
    },
  },
  // A cash pickup between shifts that is just the owner's regular collection.
  pickups_normal: {
    button: "Yes, it's the normal pickup",
    declineScope: (p) => p.tenant,
    eligible: (f, state) => f.code === "CASH_PICKUP" && f.severity === "amber" && !!f.tenant && !(state.cashPickupsExpected || []).includes(f.tenant) && !(state.fixDeclined || {})[`pickups_normal|${f.tenant}`],
    text: (f) => `Is this the regular cash pickup, money taken out between shifts? If you say yes I'll treat pickups at ${f.tenantName || "this restaurant"} as normal: they will only be listed in the weekly report, not raised each time.`,
    apply: ({ state, p }) => {
      const list = state.cashPickupsExpected || [];
      if (list.includes(p.tenant)) return { ok: true, message: "Already treated as normal for that restaurant.", undo: { added: false } };
      state.cashPickupsExpected = [...list, p.tenant];
      return { ok: true, message: `Done. Cash pickups at ${esc(p.tenantName || "that restaurant")} are now treated as normal.`, undo: { added: true } };
    },
    undo: ({ state, p }) => {
      if (p.undo?.added) state.cashPickupsExpected = (state.cashPickupsExpected || []).filter((t) => t !== p.tenant);
      return { ok: true, message: "Undone. Pickups there will be flagged again." };
    },
  },
};

export const buttonsFor = (p) => [[{ text: `✅ ${FIX_TYPES[p.type].button}`, callback_data: `fx:${p.id}` }, { text: "Skip", callback_data: `sk:${p.id}` }]];

export const suggestionText = (p) => [`🛠 <b>Suggested fix</b>${p.tenantName ? ` — ${esc(p.tenantName)}` : ""}`, `<b>${esc(p.title)}</b>`, esc(p.text), `<i>Tap the button to do it, or Skip. This offer expires in ${PROPOSAL_TTL_HOURS} hours.</i>`].join("\n");

// Creates a proposal for every open finding that has an eligible fix and has not been offered one yet.
export function proposeFixes(state, findings, nowIso) {
  state.proposals ||= {};
  const made = [];
  for (const f of findings) {
    for (const [type, def] of Object.entries(FIX_TYPES)) {
      if (!def.eligible(f, state)) continue;
      if (Object.values(state.proposals).some((p) => p.type === type && p.fp === f.fp)) continue;
      const id = crypto.randomBytes(4).toString("hex");
      const p = { id, type, fp: f.fp, tenant: f.tenant || null, tenantName: f.tenantName || null, title: f.title, text: def.text(f), status: "proposed", createdAt: nowIso, expiresAt: plus(nowIso, PROPOSAL_TTL_HOURS) };
      state.proposals[id] = p;
      made.push(p);
    }
  }
  return made;
}

// Marks old offers expired and forgets long-finished ones.
export function tidyProposals(state, nowIso) {
  const now = new Date(nowIso).getTime();
  for (const [id, p] of Object.entries(state.proposals || {})) {
    if (p.status === "proposed" && now > new Date(p.expiresAt).getTime()) p.status = "expired";
    if (p.status !== "proposed" && p.status !== "applied" && now - new Date(p.createdAt).getTime() > 14 * 24 * HOUR) delete state.proposals[id];
    else if (p.status === "applied" && now - new Date(p.createdAt).getTime() > 30 * 24 * HOUR) delete state.proposals[id];
  }
}

const log = (state, entry) => {
  state.fixLog = [...(state.fixLog || []), entry].slice(-300);
};
const REDEPLOY_MIN_GAP_MIN = 10;

// A tap on a button. `owners` are the chat ids allowed to approve. Returns what to do on Telegram:
//   { replies: [{ to, text, buttons? }], clearButtons: [{ chatId, messageId }] }
export async function handleCallback({ state, update, nowIso, owners, hookUrl = process.env.VERCEL_DEPLOY_HOOK, doFetch = fetch }) {
  const cq = update.callback_query;
  const out = { replies: [], clearButtons: [] };
  if (!cq || !cq.data) return out;
  const from = String(cq.from?.id ?? "");
  const chatId = String(cq.message?.chat?.id ?? from);
  const who = [cq.from?.first_name, cq.from?.last_name].filter(Boolean).join(" ") || cq.from?.username || "owner";
  const say = (text, buttons = null) => out.replies.push({ to: chatId, text, buttons });
  if (!owners.includes(from)) {
    log(state, { at: nowIso, by: who, byId: from, outcome: "refused: not an owner", data: cq.data });
    say("Only the owner can approve fixes.");
    return out;
  }
  const [kind, id] = cq.data.split(":");
  if (cq.message?.message_id) out.clearButtons.push({ chatId, messageId: cq.message.message_id });

  if (kind === "rd") {
    const last = state.lastRedeploy ? new Date(state.lastRedeploy).getTime() : 0;
    if (!hookUrl) say("A redeploy isn't set up yet (no deploy hook was given to me).");
    else if (new Date(nowIso).getTime() - last < REDEPLOY_MIN_GAP_MIN * 60000) say("A redeploy was already requested a few minutes ago. Give it a little time before asking again.");
    else {
      try {
        const res = await doFetch(hookUrl, { method: "POST" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        state.lastRedeploy = nowIso;
        log(state, { at: nowIso, by: who, type: "redeploy", outcome: "requested" });
        say("🔁 Redeploy requested. Vercel is rebuilding the site now; the uptime watch will tell you when it is back.");
      } catch (e) {
        log(state, { at: nowIso, by: who, type: "redeploy", outcome: `failed: ${e.message}` });
        say(`The redeploy request failed (${esc(e.message)}). Check Vercel directly.`);
      }
    }
    return out;
  }

  const p = (state.proposals || {})[id];
  if (!p || !FIX_TYPES[p.type]) {
    say("I don't recognise that fix. It may be too old.");
    return out;
  }
  const def = FIX_TYPES[p.type];
  if (kind === "fx") {
    if (p.status !== "proposed") say(`That fix was already handled (${p.status}).`);
    else if (new Date(nowIso).getTime() > new Date(p.expiresAt).getTime()) {
      p.status = "expired";
      say("That offer expired. If the problem is still there I'll offer it again.");
    } else {
      let result;
      try {
        result = await def.apply({ state, p, nowIso });
      } catch (e) {
        result = { ok: false, message: `It failed: ${esc(e.message)}. Nothing was changed.` };
      }
      p.status = result.ok ? "applied" : "failed";
      p.appliedAt = nowIso;
      p.appliedBy = who;
      if (result.ok) p.undo = result.undo || null;
      log(state, { at: nowIso, by: who, type: p.type, id: p.id, tenant: p.tenant, title: p.title, outcome: result.ok ? "applied" : `failed: ${result.message}` });
      say(`${result.ok ? "✅" : "⚠️"} ${result.message}`, result.ok && def.undo ? [[{ text: "↩️ Undo", callback_data: `un:${p.id}` }]] : null);
    }
  } else if (kind === "sk") {
    if (p.status !== "proposed") say(`That fix was already handled (${p.status}).`);
    else {
      p.status = "skipped";
      if (def.declineScope) state.fixDeclined = { ...(state.fixDeclined || {}), [`${p.type}|${def.declineScope(p)}`]: nowIso };
      log(state, { at: nowIso, by: who, type: p.type, id: p.id, tenant: p.tenant, title: p.title, outcome: "skipped" });
      say("Skipped. I won't offer this one again.");
    }
  } else if (kind === "un") {
    if (p.status !== "applied" || !def.undo) say(`That can't be undone (${p.status}).`);
    else {
      const result = await def.undo({ state, p, nowIso });
      p.status = result.ok ? "undone" : p.status;
      log(state, { at: nowIso, by: who, type: p.type, id: p.id, tenant: p.tenant, title: p.title, outcome: result.ok ? "undone" : `undo failed: ${result.message}` });
      say(`${result.ok ? "↩️" : "⚠️"} ${result.message}`);
    }
  } else say("I don't recognise that button.");
  return out;
}
