// Shared design tokens for the admin portal. Mirrors the palette already used in the POS
// terminal (src/pos.jsx COLORS) so both surfaces read as the same product, not two different
// apps bolted together.

export const COLORS = {
  ink: "#20242B",
  charcoalSoft: "#6B685F",
  paper: "#FBF8F2",
  cream: "#F5F3EE",
  card: "#FFFFFF",
  line: "#E2DBC9",
  lineSoft: "#EEE9DC",

  burgundy: "#7C2D3B",
  burgundyDark: "#601F2A",
  brass: "#B08D57",

  sage: "#3D6B3D",
  sageLight: "#DCEAD8",
  sageLine: "#B9D6B4",
  amber: "#8A6A2E",
  amberLight: "#EFE4CB",
  red: "#A6534A",
  redLight: "#F3DAD6",
  clay: "#6B5A3A",
  clayLight: "#EFE9DA",
};

export const FONT_SERIF = "'Fraunces', Georgia, serif";
export const FONT_SANS = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
export const FONT_MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace";

export const FONT_IMPORT_URL =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap";

export const RADIUS = { sm: 7, md: 9, lg: 12, xl: 16, pill: 999 };

export const SHADOW = {
  card: "0 1px 2px rgba(32,36,43,0.05), 0 4px 16px rgba(32,36,43,0.05)",
  raised: "0 2px 4px rgba(32,36,43,0.06), 0 8px 24px rgba(32,36,43,0.08)",
};
