"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminNav from "@/components/AdminNav";
import { COLORS, FONT_SERIF, RADIUS, SHADOW } from "@/lib/theme";

export default function ActivityPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/activity");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load");
        setData(json);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  return (
    <div>
      <AdminNav />
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ fontFamily: FONT_SERIF, fontSize: 22, fontWeight: 600, marginTop: 0, marginBottom: 6, color: COLORS.ink }}>Unusual activity</h1>
        <p style={{ fontSize: 13.5, color: COLORS.charcoalSoft, marginTop: 0, marginBottom: 24, lineHeight: 1.5 }}>
          Restaurants that made the same "major" edit — renaming the restaurant, changing the logo, or scanning a menu — more than {data?.threshold ?? 2} times in the last {data?.windowDays ?? 30} days. Each edit type is judged on its own, not combined.
        </p>

        {error && <div style={{ fontSize: 13, color: COLORS.red, marginBottom: 16 }}>{error}</div>}

        {!data ? (
          <div style={{ fontSize: 13, color: COLORS.charcoalSoft }}>Loading…</div>
        ) : data.flagged.length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.charcoalSoft, background: COLORS.card, border: `1px dashed ${COLORS.line}`, borderRadius: RADIUS.lg, padding: 24, textAlign: "center" }}>
            Nothing unusual — no restaurant has crossed the threshold on any single edit type in the last {data.windowDays} days.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.flagged.map((f) => (
              <div key={f.tenant_id} style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.lg, padding: "14px 18px", boxShadow: SHADOW.card }}>
                <Link href={`/admin/tenants/${f.tenant_id}`} style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, textDecoration: "none" }}>
                  {f.restaurant_name}
                </Link>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                  {f.flaggedTypes.map((ft) => (
                    <div key={ft.type}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.ink }}>{ft.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: RADIUS.pill, background: COLORS.amberLight, color: COLORS.amber }}>
                          {ft.count}×
                        </span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {ft.events.map((ev, i) => (
                          <div key={i} style={{ fontSize: 11.5, color: COLORS.charcoalSoft, display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <span>{ev.detail || "—"}</span>
                            <span style={{ flexShrink: 0, fontFamily: "monospace" }}>{new Date(ev.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
