"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { SITE_PRESET_IDS, SITE_PRESETS, SLUG_RE, mergeSiteSettings, SITE_FONT_IMPORT } from "./presets";
import { makeSiteT } from "./siteStrings";

// The manager's "Website" screen: pick a look, add photos and details, preview it next to the
// controls, then publish. Everything auto-saves (like the rest of Settings); nothing reaches
// customers until the Published switch is on.

const labelStyle = { fontSize: 11, color: "var(--text-muted, #8A8F99)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 };
const card = { background: "var(--surface)", border: "1px solid var(--border, #3A404C)", borderRadius: 12, padding: 16, marginBottom: 16 };
const h = { fontFamily: "Fraunces, serif", fontSize: 15, fontWeight: 600, marginBottom: 12 };
const hint = { fontSize: 11.5, color: "var(--text-faint, #6E7580)", marginTop: 6, lineHeight: 1.5 };

export default function WebsiteSettingsPanel({ tenantId, isRtl, isMobile, theme, brand, loadKey, saveKey, resizeImage, flashNotice, copyText }) {
  const st = useMemo(() => makeSiteT(isRtl ? "ar" : "en"), [isRtl]);
  const [draft, setDraft] = useState(null);
  const [media, setMedia] = useState({ cover: null, gallery: [] });
  const [saveState, setSaveState] = useState("idle");
  const [previewKey, setPreviewKey] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [slugDraft, setSlugDraft] = useState("");
  const [slugMsg, setSlugMsg] = useState(null);
  const [copied, setCopied] = useState(false);
  const saveTimer = useRef(null);
  const previewTimer = useRef(null);
  const draftRef = useRef(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const basePath = `/t/${encodeURIComponent(tenantId)}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [s, m] = await Promise.all([loadKey("website-settings"), loadKey("website-media")]);
      let slugValue = "";
      try {
        const r = await fetch(`/api/pos/${encodeURIComponent(tenantId)}/site-slug`);
        if (r.ok) slugValue = (await r.json()).slug || "";
      } catch (e) {
        // the address section simply shows empty
      }
      if (cancelled) return;
      const merged = mergeSiteSettings(s);
      draftRef.current = merged;
      setDraft(merged);
      setMedia({ cover: m?.cover || null, gallery: Array.isArray(m?.gallery) ? m.gallery : [] });
      setSlug(slugValue);
      setSlugDraft(slugValue);
    })();
    return () => {
      cancelled = true;
      clearTimeout(saveTimer.current);
      clearTimeout(previewTimer.current);
    };
  }, []);

  const refreshPreview = () => {
    clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => setPreviewKey((k) => k + 1), 500);
  };
  // Saves 700ms after the last change so typing doesn't write on every keystroke.
  const scheduleSave = () => {
    setSaveState("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const ok = await saveKey("website-settings", draftRef.current);
      setSaveState(ok ? "saved" : "failed");
      if (ok) refreshPreview();
    }, 700);
  };
  const update = (patch) => {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
    scheduleSave();
  };
  const updateIn = (group, patch) => update({ [group]: { ...draftRef.current[group], ...patch } });
  const saveMedia = async (next) => {
    setMedia(next);
    setSaveState("saving");
    const ok = await saveKey("website-media", next);
    setSaveState(ok ? "saved" : "failed");
    if (ok) refreshPreview();
  };

  const pickImage = async (file, maxDim, quality) => {
    if (!file || !file.type.startsWith("image/")) {
      flashNotice(st("wsImageFailed"));
      return null;
    }
    try {
      return await resizeImage(file, maxDim, quality);
    } catch (e) {
      flashNotice(st("wsImageFailed"));
      return null;
    }
  };
  const uploadCover = async (file) => {
    const url = await pickImage(file, 1400, 0.72);
    if (url) saveMedia({ ...media, cover: url });
  };
  const addGallery = async (files) => {
    const room = 6 - media.gallery.length;
    const list = Array.from(files || []).slice(0, Math.max(0, room));
    const urls = [];
    for (const f of list) {
      const u = await pickImage(f, 900, 0.7);
      if (u) urls.push(u);
    }
    if (urls.length) saveMedia({ ...media, gallery: [...media.gallery, ...urls] });
  };

  const saveSlug = async () => {
    const value = slugDraft.trim().toLowerCase();
    if (!SLUG_RE.test(value)) {
      setSlugMsg({ ok: false, text: st("wsSlugInvalid") });
      return;
    }
    try {
      const r = await fetch(`/api/pos/${encodeURIComponent(tenantId)}/site-slug`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: value }),
      });
      const body = await r.json().catch(() => ({}));
      if (r.ok) {
        setSlug(value);
        setSlugDraft(value);
        setSlugMsg({ ok: true, text: st("wsSlugSaved") });
      } else {
        setSlugMsg({ ok: false, text: body.code === "taken" ? st("wsSlugTaken") : body.code === "reserved" ? st("wsSlugReserved") : st("wsSlugInvalid") });
      }
    } catch (e) {
      setSlugMsg({ ok: false, text: st("wsSaveFailed") });
    }
  };

  if (!draft) return <div style={{ fontSize: 13, color: "var(--text-faint, #6E7580)" }}>…</div>;

  const siteLink = slug ? `${origin}/r/${slug}` : `${origin}${basePath}?order=1`;
  const previewSrc = `${origin}${basePath}?order=1&preview=1&v=${previewKey}`;
  const brandAccent = brand.primary || "#7C2D3B";
  const brandAccent2 = brand.secondary || "#B08D57";

  const field = { width: "100%", boxSizing: "border-box" };
  const textRow = (label, valueObj, key, placeholder, multiline) => (
    <div style={{ marginBottom: 12 }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[["en", st("wsEnglish")], ["ar", st("wsArabic")]].map(([code, name]) => {
          const common = {
            value: valueObj[code] || "",
            onChange: (e) => updateIn(key, { [code]: e.target.value }),
            placeholder: `${placeholder} (${name})`,
            className: "field",
            style: { ...field, direction: code === "ar" ? "rtl" : "ltr" },
          };
          return multiline ? <textarea key={code} rows={3} {...common} /> : <input key={code} type="text" maxLength={120} {...common} />;
        })}
      </div>
    </div>
  );
  const sectionToggle = (key, label) => (
    <label key={key} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, padding: "6px 0", cursor: "pointer" }}>
      <input type="checkbox" checked={!!draft.sections[key]} onChange={(e) => updateIn("sections", { [key]: e.target.checked })} />
      {label}
    </label>
  );

  const controls = (
    <div style={{ flex: 1, minWidth: 0 }}>
      <style>{SITE_FONT_IMPORT}</style>
      <div style={{ ...card, borderColor: draft.enabled ? "#4E7A47" : "var(--border, #3A404C)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...h, marginBottom: 4 }}>{st("wsPublishTitle")}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted, #8A8F99)", lineHeight: 1.5 }}>{draft.enabled ? st("wsPublishOn") : st("wsPublishOff")}</div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={draft.enabled}
            aria-label={st("wsPublishToggle")}
            onClick={() => update({ enabled: !draft.enabled })}
            style={{ width: 54, height: 30, borderRadius: 999, border: "none", background: draft.enabled ? "#4E9A47" : "var(--track, #4A4F5A)", position: "relative", cursor: "pointer", flexShrink: 0 }}
          >
            <span style={{ position: "absolute", top: 3, insetInlineStart: draft.enabled ? 27 : 3, width: 24, height: 24, borderRadius: "50%", background: "#fff", transition: "inset-inline-start .15s ease" }} />
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180, fontSize: 12, fontFamily: "IBM Plex Mono, monospace", color: "var(--text-muted, #8A8F99)", wordBreak: "break-all" }}>{siteLink}</div>
          <button
            type="button"
            onClick={async () => {
              if (await copyText(siteLink)) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              }
            }}
            style={{ fontSize: 12, padding: "7px 14px", borderRadius: 7, border: `1px solid ${theme.secondary}`, background: "transparent", color: theme.secondaryLight, cursor: "pointer" }}
          >
            {copied ? st("wsSlugCopied") : st("wsSlugCopy")}
          </button>
        </div>
        <div style={{ fontSize: 11.5, marginTop: 10, minHeight: 16, color: saveState === "failed" ? "#E3A79C" : "var(--text-faint, #6E7580)" }}>
          {saveState === "saving" ? st("wsSaving") : saveState === "saved" ? `✓ ${st("wsSaved")}` : saveState === "failed" ? st("wsSaveFailed") : ""}
        </div>
      </div>

      <div style={card}>
        <div style={h}>{st("wsLookTitle")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
          {SITE_PRESET_IDS.map((id) => {
            const pr = SITE_PRESETS[id];
            const sel = draft.preset === id;
            const acc = draft.accent || brandAccent;
            return (
              <button
                key={id}
                type="button"
                onClick={() => update({ preset: id })}
                aria-pressed={sel}
                style={{ textAlign: "start", padding: 0, borderRadius: 12, border: `2px solid ${sel ? theme.secondary : "var(--border, #3A404C)"}`, background: "transparent", cursor: "pointer", overflow: "hidden", color: "var(--text-primary)" }}
              >
                <div style={{ background: pr.bg, padding: "12px 12px 14px", borderBottom: "1px solid var(--border, #3A404C)" }}>
                  <div style={{ fontFamily: pr.headingFont, fontWeight: pr.headingWeight, textTransform: pr.headingCase, fontSize: 17, color: pr.text, lineHeight: 1.1, marginBottom: 8 }}>{brand.name || "Aa"}</div>
                  <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                    <span style={{ width: 34, height: 14, borderRadius: Math.min(pr.radius, 7), background: acc }} />
                    <span style={{ width: 20, height: 14, borderRadius: Math.min(pr.radius, 7), background: pr.surface, border: `1px solid ${pr.line}` }} />
                    <span style={{ width: 14, height: 14, borderRadius: "50%", background: draft.accent2 || brandAccent2 }} />
                  </div>
                </div>
                <div style={{ padding: "8px 12px 10px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{st(`preset_${id}`)}</div>
                  <div style={{ fontSize: 11, color: "var(--text-faint, #6E7580)", lineHeight: 1.35, marginTop: 2 }}>{st(`preset_${id}_desc`)}</div>
                </div>
              </button>
            );
          })}
        </div>
        <div style={hint}>{st("wsLookHint")}</div>

        <div style={{ ...labelStyle, marginTop: 18 }}>{st("wsColorsTitle")}</div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-end" }}>
          {[["accent", st("wsAccent"), brandAccent], ["accent2", st("wsAccent2"), brandAccent2]].map(([key, label, fallback]) => (
            <div key={key}>
              <div style={{ fontSize: 12, color: "var(--text-muted, #8A8F99)", marginBottom: 6 }}>{label}</div>
              <input type="color" value={draft[key] || fallback} onChange={(e) => update({ [key]: e.target.value })} style={{ width: 52, height: 36, padding: 0, border: "1px solid var(--border, #3A404C)", borderRadius: 6, background: "transparent", cursor: "pointer" }} />
            </div>
          ))}
          {(draft.accent || draft.accent2) && (
            <button type="button" onClick={() => update({ accent: null, accent2: null })} style={{ fontSize: 12, padding: "8px 12px", borderRadius: 7, border: "1px solid var(--border, #3A404C)", background: "transparent", color: "var(--text-muted, #8A8F99)", cursor: "pointer" }}>
              {st("wsUseBrand")}
            </button>
          )}
        </div>
        <div style={hint}>{st("wsColorsHint")}</div>

        <div style={{ ...labelStyle, marginTop: 18 }}>{st("wsLangTitle")}</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[["ar", st("wsLangAr")], ["en", st("wsLangEn")]].map(([code, label]) => (
            <button key={code} type="button" onClick={() => update({ defaultLang: code })} style={{ padding: "7px 16px", borderRadius: 999, border: `1px solid ${draft.defaultLang === code ? theme.secondary : "var(--border, #3A404C)"}`, background: draft.defaultLang === code ? "rgba(176,141,87,0.18)" : "transparent", color: draft.defaultLang === code ? theme.secondaryLight : "var(--text-muted, #8A8F99)", fontSize: 12.5, cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={h}>{st("wsHeaderTitle")}</div>
        <div style={labelStyle}>{st("wsCover")}</div>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
          <div style={{ width: 150, height: 84, borderRadius: 8, overflow: "hidden", background: "var(--bg)", border: "1px solid var(--border, #3A404C)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {media.cover ? <img src={media.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 11, color: "var(--text-faint, #6E7580)" }}>{st("wsCover")}</span>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12, padding: "8px 14px", borderRadius: 7, border: `1px solid ${theme.secondary}`, color: theme.secondaryLight, cursor: "pointer", textAlign: "center" }}>
              {media.cover ? st("wsCoverChange") : st("wsCoverUpload")}
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { uploadCover(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            {media.cover && (
              <button type="button" onClick={() => saveMedia({ ...media, cover: null })} style={{ fontSize: 12, padding: "8px 14px", borderRadius: 7, border: "1px solid var(--border, #3A404C)", background: "transparent", color: "var(--text-muted, #8A8F99)", cursor: "pointer" }}>
                {st("wsCoverRemove")}
              </button>
            )}
          </div>
        </div>
        <div style={{ ...hint, marginBottom: 14 }}>{st("wsCoverHint")}</div>
        {textRow(st("wsTagline"), draft.tagline, "tagline", st("wsTaglinePh"), false)}
        {textRow(st("wsAboutTitle"), draft.about, "about", st("wsAboutPh"), true)}
      </div>

      <div style={card}>
        <div style={h}>{st("wsAnnouncementTitle")}</div>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, marginBottom: 12, cursor: "pointer" }}>
          <input type="checkbox" checked={!!draft.announcement.on} onChange={(e) => updateIn("announcement", { on: e.target.checked })} />
          {st("wsAnnouncementOn")}
        </label>
        {draft.announcement.on && textRow("", draft.announcement, "announcement", st("wsAnnouncementPh"), false)}
      </div>

      <div style={card}>
        <div style={h}>{st("wsContactTitle")}</div>
        <div style={{ marginBottom: 12 }}>
          <div style={labelStyle}>{st("wsAddress")}</div>
          <input type="text" className="field" style={field} value={draft.address} placeholder={st("wsAddressPh")} onChange={(e) => update({ address: e.target.value })} />
          <div style={hint}>{st("wsContactNote")}</div>
        </div>
        {[["instagram", "wsInstagram"], ["facebook", "wsFacebook"], ["tiktok", "wsTiktok"], ["whatsapp", "wsWhatsapp"], ["website", "wsWebsite"]].map(([k, label]) => (
          <div key={k} style={{ marginBottom: 10 }}>
            <div style={labelStyle}>{st(label)}</div>
            <input type="text" className="field" style={{ ...field, direction: "ltr" }} value={draft.social[k]} onChange={(e) => updateIn("social", { [k]: e.target.value })} />
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={h}>{st("wsSectionsTitle")}</div>
        {sectionToggle("about", st("wsSecAbout"))}
        {sectionToggle("featured", st("wsSecFeatured"))}
        {sectionToggle("gallery", st("wsSecGallery"))}
        {sectionToggle("hours", st("wsSecHours"))}
        <div style={hint}>{st("wsHoursNote")}</div>
      </div>

      <div style={card}>
        <div style={h}>{st("wsGalleryTitle")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: 8, marginBottom: 10 }}>
          {media.gallery.map((src, i) => (
            <div key={i} style={{ position: "relative", aspectRatio: "1", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border, #3A404C)" }}>
              <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button type="button" aria-label={st("wsGalleryRemove")} onClick={() => saveMedia({ ...media, gallery: media.gallery.filter((_, j) => j !== i) })} style={{ position: "absolute", top: 4, insetInlineEnd: 4, width: 24, height: 24, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.65)", color: "#fff", cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
        {media.gallery.length < 6 && (
          <label style={{ display: "inline-block", fontSize: 12, padding: "8px 14px", borderRadius: 7, border: `1px solid ${theme.secondary}`, color: theme.secondaryLight, cursor: "pointer" }}>
            {st("wsGalleryAdd")}
            <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { addGallery(e.target.files); e.target.value = ""; }} />
          </label>
        )}
        <div style={hint}>{st("wsGalleryHint")} {st("wsImagesHint")}</div>
      </div>

      <div style={card}>
        <div style={h}>{st("wsAddressTitle")}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted, #8A8F99)", fontFamily: "IBM Plex Mono, monospace", direction: "ltr" }}>{origin.replace(/^https?:\/\//, "")}/r/</span>
          <input type="text" className="field" value={slugDraft} placeholder={st("wsSlugPh")} onChange={(e) => { setSlugDraft(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setSlugMsg(null); }} style={{ flex: 1, minWidth: 130, direction: "ltr" }} maxLength={30} />
          <button type="button" onClick={saveSlug} disabled={!slugDraft || slugDraft === slug} style={{ fontSize: 12.5, padding: "9px 16px", borderRadius: 7, border: "none", background: theme.primary, color: "#FBF8F2", cursor: "pointer", opacity: !slugDraft || slugDraft === slug ? 0.5 : 1 }}>
            {st("wsSlugSave")}
          </button>
        </div>
        {slugMsg && <div style={{ fontSize: 12, marginTop: 8, color: slugMsg.ok ? "#9FCB8E" : "#E3A79C" }}>{slugMsg.text}</div>}
        <div style={hint}>{st("wsAddressHint")}</div>
        <div style={{ ...hint, direction: "ltr", textAlign: isRtl ? "right" : "left" }}>{st("wsLinkOriginal")}: {origin}{basePath}?order=1</div>
      </div>
    </div>
  );

  const phone = (
    <div style={{ width: 375, maxWidth: "100%", height: isMobile ? "calc(100vh - 80px)" : 690, borderRadius: 28, border: "8px solid #111", overflow: "hidden", background: "#fff", boxShadow: "0 10px 40px rgba(0,0,0,.35)" }}>
      <iframe key={previewKey} title={st("wsPreview")} src={previewSrc} style={{ width: "100%", height: "100%", border: "none", background: "#fff" }} />
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{st("wsTitle")}</div>
        <div style={{ fontSize: 13, color: "var(--text-muted, #8A8F99)", maxWidth: 620, lineHeight: 1.55 }}>{st("wsSubtitle")}</div>
      </div>
      {isMobile ? (
        <>
          <button type="button" onClick={() => setPreviewOpen(true)} style={{ width: "100%", marginBottom: 16, padding: "12px 0", borderRadius: 9, border: `1px solid ${theme.secondary}`, background: "transparent", color: theme.secondaryLight, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            {st("wsPreviewOpen")}
          </button>
          {controls}
          {previewOpen && (
            <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,.7)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 12 }} onClick={() => setPreviewOpen(false)}>
              <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 400 }}>
                <button type="button" onClick={() => setPreviewOpen(false)} style={{ marginBottom: 8, padding: "8px 16px", borderRadius: 999, border: "none", background: "#fff", color: "#111", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{st("close")}</button>
                {phone}
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0, maxWidth: 620 }}>{controls}</div>
          <div style={{ position: "sticky", top: 16, flexShrink: 0 }}>
            <div style={{ ...labelStyle, textAlign: "center" }}>{st("wsPreview")}</div>
            {phone}
            <div style={{ ...hint, textAlign: "center" }}>{st("wsPreviewHint")}</div>
          </div>
        </div>
      )}
    </div>
  );
}
