"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  buildSiteTheme,
  ITEM_BADGES,
  openStatus,
  hoursAreConfigured,
  groupHours,
  formatClock,
  weekdayName,
  socialHref,
  SITE_FONT_IMPORT,
  withAlpha,
} from "./presets";
import { makeSiteT } from "./siteStrings";

// The website-style version of the online-ordering page. It is purely presentational: every piece of
// state and every action (cart, delivery choice, sending the order) is owned by CustomerMenuView in
// pos.jsx and arrives through props, so ordering behaves exactly like the original page — only the
// look and layout differ.

const Icon = ({ d, size = 18, fill = "none", stroke = "currentColor", sw = 1.8, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
    {d ? <path d={d} /> : children}
  </svg>
);
const PhoneIcon = (p) => <Icon {...p} d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />;
const PinIcon = (p) => (
  <Icon {...p}>
    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" />
    <circle cx="12" cy="10" r="3" />
  </Icon>
);
const ClockIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);
const BagIcon = (p) => (
  <Icon {...p}>
    <path d="M6 7h12l1 13H5L6 7z" />
    <path d="M9 7V6a3 3 0 0 1 6 0v1" />
  </Icon>
);
const CloseIcon = (p) => <Icon {...p} d="M6 6l12 12M18 6L6 18" />;
const PlusIcon = (p) => <Icon {...p} d="M12 5v14M5 12h14" />;
const MinusIcon = (p) => <Icon {...p} d="M5 12h14" />;

const BADGE_COLORS = { popular: "#C2410C", new: "#1D4ED8", spicy: "#B91C1C", vegetarian: "#15803D", chef: null };

