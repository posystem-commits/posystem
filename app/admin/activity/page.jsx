"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/AdminShell";
import { Avatar, Badge, Card, Empty, Notice, Skeleton } from "@/components/admin/ui";

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
    <AdminShell
      eyebrow="Watch list"
      title="Unusual activity"
      subtitle={`Restaurants that made the same “major” edit — renaming the restaurant, changing the logo, or scanning a menu — more than ${data?.threshold ?? 2} times in the last ${data?.windowDays ?? 30} days. Each edit type is judged on its own, not combined.`}
      narrow
    >
      {error && <Notice tone="bad" style={{ marginBottom: 16 }}>{error}</Notice>}

      {!data ? (
        <Skeleton rows={3} height={110} />
      ) : data.flagged.length === 0 ? (
        <Empty icon="pulse">Nothing unusual — no restaurant has crossed the threshold on any single edit type in the last {data.windowDays} days.</Empty>
      ) : (
        <div className="ad-rows">
          {data.flagged.map((f) => (
            <Card key={f.tenant_id} className="ad-fade">
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                <Avatar name={f.restaurant_name} />
                <Link href={`/admin/tenants/${f.tenant_id}`} className="ad-row-name">{f.restaurant_name}</Link>
              </div>
              <div className="ad-stack" style={{ gap: 16 }}>
                {f.flaggedTypes.map((ft) => (
                  <div key={ft.type}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{ft.label}</span>
                      <Badge tone="warn" plain>{ft.count}×</Badge>
                    </div>
                    <div className="ad-table-wrap">
                      <table className="ad-table">
                        <tbody>
                          {ft.events.map((ev, i) => (
                            <tr key={i}>
                              <td>{ev.detail || "—"}</td>
                              <td className="ad-mono" style={{ textAlign: "right", color: "var(--ad-muted)", whiteSpace: "nowrap" }}>
                                {new Date(ev.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
