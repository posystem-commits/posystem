// Look presets and helpers for the customer-facing "website" version of the online-ordering link.
//
// A preset is a complete, tested look — palette, fonts, corner radius, how the hero, menu cards and
// category bar are drawn — so whatever the owner picks always looks designed. The owner then tweaks
// colors, text and photos; they never have to design anything from scratch.
//
// Nothing here touches the legacy ordering page. The website look is only used when a restaurant has
// published it (website-settings.enabled), so restaurants that never opt in keep their page exactly
// as it was.

export const SITE_PRESET_IDS = ["classic", "modern", "dark", "bold", "minimal"];

export const SITE_PRESETS = {
  classic: {
    id: "classic",
    dark: false,
    bg: "#FBF8F2",
    surface: "#FFFFFF",
    text: "#2A2420",
    muted: "#7A7366",
    line: "#E6DFCF",
    headingFont: "'Fraunces', Georgia, serif",
    bodyFont: "'Inter', system-ui, sans-serif",
    arabicFont: "'Tajawal', 'Inter', sans-serif",
    headingWeight: 600,
    headingCase: "none",
    radius: 14,
    hero: "overlay",
    itemStyle: "card",
    navStyle: "pill",
  },
  modern: {
    id: "modern",
    dark: false,
    bg: "#F3F5F8",
    surface: "#FFFFFF",
    text: "#12151B",
    muted: "#677084",
    line: "#E1E6EE",
    headingFont: "'Poppins', 'Inter', sans-serif",
    bodyFont: "'Poppins', 'Inter', sans-serif",
    arabicFont: "'Tajawal', 'Inter', sans-serif",
    headingWeight: 600,
    headingCase: "none",
    radius: 20,
    hero: "overlay",
    itemStyle: "soft",
    navStyle: "pill",
  },
  dark: {
    id: "dark",
    dark: true,
    bg: "#0F1115",
    surface: "#181B21",
    text: "#F3EFE7",
    muted: "#9A9588",
    line: "#2A2E36",
    headingFont: "'Playfair Display', Georgia, serif",
    bodyFont: "'Inter', system-ui, sans-serif",
    arabicFont: "'Tajawal', 'Inter', sans-serif",
    headingWeight: 600,
    headingCase: "none",
    radius: 10,
    hero: "overlay",
    itemStyle: "card",
    navStyle: "pill",
  },
  bold: {
    id: "bold",
    dark: false,
    bg: "#FFFFFF",
    surface: "#FFFFFF",
    text: "#0B0B0C",
    muted: "#55555C",
    line: "#0B0B0C",
    headingFont: "'Oswald', 'Tajawal', Impact, sans-serif",
    bodyFont: "'Inter', system-ui, sans-serif",
    arabicFont: "'Tajawal', 'Inter', sans-serif",
    headingWeight: 700,
    headingCase: "uppercase",
    radius: 2,
    hero: "block",
    itemStyle: "outlined",
    navStyle: "underline",
  },
  minimal: {
    id: "minimal",
    dark: false,
    bg: "#FFFFFF",
    surface: "#FFFFFF",
    text: "#1B1B1B",
    muted: "#8A8A8A",
    line: "#E9E9E9",
    headingFont: "'DM Sans', 'Inter', sans-serif",
    bodyFont: "'DM Sans', 'Inter', sans-serif",
    arabicFont: "'Tajawal', 'DM Sans', sans-serif",
    headingWeight: 500,
    headingCase: "none",
    radius: 0,
    hero: "plain",
    itemStyle: "list",
    navStyle: "underline",
  },
};

export const SITE_FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&family=Oswald:wght@500;600;700&family=DM+Sans:wght@400;500;700&family=Tajawal:wght@400;500;700;800&display=swap');";

export const ITEM_BADGES = ["popular", "new", "spicy", "vegetarian", "chef"];

export const SITE_DEFAULTS = {
  enabled: false, // publishing switch — off means customers keep seeing the original page
  preset: "classic",
  accent: null, // null = use the restaurant's brand colors from Settings
  accent2: null,
  defaultLang: "ar",
  tagline: { en: "", ar: "" },
  about: { en: "", ar: "" },
  address: "",
  social: { instagram: "", facebook: "", tiktok: "", whatsapp: "", website: "" },
  announcement: { on: false, en: "", ar: "" },
  sections: { about: true, featured: true, gallery: true, hours: true },
};

// Fills in anything missing so a half-saved or older record never breaks the page.
export const mergeSiteSettings = (raw) => {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    ...SITE_DEFAULTS,
    ...r,
    preset: SITE_PRESETS[r.preset] ? r.preset : SITE_DEFAULTS.preset,
    tagline: { ...SITE_DEFAULTS.tagline, ...(r.tagline || {}) },
    about: { ...SITE_DEFAULTS.about, ...(r.about || {}) },
    social: { ...SITE_DEFAULTS.social, ...(r.social || {}) },
    announcement: { ...SITE_DEFAULTS.announcement, ...(r.announcement || {}) },
    sections: { ...SITE_DEFAULTS.sections, ...(r.sections || {}) },
  };
};

