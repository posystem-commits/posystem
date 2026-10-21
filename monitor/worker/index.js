// Minute-by-minute availability watch (Cloudflare Worker, free plan). Read-only: it only loads pages and
// asks the "what changed" endpoint a harmless question about the test restaurant.
const failuresBeforeAlert = 2; // two bad minutes in a row, so one blip never alerts

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

async function telegram(env, text) {
  const ids = (env.TELEGRAM_CHAT_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  for (const id of ids) {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: id, text, parse_mode: "HTML" }) });
  }
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      const checks = await probe(env);
      const bad = checks.filter((c) => !c.ok);
      const st = JSON.parse((await env.STATE.get("status")) || '{"fails":0,"down":false,"since":null}');
      if (bad.length) {
        st.fails += 1;
        if (st.fails >= failuresBeforeAlert && !st.down) {
          st.down = true;
          st.since = new Date().toISOString();
          await telegram(env, `🔴 <b>The POS looks DOWN</b>\n${bad.map((b) => `${b.name}: ${b.detail}`).join("\n")}\nKaivo's terminals may not be able to work. (A 402 means Vercel has paused the project — check billing.)`);
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
      await env.STATE.put("status", JSON.stringify(st));
    })());
  },
};
