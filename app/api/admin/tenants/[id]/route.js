import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// See app/api/pos/[tenantId]/status/route.js for why every route reading live data opts out of
// Next's default fetch caching this way.
export const dynamic = "force-dynamic";

const EDITABLE_FIELDS = [
  "restaurant_name",
  "contact_name",
  "contact_email",
  "contact_phone",
  "status",
  "paid_until",
  "notes",
  "package",
];

// PATCH /admin/tenants/:id — edit info, toggle active/paused, update paid_until.
export async function PATCH(req, { params }) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  if (body.status && !["active", "paused"].includes(body.status)) {
    return NextResponse.json({ error: "status must be 'active' or 'paused'" }, { status: 400 });
  }
  if (body.package && !["basic", "standard", "premium"].includes(body.package)) {
    return NextResponse.json({ error: "package must be 'basic', 'standard', or 'premium'" }, { status: 400 });
  }
  if (body.paid_until && Number.isNaN(Date.parse(body.paid_until))) {
    return NextResponse.json({ error: "paid_until must be a valid date" }, { status: 400 });
  }

  const patch = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in body) patch[key] = body[key];
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from("tenants")
    .update(patch)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  return NextResponse.json({ tenant: data });
}

// DELETE /admin/tenants/:id — remove a customer.
export async function DELETE(req, { params }) {
  const { error } = await supabaseAdmin().from("tenants").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
