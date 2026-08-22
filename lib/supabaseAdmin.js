import { createClient } from "@supabase/supabase-js";

// Server-only client using the service-role key — bypasses RLS, so this file must never be
// imported from client components. Every admin API route and every tenant POS route use this.
let client;

export function supabaseAdmin() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Next.js's App Router patches the global fetch used inside Route Handlers and caches GET
    // responses by default (its "Data Cache") — this applies to ANY fetch call made during a
    // request, including the ones supabase-js makes internally, not just fetch() calls a route
    // writes directly. `export const dynamic = "force-dynamic"` on a route is documented to be
    // equivalent to this, but was observed NOT reliably preventing stale reads here (e.g.
    // /api/pos/[tenantId]/status kept returning a tenant's paid_until from the very first
    // request after a server start, even minutes after the row had genuinely changed — confirmed
    // via a direct REST call to Supabase showing the fresh value). Forcing `cache: "no-store"` on
    // every request this client makes, at the client level rather than trusting route-level
    // config, is what actually and reliably fixed it.
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
  return client;
}
