import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireActiveTenant } from "@/lib/requireActiveTenant";
import { RESERVED_SLUGS } from "@/lib/siteServer";
import { SLUG_RE } from "@/src/site/presets";

export const dynamic = "force-dynamic";

const KEY = "site-slug";

// The restaurant's current short web address (the part after /r/), or null.
export async function GET(req, { params }) {
  const gate = await requireActiveTenant(params.tenantId);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: 403 });
  const { data, error } = await supabaseAdmin().from("tenant_pos_kv").select("value").eq("tenant_id", params.tenantId).eq("key", KEY).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let slug = null;
  try {
    slug = data?.value ? JSON.parse(data.value) : null;
  } catch (e) {
    slug = null;
  }
  return NextResponse.json({ slug });
}

// Claims a short address. Addresses are unique across restaurants, so this checks no one else has it
// first (the generic storage route refuses to write this key, so this is the only way to set one).
export async function PUT(req, { params }) {
  const gate = await requireActiveTenant(params.tenantId);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: 403 });
  const body = await req.json().catch(() => null);
  const slug = String(body?.slug || "").trim().toLowerCase();
  if (!SLUG_RE.test(slug)) return NextResponse.json({ error: "Invalid address", code: "invalid" }, { status: 400 });
  if (RESERVED_SLUGS.has(slug)) return NextResponse.json({ error: "Reserved", code: "reserved" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: clash, error: clashErr } = await db.from("tenant_pos_kv").select("tenant_id").eq("key", KEY).eq("value", JSON.stringify(slug)).neq("tenant_id", params.tenantId).maybeSingle();
  if (clashErr) return NextResponse.json({ error: clashErr.message }, { status: 500 });
  if (clash) return NextResponse.json({ error: "Taken", code: "taken" }, { status: 409 });

  const { error } = await db.from("tenant_pos_kv").upsert({ tenant_id: params.tenantId, key: KEY, value: JSON.stringify(slug) }, { onConflict: "tenant_id,key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, slug });
}
