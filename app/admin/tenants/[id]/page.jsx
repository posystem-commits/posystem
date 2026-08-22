"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import { COLORS, FONT_SERIF, RADIUS, SHADOW } from "@/lib/theme";

const inputStyle = { width: "100%", boxSizing: "border-box", padding: "10px 12px", border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.sm, fontSize: 13.5, fontFamily: "inherit" };
const labelStyle = { display: "block", fontSize: 11.5, color: COLORS.charcoalSoft, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 500 };

// The POS terminal route (app/t/[tenantId]/page.jsx) works for any tenant id already in the
// database — no separate provisioning step, so this link is live the instant the tenant exists.
function posLink(tenantId) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/t/${tenantId}`;
}

function SegmentedControl({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {options.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          style={{
            flex: 1,
            padding: "9px 0",
            borderRadius: RADIUS.sm,
            border: `1px solid ${value === key ? COLORS.burgundy : COLORS.line}`,
            background: value === key ? COLORS.burgundy : "transparent",
            color: value === key ? "#fff" : COLORS.ink,
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            textTransform: "capitalize",
            transition: "background 0.15s ease, border-color 0.15s ease",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function TenantDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [tenant, setTenant] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/tenants");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load");
        return;
      }
      const found = data.tenants.find((t) => t.id === id);
      if (!found) {
        setError("Tenant not found");
        return;
      }
      setTenant(found);
    })();
  }, [id]);

  const update = (field, value) => setTenant((t) => ({ ...t, [field]: value }));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_name: tenant.restaurant_name,
          contact_name: tenant.contact_name,
          contact_email: tenant.contact_email,
          contact_phone: tenant.contact_phone,
          status: tenant.status,
          paid_until: tenant.paid_until,
          notes: tenant.notes,
          package: tenant.package,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const extend30Days = () => {
    // Extends from whichever is later: today, or their current paid_until — so topping up early
    // adds to the remaining balance instead of resetting it.
    const base = tenant.paid_until && tenant.paid_until > new Date().toISOString().slice(0, 10) ? new Date(`${tenant.paid_until}T00:00:00`) : new Date();
    base.setDate(base.getDate() + 30);
    update("paid_until", base.toISOString().slice(0, 10));
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(posLink(id));
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (e) {
      // clipboard API can be blocked — the link is still visible to select and copy manually
    }
  };

  const remove = async () => {
    if (!confirm(`Remove ${tenant.restaurant_name}? This can't be undone.`)) return;
    const res = await fetch(`/api/admin/tenants/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin");
  };

  if (error) {
    return (
      <div>
        <AdminNav />
        <div style={{ maxWidth: 640, margin: "40px auto", padding: "0 24px", fontSize: 13, color: COLORS.red }}>{error}</div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div>
        <AdminNav />
        <div style={{ maxWidth: 640, margin: "40px auto", padding: "0 24px", fontSize: 13, color: COLORS.charcoalSoft }}>Loading…</div>
      </div>
    );
  }

  return (
    <div>
      <AdminNav />
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ fontFamily: FONT_SERIF, fontSize: 22, fontWeight: 600, marginTop: 0, marginBottom: 14, color: COLORS.ink }}>{tenant.restaurant_name}</h1>

        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.lg, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "#8A8580", textTransform: "uppercase", letterSpacing: 0.4 }}>POS link</span>
          <code style={{ fontSize: 12, color: "#4A4A45", flex: 1, minWidth: 200, wordBreak: "break-all" }}>{posLink(id)}</code>
          <button onClick={copyLink} style={{ fontSize: 12, padding: "6px 12px", borderRadius: RADIUS.sm, border: `1px solid ${COLORS.line}`, background: "transparent", cursor: "pointer", flexShrink: 0, color: COLORS.ink }}>
            {linkCopied ? "Copied!" : "Copy"}
          </button>
          <a href={posLink(id)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, padding: "6px 12px", borderRadius: RADIUS.sm, border: `1px solid ${COLORS.burgundy}`, color: COLORS.burgundy, textDecoration: "none", flexShrink: 0 }}>
            Open POS terminal
          </a>
        </div>

        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.lg, padding: 24, display: "flex", flexDirection: "column", gap: 18, boxShadow: SHADOW.card }}>
          <div>
            <label style={labelStyle}>Restaurant name</label>
            <input style={inputStyle} value={tenant.restaurant_name || ""} onChange={(e) => update("restaurant_name", e.target.value)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Contact name</label>
              <input style={inputStyle} value={tenant.contact_name || ""} onChange={(e) => update("contact_name", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Contact phone</label>
              <input style={inputStyle} value={tenant.contact_phone || ""} onChange={(e) => update("contact_phone", e.target.value)} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Contact email</label>
            <input style={inputStyle} type="email" value={tenant.contact_email || ""} onChange={(e) => update("contact_email", e.target.value)} />
            <div style={{ fontSize: 11, color: "#8A8580", marginTop: 5 }}>Just for your own records — the 7/3/1-day renewal notice shows up in their POS terminal, not by email.</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Status</label>
              <SegmentedControl
                options={[{ key: "active", label: "Active" }, { key: "paused", label: "Paused" }]}
                value={tenant.status}
                onChange={(v) => update("status", v)}
              />
            </div>
            <div>
              <label style={labelStyle}>Paid until</label>
              <input style={inputStyle} type="date" value={tenant.paid_until || ""} onChange={(e) => update("paid_until", e.target.value)} />
            </div>
          </div>
          <button onClick={extend30Days} style={{ alignSelf: "flex-start", fontSize: 12, color: COLORS.burgundy, fontWeight: 500, background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: -10 }}>
            + Extend 30 days from today (or from current paid-until, if later)
          </button>

          <div>
            <label style={labelStyle}>Package</label>
            <SegmentedControl
              options={[{ key: "basic", label: "basic" }, { key: "standard", label: "standard" }, { key: "premium", label: "premium" }]}
              value={tenant.package}
              onChange={(v) => update("package", v)}
            />
            <div style={{ fontSize: 11, color: "#8A8580", marginTop: 5 }}>
              Controls which features show up in their POS terminal — define what's in each package under Packages.
            </div>
          </div>

          <div>
            <label style={labelStyle}>Notes / payment history</label>
            <textarea
              style={{ ...inputStyle, minHeight: 80, fontFamily: "inherit", resize: "vertical" }}
              value={tenant.notes || ""}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="e.g. 500 EGP cash, Aug 19, covers Sept"
            />
          </div>

          {error && <div style={{ fontSize: 13, color: COLORS.red }}>{error}</div>}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, paddingTop: 14, borderTop: `1px solid ${COLORS.lineSoft}` }}>
            <button onClick={remove} style={{ fontSize: 12.5, color: COLORS.red, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              Remove customer
            </button>
            <button
              onClick={save}
              disabled={saving}
              style={{ padding: "10px 20px", borderRadius: RADIUS.sm, border: "none", background: COLORS.burgundy, color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "Saving…" : savedFlash ? "Saved ✓" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
