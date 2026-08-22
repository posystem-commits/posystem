import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

  const tenants = data.map((t) => ({ ...t, days_remaining: daysRemaining(t.paid_until) }));
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
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tenant: { ...data, days_remaining: daysRemaining(data.paid_until) } }, { status: 201 });
}
