import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireActiveTenant } from "@/lib/requireActiveTenant";

export const dynamic = "force-dynamic";

// Serves the website's cover photo or the restaurant's logo as a real image file. Link previews
// (WhatsApp, Instagram, Google) can't use the data-URL form the images are stored in, so the page's
// share tags point here instead.
export async function GET(req, { params }) {
  const gate = await requireActiveTenant(params.tenantId);
  if (!gate.ok) return new NextResponse("Not found", { status: 404 });
  const type = new URL(req.url).searchParams.get("type");
  const key = type === "logo" ? "restaurant-branding" : type === "cover" ? "website-media" : null;
  if (!key) return new NextResponse("Not found", { status: 404 });

  const { data } = await supabaseAdmin().from("tenant_pos_kv").select("value").eq("tenant_id", params.tenantId).eq("key", key).maybeSingle();
  let dataUrl = null;
  try {
    const parsed = data?.value ? JSON.parse(data.value) : null;
    dataUrl = type === "logo" ? parsed?.logo : parsed?.cover;
  } catch (e) {
    dataUrl = null;
  }
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl || "");
  if (!m) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(Buffer.from(m[2], "base64"), {
    headers: { "Content-Type": m[1], "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
}
