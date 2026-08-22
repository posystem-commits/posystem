import { NextResponse } from "next/server";
import { findTenantsDueToday, reminderAlreadySent, recordReminderSent } from "@/lib/reminders";
import { sendReminderEmail } from "@/lib/email";

// Runs once a day, independent of anyone having anything open — the piece that fundamentally
// needs a scheduler, not a browser tab. Triggered by Vercel Cron (see vercel.json) or, as an
// alternative, Supabase pg_cron calling this over HTTP (see the commented block at the bottom of
// db/schema.sql). Either way, it must be called with the CRON_SECRET bearer token below — this
// endpoint is intentionally NOT behind the admin-session middleware (a cron trigger has no
// browser cookie), so this check is the only thing standing between it and the public internet.
function isAuthorized(req) {
  const auth = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  return process.env.CRON_SECRET && auth === expected;
}

async function runSweep() {
  const due = await findTenantsDueToday();
  const results = [];

  for (const { tenant, daysLeft, reminderType } of due) {
    const already = await reminderAlreadySent(tenant.id, tenant.paid_until, reminderType);
    if (already) {
      results.push({ tenant_id: tenant.id, reminderType, status: "already_sent" });
      continue;
    }
    try {
      const sendResult = await sendReminderEmail({
        to: tenant.contact_email,
        restaurantName: tenant.restaurant_name,
        daysLeft,
        paidUntil: tenant.paid_until,
      });
      // The Resend SDK doesn't throw on a rejected send (invalid recipient, sandbox
      // restrictions, etc.) — it resolves with { data: null, error: {...} }. Only mark the
      // reminder as sent (and suppress future retries via reminder_log) once we've confirmed
      // there's no error in the result; otherwise the tenant would silently never get reminded
      // for this cycle even though nothing actually went out.
      if (sendResult?.error) {
        results.push({ tenant_id: tenant.id, reminderType, status: "send_failed", error: sendResult.error });
        continue;
      }
      await recordReminderSent(tenant.id, tenant.paid_until, reminderType);
      results.push({ tenant_id: tenant.id, reminderType, status: "sent", sendResult });
    } catch (e) {
      results.push({ tenant_id: tenant.id, reminderType, status: "error", error: e.message });
    }
  }

  return results;
}

export async function GET(req) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const results = await runSweep();
  return NextResponse.json({ ok: true, results });
}

// Some cron triggers (e.g. a Supabase pg_cron net.http_post) are easiest to wire as POST.
export async function POST(req) {
  return GET(req);
}
