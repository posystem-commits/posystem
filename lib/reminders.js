import { supabaseAdmin } from "@/lib/supabaseAdmin";

const REMINDER_DAYS = [7, 3, 1];

function diffInDays(paidUntil, today) {
  const until = new Date(`${paidUntil}T00:00:00`);
  const start = new Date(today.toISOString().slice(0, 10) + "T00:00:00");
  return Math.round((until.getTime() - start.getTime()) / 86400000);
}

// Shared by both /api/admin/reminders/due-today (a read-only preview for the dashboard) and
// /api/cron/reminders (the job that actually sends). Keeping the "who's due" computation in one
// place means the dashboard can never show a different answer than what the cron job will act on.
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

export async function reminderAlreadySent(tenantId, paidUntil, reminderType) {
  const { data, error } = await supabaseAdmin()
    .from("reminder_log")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("paid_until", paidUntil)
    .eq("reminder_type", reminderType)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return !!data;
}

export async function recordReminderSent(tenantId, paidUntil, reminderType) {
  const { error } = await supabaseAdmin()
    .from("reminder_log")
    .insert({ tenant_id: tenantId, paid_until: paidUntil, reminder_type: reminderType });
  // A unique-constraint conflict here means two runs raced each other — harmless, not an error.
  if (error && error.code !== "23505") throw new Error(error.message);
}
