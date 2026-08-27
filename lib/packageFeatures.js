import { supabaseAdmin } from "@/lib/supabaseAdmin";

// The fixed list of "big features" that can be turned on/off per package. Deliberately not
// user-extensible — adding a new toggleable feature is a code change (wire it into the POS
// terminal's gating too, not just this list), same as adding a new tab already is. "order" (the
// core order-taking screen) and "settings" (branding/basic config) are intentionally absent —
// every package can always use those; there'd be no usable POS terminal otherwise.
//
// Kept deliberately granular — each entry is one specific capability, not a bundle of several
// (e.g. table QR self-ordering is separate from basic table management; the online-ordering link
// is separate from delivery-zone configuration) — so a package can include exactly the mix of
// features you want to sell, rather than an all-or-nothing chunk.
export const FEATURE_KEYS = [
  { key: "menu", label: "Menu editor" },
  { key: "menuScan", label: "AI menu photo scan" },
  { key: "stock", label: "Stock tracking" },
  { key: "discounts", label: "Order discounts" },
  { key: "splitBill", label: "Split bill" },
  { key: "tables", label: "Tables & dine-in tickets" },
  { key: "tableQrOrdering", label: "Table QR self-ordering" },
  { key: "onlineOrderingLink", label: "Online ordering link" },
  { key: "deliveryZones", label: "Delivery zones & fees" },
  { key: "receipts", label: "Receipts history" },
  { key: "whatsappUpdates", label: "WhatsApp order updates" },
  { key: "expenses", label: "Expenses tracking" },
  { key: "dashboard", label: "Analytics dashboard" },
  { key: "customers", label: "Customer directory" },
  { key: "shift", label: "Shift tracking" },
  { key: "staff", label: "Staff management" },
  { key: "teamTracking", label: "Waiter & delivery tracking" },
  { key: "tabAccessControl", label: "Manager tab-lock (PIN-restricted tabs)" },
  { key: "vatService", label: "VAT & service charge" },
  { key: "googleMapsDirections", label: "Google Maps directions link" },
  { key: "helpChat", label: "In-app help assistant" },
];

export const PACKAGES = ["basic", "standard", "premium"];

// Used only to seed a package's row set the first time it's read with nothing stored yet (see
// getPackageMatrix below) — after that, whatever's actually in package_features wins. Not a
// hardcoded restriction; change the split freely at /admin/packages any time.
const SEED_DEFAULTS = {
  basic: ["menu", "stock", "discounts", "splitBill", "receipts", "customers", "shift", "staff"],
  standard: [
    "menu", "stock", "discounts", "splitBill", "receipts", "customers", "shift", "staff",
    "tables", "onlineOrderingLink", "deliveryZones", "vatService", "whatsappUpdates", "googleMapsDirections",
    "teamTracking",
  ],
  premium: FEATURE_KEYS.map((f) => f.key),
};

// Returns { basic: {menu: true, ...}, standard: {...}, premium: {...} } — every feature key
// present for every package, defaulting to the seed set for any package with no stored rows yet.
export async function getPackageMatrix() {
  const { data, error } = await supabaseAdmin().from("package_features").select("package, feature_key, enabled");
  if (error) throw new Error(error.message);

  const stored = {};
  for (const row of data) {
    stored[row.package] = stored[row.package] || {};
    stored[row.package][row.feature_key] = row.enabled;
  }

  const matrix = {};
  for (const pkg of PACKAGES) {
    const hasAnyStored = !!stored[pkg];
    matrix[pkg] = {};
    for (const { key } of FEATURE_KEYS) {
      if (hasAnyStored && key in stored[pkg]) {
        matrix[pkg][key] = stored[pkg][key];
      } else if (!hasAnyStored) {
        matrix[pkg][key] = SEED_DEFAULTS[pkg].includes(key);
      } else {
        // This package has some stored rows but not this specific key (e.g. a feature added to
        // FEATURE_KEYS after the package was first configured) — fall back to the seed default
        // for just that key rather than silently defaulting to false.
        matrix[pkg][key] = SEED_DEFAULTS[pkg].includes(key);
      }
    }
  }
  return matrix;
}

export async function setPackageMatrix(matrix) {
  const rows = [];
  for (const pkg of PACKAGES) {
    for (const { key } of FEATURE_KEYS) {
      rows.push({ package: pkg, feature_key: key, enabled: !!matrix?.[pkg]?.[key] });
    }
  }
  const { error } = await supabaseAdmin().from("package_features").upsert(rows, { onConflict: "package,feature_key" });
  if (error) throw new Error(error.message);
}

// What a single tenant's terminal is actually allowed to use — resolves their package against
// the current matrix. Used by app/api/pos/[tenantId]/status.
export async function getFeaturesForPackage(pkg) {
  const matrix = await getPackageMatrix();
  return matrix[pkg] || matrix.basic;
}
