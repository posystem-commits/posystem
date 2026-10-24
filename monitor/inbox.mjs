import crypto from "node:crypto";
import { openFindings, shortId } from "./lib/state.mjs";
import { esc, ICON } from "./lib/format.mjs";
import { recipientsFor } from "./lib/telegram.mjs";

// Reads what people sent the bot on Telegram and answers. Commands:
//   /start            ask to join (the owner approves)       /help        list of commands
//   /status           what is open right now                  /report      send the weekly report now (owner)
//   /explain <id> …   tell me why something happened (owner)  /usage k=v … give me this month's Vercel/Supabase numbers (owner)
//   /invite           make a one-day join code (owner)        /join <code> join with a code from the owner
//   /approve <chat>   accept a join request (owner)           /remove <chat> stop sending to someone (owner)
const API = (token, method) => `https://api.telegram.org/bot${token}/${method}`;

async function tg(token, method, body) {
  const res = await fetch(API(token, method), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}

export function handleMessage({ state, chatId, name, text, nowIso, envOwners }) {
  const isOwner = envOwners.includes(String(chatId)) || state.recipients.some((r) => r.chatId === String(chatId) && r.role === "owner");
  const isMember = isOwner || state.recipients.some((r) => r.chatId === String(chatId));
  const [cmd, ...rest] = text.trim().split(/\s+/);
  const arg = rest.join(" ");
  const replies = []; // { to, text }
  const say = (t, to = String(chatId)) => {
    replies.push({ to, text: t });
  };
  const ownerIds = () => [...new Set([...envOwners, ...state.recipients.filter((r) => r.role === "owner").map((r) => r.chatId)])];

  switch (cmd.toLowerCase().replace(/@\w+$/, "")) {
    case "/start":
    case "/help":
      if (isMember) say(`Hi ${esc(name)} — I'm the POS manager bot. I watch the numbers, the cash, the system and its limits, and message you when something needs attention, plus a report every Thursday at 10:00.\n\n/status — what is open now\n${isOwner ? "/report — send the weekly report now\n/explain &lt;id&gt; &lt;why&gt; — tell me the reason for something\n/usage vercel_calls=… vercel_gb=… supabase_egress_gb=…\n/invite — make a join code for someone\n/approve &lt;chat&gt; · /remove &lt;chat&gt;" : ""}`);
      else {
        state.pendingJoins = { ...(state.pendingJoins || {}), [chatId]: { name, at: nowIso } };
        say("Thanks — I've asked the owner to approve you. You'll start getting the weekly reports once they do.");
        ownerIds().forEach((o) => say(`🆕 <b>${esc(name)}</b> (chat <code>${chatId}</code>) asked to receive reports.\nReply <code>/approve ${chatId}</code> to accept.`, o));
      }
      break;
    case "/join": {
      const code = (state.inviteCodes || {})[arg];
      if (code && code.expires > nowIso) {
        state.recipients.push({ chatId: String(chatId), name, role: "viewer" });
        delete state.inviteCodes[arg];
        say("You're in. You'll get the weekly report and can use /status.");
        ownerIds().forEach((o) => say(`✅ ${esc(name)} joined with your invite.`, o));
      } else say("That code isn't valid (or it expired). Ask the owner for a new one.");
      break;
    }
    case "/status":
      if (!isMember) return say("Please /start first.") || replies;
      {
        const open = openFindings(state).sort((a, b) => ({ red: 0, amber: 1, info: 2 }[a.severity] - { red: 0, amber: 1, info: 2 }[b.severity]));
        say(open.length ? `<b>Open right now (${open.length})</b>\n` + open.slice(0, 15).map((f) => `${ICON[f.severity]} ${f.tenantName ? esc(f.tenantName) + ": " : ""}${esc(f.title)} <code>${shortId(f.fp)}</code>`).join("\n") : "🟢 Nothing open — everything I check is fine.");
      }
      break;
    case "/invite":
      if (!isOwner) return say("Only the owner can invite people.") || replies;
      {
        const code = crypto.randomBytes(4).toString("hex");
        state.inviteCodes = { ...(state.inviteCodes || {}), [code]: { expires: new Date(new Date(nowIso).getTime() + 86400000).toISOString() } };
        say(`Send this to the person: open the bot and type <code>/join ${code}</code> (valid for 24 hours).`);
      }
      break;
    case "/approve":
      if (!isOwner) return say("Only the owner can approve.") || replies;
      {
        const p = (state.pendingJoins || {})[arg];
        if (!p) say("No pending request from that chat.");
        else {
          state.recipients.push({ chatId: String(arg), name: p.name, role: "viewer" });
          delete state.pendingJoins[arg];
          say(`Added ${esc(p.name)} as a viewer (weekly report + /status).`);
          say("You're approved — you'll get the weekly reports now.", String(arg));
        }
      }
      break;
    case "/remove":
      if (!isOwner) return say("Only the owner can remove people.") || replies;
      state.recipients = state.recipients.filter((r) => r.chatId !== String(arg));
      say("Removed.");
      break;
    case "/explain":
      if (!isOwner) return say("Only the owner can explain things to me.") || replies;
      {
        const id = rest[0];
        const why = rest.slice(1).join(" ").trim();
        const f = openFindings(state).concat(Object.values(state.findings)).find((x) => shortId(x.fp) === id);
        if (!id || !why) say("Use: /explain &lt;id&gt; &lt;what happened&gt;");
        else if (!f) say("I don't know that id (it may have been resolved long ago).");
        else {
          state.explanations[id] = { text: why, by: name, at: nowIso };
          // Teaching: confirming that cash pickups between shifts are normal stops those being flagged for that restaurant.
          if (f.code === "CASH_PICKUP" && /pick ?up|collect|owner|deposit|bank/i.test(why) && f.tenant) {
            state.cashPickupsExpected = Array.from(new Set([...(state.cashPickupsExpected || []), f.tenant]));
            say(`Got it — I'll treat cash taken out between shifts at ${esc(f.tenantName)} as the normal pickup and only list it in the weekly report.`);
          } else say(`Noted. I'll show your explanation next to that item: <i>${esc(why)}</i>`);
        }
      }
      break;
    case "/usage":
      if (!isOwner) return say("Only the owner can send usage numbers.") || replies;
      {
        const vals = {};
        rest.forEach((kv) => {
          const [k, v] = kv.split("=");
          if (k && v !== undefined && !Number.isNaN(Number(v))) vals[k] = Number(v);
        });
        if (!Object.keys(vals).length) say("Use: /usage vercel_calls=1200000 vercel_gb=12 supabase_egress_gb=1.4");
        else {
          state.usage = { at: nowIso, values: { ...(state.usage?.values || {}), ...vals } };
          say(`Saved: ${Object.entries(vals).map(([k, v]) => `${k}=${v}`).join(", ")}. They'll be in the next report.`);
        }
      }
      break;
    case "/report":
      if (!isOwner) return say("Only the owner can request the report.") || replies;
      state.reportRequested = true;
      say("OK — sending the weekly report with the next check (within the hour).");
      break;
    default:
      if (isMember) say("I didn't understand that. Try /help.");
  }
  return replies;
}

// Fetches new messages and answers them. Returns how many were handled.
export async function processInbox({ state, dry, nowIso }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || dry) return 0;
  const envOwners = (process.env.TELEGRAM_CHAT_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const upd = await tg(token, "getUpdates", { offset: (state.telegramOffset || 0) + 1, timeout: 0, allowed_updates: ["message"] });
  if (!upd.ok) return 0;
  let handled = 0;
  for (const u of upd.result) {
    state.telegramOffset = u.update_id;
    const m = u.message;
    if (!m || !m.text || !m.chat) continue;
    const name = [m.from?.first_name, m.from?.last_name].filter(Boolean).join(" ") || m.from?.username || "someone";
    const replies = handleMessage({ state, chatId: m.chat.id, name, text: m.text, nowIso, envOwners });
    for (const r of replies) await tg(token, "sendMessage", { chat_id: r.to, text: r.text, parse_mode: "HTML" });
    handled++;
  }
  return handled;
}
