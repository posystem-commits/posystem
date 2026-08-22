import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { signAdminToken, adminCookieOptions } from "@/lib/adminAuth";

// See app/api/pos/[tenantId]/status/route.js for why this opts out of Next's default fetch
// caching — a stale cached read here could validate a password against an old password_hash.
export const dynamic = "force-dynamic";

export async function POST(req) {
  const body = await req.json().catch(() => null);
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const { data: admin, error } = await supabaseAdmin()
    .from("admins")
    .select("id, email, password_hash")
    .eq("email", email)
    .single();

  // Same generic error whether the email doesn't exist or the password is wrong — avoids
  // confirming which emails have accounts.
  if (error || !admin) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, admin.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = await signAdminToken({ id: admin.id, email: admin.email });
  const res = NextResponse.json({ ok: true, email: admin.email });
  res.cookies.set(adminCookieOptions.name, token, adminCookieOptions);
  return res;
}
