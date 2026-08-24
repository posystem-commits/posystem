"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminNav from "@/components/AdminNav";
import { COLORS, FONT_SERIF, RADIUS, SHADOW } from "@/lib/theme";

function statusBadge(tenant) {
  if (tenant.status === "paused") return { text: "Paused", bg: COLORS.amberLight, fg: COLORS.amber };
  if (tenant.days_remaining < 0) return { text: "Expired", bg: COLORS.redLight, fg: COLORS.red };
  if (tenant.days_remaining <= 3) return { text: `${tenant.days_remaining}d left`, bg: COLORS.redLight, fg: COLORS.red };
  if (tenant.days_remaining <= 7) return { text: `${tenant.days_remaining}d left`, bg: COLORS.amberLight, fg: COLORS.amber };
  return { text: "Active", bg: COLORS.sageLight, fg: COLORS.sage };
}

// The POS terminal route (app/t/[tenantId]/page.jsx) works for any tenant id already in the
// database — there's no separate "provisioning" step, so a restaurant's terminal exists the
// instant they're added below. This just builds the shareable link to it.
function posLink(tenantId) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/t/${tenantId}`;
}

const emptyForm = { restaurant_name: "", contact_name: "", contact_email: "", contact_phone: "", paid_until: "", notes: "", package: "basic" };

function PrimaryButton({ children, onClick, type = "button", disabled, style }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "9px 18px",
        borderRadius: RADIUS.sm,
        border: "none",
        background: disabled ? COLORS.burgundy : hover ? COLORS.burgundyDark : COLORS.burgundy,
        color: "#fff",
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.7 : 1,
        transition: "background 0.15s ease",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function TenantRow({ tenant, onToggleStatus, onCopyLink, copiedId }) {
  const [hover, setHover] = useState(false);
  const badge = statusBadge(tenant);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.line}`,
        borderRadius: RADIUS.lg,
        padding: "14px 18px",
        boxShadow: hover ? SHADOW.card : "none",
        transition: "box-shadow 0.15s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <Link href={`/admin/tenants/${tenant.id}`} style={{ fontSize: 14.5, fontWeight: 600, color: COLORS.ink, textDecoration: "none" }}>
            {tenant.restaurant_name}
          </Link>
          {tenant.live_name && (
            <div style={{ fontSize: 11.5, color: tenant.live_name !== tenant.restaurant_name ? COLORS.amber : COLORS.charcoalSoft, marginTop: 3 }}>
              On their terminal: <strong>{tenant.live_name}</strong>
            </div>
          )}
          <div style={{ fontSize: 12, color: COLORS.charcoalSoft, marginTop: 3 }}>
            {tenant.contact_name || tenant.contact_email || tenant.contact_phone || "No contact on file"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: RADIUS.pill, background: COLORS.clayLight, color: COLORS.clay, textTransform: "capitalize" }}>{tenant.package || "basic"}</span>
          <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: RADIUS.pill, background: badge.bg, color: badge.fg }}>{badge.text}</span>
          <span style={{ fontSize: 12.5, color: COLORS.charcoalSoft, fontFamily: "monospace" }}>paid until {tenant.paid_until}</span>
          <button
            onClick={() => onToggleStatus(tenant)}
            style={{ fontSize: 12, padding: "6px 12px", borderRadius: RADIUS.sm, border: `1px solid ${COLORS.line}`, background: "transparent", cursor: "pointer", color: COLORS.ink }}
          >
            {tenant.status === "active" ? "Pause" : "Activate"}
          </button>
          <Link href={`/admin/tenants/${tenant.id}`} style={{ fontSize: 12, color: COLORS.burgundy, fontWeight: 500, textDecoration: "none" }}>
            Edit
          </Link>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${COLORS.lineSoft}`, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "#8A8580", textTransform: "uppercase", letterSpacing: 0.4 }}>POS link</span>
        <code style={{ fontSize: 11.5, color: COLORS.charcoalSoft, flex: 1, minWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{posLink(tenant.id)}</code>
        <button onClick={() => onCopyLink(tenant.id)} style={{ fontSize: 11.5, padding: "5px 10px", borderRadius: RADIUS.sm, border: `1px solid ${COLORS.line}`, background: "transparent", cursor: "pointer", flexShrink: 0, color: COLORS.ink }}>
          {copiedId === tenant.id ? "Copied!" : "Copy"}
        </button>
        <a href={posLink(tenant.id)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, padding: "5px 10px", borderRadius: RADIUS.sm, border: `1px solid ${COLORS.burgundy}`, color: COLORS.burgundy, textDecoration: "none", flexShrink: 0 }}>
          Open
        </a>
      </div>
    </div>
  );
}

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
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ fontFamily: FONT_SERIF, fontSize: 23, fontWeight: 600, margin: 0, color: COLORS.ink }}>Customers</h1>
          <PrimaryButton onClick={() => setShowAdd((v) => !v)}>{showAdd ? "Cancel" : "+ Add customer"}</PrimaryButton>
        </div>

        {error && <div style={{ fontSize: 13, color: COLORS.red, marginBottom: 16 }}>{error}</div>}

        {justAdded && (
          <div style={{ background: COLORS.sageLight, border: `1px solid ${COLORS.sageLine}`, borderRadius: RADIUS.lg, padding: "16px 18px", marginBottom: 24 }}>
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
              <code style={{ background: "#fff", border: `1px solid ${COLORS.sageLine}`, borderRadius: RADIUS.sm, padding: "7px 10px", fontSize: 12, flex: 1, minWidth: 200, wordBreak: "break-all" }}>
                {posLink(justAdded.id)}
              </code>
              <button onClick={() => copyLink(justAdded.id)} style={{ padding: "7px 12px", borderRadius: RADIUS.sm, border: "none", background: COLORS.sage, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {copiedId === justAdded.id ? "Copied!" : "Copy link"}
              </button>
              <a href={posLink(justAdded.id)} target="_blank" rel="noopener noreferrer" style={{ padding: "7px 12px", borderRadius: RADIUS.sm, border: `1px solid ${COLORS.sage}`, color: COLORS.sage, fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                Open
              </a>
            </div>
          </div>
        )}

        {showAdd && (
          <form onSubmit={addTenant} style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.lg, padding: 20, marginBottom: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, boxShadow: SHADOW.card }}>
            <input required placeholder="Restaurant name" value={form.restaurant_name} onChange={(e) => setForm((f) => ({ ...f, restaurant_name: e.target.value }))} style={inputStyle} />
            <input required type="date" placeholder="Paid until" value={form.paid_until} onChange={(e) => setForm((f) => ({ ...f, paid_until: e.target.value }))} style={inputStyle} />
            <input placeholder="Contact name" value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} style={inputStyle} />
            <input placeholder="Contact email" type="email" value={form.contact_email} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))} style={inputStyle} />
            <input placeholder="Contact phone" value={form.contact_phone} onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))} style={inputStyle} />
            <input placeholder="Notes (e.g. payment history)" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} style={inputStyle} />
            <select value={form.package} onChange={(e) => setForm((f) => ({ ...f, package: e.target.value }))} style={inputStyle}>
              <option value="basic">Basic</option>
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
            </select>
            <PrimaryButton type="submit" disabled={saving} style={{ gridColumn: "1 / -1", padding: "10px 0" }}>
              {saving ? "Adding…" : "Add customer"}
            </PrimaryButton>
          </form>
        )}

        {tenants === null ? (
          <div style={{ fontSize: 13, color: COLORS.charcoalSoft }}>Loading…</div>
        ) : tenants.length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.charcoalSoft, background: COLORS.card, border: `1px dashed ${COLORS.line}`, borderRadius: RADIUS.lg, padding: 24, textAlign: "center" }}>
            No customers yet — add your first one above.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {tenants.map((tenant) => (
              <TenantRow key={tenant.id} tenant={tenant} onToggleStatus={toggleStatus} onCopyLink={copyLink} copiedId={copiedId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = { padding: "9px 12px", border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.sm, fontSize: 13.5, fontFamily: "inherit" };
