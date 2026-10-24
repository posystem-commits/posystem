"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/AdminShell";
import { Avatar, Badge, Button, Card, Empty, Field, Icon, Notice, Skeleton, Stat } from "@/components/admin/ui";

function statusBadge(tenant) {
  if (tenant.status === "paused") return { text: "Paused", tone: "warn" };
  if (tenant.days_remaining < 0) return { text: "Expired", tone: "bad" };
  if (tenant.days_remaining <= 3) return { text: `${tenant.days_remaining}d left`, tone: "bad" };
  if (tenant.days_remaining <= 7) return { text: `${tenant.days_remaining}d left`, tone: "warn" };
  return { text: "Active", tone: "good" };
}

// A tenant's group on the filter chips: paused or lapsed ones need attention first.
const needsAttention = (t) => t.status === "paused" || t.days_remaining < 0;
const expiringSoon = (t) => t.status === "active" && t.days_remaining >= 0 && t.days_remaining <= 7;

// The POS terminal route (app/t/[tenantId]/page.jsx) works for any tenant id already in the
// database — there's no separate "provisioning" step, so a restaurant's terminal exists the
// instant they're added below. This just builds the shareable link to it.
function posLink(tenantId) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/t/${tenantId}`;
}

const emptyForm = { restaurant_name: "", contact_name: "", contact_email: "", contact_phone: "", paid_until: "", notes: "", package: "basic" };

function TenantRow({ tenant, onToggleStatus, onCopyLink, copiedId }) {
  const badge = statusBadge(tenant);
  return (
    <div className="ad-card ad-row ad-fade">
      <Avatar name={tenant.restaurant_name} />
      <div className="ad-row-main">
        <Link href={`/admin/tenants/${tenant.id}`} className="ad-row-name">
          {tenant.restaurant_name}
        </Link>
        <div className="ad-row-meta">
          {tenant.live_name && tenant.live_name !== tenant.restaurant_name ? (
            <span style={{ color: "var(--ad-amber)" }}>Shown on their terminal as “{tenant.live_name}” · </span>
          ) : null}
          {tenant.contact_name || tenant.contact_email || tenant.contact_phone || "No contact on file"}
        </div>
      </div>
      <div className="ad-row-side">
        <Badge tone="brass" plain>{(tenant.package || "basic").replace(/^./, (c) => c.toUpperCase())}</Badge>
        <Badge tone={badge.tone}>{badge.text}</Badge>
        <span className="ad-date">until {tenant.paid_until}</span>
        <Button variant="ghost" size="sm" onClick={() => onToggleStatus(tenant)}>{tenant.status === "active" ? "Pause" : "Activate"}</Button>
        <Button variant="ghost" size="sm" icon={copiedId === tenant.id ? "check" : "copy"} className="icon-only" aria-label="Copy the POS link" title="Copy the POS link" onClick={() => onCopyLink(tenant.id)} />
        <Button as="a" variant="ghost" size="sm" icon="external" className="icon-only" aria-label="Open the POS terminal" title="Open the POS terminal" href={posLink(tenant.id)} target="_blank" rel="noopener noreferrer" />
        <Button as={Link} variant="quiet" size="sm" href={`/admin/tenants/${tenant.id}`}>Edit</Button>
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
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

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

  const counts = useMemo(() => {
    const list = tenants || [];
    return {
      total: list.length,
      active: list.filter((t) => t.status === "active" && t.days_remaining >= 0).length,
      soon: list.filter(expiringSoon).length,
      attention: list.filter(needsAttention).length,
    };
  }, [tenants]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (tenants || []).filter((t) => {
      if (filter === "active" && !(t.status === "active" && t.days_remaining >= 0)) return false;
      if (filter === "soon" && !expiringSoon(t)) return false;
      if (filter === "attention" && !needsAttention(t)) return false;
      if (!q) return true;
      return [t.restaurant_name, t.live_name, t.contact_name, t.contact_email, t.contact_phone].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [tenants, query, filter]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <AdminShell
      eyebrow="Overview"
      title="Customers"
      subtitle="Every restaurant running on your POS, with where their subscription stands."
      actions={<Button icon={showAdd ? undefined : "plus"} onClick={() => setShowAdd((v) => !v)}>{showAdd ? "Cancel" : "Add customer"}</Button>}
    >
      {error && <Notice tone="bad" style={{ marginBottom: 16 }}>{error}</Notice>}

      {justAdded && (
        <Notice tone="good" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <strong>{justAdded.restaurant_name} added — their POS terminal is ready.</strong>
            <button onClick={() => setJustAdded(null)} aria-label="Dismiss" style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
          </div>
          <div style={{ fontSize: 13, margin: "4px 0 12px", opacity: 0.85 }}>Send them this link to bookmark on their POS device (staff still clock in with their own name + PIN once they open it):</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <code className="ad-code" style={{ flex: 1, minWidth: 220, background: "rgba(255,255,255,0.7)" }}>{posLink(justAdded.id)}</code>
            <Button size="sm" icon="copy" onClick={() => copyLink(justAdded.id)}>{copiedId === justAdded.id ? "Copied" : "Copy link"}</Button>
            <Button as="a" variant="ghost" size="sm" icon="external" href={posLink(justAdded.id)} target="_blank" rel="noopener noreferrer">Open</Button>
          </div>
        </Notice>
      )}

      {showAdd && (
        <Card className="ad-fade" style={{ marginBottom: 22 }}>
          <h2 className="ad-card-title">New customer</h2>
          <p className="ad-card-sub">Their POS terminal is created the moment you add them.</p>
          <form onSubmit={addTenant}>
            <div className="ad-form-grid">
              <Field label="Restaurant name"><input required className="ad-input" value={form.restaurant_name} onChange={set("restaurant_name")} /></Field>
              <Field label="Paid until"><input required type="date" className="ad-input" value={form.paid_until} onChange={set("paid_until")} /></Field>
              <Field label="Contact name"><input className="ad-input" value={form.contact_name} onChange={set("contact_name")} /></Field>
              <Field label="Contact phone"><input className="ad-input" value={form.contact_phone} onChange={set("contact_phone")} /></Field>
              <Field label="Contact email"><input type="email" className="ad-input" value={form.contact_email} onChange={set("contact_email")} /></Field>
              <Field label="Package">
                <select className="ad-select" value={form.package} onChange={set("package")}>
                  <option value="basic">Basic</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                </select>
              </Field>
            </div>
            <Field label="Notes"><input className="ad-input" placeholder="e.g. payment history" value={form.notes} onChange={set("notes")} /></Field>
            <Button type="submit" disabled={saving}>{saving ? "Adding…" : "Add customer"}</Button>
          </form>
        </Card>
      )}

      <div className="ad-grid cols-4" style={{ marginBottom: 24 }}>
        <Stat label="Customers" value={tenants ? counts.total : "–"} />
        <Stat label="Active" value={tenants ? counts.active : "–"} tone="good" />
        <Stat label="Renew within 7 days" value={tenants ? counts.soon : "–"} tone={counts.soon ? "warn" : undefined} />
        <Stat label="Paused or expired" value={tenants ? counts.attention : "–"} tone={counts.attention ? "bad" : undefined} />
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <div className="ad-search">
          <Icon name="search" />
          <input className="ad-input" placeholder="Search by name, contact or phone" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="ad-chips">
          {[["all", "All", counts.total], ["active", "Active", counts.active], ["soon", "Renewing soon", counts.soon], ["attention", "Needs attention", counts.attention]].map(([key, label, n]) => (
            <button key={key} className={`ad-chip${filter === key ? " is-on" : ""}`} onClick={() => setFilter(key)}>
              {label}
              <b>{tenants ? n : ""}</b>
            </button>
          ))}
        </div>
      </div>

      {tenants === null ? (
        <Skeleton rows={4} />
      ) : tenants.length === 0 ? (
        <Empty icon="store">No customers yet — add your first one above.</Empty>
      ) : visible.length === 0 ? (
        <Empty icon="search">No customer matches that search.</Empty>
      ) : (
        <div className="ad-rows">
          {visible.map((tenant) => (
            <TenantRow key={tenant.id} tenant={tenant} onToggleStatus={toggleStatus} onCopyLink={copyLink} copiedId={copiedId} />
          ))}
        </div>
      )}
    </AdminShell>
  );
}
