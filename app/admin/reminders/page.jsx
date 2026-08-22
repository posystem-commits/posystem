"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminNav from "@/components/AdminNav";

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
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "28px 24px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginTop: 0, marginBottom: 4 }}>Reminders due today</h1>
        <p style={{ fontSize: 13, color: "#6B685F", marginTop: 0, marginBottom: 20 }}>
          Anyone hitting a 7/3/1-day mark today. The daily cron job (/api/cron/reminders) sends these automatically — this is a sanity-check view, not a manual trigger.
        </p>

        {error && <div style={{ fontSize: 13, color: "#A6534A", marginBottom: 16 }}>{error}</div>}

        {due === null ? (
          <div style={{ fontSize: 13, color: "#6B685F" }}>Loading…</div>
        ) : due.length === 0 ? (
          <div style={{ fontSize: 13, color: "#6B685F" }}>Nobody is due for a reminder today.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {due.map((d) => (
              <div key={`${d.tenant_id}-${d.reminder_type}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", border: "1px solid #DCD5C4", borderRadius: 10, padding: "14px 18px", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <Link href={`/admin/tenants/${d.tenant_id}`} style={{ fontSize: 14, fontWeight: 600, color: "#20242B", textDecoration: "none" }}>
                    {d.restaurant_name}
                  </Link>
                  <div style={{ fontSize: 12, color: "#6B685F", marginTop: 3 }}>
                    {d.contact_email || "No email on file"} &middot; paid until {d.paid_until}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: "#EFE4CB", color: "#8A6A2E" }}>{REMINDER_LABEL[d.reminder_type]}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: d.already_sent ? "#DCEAD8" : "#F3DAD6", color: d.already_sent ? "#3D6B3D" : "#A6534A" }}>
                    {d.already_sent ? "Sent" : "Not sent yet"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
