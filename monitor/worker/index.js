// Availability watch (every 3 minutes) and the Telegram doorway (Cloudflare Worker, free plan).
//
// 1. Every 3 minutes it loads the POS pages and tells the owner on Telegram if they stop answering. Read-only: it
//    only loads pages and asks the "what changed" endpoint a harmless question about the test restaurant.
// 2. It is the bot's Telegram webhook. A tap on a button, or a message, is put in a small queue here and a GitHub
//    job (relay.yml) is started to answer it; the monitor collects the queue (GET /queue) and acknowledges it (POST /ack).
//    The passwords between the pieces are derived from the bot token, so there is nothing extra to store, and only
//    taps from the owner's chat are accepted.
const failuresBeforeAlert = 2; // two bad checks in a row (about 6 minutes), so one blip never alerts

// ---- shared helpers ----
const sha256hex = async (s) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
const derive = (env, purpose) => sha256hex(`${env.TELEGRAM_BOT_TOKEN}:${purpose}`);
const owners = (env) => (env.TELEGRAM_CHAT_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
const tgApi = (env, method, body) => fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function probe(env) {
  const checks = [];
  const t0 = Date.now();
  try {
    const r = await fetch(env.SITE + env.KAIVO_PAGE, { cf: { cacheTtl: 0 } });
    const body = r.status === 200 ? await r.text() : "";
    checks.push({ name: "POS page", ok: r.status === 200 && body.length > 500, detail: `HTTP ${r.status}${r.headers.get("x-vercel-error") ? " " + r.headers.get("x-vercel-error") : ""}`, ms: Date.now() - t0 });
  } catch (e) {
    checks.push({ name: "POS page", ok: false, detail: String(e.message || e), ms: Date.now() - t0 });
  }
  const t1 = Date.now();
  try {
    const r = await fetch(`${env.SITE}/api/pos/${env.PROBE_TENANT}/changes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keys: ["tax-config"], versions: {} }) });
    const j = r.status === 200 ? await r.json().catch(() => null) : null;
    checks.push({ name: "data service", ok: !!(j && j.results), detail: `HTTP ${r.status}${r.headers.get("x-vercel-error") ? " " + r.headers.get("x-vercel-error") : ""}`, ms: Date.now() - t1 });
  } catch (e) {
    checks.push({ name: "data service", ok: false, detail: String(e.message || e), ms: Date.now() - t1 });
  }
  return checks;
}

async function telegram(env, text, buttons) {
  for (const id of owners(env)) {
    await tgApi(env, "sendMessage", { chat_id: id, text, parse_mode: "HTML", ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}) });
  }
}

// Starts the GitHub job that answers what is waiting in the queue.
async function dispatchRelay(env) {
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/relay.yml/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.GH_DISPATCH_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "pos-uptime-watch", "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "main" }),
  });
  if (!res.ok) console.error("could not start relay.yml:", res.status);
  return res.ok;
}

// Makes sure Telegram sends everything to this Worker. Only once the Worker can start the GitHub job; until then the
// monitor keeps reading Telegram directly, so nothing is lost.
async function ensureWebhook(env) {
  if (!env.WORKER_URL || !env.GH_DISPATCH_TOKEN || !env.GITHUB_REPO) return false;
  const want = `${env.WORKER_URL.replace(/\/+$/, "")}/tg`;
  const info = await (await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`)).json().catch(() => null);
  if (!info || !info.ok) return false;
  if (info.result.url === want) return true;
  const res = await tgApi(env, "setWebhook", { url: want, secret_token: await derive(env, "webhook"), allowed_updates: ["message", "callback_query"], max_connections: 4 });
  console.log("webhook set:", res.status);
  return res.ok;
}

async function handleFetch(request, env, ctx) {
  const url = new URL(request.url);
  const ok = () => new Response("ok");
  if (request.method === "POST" && url.pathname === "/tg") {
    if (request.headers.get("x-telegram-bot-api-secret-token") !== (await derive(env, "webhook"))) return new Response("unauthorized", { status: 401 });
    let u = null;
    try {
      u = await request.json();
    } catch (e) {
      return new Response("bad request", { status: 400 });
    }
    if (!u || typeof u.update_id !== "number") return ok();
    const cq = u.callback_query;
    if (cq) {
      // Only the owner's chat may press a button; a stranger gets a refusal and nothing is queued.
      if (!owners(env).includes(String(cq.from?.id ?? ""))) {
        ctx.waitUntil(tgApi(env, "answerCallbackQuery", { callback_query_id: cq.id, text: "Only the owner can do this.", show_alert: true }));
        return ok();
      }
      ctx.waitUntil(tgApi(env, "answerCallbackQuery", { callback_query_id: cq.id, text: "Got it. Working on it…" }));
    } else if (!u.message) return ok(); // other kinds of update are not used
    await env.STATE.put(`q:${String(u.update_id).padStart(12, "0")}`, JSON.stringify(u), { expirationTtl: 3 * 86400 });
    ctx.waitUntil(dispatchRelay(env));
    return ok();
  }
  const authed = async () => request.headers.get("authorization") === `Bearer ${await derive(env, "queue")}`;
  if (request.method === "GET" && url.pathname === "/queue") {
    if (!(await authed())) return new Response("unauthorized", { status: 401 });
    const listed = await env.STATE.list({ prefix: "q:", limit: 100 });
    const items = [];
    for (const k of listed.keys) {
      const raw = await env.STATE.get(k.name);
      if (raw) items.push({ key: k.name, update: JSON.parse(raw) });
    }
    return new Response(JSON.stringify({ items }), { headers: { "Content-Type": "application/json" } });
  }
  if (request.method === "POST" && url.pathname === "/ack") {
    if (!(await authed())) return new Response("unauthorized", { status: 401 });
    const body = await request.json().catch(() => ({}));
    for (const key of (body.keys || []).filter((k) => typeof k === "string" && k.startsWith("q:"))) await env.STATE.delete(key);
    return ok();
  }
  return new Response("not found", { status: 404 });
}

async function handleScheduled(env) {
  const checks = await probe(env);
  const bad = checks.filter((c) => !c.ok);
  const raw = (await env.STATE.get("status")) || '{"fails":0,"down":false,"since":null}';
  const st = JSON.parse(raw);
  if (bad.length) {
    st.fails += 1;
    if (st.fails >= failuresBeforeAlert && !st.down) {
      st.down = true;
      st.since = new Date().toISOString();
      await telegram(env, `🔴 <b>The POS looks DOWN</b>\n${bad.map((b) => `${b.name}: ${b.detail}`).join("\n")}\nKaivo's terminals may not be able to work. (A 402 means Vercel has paused the project: check billing. Otherwise a redeploy sometimes helps.)`, [[{ text: "🔁 Redeploy the site", callback_data: "rd" }]]);
    }
  } else {
    if (st.down) {
      const mins = Math.round((Date.now() - new Date(st.since).getTime()) / 60000);
      await telegram(env, `🟢 <b>The POS is back</b> after about ${mins} minute(s).`);
    }
    st.fails = 0;
    st.down = false;
    const slow = checks.filter((c) => c.ms > 4000);
    if (slow.length && !st.slowAt) {
      st.slowAt = Date.now();
      await telegram(env, `🟡 The POS is slow: ${slow.map((c) => `${c.name} took ${(c.ms / 1000).toFixed(1)} s`).join(", ")}.`);
    } else if (!slow.length) st.slowAt = null;
    if (env.HEALTHCHECK_URL) await fetch(env.HEALTHCHECK_URL).catch(() => {});
  }
  // Free-plan storage allows 1,000 writes a day, so only write when something changed.
  const after = JSON.stringify(st);
  if (after !== raw) await env.STATE.put("status", after);
  // Make sure the Telegram webhook points here: on every run until it is confirmed once, then once an hour.
  const confirmed = await env.STATE.get("webhook-ok");
  if (!confirmed || new Date().getUTCMinutes() < 3) {
    const good = await ensureWebhook(env).catch((e) => { console.error("webhook check failed:", e.message || e); return false; });
    if (good && !confirmed) await env.STATE.put("webhook-ok", "1");
    if (!good && confirmed) await env.STATE.delete("webhook-ok");
  }
}

export default {
  fetch: handleFetch,
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(env));
  },
};
