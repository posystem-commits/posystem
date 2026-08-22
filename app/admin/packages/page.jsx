"use client";

import { useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";

const PACKAGE_LABELS = { basic: "Basic", standard: "Standard", premium: "Premium" };
const PACKAGES = ["basic", "standard", "premium"];

export default function PackagesPage() {
  const [features, setFeatures] = useState(null);
  const [matrix, setMatrix] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

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
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Packages</h1>
          <button
            onClick={save}
            disabled={saving || !matrix}
            style={{ padding: "9px 18px", borderRadius: 7, border: "none", background: "#7C2D3B", color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "Saving…" : savedFlash ? "Saved ✓" : "Save changes"}
          </button>
        </div>
        <p style={{ fontSize: 13, color: "#6B685F", marginTop: 0, marginBottom: 24 }}>
          Choose which features each package includes. Order-taking and basic settings are always available on every package — everything below is optional. Assign a restaurant to a package from its customer detail page.
        </p>

        {error && <div style={{ fontSize: 13, color: "#A6534A", marginBottom: 16 }}>{error}</div>}

        {!matrix ? (
          <div style={{ fontSize: 13, color: "#6B685F" }}>Loading…</div>
        ) : (
          <div style={{ background: "#fff", border: "1px solid #DCD5C4", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(3, 90px)", borderBottom: "1px solid #DCD5C4", background: "#F5F3EE" }}>
              <div style={{ padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "#6B685F", textTransform: "uppercase", letterSpacing: 0.4 }}>Feature</div>
              {PACKAGES.map((pkg) => (
                <div key={pkg} style={{ padding: "10px 8px", fontSize: 11.5, fontWeight: 700, color: "#20242B", textAlign: "center" }}>{PACKAGE_LABELS[pkg]}</div>
              ))}
            </div>
            {features.map((f, i) => (
              <div key={f.key} style={{ display: "grid", gridTemplateColumns: "1fr repeat(3, 90px)", alignItems: "center", borderBottom: i < features.length - 1 ? "1px solid #EEE9DC" : "none" }}>
                <div style={{ padding: "12px 16px", fontSize: 13.5 }}>{f.label}</div>
                {PACKAGES.map((pkg) => (
                  <div key={pkg} style={{ display: "flex", justifyContent: "center" }}>
                    <button
                      onClick={() => toggle(pkg, f.key)}
                      aria-label={`${f.label} — ${PACKAGE_LABELS[pkg]}`}
                      style={{
                        width: 40,
                        height: 22,
                        borderRadius: 999,
                        border: "none",
                        background: matrix[pkg][f.key] ? "#7C2D3B" : "#DCD5C4",
                        position: "relative",
                        cursor: "pointer",
                        padding: 0,
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: 2,
                          left: matrix[pkg][f.key] ? 20 : 2,
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          background: "#fff",
                          transition: "left .15s ease",
                        }}
                      />
                    </button>
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
