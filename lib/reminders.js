import { supabaseAdmin } from "@/lib/supabaseAdmin";

const REMINDER_DAYS = [7, 3, 1];

export function diffInDays(paidUntil, today) {
  const until = new Date(`${paidUntil}T00:00:00`);
  const start = new Date(today.toISOString().slice(0, 10) + "T00:00:00");
  return Math.round((until.getTime() - start.getTime()) / 86400000);
}

// Who's hitting a 7/3/1-day expiry mark today — used by /api/admin/reminders/due-today (an
// admin-facing preview) and by each tenant's own POS terminal (/api/pos/[tenantId]/status),
// which is what actually surfaces the reminder now, as a popup in the terminal itself rather
// than an email. No server-side "did we send this yet" tracking is needed anymore since nothing
// dispatches on a schedule — the terminal just checks its own paid_until on load and shows the
// popup for as long as it's genuinely within the 7/3/1-day window.
export async function findTenantsDueToday() {
  const today = new Date();
  const { data: tenants, error } = await supabaseAdmin()
    .from("tenants")
    .select("id, restaurant_name, contact_email, contact_phone, paid_until, status")
    .eq("status", "active");

  if (error) throw new Error(error.message);

  const due = [];
  for (const tenant of tenants) {
    const daysLeft = diffInDays(tenant.paid_until, today);
    if (!REMINDER_DAYS.includes(daysLeft)) continue;
    due.push({ tenant, daysLeft, reminderType: `${daysLeft}_day` });
  }
  return due;
}
