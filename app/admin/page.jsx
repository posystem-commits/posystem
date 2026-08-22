"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminNav from "@/components/AdminNav";

function statusBadge(tenant) {
  if (tenant.status === "paused") return { text: "Paused", bg: "#EFE4CB", fg: "#8A6A2E" };
  if (tenant.days_remaining < 0) return { text: "Expired", bg: "#F3DAD6", fg: "#A6534A" };
  if (tenant.days_remaining <= 3) return { text: `${tenant.days_remaining}d left`, bg: "#F3DAD6", fg: "#A6534A" };
  if (tenant.days_remaining <= 7) return { text: `${tenant.days_remaining}d left`, bg: "#EFE4CB", fg: "#8A6A2E" };
  return { text: "Active", bg: "#DCEAD8", fg: "#3D6B3D" };
}

// The POS terminal route (app/t/[tenantId]/page.jsx) works for any tenant id already in the
// database — there's no separate "provisioning" step, so a restaurant's terminal exists the
// instant they're added below. This just builds the shareable link to it.
function posLink(tenantId) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/t/${tenantId}`;
}

const emptyForm = { restaurant_name: "", contact_name: "", contact_email: "", contact_phone: "", paid_until: "", notes: "" };

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState(null);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [justAdded, setJustAdded] = useState(null); // the tenant object just created, shown in a banner with its link

  const load = async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/tenants");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setTenants(data.tenants);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleStatus = async (tenant) => {
    const nextStatus = tenant.status === "active" ? "paused" : "active";
    setTenants((prev) => prev.map((t) => (t.id === tenant.id ? { ...t, status: nextStatus } : t)));
    const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!res.ok) load(); // revert to server truth on failure
  };

  const copyLink = async (tenantId) => {
    try {
      await navigator.clipboard.writeText(posLink(tenantId));
      setCopiedId(tenantId);
      setTimeout(() => setCopiedId((id) => (id === tenantId ? null : id)), 2000);
    } catch (e) {
      // clipboard API can be blocked (permissions, non-HTTPS); the link is still visible to
      // select and copy manually in the just-added banner / tenant detail page
    }
  };

  const addTenant = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add customer");
      setForm(emptyForm);
      setShowAdd(false);
      setJustAdded(data.tenant);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <AdminNav />
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Customers</h1>
          <button
            onClick={() => setShowAdd((v) => !v)}
            style={{ padding: "9px 16px", borderRadius: 7, border: "none", background: "#7C2D3B", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            {showAdd ? "Cancel" : "+ Add customer"}
          </button>
        </div>

        {error && <div style={{ fontSize: 13, color: "#A6534A", marginBottom: 16 }}>{error}</div>}

        {justAdded && (
          <div style={{ background: "#DCEAD8", border: "1px solid #B9D6B4", borderRadius: 10, padding: "16px 18px", marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "#2F4A2F" }}>
                {justAdded.restaurant_name} added — their POS terminal is ready.
              </div>
              <button onClick={() => setJustAdded(null)} style={{ background: "none", border: "none", color: "#2F4A2F", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
            </div>
            <div style={{ fontSize: 12, color: "#3D5A3D", marginTop: 4, marginBottom: 10 }}>
              Send them this link to bookmark on their POS device (staff still clock in with their own name + PIN once they open it):
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <code style={{ background: "#fff", border: "1px solid #B9D6B4", borderRadius: 6, padding: "7px 10px", fontSize: 12, flex: 1, minWidth: 200, wordBreak: "break-all" }}>
                {posLink(justAdded.id)}
              </code>
              <button onClick={() => copyLink(justAdded.id)} style={{ padding: "7px 12px", borderRadius: 6, border: "none", background: "#3D6B3D", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {copiedId === justAdded.id ? "Copied!" : "Copy link"}
              </button>
              <a href={posLink(justAdded.id)} target="_blank" rel="noopener noreferrer" style={{ padding: "7px 12px", borderRadius: 6, border: "1px solid #3D6B3D", color: "#3D6B3D", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                Open
              </a>
            </div>
          </div>
        )}

        {showAdd && (
          <form onSubmit={addTenant} style={{ background: "#fff", border: "1px solid #DCD5C4", borderRadius: 10, padding: 20, marginBottom: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <input required placeholder="Restaurant name" value={form.restaurant_name} onChange={(e) => setForm((f) => ({ ...f, restaurant_name: e.target.value }))} style={inputStyle} />
            <input required type="date" placeholder="Paid until" value={form.paid_until} onChange={(e) => setForm((f) => ({ ...f, paid_until: e.target.value }))} style={inputStyle} />
            <input placeholder="Contact name" value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} style={inputStyle} />
            <input placeholder="Contact email" type="email" value={form.contact_email} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))} style={inputStyle} />
            <input placeholder="Contact phone" value={form.contact_phone} onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))} style={inputStyle} />
            <input placeholder="Notes (e.g. payment history)" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} style={inputStyle} />
            <button type="submit" disabled={saving} style={{ gridColumn: "1 / -1", padding: "10px 0", borderRadius: 7, border: "none", background: "#7C2D3B", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Adding…" : "Add customer"}
            </button>
          </form>
        )}

        {tenants === null ? (
          <div style={{ fontSize: 13, color: "#6B685F" }}>Loading…</div>
        ) : tenants.length === 0 ? (
          <div style={{ fontSize: 13, color: "#6B685F" }}>No customers yet — add your first one above.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tenants.map((tenant) => {
              const badge = statusBadge(tenant);
              return (
                <div key={tenant.id} style={{ background: "#fff", border: "1px solid #DCD5C4", borderRadius: 10, padding: "14px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <Link href={`/admin/tenants/${tenant.id}`} style={{ fontSize: 14.5, fontWeight: 600, color: "#20242B", textDecoration: "none" }}>
                        {tenant.restaurant_name}
                      </Link>
                      <div style={{ fontSize: 12, color: "#6B685F", marginTop: 3 }}>
                        {tenant.contact_name || tenant.contact_email || tenant.contact_phone || "No contact on file"}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: badge.bg, color: badge.fg }}>{badge.text}</span>
                      <span style={{ fontSize: 12.5, color: "#6B685F", fontFamily: "monospace" }}>paid until {tenant.paid_until}</span>
                      <button
                        onClick={() => toggleStatus(tenant)}
                        style={{ fontSize: 12, padding: "6px 12px", borderRadius: 6, border: "1px solid #DCD5C4", background: "transparent", cursor: "pointer" }}
                      >
                        {tenant.status === "active" ? "Pause" : "Activate"}
                      </button>
                      <Link href={`/admin/tenants/${tenant.id}`} style={{ fontSize: 12, color: "#7C2D3B" }}>
                        Edit
                      </Link>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, paddingTop: 10, borderTop: "1px solid #F0EDE4", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "#8A8580", textTransform: "uppercase", letterSpacing: 0.4 }}>POS link</span>
                    <code style={{ fontSize: 11.5, color: "#6B685F", flex: 1, minWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{posLink(tenant.id)}</code>
                    <button onClick={() => copyLink(tenant.id)} style={{ fontSize: 11.5, padding: "5px 10px", borderRadius: 6, border: "1px solid #DCD5C4", background: "transparent", cursor: "pointer", flexShrink: 0 }}>
                      {copiedId === tenant.id ? "Copied!" : "Copy"}
                    </button>
                    <a href={posLink(tenant.id)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, padding: "5px 10px", borderRadius: 6, border: "1px solid #7C2D3B", color: "#7C2D3B", textDecoration: "none", flexShrink: 0 }}>
                      Open
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = { padding: "9px 12px", border: "1px solid #DCD5C4", borderRadius: 7, fontSize: 13.5 };
