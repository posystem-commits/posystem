"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import { Avatar, Badge, Button, Card, Field, Notice, Segmented, Skeleton } from "@/components/admin/ui";

// The POS terminal route (app/t/[tenantId]/page.jsx) works for any tenant id already in the
// database — no separate provisioning step, so this link is live the instant the tenant exists.
function posLink(tenantId) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/t/${tenantId}`;
}

function statusOf(tenant) {
  if (tenant.status === "paused") return { text: "Paused", tone: "warn" };
  const days = Math.round((new Date(`${tenant.paid_until}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (days < 0) return { text: "Expired", tone: "bad", days };
  if (days <= 7) return { text: `${days}d left`, tone: days <= 3 ? "bad" : "warn", days };
  return { text: "Active", tone: "good", days };
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
    const typed = window.prompt(
      `This permanently removes ${tenant.restaurant_name} and ALL of its menu, orders, expenses and customers from the live system (a backup copy is saved first).\n\nType the restaurant's exact name to confirm:`
    );
    if (typed === null) return;
    if (typed.trim() !== tenant.restaurant_name.trim()) {
      window.alert("That doesn't match the restaurant's name — nothing was deleted.");
      return;
    }
    const res = await fetch(`/api/admin/tenants/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmName: typed }),
    });
    if (res.ok) {
      router.push("/admin");
    } else {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error || "Couldn't remove the restaurant — nothing was deleted.");
    }
  };

  if (!tenant) {
    return (
      <AdminShell eyebrow="Customer" title={error ? "Customer not found" : "Loading…"} narrow>
        {error ? (
          <>
            <Notice tone="bad" style={{ marginBottom: 16 }}>{error}</Notice>
            <Button as={Link} variant="ghost" href="/admin">Back to customers</Button>
          </>
        ) : (
          <Skeleton rows={3} height={110} />
        )}
      </AdminShell>
    );
  }

  const status = statusOf(tenant);
  return (
    <AdminShell
      eyebrow={<Link href="/admin" style={{ textDecoration: "none", color: "inherit" }}>← Customers</Link>}
      title={tenant.restaurant_name}
      subtitle={tenant.live_name && tenant.live_name !== tenant.restaurant_name ? `Shown on their terminal as “${tenant.live_name}”.` : undefined}
      actions={
        <>
          <Badge tone={status.tone}>{status.text}</Badge>
          <Button variant="ghost" icon="external" as="a" href={posLink(id)} target="_blank" rel="noopener noreferrer">Open terminal</Button>
        </>
      }
    >
      <div className="ad-split">
        <div className="ad-stack">
          <Card>
            <h2 className="ad-card-title">Restaurant</h2>
            <p className="ad-card-sub">How you know them. The name here is your own record — their terminal has its own name in Settings.</p>
            <Field label="Restaurant name">
              <input className="ad-input" value={tenant.restaurant_name || ""} onChange={(e) => update("restaurant_name", e.target.value)} />
            </Field>
            <div className="ad-form-grid">
              <Field label="Contact name"><input className="ad-input" value={tenant.contact_name || ""} onChange={(e) => update("contact_name", e.target.value)} /></Field>
              <Field label="Contact phone"><input className="ad-input" value={tenant.contact_phone || ""} onChange={(e) => update("contact_phone", e.target.value)} /></Field>
            </div>
            <Field label="Contact email" hint="Just for your own records — the 7/3/1-day renewal notice shows up in their POS terminal, not by email.">
              <input className="ad-input" type="email" value={tenant.contact_email || ""} onChange={(e) => update("contact_email", e.target.value)} />
            </Field>
          </Card>

          <Card>
            <h2 className="ad-card-title">Subscription</h2>
            <p className="ad-card-sub">Pausing, or letting the paid-until date pass, locks their terminal within seconds.</p>
            <div className="ad-form-grid">
              <Field label="Status">
                <Segmented options={[{ key: "active", label: "Active" }, { key: "paused", label: "Paused" }]} value={tenant.status} onChange={(v) => update("status", v)} />
              </Field>
              <Field label="Paid until">
                <input className="ad-input" type="date" value={tenant.paid_until || ""} onChange={(e) => update("paid_until", e.target.value)} />
              </Field>
            </div>
            <div style={{ marginTop: -6, marginBottom: 18 }}>
              <Button variant="quiet" size="sm" icon="plus" onClick={extend30Days}>Extend 30 days</Button>
              <span className="ad-hint" style={{ marginLeft: 6 }}>from today, or from the current date if it is later</span>
            </div>
            <Field label="Package" hint="Controls which features show up in their POS terminal — define what's in each package under Packages.">
              <Segmented options={[{ key: "basic", label: "basic" }, { key: "standard", label: "standard" }, { key: "premium", label: "premium" }]} value={tenant.package} onChange={(v) => update("package", v)} />
            </Field>
          </Card>

          <Card>
            <h2 className="ad-card-title">Notes</h2>
            <p className="ad-card-sub">Payment history or anything worth remembering.</p>
            <textarea className="ad-textarea" value={tenant.notes || ""} onChange={(e) => update("notes", e.target.value)} placeholder="e.g. 500 EGP cash, Aug 19, covers Sept" />
          </Card>

          {error && <Notice tone="bad">{error}</Notice>}

          <div className="ad-savebar" style={{ borderTop: "none", paddingTop: 0 }}>
            <span className="ad-hint" style={{ margin: 0 }}>Changes are saved when you press Save.</span>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : savedFlash ? "Saved ✓" : "Save changes"}</Button>
          </div>
        </div>

        <div className="ad-stack">
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              <Avatar name={tenant.restaurant_name} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{tenant.restaurant_name}</div>
                <div className="ad-row-meta">{(tenant.package || "basic").replace(/^./, (c) => c.toUpperCase())} package</div>
              </div>
            </div>
            <div className="ad-kv"><span>Status</span><span><Badge tone={status.tone}>{status.text}</Badge></span></div>
            <div className="ad-kv"><span>Paid until</span><span>{tenant.paid_until || "—"}</span></div>
            <div className="ad-kv"><span>Customer since</span><span>{tenant.created_at ? tenant.created_at.slice(0, 10) : "—"}</span></div>
          </Card>

          <Card>
            <h2 className="ad-card-title" style={{ fontSize: 15 }}>POS terminal link</h2>
            <p className="ad-card-sub" style={{ marginBottom: 12 }}>Staff bookmark this on their devices.</p>
            <code className="ad-code" style={{ marginBottom: 12 }}>{posLink(id)}</code>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="ghost" size="sm" icon="copy" onClick={copyLink}>{linkCopied ? "Copied" : "Copy"}</Button>
              <Button as="a" variant="ghost" size="sm" icon="external" href={posLink(id)} target="_blank" rel="noopener noreferrer">Open</Button>
            </div>
          </Card>

          <Card>
            <h2 className="ad-card-title" style={{ fontSize: 15, color: "var(--ad-red)" }}>Danger zone</h2>
            <p className="ad-card-sub" style={{ marginBottom: 12 }}>Removing a customer deletes all of their data. A backup copy is saved first.</p>
            <Button variant="danger" size="sm" onClick={remove}>Remove customer</Button>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
