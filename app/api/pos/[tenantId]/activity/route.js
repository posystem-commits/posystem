import { NextResponse } from "next/server";
import { requireActiveTenant } from "@/lib/requireActiveTenant";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// A small, fire-and-forget log of "major" edits made from inside a tenant's own POS terminal
// (restaurant name change, logo change, a menu scan) — see src/pos.jsx's logActivity(). Read back
// by app/api/admin/activity/route.js to flag a tenant making an unusual number of them recently.
// Deliberately never blocks or throws into the caller: pos.jsx fires this without awaiting the
// result, so a failure here (offline, DB hiccup) is silent to staff rather than surfacing as an
// error for what's just a background analytics write.
const EVENT_TYPES = ["restaurant_name_changed", "logo_changed", "menu_scanned"];

export async function POST(req, { params }) {
  const gate = await requireActiveTenant(params.tenantId);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => null);
  const eventType = body?.event_type;
  if (!EVENT_TYPES.includes(eventType)) {
    return NextResponse.json({ error: "Invalid event_type" }, { status: 400 });
  }
  const detail = typeof body?.detail === "string" ? body.detail.slice(0, 500) : null;

  const { error } = await supabaseAdmin()
    .from("tenant_activity_log")
    .insert({ tenant_id: params.tenantId, event_type: eventType, detail });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
