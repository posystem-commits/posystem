// node --no-warnings monitor/test-fixes.mjs
// The fix engine (suggest -> owner taps -> apply -> undo) and how taps reach it.
import assert from "node:assert/strict";
import { proposeFixes, handleCallback, tidyProposals, buttonsFor, FIX_TYPES } from "./fixes.mjs";
import { emptyState, reconcile } from "./lib/state.mjs";
import { processInbox } from "./inbox.mjs";
import { derive } from "./lib/worker.mjs";

const NOW = "2026-11-27T12:00:00.000Z";
const owners = ["111"];
const redF = { fp: "t1|CASH_GAP|k1", tenant: "t1", tenantName: "Kaivo", code: "CASH_GAP", severity: "red", title: "Ghazel short 1333", first: NOW };
const pickF = { fp: "t1|CASH_PICKUP|k2", tenant: "t1", tenantName: "Kaivo", code: "CASH_PICKUP", severity: "amber", title: "4404 taken out", first: NOW };
const tap = (from, data, msgId = 9) => ({ update_id: Math.floor(Math.random() * 1e9), callback_query: { id: "cb", from: { id: from, first_name: "Owner" }, message: { message_id: msgId, chat: { id: from } }, data } });
const stateWith = (...fs) => { const s = emptyState(); fs.forEach((f) => (s.findings[f.fp] = { ...f })); return s; };
let n = 0;
const ok = async (name, fn) => { await fn(); n++; console.log("ok:", name); };

