"use client";

import { useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";
import { COLORS, FONT_SERIF, RADIUS, SHADOW } from "@/lib/theme";

const PACKAGE_LABELS = { basic: "Basic", standard: "Standard", premium: "Premium" };
const PACKAGES = ["basic", "standard", "premium"];

function Toggle({ on, onClick, label }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        width: 40,
        height: 22,
        borderRadius: RADIUS.pill,
        border: "none",
        background: on ? COLORS.burgundy : COLORS.line,
        position: "relative",
        cursor: "pointer",
        padding: 0,
        flexShrink: 0,
        transition: "background 0.15s ease",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
          transition: "left 0.15s ease",
        }}
      />
    </button>
  );
}

export default function PackagesPage() {
  const [features, setFeatures] = useState(null);
  const [matrix, setMatrix] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [btnHover, setBtnHover] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/packages");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load");
        setFeatures(data.features);
        setMatrix(data.matrix);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  const toggle = (pkg, key) => {
    setMatrix((prev) => ({ ...prev, [pkg]: { ...prev[pkg], [key]: !prev[pkg][key] } }));
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/packages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matrix }),
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

  return (
    <div>
      <AdminNav />
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ fontFamily: FONT_SERIF, fontSize: 22, fontWeight: 600, margin: 0, color: COLORS.ink }}>Packages</h1>
          <button
            onClick={save}
            disabled={saving || !matrix}
            onMouseEnter={() => setBtnHover(true)}
            onMouseLeave={() => setBtnHover(false)}
            style={{
              padding: "9px 18px",
              borderRadius: RADIUS.sm,
              border: "none",
              background: saving ? COLORS.burgundy : btnHover ? COLORS.burgundyDark : COLORS.burgundy,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.7 : 1,
              transition: "background 0.15s ease",
            }}
          >
            {saving ? "Saving…" : savedFlash ? "Saved ✓" : "Save changes"}
          </button>
        </div>
        <p style={{ fontSize: 13.5, color: COLORS.charcoalSoft, marginTop: 0, marginBottom: 26, lineHeight: 1.5 }}>
          Choose which features each package includes. Order-taking and basic settings are always available on every package — everything below is optional. Assign a restaurant to a package from its customer detail page.
        </p>

        {error && <div style={{ fontSize: 13, color: COLORS.red, marginBottom: 16 }}>{error}</div>}

        {!matrix ? (
          <div style={{ fontSize: 13, color: COLORS.charcoalSoft }}>Loading…</div>
        ) : (
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.lg, overflow: "hidden", boxShadow: SHADOW.card }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(3, 90px)", borderBottom: `1px solid ${COLORS.line}`, background: COLORS.cream }}>
              <div style={{ padding: "11px 16px", fontSize: 11, fontWeight: 600, color: COLORS.charcoalSoft, textTransform: "uppercase", letterSpacing: 0.4 }}>Feature</div>
              {PACKAGES.map((pkg) => (
                <div key={pkg} style={{ padding: "11px 8px", fontSize: 11.5, fontWeight: 700, color: COLORS.ink, textAlign: "center" }}>{PACKAGE_LABELS[pkg]}</div>
              ))}
            </div>
            {features.map((f, i) => (
              <div
                key={f.key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr repeat(3, 90px)",
                  alignItems: "center",
                  borderBottom: i < features.length - 1 ? `1px solid ${COLORS.lineSoft}` : "none",
                }}
              >
                <div style={{ padding: "13px 16px", fontSize: 13.5, color: COLORS.ink }}>{f.label}</div>
                {PACKAGES.map((pkg) => (
                  <div key={pkg} style={{ display: "flex", justifyContent: "center" }}>
                    <Toggle on={matrix[pkg][f.key]} onClick={() => toggle(pkg, f.key)} label={`${f.label} — ${PACKAGE_LABELS[pkg]}`} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
