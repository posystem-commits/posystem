import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireActiveTenant } from "@/lib/requireActiveTenant";

export const dynamic = "force-dynamic";

const MAX_KEYS = 40;

// One request that answers "what changed?" for several stored records at once.
//
// POST { keys: ["pending-orders", "receipts:2026-10", ...], versions: { key: updated_at-or-"none" } }
// returns { results: { key: { unchanged: true } | { updated_at, value } | { missing: true } } }
//
// Terminals and customer pages used to poll every record separately every few seconds — dozens of
// requests a minute each. This turns that into a single request, and only records that actually changed
// carry their value back, so a quiet minute costs almost nothing in requests or data.
export async function POST(req, { params }) {
  const gate = await requireActiveTenant(params.tenantId);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: 403 });

  const body = await req.json().catch(() => null);
  const keys = Array.isArray(body?.keys) ? [...new Set(body.keys.filter((k) => typeof k === "string" && k.length > 0 && k.length < 200))].slice(0, MAX_KEYS) : [];
  const versions = body?.versions && typeof body.versions === "object" ? body.versions : {};
  if (keys.length === 0) return NextResponse.json({ results: {} });

  const db = supabaseAdmin();
  // First only each record's version stamp (cheap) ...
  const { data: metas, error } = await db.from("tenant_pos_kv").select("key, updated_at").eq("tenant_id", params.tenantId).in("key", keys);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const stamp = new Map((metas || []).map((m) => [m.key, m.updated_at]));

  const results = {};
  const changed = [];
  keys.forEach((k) => {
    if (!stamp.has(k)) {
      results[k] = versions[k] === "none" ? { unchanged: true } : { missing: true, updated_at: null, value: null };
    } else if (versions[k] === stamp.get(k)) {
      results[k] = { unchanged: true };
    } else {
      changed.push(k);
    }
  });

  // ... then the values, only for the ones that moved.
  if (changed.length > 0) {
    const { data: rows, error: valErr } = await db.from("tenant_pos_kv").select("key, value, updated_at").eq("tenant_id", params.tenantId).in("key", changed);
    if (valErr) return NextResponse.json({ error: valErr.message }, { status: 500 });
    (rows || []).forEach((r) => {
      results[r.key] = { updated_at: r.updated_at, value: r.value };
    });
  }
  return NextResponse.json({ results });
}
