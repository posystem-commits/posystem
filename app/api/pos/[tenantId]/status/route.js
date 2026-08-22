import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { diffInDays } from "@/lib/reminders";
import { getFeaturesForPackage } from "@/lib/packageFeatures";

// Belt-and-suspenders: keeps this route itself from ever being statically optimized. The fix for
// stale reads (this endpoint was observed serving a tenant's paid_until from the very first
// request after a server start, forever, ignoring later changes) actually lives in
// lib/supabaseAdmin.js, which forces cache: "no-store" on every request the Supabase client
// makes — that's what fixed it; this export alone was not sufficient on its own.
export const dynamic = "force-dynamic";

// Lets a tenant's own POS terminal know its subscription state (so it can show the 7/3/1-day
// renewal popup itself instead of that living in a server-dispatched email) and which package
// features it's allowed to use (see lib/packageFeatures.js and /admin/packages). Deliberately NOT
// gated by requireActiveTenant like the storage routes — a paused or expired tenant still needs
// to be able to ask "what's my status?" (that's the whole point), it just gets told the truth
// rather than being locked out of finding out.
export async function GET(req, { params }) {
  const { data: tenant, error } = await supabaseAdmin()
    .from("tenants")
    .select("status, paid_until, restaurant_name, package")
    .eq("id", params.tenantId)
    .single();

  if (error || !tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const days_remaining = diffInDays(tenant.paid_until, new Date());
  const features = await getFeaturesForPackage(tenant.package || "basic").catch(() => ({}));
  return NextResponse.json({
    status: tenant.status,
    paid_until: tenant.paid_until,
    restaurant_name: tenant.restaurant_name,
    days_remaining,
    package: tenant.package || "basic",
    features,
  });
}