await ok("a red alert gets an acknowledge offer and a pickup gets a 'normal pickup' offer, once each", () => {
  const s = stateWith(redF, pickF);
  const first = proposeFixes(s, Object.values(s.findings), NOW);
  assert.deepEqual(first.map((p) => p.type).sort(), ["acknowledge", "pickups_normal"]);
  assert.equal(proposeFixes(s, Object.values(s.findings), NOW).length, 0, "not offered again");
  assert.equal(buttonsFor(first[0])[0].length, 2);
});
await ok("a fix is not offered for a skipped restaurant, an expected pickup, or an event", () => {
  const s = stateWith(pickF);
  s.fixDeclined = { "pickups_normal|t1": NOW };
  assert.equal(proposeFixes(s, [pickF], NOW).length, 0);
  const s2 = stateWith(pickF);
  s2.cashPickupsExpected = ["t1"];
  assert.equal(proposeFixes(s2, [pickF], NOW).length, 0);
  assert.equal(proposeFixes(stateWith({ ...redF, event: true }), [{ ...redF, event: true }], NOW).length, 0);
});
await ok("only an owner can approve; a stranger changes nothing and is logged", async () => {
  const s = stateWith(redF);
  const [p] = proposeFixes(s, [redF], NOW);
  const r = await handleCallback({ state: s, update: tap(999, `fx:${p.id}`), nowIso: NOW, owners });
  assert.equal(s.proposals[p.id].status, "proposed");
  assert.equal(s.findings[redF.fp].snoozedUntil, undefined);
  assert.match(r.replies[0].text, /Only the owner/);
  assert.match(s.fixLog.at(-1).outcome, /refused/);
});
await ok("acknowledge works once, shows Undo, and a second tap is refused", async () => {
  const s = stateWith(redF);
  const [p] = proposeFixes(s, [redF], NOW);
  const r = await handleCallback({ state: s, update: tap(111, `fx:${p.id}`), nowIso: NOW, owners });
  assert.equal(s.proposals[p.id].status, "applied");
  assert.ok(s.findings[redF.fp].snoozedUntil > NOW);
  assert.equal(r.replies[0].buttons[0][0].callback_data, `un:${p.id}`);
  assert.deepEqual(r.clearButtons, [{ chatId: "111", messageId: 9 }]);
  const again = await handleCallback({ state: s, update: tap(111, `fx:${p.id}`), nowIso: NOW, owners });
  assert.match(again.replies[0].text, /already handled/);
  assert.equal(s.fixLog.filter((l) => l.outcome === "applied").length, 1);
});
await ok("undo puts things back", async () => {
  const s = stateWith(redF);
  const [p] = proposeFixes(s, [redF], NOW);
  await handleCallback({ state: s, update: tap(111, `fx:${p.id}`), nowIso: NOW, owners });
  await handleCallback({ state: s, update: tap(111, `un:${p.id}`), nowIso: NOW, owners });
  assert.equal(s.findings[redF.fp].snoozedUntil, null);
  assert.equal(s.proposals[p.id].status, "undone");
});
await ok("the pickup fix teaches the monitor, and undo takes it back", async () => {
  const s = stateWith(pickF);
  const [p] = proposeFixes(s, [pickF], NOW);
  await handleCallback({ state: s, update: tap(111, `fx:${p.id}`), nowIso: NOW, owners });
  assert.deepEqual(s.cashPickupsExpected, ["t1"]);
  await handleCallback({ state: s, update: tap(111, `un:${p.id}`), nowIso: NOW, owners });
  assert.deepEqual(s.cashPickupsExpected, []);
});
await ok("Skip declines for good; an expired offer cannot be applied", async () => {
  const s = stateWith(pickF);
  const [p] = proposeFixes(s, [pickF], NOW);
  await handleCallback({ state: s, update: tap(111, `sk:${p.id}`), nowIso: NOW, owners });
  assert.equal(s.proposals[p.id].status, "skipped");
  assert.equal(proposeFixes(s, [pickF], NOW).length, 0);
  const s2 = stateWith(redF);
  const [q] = proposeFixes(s2, [redF], NOW);
  const later = "2026-11-29T12:00:00.000Z";
  const r = await handleCallback({ state: s2, update: tap(111, `fx:${q.id}`), nowIso: later, owners });
  assert.match(r.replies[0].text, /expired/);
  assert.equal(s2.findings[redF.fp].snoozedUntil, undefined);
});
await ok("an unknown button changes nothing", async () => {
  const s = stateWith(redF);
  const r = await handleCallback({ state: s, update: tap(111, "fx:deadbeef"), nowIso: NOW, owners });
  assert.match(r.replies[0].text, /don't recognise/);
});
await ok("redeploy: needs a hook, calls it once, and is rate limited", async () => {
  const s = emptyState();
  const none = await handleCallback({ state: s, update: tap(111, "rd"), nowIso: NOW, owners, hookUrl: "" });
  assert.match(none.replies[0].text, /isn't set up/);
  let calls = 0;
  const doFetch = async () => { calls++; return { ok: true, status: 201 }; };
  const a = await handleCallback({ state: s, update: tap(111, "rd"), nowIso: NOW, owners, hookUrl: "https://hook", doFetch });
  assert.match(a.replies[0].text, /Redeploy requested/);
  const b = await handleCallback({ state: s, update: tap(111, "rd"), nowIso: "2026-11-27T12:03:00.000Z", owners, hookUrl: "https://hook", doFetch });
  assert.match(b.replies[0].text, /already requested/);
  assert.equal(calls, 1);
  const bad = await handleCallback({ state: s, update: tap(111, "rd"), nowIso: "2026-11-27T12:30:00.000Z", owners, hookUrl: "https://hook", doFetch: async () => ({ ok: false, status: 500 }) });
  assert.match(bad.replies[0].text, /failed/);
});
await ok("an acknowledged alert stays quiet until the snooze ends", () => {
  const s = stateWith({ ...redF, notifiedAt: "2026-11-25T00:00:00.000Z", notifiedSeverity: "red", snoozedUntil: "2026-12-01T00:00:00.000Z" });
  const r = reconcile(s, [redF], NOW, 24);
  assert.equal(r.reminders.length, 0);
  s.findings[redF.fp].snoozedUntil = "2026-11-26T00:00:00.000Z";
  assert.equal(reconcile(s, [redF], NOW, 24).reminders.length, 1);
});
await ok("old finished offers are forgotten and stale open ones expire", () => {
  const s = emptyState();
  s.proposals = { a: { id: "a", status: "proposed", createdAt: "2026-11-20T00:00:00.000Z", expiresAt: "2026-11-21T00:00:00.000Z" }, b: { id: "b", status: "skipped", createdAt: "2026-11-01T00:00:00.000Z" } };
  tidyProposals(s, NOW);
  assert.equal(s.proposals.a.status, "expired");
  assert.equal(s.proposals.b, undefined);
});

// ---- how taps reach the engine: the Worker's queue, redelivery, acknowledging ----
await ok("the inbox collects the queue, handles a redelivered tap once, and acknowledges everything", async () => {
  process.env.TELEGRAM_BOT_TOKEN = "TESTTOKEN";
  process.env.TELEGRAM_CHAT_IDS = "111";
  process.env.WORKER_URL = "https://worker.test";
  const s = stateWith(redF);
  const [p] = proposeFixes(s, [redF], NOW);
  const u1 = tap(111, `fx:${p.id}`);
  u1.update_id = 1001;
  const dup = { ...u1 };
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.startsWith("https://worker.test/queue")) {
      assert.equal(opts.headers.Authorization, `Bearer ${derive("TESTTOKEN", "queue")}`);
      return { ok: true, json: async () => ({ items: [{ key: "q:000000001001", update: u1 }, { key: "q:000000001002", update: { ...dup, update_id: 1001 } }] }) };
    }
    sent.push(u.split("/").pop() + ":" + (opts.body || ""));
    return { ok: true, json: async () => ({ ok: true }) };
  };
  try {
    const r = await processInbox({ state: s, dry: false, nowIso: NOW });
    assert.equal(r.handled, 1);
    assert.deepEqual(r.ackKeys, ["q:000000001001", "q:000000001002"]);
    assert.equal(s.proposals[p.id].status, "applied");
    assert.ok(sent.some((x) => x.startsWith("editMessageReplyMarkup")), "buttons removed from the tapped message");
    assert.ok(sent.some((x) => x.startsWith("sendMessage") && x.includes("Undo")), "result sent with an Undo button");
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.WORKER_URL;
  }
});
await ok("every fix type has a button label and (when it changes anything) an undo", () => {
  Object.values(FIX_TYPES).forEach((t) => { assert.ok(t.button); assert.equal(typeof t.apply, "function"); assert.equal(typeof t.undo, "function"); });
});
console.log(n, "checks passed");
