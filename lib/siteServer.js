import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { mergeSiteSettings } from "@/src/site/presets";

// Server-side reads for the website-style ordering page: what to paint on the very first frame (so
// the original layout never flashes before the new one), the social-sharing tags, and the short
// web address lookup. Every function is fault-tolerant — if anything fails the caller falls back to
// the original behavior, so a hiccup here can never take the ordering page down.

export const RESERVED_SLUGS = new Set([
  "admin", "api", "t", "r", "login", "logout", "www", "app", "static", "pos", "menu", "order", "orders",
  "home", "index", "about", "contact", "settings", "support", "help", "billing", "dashboard", "test",
]);

const parse = (raw) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

async function readKeys(tenantId, keys) {
  const { data, error } = await supabaseAdmin().from("tenant_pos_kv").select("key, value, updated_at").eq("tenant_id", tenantId).in("key", keys);
  if (error) throw new Error(error.message);
  const out = {};
  const at = {};
  (data || []).forEach((row) => {
    out[row.key] = parse(row.value);
    at[row.key] = row.updated_at;
  });
  Object.defineProperty(out, "__at", { value: at, enumerable: false });
  return out;
}

// { settings, brand } when the website look should be shown (published, or being previewed); null otherwise.
export async function loadSiteBootstrap(tenantId, { preview = false } = {}) {
  try {
    const rows = await readKeys(tenantId, ["website-settings", "restaurant-branding", "website-media"]);
    const raw = rows["website-settings"];
    if (!preview && !(raw && raw.enabled)) return null;
    const b = rows["restaurant-branding"] || {};
    return {
      settings: mergeSiteSettings(raw),
      // Only the cover goes with the first paint (the gallery loads afterwards) so the top of the page doesn't jump.
      // Pictures travel as cacheable links, not as data.
      media: { cover: rows["website-media"]?.cover ? `/api/pos/${tenantId}/site-image?type=cover&v=${encodeURIComponent(rows.__at["website-media"])}` : null },
      brand: { name: b.name || "", logo: b.logo ? `/api/pos/${tenantId}/site-image?type=logo&v=${encodeURIComponent(rows.__at["restaurant-branding"])}` : null, primary: b.primary || null, secondary: b.secondary || null, mapsLink: b.mapsLink || "", phone: b.phone || "" },
    };
  } catch (e) {
    return null;
  }
}

export async function tenantIdForSlug(slug) {
  try {
    const { data, error } = await supabaseAdmin()
      .from("tenant_pos_kv")
      .select("tenant_id")
      .eq("key", "site-slug")
      .eq("value", JSON.stringify(String(slug || "").toLowerCase()))
      .maybeSingle();
    if (error || !data) return null;
    return data.tenant_id;
  } catch (e) {
    return null;
  }
}

// Page metadata (title, description, share image) for a published website.
export async function buildSiteMetadata(tenantId, origin) {
  try {
    const rows = await readKeys(tenantId, ["website-settings", "restaurant-branding", "website-media"]);
    const site = rows["website-settings"];
    if (!site || !site.enabled) return null;
    const brand = rows["restaurant-branding"] || {};
    const media = rows["website-media"] || {};
    const s = mergeSiteSettings(site);
    const name = brand.name || "Restaurant";
    const lang = s.defaultLang === "en" ? "en" : "ar";
    const tagline = s.tagline[lang] || s.tagline.en || s.tagline.ar || "";
    const description = (s.about[lang] || s.about.en || s.about.ar || tagline || name).slice(0, 200);
    const title = tagline ? `${name} — ${tagline}` : name;
    const imageUrl = media.cover ? `${origin}/api/pos/${tenantId}/site-image?type=cover` : brand.logo ? `${origin}/api/pos/${tenantId}/site-image?type=logo` : null;
    return {
      title,
      description,
      icons: brand.logo ? { icon: `${origin}/api/pos/${tenantId}/site-image?type=logo` } : undefined,
      openGraph: { title, description, type: "website", siteName: name, images: imageUrl ? [imageUrl] : undefined },
      twitter: { card: imageUrl ? "summary_large_image" : "summary", title, description, images: imageUrl ? [imageUrl] : undefined },
    };
  } catch (e) {
    return null;
  }
}
