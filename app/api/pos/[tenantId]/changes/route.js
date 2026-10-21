import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireActiveTenant } from "@/lib/requireActiveTenant";

export const dynamic = "force-dynamic";

const MAX_KEYS = 40;

// What a customer's browser needs from a record, without the heavy parts. Pictures are stored inside these
// records as data URLs, so sending them on every visit was the biggest use of data. Instead the page gets a
// flag and loads each picture from /site-image, where it is cached. Recipes never leave the server.
// (Staff terminals read these records through the normal storage route, not this one.)
function publicView(key, value, updatedAt, tenantId) {
  try {
    if (key === "menu-config") {
      const m = JSON.parse(value);
      const menu = {};
      Object.keys(m.menu || {}).forEach((cat) => {
        menu[cat] = (m.menu[cat] || []).map((i) => ({ id: i.id, name: i.name, tag: i.tag, price: i.price, badges: Array.isArray(i.badges) ? i.badges : [], featured: !!i.featured, hasImage: !!i.image }));
      });
      return JSON.stringify({ categories: m.categories || [], menu });
    }
    if (key === "website-media") {
      const m = JSON.parse(value);
      return JSON.stringify({ cover: !!m.cover, gallery: Array.isArray(m.gallery) ? m.gallery.length : 0 });
    }
    if (key === "restaurant-branding") {
      const b = JSON.parse(value);
      return JSON.stringify({ ...b, logo: b.logo ? `/api/pos/${tenantId}/site-image?type=logo&v=${encodeURIComponent(updatedAt)}` : null });
    }
  } catch (e) {
    // fall through to the raw value
  }
  return value;
}

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
      results[r.key] = { updated_at: r.updated_at, value: publicView(r.key, r.value, r.updated_at, params.tenantId) };
    });
  }
  return NextResponse.json({ results });
}
