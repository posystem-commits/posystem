import { NextResponse } from "next/server";
import { findTenantsDueToday, reminderAlreadySent } from "@/lib/reminders";

// GET /admin/reminders/due-today — visibility into what the cron job is about to send (or has
// already sent today), as a sanity check even though sending itself is automatic.
export async function GET() {
  try {
    const due = await findTenantsDueToday();
    const withStatus = await Promise.all(
      due.map(async (d) => ({
        tenant_id: d.tenant.id,
        restaurant_name: d.tenant.restaurant_name,
        contact_email: d.tenant.contact_email,
        contact_phone: d.tenant.contact_phone,
        paid_until: d.tenant.paid_until,
        days_left: d.daysLeft,
        reminder_type: d.reminderType,
        already_sent: await reminderAlreadySent(d.tenant.id, d.tenant.paid_until, d.reminderType),
      }))
    );
    return NextResponse.json({ due: withStatus });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
