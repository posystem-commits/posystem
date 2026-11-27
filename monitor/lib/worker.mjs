import crypto from "node:crypto";

// The Cloudflare Worker receives everything people tap or type in Telegram (a webhook) and keeps it in a small
// queue until the monitor collects it. Both sides know the bot token, so the passwords between them are derived from
// it: nothing extra to store, and nothing that works without the token.
export const derive = (token, purpose) => crypto.createHash("sha256").update(`${token}:${purpose}`).digest("hex");

const base = () => (process.env.WORKER_URL || "").replace(/\/+$/, "");
const bearer = () => ({ Authorization: `Bearer ${derive(process.env.TELEGRAM_BOT_TOKEN || "", "queue")}` });

// Returns [{ key, update }] — or null when the Worker is not reachable (the caller falls back to asking Telegram).
export async function fetchQueue() {
  if (!base() || !process.env.TELEGRAM_BOT_TOKEN) return null;
  try {
    const res = await fetch(`${base()}/queue`, { headers: bearer(), signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const j = await res.json();
    return Array.isArray(j.items) ? j.items : null;
  } catch (e) {
    return null;
  }
}

// Tells the Worker which queued items are done, so they are not delivered again.
export async function ackQueue(keys) {
  if (!keys.length || !base() || !process.env.TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`${base()}/ack`, { method: "POST", headers: { ...bearer(), "Content-Type": "application/json" }, body: JSON.stringify({ keys }), signal: AbortSignal.timeout(15000) });
  } catch (e) {
    console.error("could not acknowledge the queue:", e.message || e);
  }
}
