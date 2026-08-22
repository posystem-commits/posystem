import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { ADMIN_COOKIE } from "@/lib/adminAuth";

// Edge middleware can't import the jose helper directly (it wraps a Node-only error path in
// adminAuth.js's getSecretKey via env access, which is fine at the edge too, but keeping the
// verify call self-contained here avoids any bundling surprises). Mirrors verifyAdminToken.
async function verify(token) {
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (e) {
    return null;
  }
}

const PUBLIC_ADMIN_PATHS = ["/admin/login"];
const PUBLIC_API_PATHS = ["/api/admin/login"];

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  const isAdminPage = pathname.startsWith("/admin") && !PUBLIC_ADMIN_PATHS.includes(pathname);
  const isAdminApi = pathname.startsWith("/api/admin") && !PUBLIC_API_PATHS.includes(pathname);

  if (!isAdminPage && !isAdminApi) return NextResponse.next();

  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const payload = await verify(token);

  if (!payload) {
    if (isAdminApi) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const loginUrl = new URL("/admin/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
