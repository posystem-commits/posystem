import { supabaseAdmin } from "@/lib/supabaseAdmin";

// The server-side gate from build-spec section 2: every tenant-facing POS API route must call
// this before touching tenant data. Pausing a customer, or letting their paid_until lapse, takes
// effect within seconds — not just a dashboard toggle a client could bypass.
//
// NOTE ON TENANT RESOLUTION: this only checks a tenantId you already have. How a request gets a
// tenantId in the first place (subdomain, a signed staff-session cookie, a path param, etc.) is
// part of the pos.jsx → real-API migration described in build-spec section 7, which hasn't
// happened yet — src/pos.jsx still runs entirely on the Claude-artifact `window.storage` API and
// has no concept of a tenant. Wire that resolution up first, then call this at the top of every
// tenant route handler, e.g.:
//
//   export async function GET(req) {
//     const tenantId = resolveTenantIdSomehow(req);
//     const gate = await requireActiveTenant(tenantId);
//     if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: 403 });
//     ... proceed using gate.tenant ...
//   }

// An active tenant stays active for a few seconds, so a burst of requests from one restaurant does one
// lookup instead of one each. Only "active" answers are remembered — a paused or expired tenant is
// looked up again every time, so reactivating takes effect immediately, and pausing within TTL_MS.
const TTL_MS = 20000;
const activeUntil = new Map(); // tenantId -> { until, tenant }

export async function requireActiveTenant(tenantId) {
  if (!tenantId) return { ok: false, error: "Missing tenant" };

  const cached = activeUntil.get(tenantId);
  const todayNow = new Date().toISOString().slice(0, 10);
  if (cached && cached.until > Date.now() && cached.tenant.paid_until >= todayNow) return { ok: true, tenant: cached.tenant };

  const { data: tenant, error } = await supabaseAdmin()
    .from("tenants")
    .select("id, status, paid_until, restaurant_name")
    .eq("id", tenantId)
    .single();

  if (error || !tenant) return { ok: false, error: "Access is paused or your subscription has expired." };

  const today = new Date().toISOString().slice(0, 10);
  if (tenant.status !== "active" || tenant.paid_until < today) {
    activeUntil.delete(tenantId);
    return { ok: false, error: "Access is paused or your subscription has expired." };
  }

  activeUntil.set(tenantId, { until: Date.now() + TTL_MS, tenant });
  return { ok: true, tenant };
}
