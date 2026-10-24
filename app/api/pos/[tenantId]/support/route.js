import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendAlert } from "@/lib/alerts";
import { SUPPORT_COOKIE, SUPPORT_SESSION_SECONDS, LIMITS, signSupportToken, verifySupportToken, supportCookieOptions, clientIp, lockState } from "@/lib/supportAuth";

export const dynamic = "force-dynamic";

// The hidden "Support" sign-in on a restaurant's terminal. The terminal opens it with a secret gesture; the
// 4-digit code is checked here against the PIN set in /admin/support, and a short pass for THIS restaurant is
// returned as an httpOnly cookie. Whatever goes wrong, the answer a wrong guesser sees is the same.

const WRONG = () => NextResponse.json({ error: "Incorrect code" }, { status: 401 });
const cairoNow = () => new Date().toLocaleString("en-GB", { timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short" });

const logAttempt = (tenantId, outcome, ip, ua) =>
  supabaseAdmin().from("support_access_log").insert({ tenant_id: tenantId, outcome, ip, user_agent: (ua || "").slice(0, 200) });

export async function POST(req, { params }) {
  const tenantId = params.tenantId;
  const body = await req.json().catch(() => null);
  const pin = typeof body?.pin === "string" ? body.pin : "";
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent") || "";
  const db = supabaseAdmin();

  const { data: tenant } = await db.from("tenants").select("id, restaurant_name").eq("id", tenantId).maybeSingle();
  if (!tenant) return WRONG();

  // Lock-out first, from the log of wrong codes — before the code is even looked at.
  const sinceGlobal = new Date(Date.now() - LIMITS.globalWindowMs).toISOString();
  const { data: fails, error: logError } = await db
    .from("support_access_log")
    .select("ip, created_at")
    .eq("outcome", "fail")
    .gte("created_at", sinceGlobal)
    .order("created_at", { ascending: false })
    .limit(200);
  if (logError) return WRONG(); // not set up yet (see db/support_access.sql) — looks like any wrong code
  const globalTimes = fails.map((f) => Date.parse(f.created_at));
  const ipTimes = fails.filter((f) => f.ip === ip).map((f) => Date.parse(f.created_at));
  const lock = lockState(ipTimes, globalTimes);
  if (lock.locked) {
    await logAttempt(tenantId, "locked", ip, ua);
    return NextResponse.json({ error: "Too many attempts", retryAfterSeconds: lock.retryAfterSeconds }, { status: 429 });
  }

  const { data: settings } = await db.from("support_settings").select("pin_hash").eq("id", 1).maybeSingle();
  if (!settings?.pin_hash) return WRONG(); // no PIN set: the feature simply does not exist

  const valid = /^\d{4}$/.test(pin) && (await bcrypt.compare(pin, settings.pin_hash));
  if (!valid) {
    await logAttempt(tenantId, "fail", ip, ua);
    const failsNow = ipTimes.filter((t) => Date.now() - t < LIMITS.perIpWindowMs).length + 1;
    const globalNow = globalTimes.length + 1;
    if (failsNow === 3 || failsNow === LIMITS.perIpFails || globalNow === LIMITS.globalFails) {
      await sendAlert(
        failsNow >= LIMITS.perIpFails || globalNow >= LIMITS.globalFails
          ? `⛔ Support sign-in LOCKED after repeated wrong codes\nRestaurant: ${tenant.restaurant_name}\nDevice IP: ${ip}\nTime: ${cairoNow()}`
          : `⚠️ Wrong support code entered ${failsNow} times\nRestaurant: ${tenant.restaurant_name}\nDevice IP: ${ip}\nTime: ${cairoNow()}`
      );
    }
    return WRONG();
  }

  await logAttempt(tenantId, "ok", ip, ua);
  await sendAlert(`🔓 Support sign-in used\nRestaurant: ${tenant.restaurant_name}\nDevice IP: ${ip}\nTime: ${cairoNow()}`);

  const token = await signSupportToken(tenantId);
  const expiresAt = new Date(Date.now() + SUPPORT_SESSION_SECONDS * 1000).toISOString();
  const res = NextResponse.json({ ok: true, expiresAt });
  res.cookies.set(supportCookieOptions.name, token, supportCookieOptions);
  return res;
}

// Is there a valid pass for this restaurant on this browser? (A reload must not end the session.)
export async function GET(req, { params }) {
  const payload = await verifySupportToken(req.cookies.get(SUPPORT_COOKIE)?.value, params.tenantId);
  if (!payload) return NextResponse.json({ active: false });
  return NextResponse.json({ active: true, expiresAt: new Date(payload.exp * 1000).toISOString() });
}

export async function DELETE(req, { params }) {
  const payload = await verifySupportToken(req.cookies.get(SUPPORT_COOKIE)?.value, params.tenantId);
  if (payload) {
    try {
      await logAttempt(params.tenantId, "exit", clientIp(req), req.headers.get("user-agent") || "");
    } catch (e) {
      // the log is a record, not a gate
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SUPPORT_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
