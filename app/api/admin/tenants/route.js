import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// See app/api/pos/[tenantId]/status/route.js for why every route reading live data opts out of
// Next's default fetch caching this way.
export const dynamic = "force-dynamic";

function daysRemaining(paidUntil) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const until = new Date(`${paidUntil}T00:00:00`);
  return Math.round((until.getTime() - today.getTime()) / 86400000);
}

// GET /admin/tenants — list all customers, with status + days remaining.
export async function GET() {
  const { data, error } = await supabaseAdmin()
    .from("tenants")
    .select("*")
    .order("restaurant_name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // The name typed in here when the tenant was created can drift from what the restaurant has
  // since renamed their own terminal to, in their Settings tab (stored in the tenant_pos_kv
  // "restaurant-branding" record) — surface that live value too so the list reflects reality.
  const ids = data.map((t) => t.id);
  let liveNameById = {};
  if (ids.length > 0) {
    const { data: brandingRows } = await supabaseAdmin()
      .from("tenant_pos_kv")
      .select("tenant_id, value")
      .eq("key", "restaurant-branding")
      .in("tenant_id", ids);
    (brandingRows || []).forEach((row) => {
      try {
        const parsed = JSON.parse(row.value);
        if (parsed?.name) liveNameById[row.tenant_id] = parsed.name;
      } catch (e) {
        // malformed/legacy value — just skip it, the admin-recorded name still shows
      }
    });
  }

  const tenants = data.map((t) => ({ ...t, days_remaining: daysRemaining(t.paid_until), live_name: liveNameById[t.id] || null }));
  return NextResponse.json({ tenants });
}

// POST /admin/tenants — add a new customer.
export async function POST(req) {
  const body = await req.json().catch(() => null);
  const restaurant_name = body?.restaurant_name?.trim();
  const paid_until = body?.paid_until;

  if (!restaurant_name) {
    return NextResponse.json({ error: "restaurant_name is required" }, { status: 400 });
  }
  if (!paid_until || Number.isNaN(Date.parse(paid_until))) {
    return NextResponse.json({ error: "paid_until (a date) is required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from("tenants")
    .insert({
      restaurant_name,
      contact_name: body?.contact_name || null,
      contact_email: body?.contact_email || null,
      contact_phone: body?.contact_phone || null,
      status: body?.status === "paused" ? "paused" : "active",
      paid_until,
      notes: body?.notes || null,
      package: ["basic", "standard", "premium"].includes(body?.package) ? body.package : "basic",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tenant: { ...data, days_remaining: daysRemaining(data.paid_until) } }, { status: 201 });
}
