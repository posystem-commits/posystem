"use client";

import React from "react";

// Small building blocks for the admin portal (styles live in app/admin/admin.css).

const PATHS = {
  users: "M16 19v-1.2a3.8 3.8 0 0 0-3.8-3.8H7.8A3.8 3.8 0 0 0 4 17.8V19M10 11a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM20 19v-1.2a3.8 3.8 0 0 0-2.7-3.6M15.5 4.8a3.2 3.2 0 0 1 0 6.1",
  layers: "m12 3 9 4.6-9 4.6-9-4.6L12 3Zm-9 9.2 9 4.6 9-4.6M3 16.6 12 21l9-4.4",
  bell: "M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Zm4.2 9.5a2 2 0 0 0 3.6 0",
  pulse: "M3 12h4l2.5-6 4 12 2.5-6H21",
  shield: "M12 3 4.5 6v5.5c0 4.4 3.1 7.6 7.5 9.5 4.4-1.9 7.5-5.1 7.5-9.5V6L12 3Zm-2.6 9.4 2 2 3.6-4",
  logout: "M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14M10 16l-4-4 4-4M6 12h10",
  search: "m21 21-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z",
  plus: "M12 5v14M5 12h14",
  copy: "M9 9h9.5a1.5 1.5 0 0 1 1.5 1.5V20a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 20v-9.5A1.5 1.5 0 0 1 9 9ZM16.5 6.5V5A1.5 1.5 0 0 0 15 3.5H5.5A1.5 1.5 0 0 0 4 5v9.5A1.5 1.5 0 0 0 5.5 16H7",
  external: "M14 4h6v6M20 4l-9 9M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10",
  check: "m5 12.5 4.5 4.5L19 7.5",
  alert: "M12 8.5v4.5m0 3.5h.01M10.3 4.2 2.9 17.1A2 2 0 0 0 4.6 20h14.8a2 2 0 0 0 1.7-2.9L13.7 4.2a2 2 0 0 0-3.4 0Z",
  info: "M12 11v5m0-8.5h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  key: "M15.5 8.5h.01M21 9a6 6 0 0 1-7.7 5.7L11 17H9v2H7v2H3v-3.3l7.3-7.3A6 6 0 1 1 21 9Z",
  store: "M4 9.5 5.5 4h13L20 9.5M4 9.5a2.5 2.5 0 0 0 4 2 2.5 2.5 0 0 0 4 0 2.5 2.5 0 0 0 4 0 2.5 2.5 0 0 0 4-2M5 12.5V20h14v-7.5M10 20v-4.5h4V20",
  clock: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
};

export function Icon({ name, className, style }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <path d={PATHS[name] || ""} />
    </svg>
  );
}

export function Button({ variant = "primary", size, block, icon, children, className = "", as: Tag = "button", ...props }) {
  const cls = ["ad-btn", variant, size === "sm" ? "sm" : "", block ? "block" : "", className].filter(Boolean).join(" ");
  const extra = Tag === "button" && !props.type ? { type: "button" } : {};
  return (
    <Tag className={cls} {...extra} {...props}>
      {icon && <Icon name={icon} />}
      {children}
    </Tag>
  );
}

export function Badge({ tone = "neutral", plain, children }) {
  return <span className={`ad-badge ${tone}${plain ? " plain" : ""}`}>{children}</span>;
}

export function Card({ pad = true, className = "", children, ...props }) {
  return (
    <div className={`ad-card${pad ? " ad-card-pad" : ""} ${className}`} {...props}>
      {children}
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <div className="ad-field">
      {label && <label className="ad-label">{label}</label>}
      {children}
      {hint && <div className="ad-hint">{hint}</div>}
    </div>
  );
}

export function Stat({ label, value, tone }) {
  return (
    <div className={`ad-card ad-stat${tone ? ` is-${tone}` : ""}`}>
      <div className="ad-stat-label">{label}</div>
      <div className="ad-stat-value">{value}</div>
    </div>
  );
}

export function Notice({ tone = "info", icon, children, style }) {
  return (
    <div className={`ad-notice ${tone}`} style={style}>
      <Icon name={icon || (tone === "good" ? "check" : tone === "info" ? "info" : "alert")} />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

export function Empty({ icon = "store", children }) {
  return (
    <div className="ad-empty">
      <Icon name={icon} />
      <div>{children}</div>
    </div>
  );
}

export function Skeleton({ rows = 3, height = 70 }) {
  return (
    <div className="ad-rows">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="ad-skel" style={{ height }} />
      ))}
    </div>
  );
}

export function Toggle({ on, onClick, label }) {
  return <button type="button" className={`ad-toggle${on ? " is-on" : ""}`} onClick={onClick} aria-label={label} aria-pressed={on} />;
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="ad-seg" role="group">
      {options.map(({ key, label }) => (
        <button key={key} type="button" className={value === key ? "is-on" : ""} onClick={() => onChange(key)}>
          {label}
        </button>
      ))}
    </div>
  );
}

const AVATAR_TONES = ["#7c2d3b", "#2f5d86", "#2f6b43", "#8d6420", "#5b3f7a", "#37606b", "#9a4a2a", "#4a5568"];
export function Avatar({ name }) {
  const text = (name || "?").trim();
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const initials = text.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  return (
    <div className="ad-avatar" style={{ background: `linear-gradient(145deg, ${AVATAR_TONES[h % AVATAR_TONES.length]}, ${AVATAR_TONES[(h + 3) % AVATAR_TONES.length]}cc)` }}>
      {initials}
    </div>
  );
}

export function Toast({ children }) {
  return children ? <div className="ad-toast">{children}</div> : null;
}
