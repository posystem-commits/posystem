import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireActiveTenant } from "@/lib/requireActiveTenant";

// Mirrors window.storage.get(key) — see lib/tenantStorage.js for the client shim that calls this.
export async function GET(req, { params }) {
  const gate = await requireActiveTenant(params.tenantId);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: 403 });

  const { data, error } = await supabaseAdmin()
    .from("tenant_pos_kv")
    .select("value")
    .eq("tenant_id", params.tenantId)
    .eq("key", params.key)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ value: data?.value ?? null });
}

// Mirrors window.storage.set(key, value) — upserts the row for this tenant+key.
export async function PUT(req, { params }) {
  const gate = await requireActiveTenant(params.tenantId);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (typeof body?.value !== "string") {
    return NextResponse.json({ error: "Body must be { value: string }" }, { status: 400 });
  }

  const { error } = await supabaseAdmin()
    .from("tenant_pos_kv")
    .upsert({ tenant_id: params.tenantId, key: params.key, value: body.value }, { onConflict: "tenant_id,key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Mirrors window.storage.delete(key).
export async function DELETE(req, { params }) {
  const gate = await requireActiveTenant(params.tenantId);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: 403 });

  const { error } = await supabaseAdmin()
    .from("tenant_pos_kv")
    .delete()
    .eq("tenant_id", params.tenantId)
    .eq("key", params.key);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