export default function SiteView(p) {
  const { lang, setLang, isRtl, t, site, media, brand, shiftHours, categories, menu, availability, loaded, money } = p;
  const st = useMemo(() => makeSiteT(lang), [lang]);
  const T = useMemo(() => buildSiteTheme(site, brand), [site, brand.primary, brand.secondary]);
  const locale = isRtl ? "ar-EG" : "en-US";
  const name = brand.name || "";
  const tagline = (isRtl ? site.tagline.ar : site.tagline.en) || (isRtl ? site.tagline.en : site.tagline.ar) || "";
  const about = (isRtl ? site.about.ar : site.about.en) || (isRtl ? site.about.en : site.about.ar) || "";
  const announcementText = site.announcement.on ? (isRtl ? site.announcement.ar : site.announcement.en) || (isRtl ? site.announcement.en : site.announcement.ar) : "";
  const mapsHref = p.mapsHref || "";
  const phone = (brand.phone || "").trim();
  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : "";
  const cover = media?.cover || null;
  const gallery = Array.isArray(media?.gallery) ? media.gallery : [];

  const [sheetOpen, setSheetOpen] = useState(false);
  const [noteFor, setNoteFor] = useState(null);
  const [activeCat, setActiveCat] = useState(0);
  const [lightbox, setLightbox] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const navRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (p.justSent) setSheetOpen(false);
  }, [p.justSent]);
  useEffect(() => {
    document.title = tagline ? `${name} — ${tagline}` : name || document.title;
  }, [name, tagline]);
  useEffect(() => {
    if (p.cartCount === 0) setSheetOpen(false);
  }, [p.cartCount]);

  // Highlight the category the visitor is currently reading.
  useEffect(() => {
    if (!loaded || categories.length === 0 || typeof IntersectionObserver === "undefined") return;
    const els = categories.map((_, i) => document.getElementById(`sv-cat-${i}`)).filter(Boolean);
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveCat(Number(e.target.dataset.idx));
        });
      },
      { rootMargin: "-35% 0px -60% 0px" }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [loaded, categories.join("|")]);
  useEffect(() => {
    const bar = navRef.current;
    const pill = bar && bar.querySelector(`[data-pill="${activeCat}"]`);
    if (bar && pill) bar.scrollTo({ left: pill.offsetLeft - bar.clientWidth / 2 + pill.clientWidth / 2, behavior: "smooth" });
  }, [activeCat]);

  const status = site.sections.hours ? openStatus(shiftHours, now) : null;
  const hoursOn = site.sections.hours && hoursAreConfigured(shiftHours);
  const statusText = status
    ? status.open
      ? st("openUntil", { time: formatClock(status.until, locale) })
      : status.dayOffset === 0
      ? st("opensAt", { time: formatClock(status.opensAt, locale) })
      : st("opensDayAt", { day: weekdayName(status.weekday, locale), time: formatClock(status.opensAt, locale) })
    : "";

  const isAvailable = (item) => availability[item.id] !== false;
  const allItems = useMemo(() => categories.flatMap((c) => menu[c] || []), [categories, menu]);
  const featured = site.sections.featured ? allItems.filter((it) => it.featured && availability[it.id] !== false).slice(0, 10) : [];
  const socials = ["instagram", "facebook", "tiktok", "whatsapp", "website"].map((k) => ({ k, href: socialHref(k, site.social[k]) })).filter((s) => s.href);
  const headingStyle = { fontFamily: isRtl ? T.arabicFont : T.headingFont, fontWeight: isRtl ? 800 : T.headingWeight, textTransform: isRtl ? "none" : T.headingCase, letterSpacing: !isRtl && T.headingCase === "uppercase" ? "0.02em" : "normal" };
  const scrollToMenu = () => {
    const el = document.getElementById("sv-menu");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const goCat = (i) => {
    const el = document.getElementById(`sv-cat-${i}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const css = `
    ${SITE_FONT_IMPORT}
    .sv-root { --bg:${T.bg}; --surface:${T.surface}; --text:${T.text}; --muted:${T.muted}; --line:${T.line}; --accent:${T.accent}; --on-accent:${T.onAccent}; --accent2:${T.accent2}; --hl:${T.highlight}; --accent-soft:${T.accentSoft}; --radius:${T.radius}px; --hf:${T.headingFont};
      background:var(--bg); color:var(--text); min-height:100vh; font-family:${isRtl ? T.arabicFont : T.bodyFont}; -webkit-font-smoothing:antialiased; line-height:1.5; }
    .sv-root *, .sv-root *::before, .sv-root *::after { box-sizing:border-box; }
    .sv-root button { font-family:inherit; cursor:pointer; }
    .sv-root button:disabled { cursor:not-allowed; }
    .sv-root a { color:inherit; }
    .sv-wrap { max-width:980px; margin:0 auto; padding-inline:18px; }
    .sv-btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; border:2px solid transparent; border-radius:${T.id === "bold" || T.id === "minimal" ? T.radius : 999}px; padding:12px 22px; font-size:15px; font-weight:600; text-decoration:none; transition:transform .08s ease, filter .15s ease, background .15s ease; }
    .sv-btn:active:not(:disabled) { transform:scale(.97); }
    .sv-btn-primary { background:var(--accent); color:var(--on-accent); }
    .sv-btn-primary:hover:not(:disabled) { filter:brightness(1.08); }
    .sv-btn-ghost { background:transparent; color:inherit; border-color:currentColor; }
    .sv-lang { display:inline-flex; border-radius:999px; padding:3px; background:rgba(255,255,255,.85); backdrop-filter:blur(6px); }
    .sv-lang button { border:none; background:transparent; color:#333; font-size:12px; font-weight:700; padding:5px 11px; border-radius:999px; }
    .sv-lang button[aria-pressed="true"] { background:var(--accent); color:var(--on-accent); }
    .sv-pill { display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600; padding:5px 12px; border-radius:999px; }
    .sv-dot { width:8px; height:8px; border-radius:50%; display:inline-block; }
    .sv-info { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:12px; margin-top:22px; }
    .sv-info a, .sv-info > div { display:flex; align-items:center; gap:12px; padding:14px 16px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); text-decoration:none; color:var(--text); min-width:0; }
    .sv-info .sv-ico { width:38px; height:38px; border-radius:${T.id === "minimal" || T.id === "bold" ? T.radius : 999}px; display:flex; align-items:center; justify-content:center; background:var(--accent-soft); color:var(--hl); flex-shrink:0; }
    .sv-info small { display:block; color:var(--muted); font-size:12px; }
    .sv-info b { display:block; font-size:14px; font-weight:600; overflow:hidden; text-overflow:ellipsis; }
    .sv-h2 { font-size:26px; line-height:1.2; margin:0 0 14px; }
    .sv-section { padding-top:38px; }
    .sv-about { color:var(--muted); font-size:15.5px; line-height:1.75; white-space:pre-line; max-width:70ch; margin:0; }
    .sv-feat { display:flex; gap:12px; overflow-x:auto; padding-bottom:8px; margin-inline:-18px; padding-inline:18px; scroll-snap-type:x proximity; scrollbar-width:none; }
    .sv-feat::-webkit-scrollbar { display:none; }
    .sv-feat-card { flex:0 0 168px; scroll-snap-align:start; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); overflow:hidden; display:flex; flex-direction:column; }
    .sv-feat-card img { width:100%; height:112px; object-fit:cover; display:block; }
    .sv-feat-ph { height:112px; background:var(--accent-soft); display:flex; align-items:center; justify-content:center; color:var(--hl); font-size:30px; font-weight:700; }
    .sv-feat-body { padding:10px 12px 12px; display:flex; flex-direction:column; gap:6px; flex:1; }
    .sv-feat-name { font-size:14px; font-weight:600; line-height:1.3; }
    .sv-nav { position:sticky; top:0; z-index:30; background:var(--bg); border-bottom:1px solid var(--line); }
    .sv-nav-in { display:flex; gap:8px; overflow-x:auto; padding:10px 18px; scrollbar-width:none; max-width:980px; margin:0 auto; }
    .sv-nav-in::-webkit-scrollbar { display:none; }
    .sv-nav button { flex-shrink:0; border:1px solid var(--line); background:var(--surface); color:var(--text); font-size:13.5px; font-weight:600; padding:7px 16px; border-radius:999px; white-space:nowrap; transition:background .15s ease,color .15s ease; }
    .sv-nav button[aria-current="true"] { background:var(--accent); border-color:var(--accent); color:var(--on-accent); }
    ${
      T.navStyle === "underline"
        ? `.sv-nav button { background:transparent; border:none; border-bottom:3px solid transparent; border-radius:0; padding:8px 4px; margin-inline-end:12px; color:var(--muted); ${T.id === "bold" ? "text-transform:uppercase; letter-spacing:.04em; font-weight:700;" : ""} }
           .sv-nav button[aria-current="true"] { background:transparent; border-bottom-color:var(--accent); color:var(--text); }`
        : ""
    }
    .sv-cat { scroll-margin-top:64px; padding-top:30px; }
    .sv-cat h3 { font-size:22px; margin:0 0 14px; }
    .sv-items { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,420px),1fr)); gap:14px; }
    .sv-item { position:relative; display:flex; gap:14px; align-items:stretch; padding:14px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); min-width:0; }
    .sv-item[data-style="soft"] { border-color:transparent; box-shadow:0 2px 14px rgba(20,30,50,.07); }
    .sv-item[data-style="outlined"] { border:2px solid var(--line); box-shadow:4px 4px 0 var(--accent); }
    .sv-item[data-style="list"] { border:none; border-bottom:1px solid var(--line); border-radius:0; padding:16px 0; background:transparent; }
    .sv-item[data-off="true"] { opacity:.62; }
    .sv-item-main { flex:1; min-width:0; display:flex; flex-direction:column; gap:4px; }
    .sv-item-name { font-size:16px; font-weight:600; line-height:1.3; display:flex; flex-wrap:wrap; align-items:center; gap:6px; }
    .sv-item-desc { font-size:13.5px; color:var(--muted); line-height:1.5; }
    .sv-item-foot { margin-top:auto; padding-top:8px; display:flex; align-items:center; justify-content:space-between; gap:10px; }
    .sv-price { font-weight:700; font-size:15.5px; color:var(--hl); font-variant-numeric:tabular-nums; }
    .sv-img { position:relative; width:104px; height:104px; flex-shrink:0; border-radius:calc(var(--radius) * .7); overflow:hidden; background:var(--accent-soft); align-self:flex-start; }
    .sv-item[data-style="list"] .sv-img { width:80px; height:80px; border-radius:${T.radius}px; }
    .sv-img img { width:100%; height:100%; object-fit:cover; display:block; }
    .sv-soldout { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.5); color:#fff; font-size:12px; font-weight:700; }
    .sv-chip { font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:999px; letter-spacing:.02em; white-space:nowrap; }
    .sv-add { border:none; border-radius:999px; background:var(--accent); color:var(--on-accent); font-weight:700; font-size:13.5px; padding:8px 16px; display:inline-flex; align-items:center; gap:5px; }
    .sv-add:disabled { background:var(--line); color:var(--muted); }
    .sv-step { display:inline-flex; align-items:center; gap:2px; background:var(--accent-soft); border-radius:999px; padding:2px; }
    .sv-step button { width:32px; height:32px; border:none; border-radius:50%; background:var(--accent); color:var(--on-accent); display:inline-flex; align-items:center; justify-content:center; }
    .sv-step span { min-width:26px; text-align:center; font-weight:700; font-variant-numeric:tabular-nums; }
    .sv-gal { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; }
    .sv-gal button { padding:0; border:none; background:var(--accent-soft); border-radius:var(--radius); overflow:hidden; aspect-ratio:1; }
    .sv-gal img { width:100%; height:100%; object-fit:cover; display:block; transition:transform .25s ease; }
    .sv-gal button:hover img { transform:scale(1.04); }
    .sv-foot { margin-top:54px; background:${T.id === "bold" ? "#0B0B0C" : T.dark ? "#0A0C0F" : T.id === "minimal" ? "var(--bg)" : "var(--surface)"}; color:${T.id === "bold" ? "#FFF" : "var(--text)"}; border-top:1px solid var(--line); padding:38px 0 120px; }
    .sv-foot-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:30px; }
    .sv-foot h4 { margin:0 0 12px; font-size:15px; }
    .sv-foot p, .sv-foot li { font-size:14px; color:${T.id === "bold" ? "#D6D6DA" : "var(--muted)"}; margin:0 0 6px; }
    .sv-foot ul { list-style:none; margin:0; padding:0; }
    .sv-hours li { display:flex; justify-content:space-between; gap:14px; }
    .sv-socials { display:flex; flex-wrap:wrap; gap:8px; }
    .sv-socials a { font-size:13px; font-weight:600; text-decoration:none; padding:7px 14px; border-radius:999px; border:1px solid var(--line); color:inherit; }
    .sv-banner { background:var(--accent); color:var(--on-accent); text-align:center; font-size:14px; font-weight:600; padding:9px 16px; }
    .sv-cartbar { position:fixed; inset-inline:0; bottom:0; z-index:50; padding:12px 16px calc(12px + env(safe-area-inset-bottom)); background:linear-gradient(to top, var(--bg) 60%, transparent); pointer-events:none; }
    .sv-cartbar button { pointer-events:auto; width:100%; max-width:560px; margin:0 auto; display:flex; align-items:center; justify-content:space-between; gap:12px; border:none; background:var(--accent); color:var(--on-accent); border-radius:${T.id === "bold" || T.id === "minimal" ? T.radius : 16}px; padding:14px 18px; font-size:15.5px; font-weight:700; box-shadow:0 8px 28px rgba(0,0,0,.28); }
    .sv-count { background:var(--on-accent); color:var(--accent); min-width:26px; height:26px; border-radius:999px; display:inline-flex; align-items:center; justify-content:center; font-size:13px; padding:0 6px; }
    .sv-back { position:fixed; inset:0; z-index:80; background:rgba(0,0,0,.55); display:flex; align-items:flex-end; justify-content:center; }
    .sv-sheet { background:var(--bg); color:var(--text); width:100%; max-width:560px; max-height:92vh; overflow-y:auto; border-radius:22px 22px 0 0; padding:18px 18px calc(22px + env(safe-area-inset-bottom)); }
    @media (min-width:700px) { .sv-back { align-items:center; } .sv-sheet { border-radius:22px; max-height:88vh; } }
    .sv-line { display:flex; gap:12px; align-items:flex-start; padding:12px 0; border-bottom:1px solid var(--line); }
    .sv-field { width:100%; background:var(--surface); color:var(--text); border:1px solid var(--line); border-radius:${Math.min(T.radius, 12)}px; padding:11px 13px; font-size:15px; font-family:inherit; }
    .sv-field:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft); }
    .sv-seg { display:flex; gap:8px; }
    .sv-seg button { flex:1; padding:11px 0; border-radius:${Math.min(T.radius, 12)}px; border:1.5px solid var(--line); background:var(--surface); color:var(--text); font-size:14.5px; font-weight:600; }
    .sv-seg button[aria-pressed="true"] { border-color:var(--accent); background:var(--accent-soft); color:var(--hl); }
    .sv-row { display:flex; justify-content:space-between; gap:12px; font-size:14px; color:var(--muted); padding:2px 0; }
    .sv-total { display:flex; justify-content:space-between; font-size:18px; font-weight:700; color:var(--text); margin-top:8px; }
    .sv-err { color:#D9534F; font-size:13px; margin-top:8px; }
    .sv-lightbox { position:fixed; inset:0; z-index:90; background:rgba(0,0,0,.88); display:flex; align-items:center; justify-content:center; padding:18px; }
    .sv-lightbox img { max-width:100%; max-height:100%; border-radius:8px; }
    .sv-link-btn { background:none; border:none; color:var(--hl); font-size:13px; padding:0; text-decoration:underline; }
    @media (prefers-reduced-motion: reduce) { .sv-root * { transition:none !important; scroll-behavior:auto !important; } }
  `;

  // ---- hero ----
  const logoEl = brand.logo ? (
    <img src={brand.logo} alt={name} style={{ width: 72, height: 72, borderRadius: T.id === "bold" || T.id === "minimal" ? T.radius : 18, objectFit: "contain", background: "#fff", padding: 6, boxShadow: "0 4px 18px rgba(0,0,0,.25)" }} />
  ) : null;
  // On photos and colored blocks the pill is a frosted chip with white text; on a plain light page it is tinted.
  const statusPill = (onMedia) =>
    status ? (
      <span className="sv-pill" style={onMedia ? { background: "rgba(0,0,0,.38)", color: "#fff", backdropFilter: "blur(6px)" } : { background: status.open ? "rgba(34,197,94,.14)" : "rgba(239,68,68,.12)", color: status.open ? "#15803D" : "#B91C1C" }}>
        <span className="sv-dot" style={{ background: status.open ? "#22C55E" : "#EF4444" }} />
        {status.open ? st("openNow") : st("closedNow")} · {statusText}
      </span>
    ) : null;
  const ctas = (mode) => (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
      <button className="sv-btn" onClick={scrollToMenu} style={mode === "inverted" ? { background: T.onAccent, color: T.accent } : { background: T.accent, color: T.onAccent }}>
        {st("orderNow")}
      </button>
      {telHref && (
        <a className="sv-btn sv-btn-ghost" href={telHref} style={mode === "inverted" ? { color: T.onAccent } : mode === "overlay" ? { color: "#fff" } : { color: T.text }}>
          <PhoneIcon size={17} /> {st("callUs")}
        </a>
      )}
    </div>
  );
  const langToggle = (
    <div className="sv-lang" role="group" aria-label="Language">
      {["ar", "en"].map((c) => (
        <button key={c} aria-pressed={lang === c} onClick={() => setLang(c)}>
          {c === "ar" ? "AR" : "EN"}
        </button>
      ))}
    </div>
  );
  const gradientFallback = `linear-gradient(135deg, ${T.accent} 0%, ${withAlpha(T.accent, 0.72)} 55%, ${T.accent2} 140%)`;

  let hero;
  if (!p.isGeneralLink) {
    // A table's QR menu: a compact header instead of the full landing hero.
    hero = (
      <div style={{ background: T.accent, color: T.onAccent, padding: "20px 0" }}>
        <div className="sv-wrap" style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {logoEl}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...headingStyle, fontSize: 24, lineHeight: 1.15 }}>{name}</div>
            <div style={{ fontSize: 13.5, opacity: 0.85 }}>{st("tableLabel", { n: p.tableId })}</div>
          </div>
          {langToggle}
        </div>
      </div>
    );
  } else if (T.hero === "overlay") {
    hero = (
      <header style={{ position: "relative", minHeight: "min(68vh, 460px)", display: "flex", flexDirection: "column", justifyContent: "flex-end", color: "#fff", background: gradientFallback, overflow: "hidden" }}>
        {cover && <img src={cover} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(8,8,10,.82) 0%, rgba(8,8,10,.35) 55%, rgba(8,8,10,.25) 100%)" }} />
        <div className="sv-wrap" style={{ position: "absolute", top: 14, insetInline: 0, display: "flex", justifyContent: "flex-end" }}>{langToggle}</div>
        <div className="sv-wrap" style={{ position: "relative", width: "100%", paddingBlock: "70px 30px" }}>
          {logoEl && <div style={{ marginBottom: 14 }}>{logoEl}</div>}
          <h1 style={{ ...headingStyle, fontSize: "clamp(32px, 7vw, 54px)", lineHeight: 1.08, margin: 0 }}>{name}</h1>
          {tagline && <p style={{ margin: "8px 0 0", fontSize: "clamp(15px, 2.6vw, 18px)", opacity: 0.92, maxWidth: "46ch" }}>{tagline}</p>}
          {status && <div style={{ marginTop: 14 }}>{statusPill(true)}</div>}
          {ctas("overlay")}
        </div>
      </header>
    );
  } else if (T.hero === "block") {
    hero = (
      <header>
        <div style={{ position: "relative", height: 190, background: gradientFallback, overflow: "hidden" }}>
          {cover && <img src={cover} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
          <div className="sv-wrap" style={{ position: "absolute", top: 14, insetInline: 0, display: "flex", justifyContent: "flex-end" }}>{langToggle}</div>
        </div>
        <div style={{ background: T.accent, color: T.onAccent, padding: "26px 0 30px" }}>
          <div className="sv-wrap" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            {logoEl}
            <div style={{ minWidth: 0 }}>
              <h1 style={{ ...headingStyle, fontSize: "clamp(36px, 9vw, 64px)", lineHeight: 1, margin: 0 }}>{name}</h1>
              {tagline && <p style={{ margin: "10px 0 0", fontSize: 16, opacity: 0.92, maxWidth: "46ch" }}>{tagline}</p>}
              {status && <div style={{ marginTop: 12 }}>{statusPill(true)}</div>}
              {ctas("inverted")}
            </div>
          </div>
        </div>
      </header>
    );
  } else {
    hero = (
      <header className="sv-wrap" style={{ paddingTop: 18, paddingBottom: 6 }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>{langToggle}</div>
        <div style={{ textAlign: "center", padding: "20px 0 4px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          {logoEl && <div style={{ marginBottom: 12 }}>{logoEl}</div>}
          <h1 style={{ ...headingStyle, fontSize: "clamp(30px, 6vw, 44px)", margin: 0, lineHeight: 1.1 }}>{name}</h1>
          {tagline && <p style={{ margin: "8px 0 0", color: T.muted, fontSize: 16, maxWidth: "46ch" }}>{tagline}</p>}
          {status && <div style={{ marginTop: 12 }}>{statusPill(false)}</div>}
          {ctas("plain")}
        </div>
        {cover && <img src={cover} alt="" style={{ width: "100%", height: "min(46vw, 320px)", objectFit: "cover", marginTop: 24, display: "block" }} />}
      </header>
    );
  }

  // ---- menu ----
  const renderBadges = (item) =>
    (Array.isArray(item.badges) ? item.badges : [])
      .filter((b) => ITEM_BADGES.includes(b))
      .map((b) => {
        const c = BADGE_COLORS[b] || T.highlight;
        return (
          <span key={b} className="sv-chip" style={{ background: withAlpha(c.startsWith("#") ? c : T.accent2, T.dark ? 0.2 : 0.12), color: T.dark ? "#fff" : c }}>
            {st(`badge_${b}`)}
          </span>
        );
      });
  const action = (item) => {
    const qty = p.cart[item.id]?.qty || 0;
    const ok = isAvailable(item);
    if (qty > 0) {
      return (
        <div className="sv-step">
          <button aria-label="−" onClick={() => p.changeQty(item, -1)}><MinusIcon size={16} /></button>
          <span>{qty}</span>
          <button aria-label="+" onClick={() => ok && p.changeQty(item, 1)}><PlusIcon size={16} /></button>
        </div>
      );
    }
    return (
      <button className="sv-add" disabled={!ok} onClick={() => ok && p.changeQty(item, 1)}>
        <PlusIcon size={15} /> {st("add")}
      </button>
    );
  };

  const menuSection = (
    <section id="sv-menu" style={{ paddingTop: 38 }}>
      <div className="sv-wrap">
        <h2 className="sv-h2" style={headingStyle}>{st("menuTitle")}</h2>
      </div>
      {loaded && categories.length > 0 && (
        <nav className="sv-nav" aria-label={st("menuTitle")}>
          <div className="sv-nav-in" ref={navRef}>
            {categories.map((c, i) => (
              <button key={c} data-pill={i} aria-current={activeCat === i} onClick={() => goCat(i)}>{c}</button>
            ))}
          </div>
        </nav>
      )}
      <div className="sv-wrap">
        {!loaded ? (
          <div style={{ color: T.muted, padding: "30px 0" }}>{t("loading")}</div>
        ) : (
          categories.map((cat, i) => (
            <div key={cat} id={`sv-cat-${i}`} data-idx={i} className="sv-cat">
              <h3 style={headingStyle}>{cat}</h3>
              <div className="sv-items">
                {(menu[cat] || []).map((item) => {
                  const ok = isAvailable(item);
                  return (
                    <article key={item.id} className="sv-item" data-style={T.itemStyle} data-off={!ok}>
                      <div className="sv-item-main">
                        <div className="sv-item-name">
                          <span>{item.name}</span>
                          {renderBadges(item)}
                        </div>
                        {item.tag && <div className="sv-item-desc">{item.tag}</div>}
                        <div className="sv-item-foot">
                          <span className="sv-price">{money(item.price)}</span>
                          {action(item)}
                        </div>
                      </div>
                      {item.image && (
                        <div className="sv-img">
                          <img src={item.image} alt="" loading="lazy" />
                          {!ok && <div className="sv-soldout">{st("soldOut")}</div>}
                        </div>
                      )}
                      {!item.image && !ok && <span className="sv-chip" style={{ position: "absolute", top: 10, insetInlineEnd: 10, background: "rgba(0,0,0,.6)", color: "#fff" }}>{st("soldOut")}</span>}
                    </article>
                  );
                })}
                {(menu[cat] || []).length === 0 && <div style={{ color: T.muted, fontSize: 14 }}>{t("noItemsYet")}</div>}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );

  // ---- hours ----
  const todayCfg = hoursOn ? shiftHours[["sun", "mon", "tue", "wed", "thu", "fri", "sat"][now.getDay()]] : null;
  const infoCards = p.isGeneralLink
    ? [
        site.address.trim() || mapsHref
          ? { key: "addr", icon: <PinIcon size={19} />, label: st("contactTitle"), value: site.address.trim() || st("getDirections"), href: mapsHref || undefined }
          : null,
        hoursOn && todayCfg ? { key: "hrs", icon: <ClockIcon size={19} />, label: st("hoursToday"), value: `${formatClock(todayCfg.start, locale)} – ${formatClock(todayCfg.end, locale)}` } : null,
        phone ? { key: "tel", icon: <PhoneIcon size={19} />, label: st("callUs"), value: phone, href: telHref } : null,
      ].filter(Boolean)
    : [];

  const sheet = sheetOpen && (
    <div className="sv-back" onClick={() => setSheetOpen(false)}>
      <div className="sv-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h2 style={{ ...headingStyle, fontSize: 24, margin: 0 }}>{st("yourOrder")}</h2>
          <button onClick={() => setSheetOpen(false)} aria-label={st("close")} style={{ border: "none", background: "transparent", color: T.text, padding: 6 }}><CloseIcon size={22} /></button>
        </div>
        {p.cartLines.length === 0 && <div style={{ color: T.muted, padding: "18px 0" }}>{st("emptyCart")}</div>}
        {p.cartLines.map((l) => (
          <div key={l.id} className="sv-line">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{l.name}</div>
              <div style={{ color: T.muted, fontSize: 13.5 }}>{money(l.price)}</div>
              {noteFor === l.id ? (
                <input
                  className="sv-field"
                  autoFocus
                  maxLength={140}
                  value={l.note}
                  placeholder={t("notePlaceholder")}
                  onChange={(e) => p.updateCartItemNote(l.id, e.target.value)}
                  onBlur={() => setNoteFor(null)}
                  onKeyDown={(e) => e.key === "Enter" && setNoteFor(null)}
                  style={{ marginTop: 8, padding: "8px 10px", fontSize: 14 }}
                />
              ) : (
                <button className="sv-link-btn" onClick={() => setNoteFor(l.id)} style={{ marginTop: 4, fontStyle: l.note ? "italic" : "normal" }}>
                  {l.note || t("addNote")}
                </button>
              )}
            </div>
            <div className="sv-step">
              <button aria-label="−" onClick={() => p.changeQty(l, -1)}><MinusIcon size={16} /></button>
              <span>{l.qty}</span>
              <button aria-label="+" onClick={() => p.changeQty(l, 1)}><PlusIcon size={16} /></button>
            </div>
            <div style={{ minWidth: 76, textAlign: "end", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{money(l.price * l.qty)}</div>
          </div>
        ))}

        {p.isGeneralLink && (
          <div style={{ marginTop: 18 }}>
            <div className="sv-seg">
              {["pickup", "delivery"].map((m) => (
                <button key={m} aria-pressed={p.deliveryMethodChoice === m} onClick={() => { p.setDeliveryMethodChoice(m); if (m === "pickup") p.setSelectedZoneId(""); }}>
                  {st(m)}
                </button>
              ))}
            </div>
            {p.deliveryMethodChoice === "delivery" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                {p.deliveryZones.length === 0 ? (
                  <div style={{ color: T.muted, fontSize: 13.5 }}>{t("noZonesYet")}</div>
                ) : (
                  <select className="sv-field" value={p.selectedZoneId} onChange={(e) => p.setSelectedZoneId(e.target.value)}>
                    <option value="">{t("selectZonePlaceholder")}</option>
                    {p.deliveryZones.map((z) => (
                      <option key={z.id} value={z.id}>{z.label} — {money(z.fee)}</option>
                    ))}
                  </select>
                )}
                <input className="sv-field" type="text" value={p.customer.name} onChange={(e) => p.customer.setName(e.target.value)} placeholder={t("namePlaceholder")} />
                <input className="sv-field" type="tel" value={p.customer.phone} onChange={(e) => p.customer.setPhone(e.target.value)} placeholder={t("phonePlaceholder")} />
                <input className="sv-field" type="text" value={p.customer.address} onChange={(e) => p.customer.setAddress(e.target.value)} placeholder={t("addressPlaceholder")} />
              </div>
            )}
            {p.zoneChoiceError && <div className="sv-err">{t("notice_chooseZoneFirst")}</div>}
            {p.customerInfoError && <div className="sv-err">{t("notice_deliveryDetailsRequired")}</div>}
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <div className="sv-row"><span>{t("subtotal")}</span><span>{money(p.cartTotal)}</span></div>
          {p.servicePercent > 0 && <div className="sv-row"><span>{t("serviceCharge")} ({p.servicePercent}%)</span><span>{money(p.serviceAmt)}</span></div>}
          {p.vatPercent > 0 && <div className="sv-row"><span>{t("vat")} ({p.vatPercent}%)</span><span>{money(p.vatAmt)}</span></div>}
          {p.deliveryFeeAmount > 0 && <div className="sv-row"><span>{t("deliveryFeeLineLabel")}</span><span>{money(p.deliveryFeeAmount)}</span></div>}
          <div className="sv-total"><span>{t("orderTotal")}</span><span>{money(p.orderTotal)}</span></div>
        </div>

        {p.sendError && <div className="sv-err">{t("notice_orderSendFailed")}</div>}
        {!p.isOnline && !p.sendError && <div className="sv-err">{t("offlineOrderingHint")}</div>}
        <button
          className="sv-btn sv-btn-primary"
          onClick={p.submitOrder}
          disabled={p.previewMode || p.sending || p.cartCount === 0 || (p.isGeneralLink && !p.deliveryMethodChoice)}
          style={{ width: "100%", marginTop: 16, padding: "15px 22px", fontSize: 16, opacity: p.previewMode || p.sending || (p.isGeneralLink && !p.deliveryMethodChoice) ? 0.6 : 1 }}
        >
          {p.previewMode ? st("previewSend") : t("sendOrderToKitchen")}
        </button>
      </div>
    </div>
  );

  const sent = p.justSent && (
    <div className="sv-back" style={{ alignItems: "center", padding: 20 }} onClick={() => p.setJustSent(false)}>
      <div className="sv-sheet" style={{ borderRadius: 22, maxWidth: 380, textAlign: "center", padding: 28 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(34,197,94,.16)", color: "#16A34A", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <Icon d="M5 13l4 4L19 7" size={28} sw={2.4} />
        </div>
        <div style={{ ...headingStyle, fontSize: 22, marginBottom: 8 }}>{t("orderSentTitle")}</div>
        <div style={{ color: T.muted, fontSize: 14.5, marginBottom: 20, lineHeight: 1.6 }}>{t("orderSentSubtitle")}</div>
        <button className="sv-btn sv-btn-primary" style={{ width: "100%" }} onClick={() => p.setJustSent(false)}>{t("orderSentOk")}</button>
      </div>
    </div>
  );

  return (
    <div className="sv-root" dir={isRtl ? "rtl" : "ltr"} lang={lang} style={{ paddingBottom: p.cartCount > 0 ? 84 : 0 }}>
      <style>{css}</style>
      {p.previewMode && <div className="sv-banner" style={{ background: "#111", color: "#fff" }}>{st("previewBanner")}</div>}
      {announcementText && <div className="sv-banner">{announcementText}</div>}
      {p.orderConfirmed && (
        <div className="sv-banner" style={{ background: "#16A34A", color: "#fff", display: "flex", justifyContent: "center", gap: 12 }}>
          <span>✓ {t("orderConfirmedBanner")}</span>
          <button onClick={p.dismissConfirmed} aria-label={st("close")} style={{ border: "none", background: "transparent", color: "inherit", padding: 0 }}><CloseIcon size={16} /></button>
        </div>
      )}

      {hero}

      <div className="sv-wrap">
        {infoCards.length > 0 && (
          <div className="sv-info">
            {infoCards.map((c) => {
              const inner = (
                <>
                  <span className="sv-ico">{c.icon}</span>
                  <span style={{ minWidth: 0 }}>
                    <small>{c.label}</small>
                    <b>{c.value}</b>
                  </span>
                </>
              );
              return c.href ? (
                <a key={c.key} href={c.href} target={c.href.startsWith("tel:") ? undefined : "_blank"} rel="noopener noreferrer">{inner}</a>
              ) : (
                <div key={c.key}>{inner}</div>
              );
            })}
          </div>
        )}

        {p.isGeneralLink && site.sections.about && about && (
          <section className="sv-section">
            <h2 className="sv-h2" style={headingStyle}>{st("aboutTitle")}</h2>
            <p className="sv-about">{about}</p>
          </section>
        )}

        {p.isGeneralLink && featured.length > 0 && (
          <section className="sv-section">
            <h2 className="sv-h2" style={headingStyle}>{st("featuredTitle")}</h2>
            <div className="sv-feat">
              {featured.map((item) => (
                <div key={item.id} className="sv-feat-card">
                  {item.image ? <img src={item.image} alt="" loading="lazy" /> : <div className="sv-feat-ph">{(item.name || "?").trim().charAt(0)}</div>}
                  <div className="sv-feat-body">
                    <div className="sv-feat-name">{item.name}</div>
                    <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
                      <span className="sv-price" style={{ fontSize: 14, whiteSpace: "nowrap" }}>{money(item.price)}</span>
                      {action(item)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!p.isGeneralLink && (
          <button className="sv-btn sv-btn-ghost" onClick={p.openBill} style={{ width: "100%", marginTop: 20, color: T.text }}>
            {t("requestBillButton")}
          </button>
        )}
      </div>

      {menuSection}

      {p.isGeneralLink && site.sections.gallery && gallery.length > 0 && (
        <section className="sv-wrap sv-section">
          <h2 className="sv-h2" style={headingStyle}>{st("galleryTitle")}</h2>
          <div className="sv-gal">
            {gallery.map((src, i) => (
              <button key={i} onClick={() => setLightbox(i)} aria-label={`${st("galleryTitle")} ${i + 1}`}>
                <img src={src} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        </section>
      )}

      {p.isGeneralLink && (
        <footer className="sv-foot">
          <div className="sv-wrap">
            <div className="sv-foot-grid">
              <div>
                <h4 style={headingStyle}>{name}</h4>
                {tagline && <p>{tagline}</p>}
                {site.address.trim() && <p>{site.address}</p>}
                {mapsHref && <p><a href={mapsHref} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", fontWeight: 600 }}>{st("getDirections")} →</a></p>}
                {phone && <p><a href={telHref} style={{ color: "inherit", fontWeight: 600 }}>{phone}</a></p>}
              </div>
              {hoursOn && (
                <div>
                  <h4 style={headingStyle}>{st("hoursTitle")}</h4>
                  <ul className="sv-hours">
                    {groupHours(shiftHours).map((g, i) => (
                      <li key={i}>
                        <span>{g.days.length > 1 ? `${weekdayName(g.days[0], locale, "short")} – ${weekdayName(g.days[g.days.length - 1], locale, "short")}` : weekdayName(g.days[0], locale, "long")}</span>
                        <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatClock(g.start, locale)} – {formatClock(g.end, locale)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {socials.length > 0 && (
                <div>
                  <h4 style={headingStyle}>{st("followUs")}</h4>
                  <div className="sv-socials">
                    {socials.map((s) => (
                      <a key={s.k} href={s.href} target="_blank" rel="noopener noreferrer">{st(`social_${s.k}`)}</a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{ marginTop: 34, fontSize: 11.5, color: T.id === "bold" ? "#8C8C93" : T.muted, textAlign: "center", letterSpacing: 0.4 }}>{st("poweredBy")}</div>
          </div>
        </footer>
      )}
      {!p.isGeneralLink && <div style={{ height: 40, textAlign: "center", fontSize: 11.5, color: T.muted, marginTop: 30 }}>{st("poweredBy")}</div>}

      {p.cartCount > 0 && !sheetOpen && (
        <div className="sv-cartbar">
          <button onClick={() => setSheetOpen(true)}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <span className="sv-count">{p.cartCount}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><BagIcon size={18} /> {st("viewOrder")}</span>
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(p.orderTotal)}</span>
          </button>
        </div>
      )}

      {sheet}
      {sent}
      {p.billModal}

      {lightbox !== null && (
        <div className="sv-lightbox" onClick={() => setLightbox(null)}>
          <img src={gallery[lightbox]} alt="" />
        </div>
      )}
    </div>
  );
}
