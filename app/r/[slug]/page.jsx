import { headers } from "next/headers";
import { notFound } from "next/navigation";
import PosClient from "@/app/_components/PosClient";
import { loadSiteBootstrap, buildSiteMetadata, tenantIdForSlug } from "@/lib/siteServer";

export const dynamic = "force-dynamic";

const originFromHeaders = () => {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || (host && host.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : "";
};

export async function generateMetadata({ params }) {
  const tenantId = await tenantIdForSlug(params.slug);
  if (!tenantId) return {};
  return (await buildSiteMetadata(tenantId, originFromHeaders())) || {};
}

// A restaurant's short web address (for social media bios, printed menus, QR codes). It always opens
// that restaurant's online-ordering page — the website look if it's published, the original page if not.
export default async function ShortLinkPage({ params }) {
  const tenantId = await tenantIdForSlug(params.slug);
  if (!tenantId) notFound();
  const siteBootstrap = await loadSiteBootstrap(tenantId);
  return <PosClient tenantId={tenantId} storeLink siteBootstrap={siteBootstrap} />;
}
