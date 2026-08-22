import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireActiveTenant } from "@/lib/requireActiveTenant";

// See app/api/pos/[tenantId]/status/route.js for why every route here opts out of Next's
// default fetch caching — reads must always reflect the latest write.
export const dynamic = "force-dynamic";

// Mirrors window.storage.list(prefix) — used once in pos.jsx, to discover which receipt months
// exist ("receipts:").
export async function GET(req, { params }) {
  const gate = await requireActiveTenant(params.tenantId);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: 403 });

  const prefix = req.nextUrl.searchParams.get("prefix") || "";
  const { data, error } = await supabaseAdmin()
    .from("tenant_pos_kv")
    .select("key")
    .eq("tenant_id", params.tenantId)
    .like("key", `${prefix.replace(/[%_]/g, "\\$&")}%`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data.map((r) => r.key) });
}
