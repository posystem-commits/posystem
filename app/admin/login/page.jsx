"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Notice } from "@/components/admin/ui";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch (e) {
      setError("Couldn't reach the server — try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ad-root">
      <div className="ad-login">
        <section className="ad-login-art">
          <div className="ad-brand" style={{ padding: 0 }}>
            <div className="ad-brand-mark">G</div>
            <div>
              <div className="ad-brand-name">G&amp;B</div>
              <div className="ad-brand-sub">Admin</div>
            </div>
          </div>
          <div>
            <div className="ad-login-quote">
              Every restaurant you run, <em>in one calm place.</em>
            </div>
          </div>
          <div className="ad-login-note">Customers, subscriptions, packages and support access — all managed from here.</div>
        </section>
        <section className="ad-login-form">
          <form className="ad-login-card ad-fade" onSubmit={submit}>
            <div className="ad-eyebrow">Welcome back</div>
            <h1>Sign in</h1>
            <p className="ad-sub" style={{ marginBottom: 28 }}>Use your admin account to manage your restaurant customers.</p>

            <div className="ad-field">
              <label className="ad-label" htmlFor="ad-email">Email</label>
              <input id="ad-email" className="ad-input" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="ad-field">
              <label className="ad-label" htmlFor="ad-password">Password</label>
              <input id="ad-password" className="ad-input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            {error && <Notice tone="bad" style={{ marginBottom: 16 }}>{error}</Notice>}

            <Button type="submit" block disabled={submitting} style={{ padding: "13px 0" }}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
