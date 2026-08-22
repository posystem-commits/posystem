import { redirect } from "next/navigation";

// This file is the eventual home of the customer-facing POS app (src/pos.jsx), once it's
// migrated off window.storage onto real tenant-scoped API routes — see the note in
// db/schema.sql and lib/requireActiveTenant.js. Until then, the root just points at the admin
// dashboard, which is what this pass of the build actually delivers.
export default function Home() {
  redirect("/admin");
}
