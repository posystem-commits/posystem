"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminNav from "@/components/AdminNav";
import { COLORS, FONT_SERIF, RADIUS, SHADOW } from "@/lib/theme";

const REMINDER_LABEL = { "7_day": "7 days out", "3_day": "3 days out", "1_day": "1 day out" };

export default function RemindersDueTodayPage() {
  const [due, setDue] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/reminders/due-today");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load");
        setDue(data.due);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  return (
    <div>
      <AdminNav />
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ fontFamily: FONT_SERIF, fontSize: 22, fontWeight: 600, marginTop: 0, marginBottom: 6, color: COLORS.ink }}>Reminders due today</h1>
        <p style={{ fontSize: 13.5, color: COLORS.charcoalSoft, marginTop: 0, marginBottom: 24, lineHeight: 1.5 }}>
          Anyone hitting a 7/3/1-day mark today. Each one of these will see a renewal popup themselves
          next time they open their POS terminal — this is just visibility for you, nothing to trigger here.
        </p>

        {error && <div style={{ fontSize: 13, color: COLORS.red, marginBottom: 16 }}>{error}</div>}

        {due === null ? (
          <div style={{ fontSize: 13, color: COLORS.charcoalSoft }}>Loading…</div>
        ) : due.length === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.charcoalSoft, background: COLORS.card, border: `1px dashed ${COLORS.line}`, borderRadius: RADIUS.lg, padding: 24, textAlign: "center" }}>
            Nobody is due for a reminder today.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {due.map((d) => (
              <div
                key={`${d.tenant_id}-${d.reminder_type}`}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: RADIUS.lg, padding: "14px 18px", flexWrap: "wrap", gap: 10, boxShadow: SHADOW.card }}
              >
                <div>
                  <Link href={`/admin/tenants/${d.tenant_id}`} style={{ fontSize: 14, fontWeight: 600, color: COLORS.ink, textDecoration: "none" }}>
                    {d.restaurant_name}
                  </Link>
                  <div style={{ fontSize: 12, color: COLORS.charcoalSoft, marginTop: 3 }}>
                    {d.contact_email || "No email on file"} &middot; paid until {d.paid_until}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: RADIUS.pill, background: COLORS.amberLight, color: COLORS.amber }}>{REMINDER_LABEL[d.reminder_type]}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
