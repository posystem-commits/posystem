import { shortId } from "./state.mjs";

export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const ICON = { red: "🔴", amber: "🟡", info: "🔵", ok: "🟢" };
const ago = (iso, nowMs) => {
  const h = (nowMs - new Date(iso).getTime()) / 3600000;
  return h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} days`;
};

export function alertText(f, kind, nowMs) {
  const head = kind === "resolved" ? `🟢 <b>Resolved</b>` : kind === "reminder" ? `🔴 <b>Still open</b> (${ago(f.first, nowMs)})` : `🔴 <b>Needs attention</b>`;
  const where = f.tenantName ? ` — ${esc(f.tenantName)}` : "";
  const lines = [`${head}${where}`, `<b>${esc(f.title)}</b>`];
  if (f.detail && kind !== "resolved") lines.push(esc(f.detail));
  if (kind !== "resolved") lines.push(`<i>id ${shortId(f.fp)} — reply /explain ${shortId(f.fp)} &lt;what happened&gt; if you know the reason.</i>`);
  return lines.join("\n");
}
