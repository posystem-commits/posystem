"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/admin/ui";

const LINKS = [
  { href: "/admin", label: "Customers", icon: "users" },
  { href: "/admin/packages", label: "Packages", icon: "layers" },
  { href: "/admin/reminders", label: "Reminders", icon: "bell" },
  { href: "/admin/activity", label: "Unusual activity", icon: "pulse" },
  { href: "/admin/support", label: "Support access", icon: "shield" },
];

// The frame every admin page sits in: sidebar (a top bar on phones) and a page header.
export default function AdminShell({ eyebrow, title, subtitle, actions, narrow, children }) {
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <div className="ad-root">
      <div className="ad-shell">
        <aside className="ad-side">
          <div className="ad-brand">
            <div className="ad-brand-mark">G</div>
            <div>
              <div className="ad-brand-name">G&amp;B</div>
              <div className="ad-brand-sub">Admin</div>
            </div>
          </div>
          <nav className="ad-nav">
            <div className="ad-nav-label">Manage</div>
            {LINKS.map((link) => {
              const active = link.href === "/admin" ? pathname === "/admin" || pathname.startsWith("/admin/tenants") : pathname.startsWith(link.href);
              return (
                <Link key={link.href} href={link.href} className={active ? "is-active" : ""}>
                  <Icon name={link.icon} />
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="ad-side-foot">
            <button onClick={logout}>
              <Icon name="logout" />
              <span>Log out</span>
            </button>
          </div>
        </aside>
        <main className="ad-main">
          <div className={`ad-page${narrow ? " is-narrow" : ""}`}>
            {(title || actions) && (
              <header className="ad-head">
                <div>
                  {eyebrow && <div className="ad-eyebrow">{eyebrow}</div>}
                  <h1 className="ad-title">{title}</h1>
                  {subtitle && <p className="ad-sub">{subtitle}</p>}
                </div>
                {actions && <div className="ad-actions">{actions}</div>}
              </header>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
