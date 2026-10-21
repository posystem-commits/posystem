import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireActiveTenant } from "@/lib/requireActiveTenant";

export const dynamic = "force-dynamic";

// Serves a restaurant's pictures — the logo, the website's cover and gallery photos, and dish photos — as
// real image files. They are stored as data URLs inside the restaurant's records, which cannot be cached
// or used by link previews (WhatsApp, Instagram, Google); this route turns them into ordinary images.
//
//   ?type=logo
//   ?type=cover
//   ?type=gallery&i=<index>
//   ?type=item&id=<dish id>
//   &v=<version of the stored record>   (optional)
//
// With a version in the link the picture is cacheable for a year: the link changes whenever the record
// does, so nobody ever sees a stale picture, and repeat views never touch the database again.
export async function GET(req, { params }) {
  const gate = await requireActiveTenant(params.tenantId);
  if (!gate.ok) return new NextResponse("Not found", { status: 404 });
  const q = new URL(req.url).searchParams;
  const type = q.get("type");
  const key = type === "logo" ? "restaurant-branding" : type === "cover" || type === "gallery" ? "website-media" : type === "item" ? "menu-config" : null;
  if (!key) return new NextResponse("Not found", { status: 404 });

  const { data } = await supabaseAdmin().from("tenant_pos_kv").select("value").eq("tenant_id", params.tenantId).eq("key", key).maybeSingle();
  let dataUrl = null;
  try {
    const parsed = data?.value ? JSON.parse(data.value) : null;
    if (type === "logo") dataUrl = parsed?.logo;
    else if (type === "cover") dataUrl = parsed?.cover;
    else if (type === "gallery") dataUrl = Array.isArray(parsed?.gallery) ? parsed.gallery[Number(q.get("i"))] : null;
    else if (type === "item") {
      const id = q.get("id");
      const all = Object.values(parsed?.menu || {}).flat();
      dataUrl = (all.find((it) => it.id === id) || {}).image;
    }
  } catch (e) {
    dataUrl = null;
  }
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl || "");
  if (!m) return new NextResponse("Not found", { status: 404 });
  const versioned = !!q.get("v");
  return new NextResponse(Buffer.from(m[2], "base64"), {
    headers: {
      "Content-Type": m[1],
      "Cache-Control": versioned ? "public, max-age=31536000, s-maxage=31536000, immutable" : "public, max-age=300, s-maxage=300",
    },
  });
}
