"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COLORS, FONT_SERIF, SHADOW, RADIUS } from "@/lib/theme";

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  marginBottom: 16,
  border: `1px solid ${COLORS.line}`,
  borderRadius: RADIUS.sm,
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
};

function FormField({ label, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <>
      <label style={{ display: "block", fontSize: 12, color: COLORS.charcoalSoft, marginBottom: 5, fontWeight: 500 }}>{label}</label>
      <input
        {...props}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...inputStyle,
          borderColor: focused ? COLORS.burgundy : COLORS.line,
          boxShadow: focused ? `0 0 0 3px ${COLORS.burgundy}1A` : "none",
        }}
      />
    </>
  );
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [btnHover, setBtnHover] = useState(false);

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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: COLORS.cream }}>
      <form
        onSubmit={submit}
        style={{ width: "100%", maxWidth: 360, background: COLORS.card, borderRadius: RADIUS.xl, padding: "36px 32px", boxShadow: SHADOW.raised, border: `1px solid ${COLORS.line}` }}
      >
        <div style={{ fontFamily: FONT_SERIF, fontWeight: 600, fontSize: 24, color: COLORS.burgundy, marginBottom: 6 }}>POS Admin</div>
        <p style={{ fontSize: 13.5, color: COLORS.charcoalSoft, marginTop: 0, marginBottom: 26, lineHeight: 1.5 }}>Sign in to manage restaurant customers.</p>

        <FormField label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <FormField label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />

        {error && (
          <div style={{ fontSize: 13, color: COLORS.red, background: COLORS.redLight, borderRadius: RADIUS.sm, padding: "9px 12px", marginBottom: 16 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          onMouseEnter={() => setBtnHover(true)}
          onMouseLeave={() => setBtnHover(false)}
          style={{
            width: "100%",
            padding: "12px 0",
            borderRadius: RADIUS.sm,
            border: "none",
            background: submitting ? COLORS.burgundy : btnHover ? COLORS.burgundyDark : COLORS.burgundy,
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: submitting ? "default" : "pointer",
            opacity: submitting ? 0.75 : 1,
            transition: "background 0.15s ease",
          }}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
