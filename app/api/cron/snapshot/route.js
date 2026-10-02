import { NextResponse } from "next/server";
import { takeSnapshots, DEFAULT_KEEP } from "@/lib/snapshots";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/cron/snapshot — run daily by Vercel Cron (see vercel.json). Vercel sends
// `Authorization: Bearer $CRON_SECRET` when the CRON_SECRET env var is set; with no secret
// configured this route refuses to run at all rather than being open to the internet.
// Optional: ?tenant=<id> to snapshot one tenant, ?keep=<n> (min 5) to change retention.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const keepParam = Number(url.searchParams.get("keep"));
  const keep = Number.isInteger(keepParam) && keepParam >= 5 ? keepParam : DEFAULT_KEEP;

  try {
    const results = await takeSnapshots({ tenantId: url.searchParams.get("tenant") || undefined, keep });
    const failed = results.filter((r) => r.status === "FAILED");
    return NextResponse.json({ ok: failed.length === 0, results }, { status: failed.length ? 500 : 200 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
