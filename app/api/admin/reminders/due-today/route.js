import { NextResponse } from "next/server";
import { findTenantsDueToday } from "@/lib/reminders";

// See app/api/pos/[tenantId]/status/route.js for why every route reading live data opts out of
// Next's default fetch caching this way.
export const dynamic = "force-dynamic";

// GET /admin/reminders/due-today — visibility into who's hitting a 7/3/1-day expiry mark today.
// Purely informational now: the actual reminder is a popup shown in each tenant's own POS
// terminal (see app/api/pos/[tenantId]/status), not something this admin dashboard dispatches.
export async function GET() {
  try {
    const due = await findTenantsDueToday();
    const list = due.map((d) => ({
      tenant_id: d.tenant.id,
      restaurant_name: d.tenant.restaurant_name,
      contact_email: d.tenant.contact_email,
      contact_phone: d.tenant.contact_phone,
      paid_until: d.tenant.paid_until,
      days_left: d.daysLeft,
      reminder_type: d.reminderType,
    }));
    return NextResponse.json({ due: list });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
