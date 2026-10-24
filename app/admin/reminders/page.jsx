"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/AdminShell";
import { Avatar, Badge, Empty, Notice, Skeleton } from "@/components/admin/ui";

const REMINDER_LABEL = { "7_day": "7 days out", "3_day": "3 days out", "1_day": "1 day out" };
const REMINDER_TONE = { "7_day": "info", "3_day": "warn", "1_day": "bad" };

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
    <AdminShell
      eyebrow="Renewals"
      title="Reminders due today"
      subtitle="Anyone hitting a 7/3/1-day mark today. Each of them will see a renewal popup themselves next time they open their POS terminal — this is just visibility for you, nothing to trigger here."
      narrow
    >
      {error && <Notice tone="bad" style={{ marginBottom: 16 }}>{error}</Notice>}

      {due === null ? (
        <Skeleton rows={3} />
      ) : due.length === 0 ? (
        <Empty icon="bell">Nobody is due for a reminder today.</Empty>
      ) : (
        <div className="ad-rows">
          {due.map((d) => (
            <div key={`${d.tenant_id}-${d.reminder_type}`} className="ad-card ad-row ad-fade">
              <Avatar name={d.restaurant_name} />
              <div className="ad-row-main">
                <Link href={`/admin/tenants/${d.tenant_id}`} className="ad-row-name">{d.restaurant_name}</Link>
                <div className="ad-row-meta">{d.contact_email || "No email on file"} · paid until {d.paid_until}</div>
              </div>
              <Badge tone={REMINDER_TONE[d.reminder_type] || "warn"}>{REMINDER_LABEL[d.reminder_type]}</Badge>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
