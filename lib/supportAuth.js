import { SignJWT, jwtVerify } from "jose";

// The hidden "Support" sign-in: a 4-digit PIN (set in /admin/support) that opens any restaurant's terminal as a
// manager for a short while, without clocking in. See app/api/pos/[tenantId]/support/route.js.

export const SUPPORT_COOKIE = "pos_support";
export const SUPPORT_SESSION_SECONDS = 30 * 60;

// A 4-digit code can only be protected by how few guesses are allowed: 5 wrong codes lock that device for 15
// minutes, and 20 wrong codes from anywhere in an hour lock everyone out for the rest of that hour.
export const LIMITS = { perIpFails: 5, perIpWindowMs: 15 * 60 * 1000, globalFails: 20, globalWindowMs: 60 * 60 * 1000 };

const secretKey = () => {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error("ADMIN_JWT_SECRET must be set");
  return new TextEncoder().encode(secret);
};

export async function signSupportToken(tenantId) {
  return new SignJWT({ kind: "support", tid: tenantId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SUPPORT_SESSION_SECONDS}s`)
    .sign(secretKey());
}

// The pass only counts for the restaurant it was issued for.
export async function verifySupportToken(token, tenantId) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload.kind === "support" && payload.tid === tenantId ? payload : null;
  } catch (e) {
    return null;
  }
}

export const supportCookieOptions = {
  name: SUPPORT_COOKIE,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: SUPPORT_SESSION_SECONDS,
};

// Rejects codes that are easy to guess: all the same digit, or running straight up or down.
export function validatePin(pin) {
  if (typeof pin !== "string" || !/^\d{4}$/.test(pin)) return { ok: false, error: "The code must be exactly 4 digits." };
  const d = pin.split("").map(Number);
  if (d.every((x) => x === d[0])) return { ok: false, error: "Pick a code that isn't the same digit four times." };
  const step = d[1] - d[0];
  if (Math.abs(step) === 1 && d.every((x, i) => i === 0 || x - d[i - 1] === step)) return { ok: false, error: "Pick a code that isn't a straight run like 1234 or 4321." };
  return { ok: true };
}

export function clientIp(req) {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : req.headers.get("x-real-ip") || "unknown").slice(0, 64);
}

// Given the wrong-code timestamps (ms) from this device and from anywhere, newest first, says whether the
// sign-in is locked and for how many more seconds.
export function lockState(ipFailTimes, globalFailTimes, nowMs = Date.now()) {
  const waits = [];
  const recent = (times, windowMs) => times.filter((t) => nowMs - t < windowMs);
  const ip = recent(ipFailTimes, LIMITS.perIpWindowMs);
  if (ip.length >= LIMITS.perIpFails) waits.push(ip[LIMITS.perIpFails - 1] + LIMITS.perIpWindowMs - nowMs);
  const all = recent(globalFailTimes, LIMITS.globalWindowMs);
  if (all.length >= LIMITS.globalFails) waits.push(all[LIMITS.globalFails - 1] + LIMITS.globalWindowMs - nowMs);
  if (waits.length === 0) return { locked: false, retryAfterSeconds: 0 };
  return { locked: true, retryAfterSeconds: Math.max(1, Math.ceil(Math.max(...waits) / 1000)) };
}
