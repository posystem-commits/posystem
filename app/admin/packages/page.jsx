"use client";

import React, { useEffect, useState } from "react";
import AdminShell from "@/components/AdminShell";
import { Button, Card, Notice, Skeleton, Toggle } from "@/components/admin/ui";

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
    <AdminShell
      eyebrow="Plans"
      title="Packages"
      subtitle="Choose which features each package includes. Order-taking and basic settings are always available on every package — everything below is optional. Assign a restaurant to a package from its customer page."
      narrow
      actions={<Button onClick={save} disabled={saving || !matrix}>{saving ? "Saving…" : savedFlash ? "Saved ✓" : "Save changes"}</Button>}
    >
      {error && <Notice tone="bad" style={{ marginBottom: 16 }}>{error}</Notice>}

      {!matrix ? (
        <Skeleton rows={6} height={54} />
      ) : (
        <Card pad={false} style={{ overflow: "hidden" }}>
          <div className="ad-matrix">
            <div className="head">Feature</div>
            {PACKAGES.map((pkg) => (
              <div key={pkg} className="head center">{PACKAGE_LABELS[pkg]}</div>
            ))}
            {features.map((f, i) => {
              const last = i === features.length - 1 ? " last" : "";
              return (
                <React.Fragment key={f.key}>
                  <div className={last.trim()} style={{ fontSize: 14, fontWeight: 500 }}>{f.label}</div>
                  {PACKAGES.map((pkg) => (
                    <div key={pkg} className={`cell${last}`}>
                      <Toggle on={matrix[pkg][f.key]} onClick={() => toggle(pkg, f.key)} label={`${f.label} — ${PACKAGE_LABELS[pkg]}`} />
                    </div>
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        </Card>
      )}
    </AdminShell>
  );
}
