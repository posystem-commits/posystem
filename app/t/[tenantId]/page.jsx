"use client";

import dynamic from "next/dynamic";

// The POS terminal (src/pos.jsx) is a stateful, browser-only app — it reads window.location for
// table/online-order routing, talks to localStorage for device-local state, and polls a tenant-
// scoped API for everything else. There's nothing here for the server to usefully render, and
// server-rendering it once would risk a hydration mismatch against whatever query params the
// browser actually has, so it's loaded client-only.
const POSApp = dynamic(() => import("@/src/pos.jsx"), {
  ssr: false,
  loading: () => (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#20242B", color: "#9CA1AC", fontFamily: "sans-serif", fontSize: 13 }}>
      Loading…
    </div>
  ),
});

// This is the link staff bookmark on their POS terminal (and that table QR codes / the online-
// ordering link both extend with ?table=/?order= — see pos.jsx's tableMenuUrl/storeOrderUrl,
// which build off window.location.origin + pathname, so they already resolve correctly here).
// It's a plain shareable link, the same trust model the rest of the app already uses (table QR
// links carry no auth either) — every request it makes is still checked server-side against the
// tenant's active/paused/paid_until status via requireActiveTenant, so a paused or expired
// tenant's link stops working even if someone still has it bookmarked.
export default function TenantPosPage({ params }) {
  return <POSApp tenantId={params.tenantId} />;
}
