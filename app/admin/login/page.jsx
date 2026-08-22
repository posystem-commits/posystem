"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 340, background: "#fff", borderRadius: 12, padding: 32, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginTop: 0, marginBottom: 4 }}>POS Admin</h1>
        <p style={{ fontSize: 13, color: "#6B685F", marginTop: 0, marginBottom: 24 }}>Sign in to manage restaurant customers.</p>

        <label style={{ display: "block", fontSize: 12, color: "#6B685F", marginBottom: 4 }}>Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", marginBottom: 14, border: "1px solid #DCD5C4", borderRadius: 7, fontSize: 14 }}
        />

        <label style={{ display: "block", fontSize: 12, color: "#6B685F", marginBottom: 4 }}>Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", marginBottom: 20, border: "1px solid #DCD5C4", borderRadius: 7, fontSize: 14 }}
        />

        {error && <div style={{ fontSize: 13, color: "#A6534A", marginBottom: 14 }}>{error}</div>}

        <button
          type="submit"
          disabled={submitting}
          style={{ width: "100%", padding: "11px 0", borderRadius: 8, border: "none", background: "#7C2D3B", color: "#fff", fontSize: 14, fontWeight: 600, cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.7 : 1 }}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
