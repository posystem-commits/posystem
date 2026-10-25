"use client";

import dynamic from "next/dynamic";

// The POS terminal (src/pos.jsx) is a stateful, browser-only app — it reads window.location for
// table/online-order routing, talks to localStorage for device-local state, and polls a tenant-
// scoped API for everything else. There's nothing here for the server to usefully render, and
// server-rendering it once would risk a hydration mismatch against whatever query params the
// browser actually has, so it's loaded client-only.
const POSApp = dynamic(() => import("@/src/pos.jsx"), {
  ssr: false,
  // Nothing about any restaurant is shown while the terminal loads — a plain spinner on a neutral ground that follows
  // the device's light/dark setting.
  loading: () => (
    <div className="pos-boot" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`.pos-boot{background:#f4f2ee;color:#8a8680}@media (prefers-color-scheme: dark){.pos-boot{background:#20242B;color:#9CA1AC}}@keyframes pos-boot-spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 22, height: 22, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "pos-boot-spin .8s linear infinite" }} />
    </div>
  ),
});

export default function PosClient(props) {
  return <POSApp {...props} />;
}
