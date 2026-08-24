"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { COLORS, FONT_SERIF } from "@/lib/theme";

const LINKS = [
  { href: "/admin", label: "Customers" },
  { href: "/admin/packages", label: "Packages" },
  { href: "/admin/reminders", label: "Reminders due today" },
  { href: "/admin/activity", label: "Unusual activity" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [logoutHover, setLogoutHover] = useState(false);

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "15px 28px",
        borderBottom: `1px solid ${COLORS.line}`,
        background: COLORS.card,
        boxShadow: "0 1px 0 rgba(32,36,43,0.03)",
        flexWrap: "wrap",
        gap: 12,
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
          <span style={{ fontFamily: FONT_SERIF, fontWeight: 600, fontSize: 18, color: COLORS.burgundy, letterSpacing: 0.2 }}>
            G&amp;B
          </span>
          <span style={{ fontSize: 11, color: COLORS.charcoalSoft, letterSpacing: 1.2, textTransform: "uppercase" }}>Admin</span>
        </div>
        <div style={{ display: "flex", gap: 2 }}>
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
                  color: active ? "#fff" : COLORS.ink,
                  background: active ? COLORS.burgundy : "transparent",
                  transition: "background 0.15s ease, color 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = COLORS.cream;
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = "transparent";
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
        onMouseEnter={() => setLogoutHover(true)}
        onMouseLeave={() => setLogoutHover(false)}
        style={{
          padding: "7px 14px",
          borderRadius: 7,
          border: `1px solid ${logoutHover ? COLORS.charcoalSoft : COLORS.line}`,
          background: "transparent",
          color: COLORS.ink,
          fontSize: 13,
          cursor: "pointer",
          transition: "border-color 0.15s ease",
        }}
      >
        Log out
      </button>
    </div>
  );
}
