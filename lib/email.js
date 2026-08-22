import { Resend } from "resend";

let client;
function resend() {
  if (client) return client;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY must be set");
  client = new Resend(key);
  return client;
}

// Sends the 7/3/1-day expiry reminder. Kept as a small, swappable function — see build-spec
// section 4's note that WhatsApp is a drop-in alternative later, same call-site shape.
export async function sendReminderEmail({ to, restaurantName, daysLeft, paidUntil }) {
  if (!to) return { skipped: true, reason: "no contact_email on file" };
  // Lowercased because Resend's sandbox mode (no verified domain yet) does a literal
  // case-sensitive match against your account's registered email — the address itself is
  // case-insensitive for actual delivery (Gmail and most providers), so this only affects that
  // sandbox check, not where the email actually ends up once you verify a real sending domain.
  to = to.trim().toLowerCase();

  const from = process.env.REMINDER_FROM_EMAIL || "billing@example.com";
  const subject =
    daysLeft === 1
      ? `${restaurantName}: access expires tomorrow`
      : `${restaurantName}: access expires in ${daysLeft} days`;
  const body = `Hi,

This is a reminder that access for "${restaurantName}" is set to expire on ${paidUntil} (${daysLeft} day${daysLeft === 1 ? "" : "s"} from today).

To keep the POS running without interruption, please arrange payment and let us know so we can extend your access.

Thanks!`;

  return resend().emails.send({ from, to, subject, text: body });
}
