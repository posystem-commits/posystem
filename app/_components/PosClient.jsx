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

export default function PosClient(props) {
  return <POSApp {...props} />;
}
