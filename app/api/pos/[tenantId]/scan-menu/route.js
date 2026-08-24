import { NextResponse } from "next/server";
import { requireActiveTenant } from "@/lib/requireActiveTenant";

// See app/api/pos/[tenantId]/status/route.js for why this opts out of Next's default fetch
// caching — requireActiveTenant's read must reflect the tenant's current status, not a cached one.
export const dynamic = "force-dynamic";

// Reads a photo of a physical/printed menu and extracts structured items (category, name,
// description, price) via Claude's vision capability, so staff can populate their menu from a
// photo instead of typing every dish in by hand. Same server-side-API-key pattern as
// app/api/pos/[tenantId]/help — the browser never holds the Anthropic key.
export async function POST(req, { params }) {
  const gate = await requireActiveTenant(params.tenantId);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: 403 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Menu scanning isn't configured on this server yet." }, { status: 503 });

  const body = await req.json().catch(() => null);
  const dataUrl = body?.image;
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "Body must be { image: a data:image/... URL }" }, { status: 400 });
  }
  const match = dataUrl.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
  if (!match) return NextResponse.json({ error: "Malformed image data URL" }, { status: 400 });
  const [, mediaType, base64Data] = match;

  // Claude's vision API only accepts these four formats. iPhones save photos as HEIC/HEIF by
  // default ("High Efficiency" camera setting) — that upload would otherwise sail through our
  // own checks (it's still a valid image/* file) and fail deep inside the Anthropic call with a
  // confusing error, so catch it here with an actionable message instead.
  const SUPPORTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!SUPPORTED_MEDIA_TYPES.includes(mediaType.toLowerCase())) {
    return NextResponse.json(
      { error: "That photo format isn't supported (only JPG, PNG, GIF, or WEBP). If you're on an iPhone, turn off \"High Efficiency\" in Settings > Camera > Formats, or choose \"Use as JPEG\" when picking the photo." },
      { status: 415 }
    );
  }

  // Roughly caps the original file around ~8MB (base64 inflates size by ~4/3) — comfortably under
  // Anthropic's per-image limit while keeping request bodies reasonable.
  if (base64Data.length > 11_000_000) {
    return NextResponse.json({ error: "Image is too large — try a smaller photo or a tighter crop." }, { status: 413 });
  }

  const prompt = `This image is a photo or scan of a restaurant menu. Extract every distinct dish/drink you can confidently read.

For each item, extract:
- "category": the section heading it appears under (e.g. "Starters", "Mains", "Drinks", "Desserts"). If no heading is visible, infer a sensible one from context.
- "name": the dish name, exactly as written.
- "tag": a short description if the menu shows one (ingredients, style — whatever's printed beneath/beside the name). Empty string if none is shown.
- "price": the numeric price only, no currency symbol, using "." as the decimal separator (e.g. 12.50). If a price is genuinely illegible or missing for an item, omit that item entirely rather than guessing a number.

Respond with ONLY a JSON array, no other text, no markdown code fences:
[{"category": "...", "name": "...", "tag": "...", "price": 12.5}, ...]`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: (process.env.ANTHROPIC_MODEL || "claude-sonnet-5").trim(),
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return NextResponse.json({ error: `Anthropic API error: ${response.status} ${detail}` }, { status: 502 });
  }

  const data = await response.json();
  const text = (data.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  // Claude sometimes ignores "respond with ONLY a JSON array" and adds a code fence, a leading
  // sentence ("Here's what I found:"), or a trailing note — strip fences first, then fall back to
  // just grabbing the outermost [ ... ] substring so any stray prose around it doesn't break
  // JSON.parse.
  let cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    cleaned = cleaned.slice(firstBracket, lastBracket + 1);
  }

  let items;
  try {
    items = JSON.parse(cleaned);
  } catch (e) {
    console.error("scan-menu: failed to parse Claude response as JSON:", text);
    return NextResponse.json({ error: "Couldn't read a menu from that photo — try a clearer or better-lit shot." }, { status: 422 });
  }
  if (!Array.isArray(items)) {
    console.error("scan-menu: Claude response parsed but wasn't an array:", text);
    return NextResponse.json({ error: "Couldn't read a menu from that photo — try a clearer or better-lit shot." }, { status: 422 });
  }

  // Prices sometimes come back as strings with a currency symbol, thousands separator, or stray
  // whitespace despite the prompt asking for a plain number (e.g. "$12.50", "150 EGP", "1,200") —
  // strip everything but digits/decimal point before parsing, rather than rejecting the item.
  const parsePrice = (raw) => {
    if (typeof raw === "number") return raw;
    if (typeof raw !== "string") return NaN;
    const cleaned = raw.replace(/[^0-9.]/g, "");
    return cleaned ? Number(cleaned) : NaN;
  };

  const cleanItems = items
    .map((it) => ({
      category: String(it?.category || "").trim() || "Menu",
      name: String(it?.name || "").trim(),
      tag: String(it?.tag || "").trim(),
      price: parsePrice(it?.price),
    }))
    .filter((it) => it.name && Number.isFinite(it.price) && it.price > 0);

  if (cleanItems.length === 0) {
    console.error("scan-menu: parsed items but none survived validation:", JSON.stringify(items));
    return NextResponse.json({ error: "Didn't find any readable menu items in that photo." }, { status: 422 });
  }

  return NextResponse.json({ items: cleanItems });
}
