// Quality tiers (everything heavy hangs off these) + persisted user settings. All storage access is wrapped: a blocked/full localStorage must never break the game.
export const TIERS = {
  low:   { vegShadow: "none", ao: false, reflect: false, oceanCascades: 1, label: "低",   minSide: 720,  maxSide: 1080, msaa: 0, casc: 2, smap: 1024, bloom: false, grass: 90,  gcell: 0.7,  veg: 0.4, tex: 256,  detail: 1, sfar: 160 },
  med:   { vegShadow: "near", ao: false, reflect: false, oceanCascades: 2, label: "中",   minSide: 1080, maxSide: 1440, msaa: 2, casc: 3, smap: 1536, bloom: true,  grass: 120, gcell: 0.55, veg: 0.7, tex: 512,  detail: 2, sfar: 220 },
  high:  { vegShadow: "all", ao: true, reflect: false, oceanCascades: 2, label: "高",   minSide: 1080, maxSide: 1440, msaa: 4, casc: 3, smap: 2048, bloom: true,  grass: 150, gcell: 0.48, veg: 0.85, tex: 512,  detail: 2, sfar: 260 },
  ultra: { vegShadow: "all", ao: true, reflect: true, oceanCascades: 3, label: "極高", minSide: 1080, maxSide: 1440, msaa: 4, casc: 4, smap: 2048, bloom: true,  grass: 200, gcell: 0.4,  veg: 1.4, tex: 1024, detail: 2, sfar: 320 },
};
export const TIER_ORDER = ["low", "med", "high", "ultra"];
const KEY = "aldric.settings.v1";
export function loadSettings() {
  const d = { tier: "high", auto: true };
  try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && TIERS[s.tier]) return { ...d, ...s }; } catch (e) { /* ignore */ }
  return d;
}
export function saveSettings(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } }
