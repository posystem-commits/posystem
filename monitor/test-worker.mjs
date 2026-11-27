// node --no-warnings monitor/test-worker.mjs
// The Worker as the Telegram doorway: who may tap, what is queued, the passwords, and that it agrees with the monitor.
import assert from "node:assert/strict";
import worker from "./worker/index.js";
import { derive } from "./lib/worker.mjs";

const TOKEN = "123:TESTTOKEN";
const kv = new Map();
const env = {
  TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_IDS: "111", GH_DISPATCH_TOKEN: "ghp_test", GITHUB_REPO: "o/r", WORKER_URL: "https://w.test",
  STATE: { put: async (k, v) => kv.set(k, v), get: async (k) => kv.get(k) ?? null, delete: async (k) => kv.delete(k), list: async ({ prefix }) => ({ keys: [...kv.keys()].filter((k) => k.startsWith(prefix)).sort().map((name) => ({ name })) }) },
};
const calls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => { calls.push({ url: String(url), body: opts.body ? JSON.parse(opts.body) : null, headers: opts.headers }); return { ok: true, status: 200, json: async () => ({ ok: true }) }; };
const waits = [];
const ctx = { waitUntil: (p) => waits.push(p) };
const send = async (path, init) => { const res = await worker.fetch(new Request("https://w.test" + path, init), env, ctx); await Promise.all(waits.splice(0)); return res; };
const secret = await derive(TOKEN, "webhook");
const post = (update, key = secret) => send("/tg", { method: "POST", headers: { "x-telegram-bot-api-secret-token": key }, body: JSON.stringify(update) });
const cb = (from, id = 1) => ({ update_id: id, callback_query: { id: "c" + id, from: { id: from }, message: { message_id: 5, chat: { id: from } }, data: "fx:abc" } });
let n = 0;
const ok = async (name, fn) => { calls.length = 0; await fn(); n++; console.log("ok:", name); };

await ok("a request without the webhook password is refused", async () => {
  assert.equal((await post(cb(111), "wrong")).status, 401);
  assert.equal(kv.size, 0);
  assert.equal(calls.length, 0);
});
await ok("an owner's tap is queued, the spinner is answered and the GitHub job is started", async () => {
  assert.equal((await post(cb(111, 7))).status, 200);
  assert.deepEqual([...kv.keys()], ["q:000000000007"]);
  assert.ok(calls.some((c) => c.url.includes("/answerCallbackQuery") && c.body.callback_query_id === "c7"));
  const gh = calls.find((c) => c.url === "https://api.github.com/repos/o/r/actions/workflows/relay.yml/dispatches");
  assert.ok(gh && gh.headers.Authorization === "Bearer ghp_test" && gh.body.ref === "main");
});
await ok("a stranger's tap is refused and nothing is queued or started", async () => {
  kv.clear();
  await post(cb(999, 8));
  assert.equal(kv.size, 0);
  assert.ok(calls.some((c) => c.url.includes("/answerCallbackQuery") && /Only the owner/.test(c.body.text)));
  assert.ok(!calls.some((c) => c.url.includes("api.github.com")));
});
await ok("a message is queued (a stranger may ask to join); other update kinds are ignored", async () => {
  kv.clear();
  await post({ update_id: 9, message: { text: "/start", chat: { id: 555 }, from: { id: 555 } } });
  assert.equal(kv.size, 1);
  await post({ update_id: 10, edited_message: {} });
  assert.equal(kv.size, 1);
});
await ok("the queue needs the derived password, hands over items in order, and acknowledging removes them", async () => {
  kv.clear();
  await post(cb(111, 12)); await post(cb(111, 11));
  assert.equal((await send("/queue")).status, 401);
  assert.equal((await send("/queue", { headers: { authorization: "Bearer nope" } })).status, 401);
  const res = await send("/queue", { headers: { authorization: `Bearer ${derive(TOKEN, "queue")}` } });
  const j = await res.json();
  assert.deepEqual(j.items.map((i) => i.update.update_id), [11, 12]);
  assert.equal((await send("/ack", { method: "POST", body: JSON.stringify({ keys: j.items.map((i) => i.key) }) })).status, 401);
  const ack = await send("/ack", { method: "POST", headers: { authorization: `Bearer ${derive(TOKEN, "queue")}` }, body: JSON.stringify({ keys: [...j.items.map((i) => i.key), "status"] }) });
  assert.equal(ack.status, 200);
  assert.equal([...kv.keys()].filter((k) => k.startsWith("q:")).length, 0);
});
await ok("the Worker and the monitor derive the same passwords", async () => {
  // derived on the Worker side with WebCrypto, on the monitor side with node:crypto
  const res = await send("/queue", { headers: { authorization: `Bearer ${derive(TOKEN, "queue")}` } });
  assert.equal(res.status, 200);
});
await ok("anything else is not found", async () => {
  assert.equal((await send("/")).status, 404);
  assert.equal((await send("/tg")).status, 404);
});
globalThis.fetch = realFetch;
console.log(n, "checks passed");
