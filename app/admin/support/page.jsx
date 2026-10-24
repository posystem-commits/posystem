"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import { Badge, Button, Card, Empty, Field, Notice, Skeleton, Stat } from "@/components/admin/ui";

const SETUP_SQL = `create table if not exists support_settings (
  id          integer primary key default 1 check (id = 1),
  pin_hash    text,
  updated_at  timestamptz not null default now()
);

create table if not exists support_access_log (
  id          bigint generated always as identity primary key,
  tenant_id   uuid not null,
  outcome     text not null check (outcome in ('ok', 'fail', 'locked', 'exit')),
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists support_access_log_created_idx on support_access_log (created_at desc);
create index if not exists support_access_log_ip_idx on support_access_log (ip, created_at desc);

alter table support_settings enable row level security;
alter table support_access_log enable row level security;`;

const OUTCOME = {
  ok: { text: "Signed in", tone: "good" },
  fail: { text: "Wrong code", tone: "bad" },
  locked: { text: "Locked out", tone: "warn" },
  exit: { text: "Signed out", tone: "neutral" },
};

const deviceOf = (ua) => {
  const u = ua || "";
  const os = /iPhone|iPad/.test(u) ? "iOS" : /Android/.test(u) ? "Android" : /Windows/.test(u) ? "Windows" : /Mac OS X/.test(u) ? "Mac" : /Linux/.test(u) ? "Linux" : "";
  const browser = /Edg\//.test(u) ? "Edge" : /Chrome\//.test(u) ? "Chrome" : /Firefox\//.test(u) ? "Firefox" : /Safari\//.test(u) ? "Safari" : "";
  return [browser, os].filter(Boolean).join(" · ") || "—";
};

export default function SupportAccessPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/support");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setData(json);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const flash = (text) => {
    setToast(text);
    setTimeout(() => setToast(""), 3500);
  };

  const call = async (method, body, okText) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/support", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.ok === false) throw new Error(json.error || "That didn't work");
      if (okText) flash(okText);
      return json;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const savePin = async (e) => {
    e.preventDefault();
    const done = await call("PUT", { pin, password }, "Support code saved");
    if (done) {
      setPin("");
      setPassword("");
      load();
    }
  };
  const switchOff = async () => {
    if (!password) return setError("Type your admin password below first, then switch the code off.");
    const done = await call("DELETE", { password }, "Support code switched off");
    if (done) {
      setPassword("");
      load();
    }
  };

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(SETUP_SQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // select-and-copy by hand still works
    }
  };

  return (
    <AdminShell
      eyebrow="Maintenance"
      title="Support access"
      subtitle="A hidden sign-in on every restaurant's terminal that lets you in as a manager — to check numbers or fix something — without clocking in. Protected by a 4-digit code you set here. Every attempt is recorded below."
      narrow
    >
      {error && <Notice tone="bad" style={{ marginBottom: 16 }}>{error}</Notice>}

      {!data ? (
        <Skeleton rows={3} height={110} />
      ) : (
        <div className="ad-stack" style={{ gap: 18 }}>
          {data.setupNeeded && (
            <Card>
              <h2 className="ad-card-title">One-time setup</h2>
              <p className="ad-card-sub">Open your Supabase project → SQL editor → paste this → Run. It only adds two small tables and does not touch any customer data. Then press “Check again”.</p>
              <pre className="ad-code ad-mono" style={{ whiteSpace: "pre-wrap", margin: "0 0 14px", maxHeight: 260, overflow: "auto" }}>{SETUP_SQL}</pre>
              <div style={{ display: "flex", gap: 10 }}>
                <Button variant="ghost" icon="copy" onClick={copySql}>{copied ? "Copied" : "Copy SQL"}</Button>
                <Button onClick={load}>Check again</Button>
              </div>
            </Card>
          )}

          <div className="ad-grid cols-2">
            <Stat label="Support code" value={data.setupNeeded ? "–" : data.pinSet ? "On" : "Off"} tone={data.pinSet ? "good" : undefined} />
            <Stat label="Wrong codes, 24 h" value={data.setupNeeded ? "–" : data.failuresLast24h} tone={data.failuresLast24h ? "bad" : undefined} />
          </div>

          {!data.setupNeeded && (
            <Card>
              <h2 className="ad-card-title">{data.pinSet ? "Change the support code" : "Set the support code"}</h2>
              <p className="ad-card-sub">
                On any terminal's sign-in screen, tap the restaurant name 7 times quickly, then enter this code. It opens that restaurant for 30 minutes.
                {data.pinUpdatedAt ? ` Last changed ${new Date(data.pinUpdatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.` : ""}
              </p>
              <form onSubmit={savePin} autoComplete="off">
                <div className="ad-form-grid">
                  <Field label="New 4-digit code" hint="Not 1234, 0000 or a straight run.">
                    <input className="ad-input ad-mono" inputMode="numeric" maxLength={4} pattern="\d{4}" required value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" style={{ letterSpacing: 6, fontSize: 16 }} autoComplete="off" />
                  </Field>
                  <Field label="Your admin password" hint="Asked again so no one can change it from a tab you left open.">
                    <input className="ad-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                  </Field>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Button type="submit" disabled={busy || pin.length !== 4 || !password}>{busy ? "Saving…" : "Save code"}</Button>
                  {data.pinSet && <Button variant="danger" onClick={switchOff} disabled={busy}>Switch the code off</Button>}
                </div>
              </form>
            </Card>
          )}

          {!data.setupNeeded && (
            <Card pad={false} style={{ overflow: "hidden" }}>
              <div style={{ padding: "20px 24px 12px" }}>
                <h2 className="ad-card-title">Recent sign-ins</h2>
                <p className="ad-card-sub" style={{ marginBottom: 0 }}>Every attempt, successful or not, on any restaurant's terminal.</p>
              </div>
              {data.log.length === 0 ? (
                <div style={{ padding: "0 24px 24px" }}><Empty icon="shield">No one has used the support sign-in yet.</Empty></div>
              ) : (
                <div className="ad-table-wrap">
                  <table className="ad-table">
                    <thead>
                      <tr><th>When</th><th>Restaurant</th><th>Result</th><th>Device</th></tr>
                    </thead>
                    <tbody>
                      {data.log.map((l) => (
                        <tr key={l.id}>
                          <td style={{ whiteSpace: "nowrap", color: "var(--ad-muted)" }}>{new Date(l.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                          <td style={{ fontWeight: 500 }}>{l.restaurant_name}</td>
                          <td><Badge tone={(OUTCOME[l.outcome] || OUTCOME.fail).tone}>{(OUTCOME[l.outcome] || { text: l.outcome }).text}</Badge></td>
                          <td style={{ color: "var(--ad-muted)", fontSize: 12.5 }}>{deviceOf(l.user_agent)}<div className="ad-mono" style={{ fontSize: 11.5, color: "var(--ad-faint)" }}>{l.ip}</div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>
      )}
      {toast && <div className="ad-toast">{toast}</div>}
    </AdminShell>
  );
}
