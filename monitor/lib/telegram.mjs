// Sends messages to everyone subscribed. With --dry (or no bot token) it prints instead, so everything can be
// tried safely.
const API = (token, method) => `https://api.telegram.org/bot${token}/${method}`;

export function recipientsFor(state, roles) {
  const fromEnv = (process.env.TELEGRAM_CHAT_IDS || "").split(",").map((s) => s.trim()).filter(Boolean).map((chatId) => ({ chatId, name: "owner", role: "owner" }));
  const all = [...fromEnv, ...state.recipients.filter((r) => !fromEnv.some((e) => e.chatId === r.chatId))];
  return all.filter((r) => roles.includes(r.role));
}

function chunk(text, size = 3800) {
  if (text.length <= size) return [text];
  const parts = [];
  let rest = text;
  while (rest.length > size) {
    let cut = rest.lastIndexOf("\n", size);
    if (cut < size / 2) cut = size;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, "");
  }
  parts.push(rest);
  return parts;
}

export async function broadcast(state, text, { roles = ["owner"], dry = false } = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const to = recipientsFor(state, roles);
  if (dry || !token || to.length === 0) {
    console.log(`\n--- would send to ${to.length ? to.map((r) => r.name).join(", ") : "nobody yet"} (${roles.join("/")}) ---\n${text.replace(/<[^>]+>/g, "")}\n--- end ---`);
    return { sent: 0, dry: true };
  }
  let sent = 0;
  for (const r of to) {
    for (const part of chunk(text)) {
      const res = await fetch(API(token, "sendMessage"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: r.chatId, text: part, parse_mode: "HTML", disable_web_page_preview: true }) });
      if (!res.ok) console.error(`telegram: ${r.name} failed with ${res.status}`);
      else sent++;
    }
  }
  return { sent, dry: false };
}
