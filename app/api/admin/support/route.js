import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/adminAuth";
import { validatePin } from "@/lib/supportAuth";
import { alertsConfigured, alertChatCount, sendAlert } from "@/lib/alerts";

export const dynamic = "force-dynamic";

// Support access settings, for the owner only (middleware.js already requires the admin session for /api/admin/*).
//   GET     status, alerts setup, and the latest sign-in attempts
//   PUT     set or change the 4-digit PIN   { pin, password }
//   DELETE  switch the PIN off              { password }
//   POST    { action: "test-alert" }

// Changing the PIN asks for the admin account's own password again, so a left-open admin tab can't be used to
// quietly set a new one.
async function confirmPassword(req, password) {
  const session = await verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value);
  if (!session?.email || typeof password !== "string" || !password) return false;
  const { data: admin } = await supabaseAdmin().from("admins").select("password_hash").eq("email", String(session.email).toLowerCase()).maybeSingle();
  return !!admin && (await bcrypt.compare(password, admin.password_hash));
}

const isMissingTable = (error) => error && (error.code === "42P01" || /does not exist|schema cache/i.test(error.message || ""));

export async function GET() {
  const db = supabaseAdmin();
  const settings = await db.from("support_settings").select("pin_hash, updated_at").eq("id", 1).maybeSingle();
  if (settings.error) {
    if (isMissingTable(settings.error)) return NextResponse.json({ setupNeeded: true, alerts: { configured: alertsConfigured(), chats: alertChatCount() } });
    return NextResponse.json({ error: settings.error.message }, { status: 500 });
  }
  const { data: log } = await db.from("support_access_log").select("id, tenant_id, outcome, ip, user_agent, created_at").order("created_at", { ascending: false }).limit(60);
  const ids = [...new Set((log || []).map((l) => l.tenant_id))];
  const names = {};
  if (ids.length > 0) {
    const { data: tenants } = await db.from("tenants").select("id, restaurant_name").in("id", ids);
    (tenants || []).forEach((t) => (names[t.id] = t.restaurant_name));
  }
  const dayAgo = Date.now() - 86400000;
  return NextResponse.json({
    setupNeeded: false,
    pinSet: !!settings.data?.pin_hash,
    pinUpdatedAt: settings.data?.updated_at || null,
    alerts: { configured: alertsConfigured(), chats: alertChatCount() },
    failuresLast24h: (log || []).filter((l) => l.outcome === "fail" && Date.parse(l.created_at) > dayAgo).length,
    log: (log || []).map((l) => ({ ...l, restaurant_name: names[l.tenant_id] || "Unknown restaurant" })),
  });
}

export async function PUT(req) {
  const body = await req.json().catch(() => null);
  const check = validatePin(body?.pin);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
  if (!(await confirmPassword(req, body?.password))) return NextResponse.json({ error: "Your password is needed to change the code, and it didn't match." }, { status: 403 });
  const pin_hash = await bcrypt.hash(body.pin, 10);
  const { error } = await supabaseAdmin().from("support_settings").upsert({ id: 1, pin_hash, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) return NextResponse.json({ error: isMissingTable(error) ? "Run the one-time setup first." : error.message }, { status: 500 });
  await sendAlert("🔑 The support PIN was changed from the admin page.");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  const body = await req.json().catch(() => null);
  if (!(await confirmPassword(req, body?.password))) return NextResponse.json({ error: "Your password is needed to switch the code off, and it didn't match." }, { status: 403 });
  const { error } = await supabaseAdmin().from("support_settings").upsert({ id: 1, pin_hash: null, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await sendAlert("🔒 The support PIN was switched off from the admin page.");
  return NextResponse.json({ ok: true });
}

export async function POST(req) {
  const body = await req.json().catch(() => null);
  if (body?.action !== "test-alert") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  if (!alertsConfigured()) return NextResponse.json({ ok: false, error: "Alerts aren't set up yet — add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_IDS in Vercel." }, { status: 400 });
  const result = await sendAlert("✅ Test alert from your admin page — support alerts will arrive here.");
  return NextResponse.json({ ok: result.ok, sent: result.sent, error: result.ok ? null : result.reason });
}
