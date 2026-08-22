import { SignJWT, jwtVerify } from "jose";

export const ADMIN_COOKIE = "pos_admin_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecretKey() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error("ADMIN_JWT_SECRET must be set");
  return new TextEncoder().encode(secret);
}

// Signs a session token for an admin — payload is intentionally minimal (id + email), nothing
// sensitive. Verified on every /admin page load and /api/admin/* call via middleware.js.
export async function signAdminToken({ id, email }) {
  return new SignJWT({ id, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyAdminToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload;
  } catch (e) {
    return null;
  }
}

export const adminCookieOptions = {
  name: ADMIN_COOKIE,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: COOKIE_MAX_AGE_SECONDS,
};
