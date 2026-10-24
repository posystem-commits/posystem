"use client";

import React, { useEffect, useRef, useState } from "react";

// The sign-in that opens after the secret gesture on the terminal's login screen. Deliberately plain: it says
// nothing about what it unlocks. Loaded only when the gesture is made, so it is not part of the normal page.

const STRINGS = {
  en: { title: "Support", hint: "Enter your code", wrong: "Incorrect code", locked: "Too many attempts. Try again in {{m}} min.", offline: "Couldn't reach the server.", close: "Close" },
  ar: { title: "الدعم", hint: "أدخل رمزك", wrong: "رمز غير صحيح", locked: "محاولات كثيرة. حاول مرة أخرى بعد {{m}} دقيقة.", offline: "تعذّر الاتصال بالخادم.", close: "إغلاق" },
};

export default function SupportLogin({ tenantId, isRtl, theme, onSuccess, onClose }) {
  const s = STRINGS[isRtl ? "ar" : "en"];
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const busyRef = useRef(false);

  const submit = async (code) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const res = await fetch(`/api/pos/${encodeURIComponent(tenantId)}/support`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        onSuccess({ expiresAt: data.expiresAt });
        return;
      }
      setMessage(res.status === 429 ? s.locked.replace("{{m}}", String(Math.max(1, Math.ceil((data.retryAfterSeconds || 60) / 60)))) : s.wrong);
    } catch (e) {
      setMessage(s.offline);
    }
    setPin("");
    setShake(true);
    setTimeout(() => setShake(false), 400);
    busyRef.current = false;
    setBusy(false);
  };

  const press = (d) => {
    if (busyRef.current) return;
    setMessage("");
    setPin((p) => {
      if (p.length >= 4) return p;
      const next = p + d;
      if (next.length === 4) setTimeout(() => submit(next), 120);
      return next;
    });
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key >= "0" && e.key <= "9") press(e.key);
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const key = { padding: "15px 0", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontSize: 18, fontFamily: "IBM Plex Mono, monospace", cursor: "pointer" };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <style>{`@keyframes sl-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-7px); } 75% { transform: translateX(7px); } }`}</style>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 300, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 16, padding: "24px 22px", textAlign: "center", color: "var(--text-primary)" }}>
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 17, fontWeight: 600, marginBottom: 3 }}>{s.title}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 18 }}>{s.hint}</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: message ? 8 : 22, animation: shake ? "sl-shake .35s" : undefined }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ width: 15, height: 15, borderRadius: "50%", border: `2px solid ${theme.secondary}`, background: i < pin.length ? theme.secondary : "transparent" }} />
          ))}
        </div>
        {message && <div style={{ fontSize: 12, color: "#E3A79C", marginBottom: 14, minHeight: 16 }}>{message}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 9, direction: "ltr", opacity: busy ? 0.6 : 1 }}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} onClick={() => press(d)} style={key}>{d}</button>
          ))}
          <button onClick={onClose} style={{ ...key, background: "transparent", color: "var(--text-muted)", fontSize: 12, fontFamily: "inherit" }}>{s.close}</button>
          <button onClick={() => press("0")} style={key}>0</button>
          <button onClick={() => setPin((p) => p.slice(0, -1))} style={{ ...key, background: "transparent", color: "var(--text-muted)" }}>⌫</button>
        </div>
      </div>
    </div>
  );
}