const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
const toRgb = (hex) => {
  const h = String(hex || "").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [124, 45, 59];
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
};
const toHex = (r, g, b) => `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;

// amount > 0 lightens toward white, amount < 0 darkens toward black.
export const shade = (hex, amount) => {
  const [r, g, b] = toRgb(hex);
  const target = amount >= 0 ? 255 : 0;
  const a = Math.abs(amount);
  return toHex(r + (target - r) * a, g + (target - g) * a, b + (target - b) * a);
};
export const withAlpha = (hex, alpha) => {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
};
const luminance = (hex) => {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
// Readable text color (near-white or near-black) for text placed on top of `hex`.
export const onColor = (hex) => (luminance(hex) > 0.5 ? "#16130F" : "#FFFFFF");

// The concrete colors the page paints with: the preset's palette, with the restaurant's own
// colors (or the owner's override) driving buttons and highlights.
export const buildSiteTheme = (settings, brand) => {
  const preset = SITE_PRESETS[settings.preset] || SITE_PRESETS.classic;
  const accent = settings.accent || brand.primary || "#7C2D3B";
  const accent2 = settings.accent2 || brand.secondary || "#B08D57";
  return {
    ...preset,
    accent,
    accent2,
    onAccent: onColor(accent),
    // A highlight color that stays readable as text on this preset's background.
    highlight: preset.dark ? shade(accent2, 0.3) : shade(accent2, -0.32),
    accentSoft: withAlpha(accent, preset.dark ? 0.22 : 0.1),
  };
};

const WEEK = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const toMin = (s) => {
  const [h, m] = String(s || "00:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
// "23:59" is the system's "until the end of the day" marker, not a real closing minute.
const endMin = (s) => (s === "23:59" ? 24 * 60 : toMin(s));

// Opening hours come from Settings > Shift hours. A restaurant that never configured them has every
// day at 00:00-23:59, which says nothing about when it is really open — so no hours are shown.
export const hoursAreConfigured = (hours) => !!hours && WEEK.some((d) => hours[d] && (hours[d].start !== "00:00" || hours[d].end !== "23:59"));

export const openStatus = (hours, now = new Date()) => {
  if (!hoursAreConfigured(hours)) return null;
  const wd = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();
  const today = hours[WEEK[wd]] || { start: "00:00", end: "23:59" };
  const yest = hours[WEEK[(wd + 6) % 7]] || { start: "00:00", end: "23:59" };
  const s = toMin(today.start);
  const e = endMin(today.end);
  const crosses = e <= s;
  const openToday = crosses ? mins >= s : mins >= s && mins < e;
  const yS = toMin(yest.start);
  const yE = endMin(yest.end);
  const openFromYesterday = yE <= yS && mins < yE;
  if (openToday) return { open: true, until: crosses ? today.end : today.end };
  if (openFromYesterday) return { open: true, until: yest.end };
  // Closed: when does it next open?
  if (mins < s) return { open: false, opensAt: today.start, dayOffset: 0, weekday: wd };
  const nextWd = (wd + 1) % 7;
  const next = hours[WEEK[nextWd]] || { start: "00:00" };
  return { open: false, opensAt: next.start, dayOffset: 1, weekday: nextWd };
};

// Groups consecutive days with identical hours: [{ days: [1,2,3], start, end }]
export const groupHours = (hours) => {
  const order = [1, 2, 3, 4, 5, 6, 0]; // Monday first
  const groups = [];
  order.forEach((d) => {
    const cfg = hours[WEEK[d]] || { start: "00:00", end: "23:59" };
    const last = groups[groups.length - 1];
    if (last && last.start === cfg.start && last.end === cfg.end) last.days.push(d);
    else groups.push({ days: [d], start: cfg.start, end: cfg.end });
  });
  return groups;
};

export const formatClock = (hhmm, locale) => {
  const [h, m] = String(hhmm || "00:00").split(":").map(Number);
  if (hhmm === "23:59") return locale.startsWith("ar") ? "منتصف الليل" : "Midnight";
  return new Date(2000, 0, 1, h || 0, m || 0).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
};

export const weekdayName = (d, locale, style = "long") => new Date(2023, 0, 1 + d).toLocaleDateString(locale, { weekday: style });

// Turns whatever the owner typed for a social field into a link.
export const socialHref = (kind, raw) => {
  const v = String(raw || "").trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "").replace(/\s+/g, "");
  if (kind === "instagram") return `https://instagram.com/${handle}`;
  if (kind === "facebook") return `https://facebook.com/${handle}`;
  if (kind === "tiktok") return `https://tiktok.com/@${handle}`;
  if (kind === "whatsapp") return `https://wa.me/${v.replace(/[^\d]/g, "")}`;
  return `https://${v}`;
};

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/;
