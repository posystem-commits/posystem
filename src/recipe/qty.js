// Recipe quantities: typing and showing amounts like ½ a piece or 1¼ pieces.
// Pure functions (no screen, no storage) so they can be tested on their own.

const DIGITS = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9", "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9" };
const GLYPHS = { "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875, "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8, "⅙": 1 / 6, "⅚": 5 / 6 };

// The amounts people actually cut a piece into, nicest-looking first. Used for showing and for quick-pick buttons.
export const FRACTION_STEPS = [
  [0.125, "⅛"], [0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"], [0.875, "⅞"],
];

// Units that are counted rather than weighed: a fraction of one reads naturally ("½ pcs", "1¼ boxes").
export const COUNT_UNITS = ["pcs", "dozen", "bottle", "can", "box", "pack", "slice", "portion"];
export const isCountUnit = (unit) => COUNT_UNITS.includes(unit);

// Reads what someone typed: "0.5", "0,5", "1/2", "1 1/2", "½", "1½", Arabic digits. NaN when it isn't a number.
export function parseQty(text) {
  let s = String(text ?? "").replace(/[٠-٩۰-۹]/g, (d) => DIGITS[d]).replace(/[٫,]/g, ".").replace(/٬/g, "").trim();
  if (!s) return NaN;
  let total = 0;
  // a trailing fraction glyph: "1½", "½"
  const glyph = s.match(/([¼½¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚])$/);
  if (glyph) {
    total += GLYPHS[glyph[1]];
    s = s.slice(0, -1).trim();
    if (!s) return total > 0 ? round4(total) : NaN;
    if (!/^\d+$/.test(s)) return NaN;
    return round4(total + Number(s));
  }
  // "1 1/2" or "3/4"
  const mixed = s.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const den = Number(mixed[3]);
    if (den === 0) return NaN;
    return round4(Number(mixed[1] || 0) + Number(mixed[2]) / den);
  }
  if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return NaN;
  return round4(Number(s));
}

export const round4 = (n) => Math.round(n * 10000) / 10000;

// How an amount is shown: counted units get fraction glyphs when the amount is (nearly) one, everything else keeps
// plain decimals trimmed of trailing zeros (0.3 kg, not 0.30).
export function fmtRecipeQty(qty, unit) {
  const n = Number(qty);
  if (!Number.isFinite(n)) return "";
  if (Number.isInteger(n)) return String(n);
  if (isCountUnit(unit)) {
    const whole = Math.floor(n + 1e-9);
    const frac = n - whole;
    const hit = FRACTION_STEPS.find(([v]) => Math.abs(v - frac) < 0.0006);
    if (hit) return `${whole > 0 ? whole : ""}${hit[1]}`;
  }
  return String(Math.round(n * 1000) / 1000);
}

// Quick-pick amounts for a counted unit (a fraction of a piece, one, one and a half, two).
export const QUICK_FRACTIONS = [
  [0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [0.75, "¾"], [1, "1"], [1.5, "1½"], [2, "2"],
];
