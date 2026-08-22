"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Customers" },
  { href: "/admin/reminders", label: "Reminders due today" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 28px", borderBottom: "1px solid #DCD5C4", background: "#fff", flexWrap: "wrap", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: "#7C2D3B" }}>POS Admin</span>
        <div style={{ display: "flex", gap: 4 }}>
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  padding: "7px 14px",
                  borderRadius: 999,
                  fontSize: 13.5,
                  fontWeight: 500,
                  textDecoration: "none",
                  color: active ? "#fff" : "#4A4A45",
                  background: active ? "#7C2D3B" : "transparent",
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
      <button
        onClick={logout}
        style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid #DCD5C4", background: "transparent", color: "#4A4A45", fontSize: 13, cursor: "pointer" }}
      >
        Log out
      </button>
    </div>
  );
}
