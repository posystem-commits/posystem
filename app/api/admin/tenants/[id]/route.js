import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// See app/api/pos/[tenantId]/status/route.js for why every route reading live data opts out of
// Next's default fetch caching this way.
export const dynamic = "force-dynamic";

const EDITABLE_FIELDS = [
  "restaurant_name",
  "contact_name",
  "contact_email",
  "contact_phone",
  "status",
  "paid_until",
  "notes",
  "package",
];

// PATCH /admin/tenants/:id — edit info, toggle active/paused, update paid_until.
export async function PATCH(req, { params }) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  if (body.status && !["active", "paused"].includes(body.status)) {
    return NextResponse.json({ error: "status must be 'active' or 'paused'" }, { status: 400 });
  }
  if (body.package && !["basic", "standard", "premium"].includes(body.package)) {
    return NextResponse.json({ error: "package must be 'basic', 'standard', or 'premium'" }, { status: 400 });
  }
  if (body.paid_until && Number.isNaN(Date.parse(body.paid_until))) {
    return NextResponse.json({ error: "paid_until must be a valid date" }, { status: 400 });
  }

  const patch = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in body) patch[key] = body[key];
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from("tenants")
    .update(patch)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  return NextResponse.json({ tenant: data });
}

// DELETE /admin/tenants/:id — remove a customer. Deleting a tenant cascades to ALL of its POS
// data (tenant_pos_kv, tenant_activity_log), so two guards run first: the caller must send the
// restaurant's exact name as `confirmName`, and a full copy of the tenant's data must be written to
// tenant_backups and read back successfully. If either fails, nothing is deleted.
export async function DELETE(req, { params }) {
  const body = await req.json().catch(() => null);
  const db = supabaseAdmin();

  const { data: tenant, error: tenantErr } = await db.from("tenants").select("*").eq("id", params.id).maybeSingle();
  if (tenantErr) return NextResponse.json({ error: tenantErr.message }, { status: 500 });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  if (typeof body?.confirmName !== "string" || body.confirmName.trim() !== tenant.restaurant_name.trim()) {
    return NextResponse.json({ error: "Type the restaurant's exact name to confirm deletion." }, { status: 400 });
  }

  const kvRows = [];
  const PAGE = 500;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("tenant_pos_kv")
      .select("key, value, updated_at")
      .eq("tenant_id", params.id)
      .order("key")
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: `Backup failed, nothing was deleted: ${error.message}` }, { status: 500 });
    kvRows.push(...data);
    if (data.length < PAGE) break;
  }

  const { data: backup, error: backupErr } = await db
    .from("tenant_backups")
    .insert({
      tenant_id: tenant.id,
      restaurant_name: tenant.restaurant_name,
      tenant_row: tenant,
      kv_rows: kvRows,
      kv_row_count: kvRows.length,
    })
    .select("id")
    .single();
  if (backupErr || !backup) {
    return NextResponse.json({ error: `Backup failed, nothing was deleted: ${backupErr?.message || "no row returned"}` }, { status: 500 });
  }

  const { data: check, error: checkErr } = await db
    .from("tenant_backups")
    .select("kv_row_count, kv_rows")
    .eq("id", backup.id)
    .single();
  if (checkErr || !check || check.kv_row_count !== kvRows.length || !Array.isArray(check.kv_rows) || check.kv_rows.length !== kvRows.length) {
    return NextResponse.json({ error: "Backup could not be verified, nothing was deleted." }, { status: 500 });
  }

  const { error } = await db.from("tenants").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, backupId: backup.id, backedUpRows: kvRows.length });
}
