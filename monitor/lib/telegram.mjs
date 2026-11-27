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

// `buttons` is a list of rows of { text, callback_data }: Telegram shows them under the message and sends the tap back
// (the Worker receives it, see monitor/worker). Returns where each message went.
export async function broadcast(state, text, { roles = ["owner"], dry = false, buttons = null } = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const to = recipientsFor(state, roles);
  if (dry || !token || to.length === 0) {
    const shownButtons = buttons ? `\n[${buttons.flat().map((b) => b.text).join("] [")}]` : "";
    console.log(`\n--- would send to ${to.length ? to.map((r) => r.name).join(", ") : "nobody yet"} (${roles.join("/")}) ---\n${text.replace(/<[^>]+>/g, "")}${shownButtons}\n--- end ---`);
    return { sent: 0, dry: true, refs: [] };
  }
  let sent = 0;
  const refs = [];
  for (const r of to) {
    const parts = chunk(text);
    for (let i = 0; i < parts.length; i++) {
      // the buttons go on the last part of a long message
      const markup = buttons && i === parts.length - 1 ? { reply_markup: { inline_keyboard: buttons } } : {};
      const res = await fetch(API(token, "sendMessage"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: r.chatId, text: parts[i], parse_mode: "HTML", disable_web_page_preview: true, ...markup }) });
      if (!res.ok) console.error(`telegram: ${r.name} failed with ${res.status}`);
      else {
        sent++;
        const j = await res.json().catch(() => null);
        if (j?.result?.message_id) refs.push({ chatId: r.chatId, messageId: j.result.message_id });
      }
    }
  }
  return { sent, dry: false, refs };
}
