"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminNav from "@/components/AdminNav";

const inputStyle = { width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #DCD5C4", borderRadius: 7, fontSize: 13.5 };
const labelStyle = { display: "block", fontSize: 11.5, color: "#6B685F", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 };

export default function TenantDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [tenant, setTenant] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

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

  const remove = async () => {
    if (!confirm(`Remove ${tenant.restaurant_name}? This can't be undone.`)) return;
    const res = await fetch(`/api/admin/tenants/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin");
  };

  if (error) {
    return (
      <div>
        <AdminNav />
        <div style={{ maxWidth: 640, margin: "40px auto", padding: "0 24px", fontSize: 13, color: "#A6534A" }}>{error}</div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div>
        <AdminNav />
        <div style={{ maxWidth: 640, margin: "40px auto", padding: "0 24px", fontSize: 13, color: "#6B685F" }}>Loading…</div>
      </div>
    );
  }

  return (
    <div>
      <AdminNav />
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "28px 24px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginTop: 0, marginBottom: 20 }}>{tenant.restaurant_name}</h1>

        <div style={{ background: "#fff", border: "1px solid #DCD5C4", borderRadius: 10, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
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
            <div style={{ fontSize: 11, color: "#8A8580", marginTop: 4 }}>Reminder emails go here — see /api/cron/reminders.</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Status</label>
              <div style={{ display: "flex", gap: 6 }}>
                {["active", "paused"].map((s) => (
                  <button
                    key={s}
                    onClick={() => update("status", s)}
                    style={{
                      flex: 1,
                      padding: "9px 0",
                      borderRadius: 7,
                      border: `1px solid ${tenant.status === s ? "#7C2D3B" : "#DCD5C4"}`,
                      background: tenant.status === s ? "#7C2D3B" : "transparent",
                      color: tenant.status === s ? "#fff" : "#4A4A45",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    {s === "active" ? "Active" : "Paused"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Paid until</label>
              <input style={inputStyle} type="date" value={tenant.paid_until || ""} onChange={(e) => update("paid_until", e.target.value)} />
            </div>
          </div>
          <button onClick={extend30Days} style={{ alignSelf: "flex-start", fontSize: 12, color: "#7C2D3B", background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: -8 }}>
            + Extend 30 days from today (or from current paid-until, if later)
          </button>

          <div>
            <label style={labelStyle}>Notes / payment history</label>
            <textarea
              style={{ ...inputStyle, minHeight: 80, fontFamily: "inherit", resize: "vertical" }}
              value={tenant.notes || ""}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="e.g. 500 EGP cash, Aug 19, covers Sept"
            />
          </div>

          {error && <div style={{ fontSize: 13, color: "#A6534A" }}>{error}</div>}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <button onClick={remove} style={{ fontSize: 12.5, color: "#A6534A", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              Remove customer
            </button>
            <button
              onClick={save}
              disabled={saving}
              style={{ padding: "10px 20px", borderRadius: 7, border: "none", background: "#7C2D3B", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "Saving…" : savedFlash ? "Saved ✓" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
