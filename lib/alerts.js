// Telegram alerts to the owner. Needs two settings on the host (Vercel → Settings → Environment Variables):
//   TELEGRAM_BOT_TOKEN   the token @BotFather gave you
//   TELEGRAM_CHAT_IDS    your chat id (several can be separated with commas)
// Without them nothing is sent and everything else works as normal.

const chatIds = () => (process.env.TELEGRAM_CHAT_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);

export function alertsConfigured() {
  return !!process.env.TELEGRAM_BOT_TOKEN && chatIds().length > 0;
}

export function alertChatCount() {
  return process.env.TELEGRAM_BOT_TOKEN ? chatIds().length : 0;
}

// Best effort and quick: a slow or failing Telegram must never hold up or break the request that triggered it.
export async function sendAlert(text) {
  if (!alertsConfigured()) return { ok: false, sent: 0, reason: "not configured" };
  const token = process.env.TELEGRAM_BOT_TOKEN;
  let sent = 0;
  await Promise.all(
    chatIds().map(async (chat) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
          signal: controller.signal,
        });
        if (res.ok) sent++;
      } catch (e) {
        // ignored on purpose — see above
      } finally {
        clearTimeout(timer);
      }
    })
  );
  return { ok: sent > 0, sent, reason: sent > 0 ? null : "Telegram did not accept the message" };
}
