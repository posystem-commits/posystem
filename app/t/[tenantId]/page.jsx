import { headers } from "next/headers";
import PosClient from "@/app/_components/PosClient";
import { loadSiteBootstrap, buildSiteMetadata } from "@/lib/siteServer";

export const dynamic = "force-dynamic";

const originFromHeaders = () => {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || (host && host.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : "";
};

// Only the online-ordering link (?order=1) of a restaurant that has published its website gets
// custom page metadata; the staff terminal and every other restaurant keep the default tags.
export async function generateMetadata({ params, searchParams }) {
  if (searchParams?.order !== "1" || searchParams?.preview === "1") return {};
  const meta = await buildSiteMetadata(params.tenantId, originFromHeaders());
  return meta || {};
}

// This is the link staff bookmark on their POS terminal (and that table QR codes / the online-
// ordering link both extend with ?table=/?order= — see pos.jsx's tableMenuUrl/storeOrderUrl,
// which build off window.location.origin + pathname, so they already resolve correctly here).
// It's a plain shareable link, the same trust model the rest of the app already uses (table QR
// links carry no auth either) — every request it makes is still checked server-side against the
// tenant's active/paused/paid_until status via requireActiveTenant, so a paused or expired
// tenant's link stops working even if someone still has it bookmarked.
export default async function TenantPosPage({ params, searchParams }) {
  // Customer-facing links get the published website look's first paint from the server so the
  // original layout never flashes first. Restaurants that haven't published it get null, and the
  // page behaves exactly as it always has.
  const customerLink = searchParams?.order === "1" || !!searchParams?.table;
  const siteBootstrap = customerLink ? await loadSiteBootstrap(params.tenantId, { preview: searchParams?.preview === "1" }) : null;
  return <PosClient tenantId={params.tenantId} siteBootstrap={siteBootstrap} />;
}
