import { NextResponse } from "next/server";
import { getPackageMatrix, setPackageMatrix, FEATURE_KEYS } from "@/lib/packageFeatures";

// See app/api/pos/[tenantId]/status/route.js for why every route reading live data opts out of
// Next's default fetch caching this way.
export const dynamic = "force-dynamic";

// GET /admin/packages — the current Basic/Standard/Premium toggle matrix, plus the fixed feature
// list so the admin UI doesn't need its own hardcoded copy.
export async function GET() {
  try {
    const matrix = await getPackageMatrix();
    return NextResponse.json({ matrix, features: FEATURE_KEYS });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT /admin/packages — replaces the whole matrix (the admin page always sends a complete one).
export async function PUT(req) {
  const body = await req.json().catch(() => null);
  if (!body?.matrix) return NextResponse.json({ error: "Body must be { matrix }" }, { status: 400 });
  try {
    await setPackageMatrix(body.matrix);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
