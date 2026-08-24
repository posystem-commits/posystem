import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 30;
const THRESHOLD = 2; // flag a (tenant, edit type) pair once ITS OWN count in the window exceeds this

const EVENT_LABELS = {
  restaurant_name_changed: "Restaurant name changed",
  logo_changed: "Logo changed",
  menu_scanned: "Menu scanned",
};

// GET /api/admin/activity — restaurants that made more than THRESHOLD of the SAME "major" terminal
// edit (restaurant name change, logo change, or a menu scan — see
// app/api/pos/[tenantId]/activity) within the last WINDOW_DAYS days. Each edit type is counted
// and flagged on its own — 3 logo changes flags, but 2 name changes + 2 logo changes does not,
// since neither individually crosses the threshold. Small expected volume (this is an anomaly
// signal, not a full audit log), so it's simplest to fetch the window and aggregate here rather
// than push the grouping into SQL.
export async function GET() {
  const since = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString();

  const { data: rows, error } = await supabaseAdmin()
    .from("tenant_activity_log")
    .select("tenant_id, event_type, detail, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by (tenant_id, event_type) — each group is judged against the threshold independently.
  const byGroup = {};
  for (const row of rows) {
    const key = `${row.tenant_id}::${row.event_type}`;
    if (!byGroup[key]) byGroup[key] = { tenant_id: row.tenant_id, event_type: row.event_type, rows: [] };
    byGroup[key].rows.push(row);
  }

  const flaggedGroups = Object.values(byGroup).filter((g) => g.rows.length > THRESHOLD);
  if (flaggedGroups.length === 0) return NextResponse.json({ flagged: [], windowDays: WINDOW_DAYS, threshold: THRESHOLD });

  const tenantIds = [...new Set(flaggedGroups.map((g) => g.tenant_id))];
  const { data: tenants, error: tenantsError } = await supabaseAdmin()
    .from("tenants")
    .select("id, restaurant_name")
    .in("id", tenantIds);

  if (tenantsError) return NextResponse.json({ error: tenantsError.message }, { status: 500 });
  const nameById = Object.fromEntries(tenants.map((t) => [t.id, t.restaurant_name]));

  // Re-group the flagged (tenant, event_type) groups back under their tenant for display, so a
  // restaurant that tripped the threshold on two different edit types shows as one card listing
  // both, rather than two separate cards for the same restaurant.
  const byTenant = {};
  flaggedGroups.forEach((g) => {
    if (!byTenant[g.tenant_id]) byTenant[g.tenant_id] = [];
    byTenant[g.tenant_id].push({
      type: g.event_type,
      label: EVENT_LABELS[g.event_type] || g.event_type,
      count: g.rows.length,
      events: g.rows.map((r) => ({ detail: r.detail, created_at: r.created_at })),
    });
  });

  const flagged = Object.keys(byTenant)
    .map((id) => ({
      tenant_id: id,
      restaurant_name: nameById[id] || "(deleted tenant)",
      flaggedTypes: byTenant[id].sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => Math.max(...b.flaggedTypes.map((f) => f.count)) - Math.max(...a.flaggedTypes.map((f) => f.count)));

  return NextResponse.json({ flagged, windowDays: WINDOW_DAYS, threshold: THRESHOLD });
}
