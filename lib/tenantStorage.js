// Drop-in replacement for the Claude-artifact-only `window.storage` API that src/pos.jsx was
// originally written against. Same shape — get/set/list/delete, values are always plain
// strings the app JSON.stringify/parse's itself — so every existing call site only needed
// `window.storage.` swapped for `storage.` (see the createTenantStorage() usage in pos.jsx).
//
// The original `shared` boolean (true = every terminal/browser sees it, false = this browser
// only) doesn't map cleanly onto a real multi-terminal restaurant: everything that's genuinely
// restaurant-wide state now lives server-side, tenant-scoped, behind requireActiveTenant — the
// `shared` argument is accepted for signature compatibility but ignored. Instead, a short
// allowlist of keys that are legitimately about THIS browser tab (which staff member is clocked
// in here, this device's language choice) stay in localStorage. Everything else — including
// receipts and the customer directory, which the original prototype had marked shared=false,
// almost certainly a bug carried over from single-browser testing — goes to the server so every
// register sees the same data.
const DEVICE_LOCAL_KEYS = new Set(["current-employee", "shift-start", "ui-lang"]);

const storageUrl = (tenantId, key) => `/api/pos/${encodeURIComponent(tenantId)}/storage/${encodeURIComponent(key)}`;

export function createTenantStorage(tenantId) {
  return {
    async get(key) {
      if (DEVICE_LOCAL_KEYS.has(key)) {
        const value = typeof window === "undefined" ? null : window.localStorage.getItem(key);
        return { value };
      }
      const res = await fetch(storageUrl(tenantId, key));
      if (res.status === 403) throw new Error((await res.json().catch(() => ({}))).error || "Access denied");
      if (!res.ok) throw new Error(`storage.get(${key}) failed: ${res.status}`);
      return res.json();
    },

    async set(key, value) {
      if (DEVICE_LOCAL_KEYS.has(key)) {
        if (typeof window !== "undefined") window.localStorage.setItem(key, value);
        return true;
      }
      const res = await fetch(storageUrl(tenantId, key), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      return res.ok;
    },

    async delete(key) {
      if (DEVICE_LOCAL_KEYS.has(key)) {
        if (typeof window !== "undefined") window.localStorage.removeItem(key);
        return true;
      }
      const res = await fetch(storageUrl(tenantId, key), { method: "DELETE" });
      if (!res.ok) throw new Error(`storage.delete(${key}) failed: ${res.status}`);
      return true;
    },

    // Only ever called with a server-backed prefix in this app (receipts month keys), but a
    // local fallback is included so it degrades gracefully rather than throwing if that changes.
    async list(prefix) {
      const isLocalPrefix = [...DEVICE_LOCAL_KEYS].some((k) => k.startsWith(prefix));
      if (isLocalPrefix && typeof window !== "undefined") {
        const keys = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith(prefix)) keys.push(k);
        }
        return { keys };
      }
      const res = await fetch(`/api/pos/${encodeURIComponent(tenantId)}/storage?prefix=${encodeURIComponent(prefix)}`);
      if (!res.ok) throw new Error(`storage.list(${prefix}) failed: ${res.status}`);
      return res.json();
    },
  };
}
