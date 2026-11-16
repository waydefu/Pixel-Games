// Save system: versioned JSON in localStorage with a rolling backup slot, validation + migration, and export / import of a .json file.
// Schema v1 (fields added later: inv, farm, fish, dex) - validate() fills defaults for saves that predate a field, which is the migration.
import { CROP_IDS, FISH_PRICE } from "./inventory.js";
export const SAVE_VERSION = 1;
const KEY = "aldric.save", BAK = "aldric.save.bak";
const num = v => typeof v === "number" && Number.isFinite(v);

export function validate(s) {
  if (!s || typeof s !== "object" || !num(s.v) || s.v < 1 || s.v > SAVE_VERSION) return null;
  if (!s.clock || !num(s.clock.hour) || !num(s.clock.dayCount)) return null;
  if (!s.player || !num(s.player.x) || !num(s.player.z)) return null;
  const o = { ...s };
  o.clock = { hour: ((s.clock.hour % 24) + 24) % 24, dayCount: Math.max(0, Math.floor(s.clock.dayCount)) };
  o.player = { x: s.player.x, z: s.player.z, yaw: num(s.player.yaw) ? s.player.yaw : 0, pitch: num(s.player.pitch) ? s.player.pitch : 0, mode: s.player.mode === "boat" ? "boat" : "walk" };
  o.weather = ["clear", "cloudy", "rain", "storm"].includes(s.weather) ? s.weather : "clear";
  o.boat = s.boat && num(s.boat.x) && num(s.boat.z) ? { x: s.boat.x, z: s.boat.z, yaw: num(s.boat.yaw) ? s.boat.yaw : 0 } : null;
  o.inv = validInv(s.inv);
  o.farm = validFarm(s.farm);
  o.fish = Array.isArray(s.fish) ? s.fish.filter(f => f && typeof f.n === "string" && num(f.len)).slice(-300) : [];
  o.tool = ["hoe", "seed", "bucket", "sickle"].includes(s.tool) ? s.tool : "hoe";   // v1 migration: saves without a tool get the hoe
  o.water = num(s.water) ? Math.min(3, Math.max(0, Math.floor(s.water))) : 0;
  o.dex = {}; if (s.dex && typeof s.dex === "object") for (const id of Object.keys(FISH_PRICE)) { const d = s.dex[id]; if (d && num(d.count) && num(d.max)) o.dex[id] = { count: Math.max(0, Math.floor(d.count)), max: d.max }; }
  return o;
}
// inventory: coins >= 0 and item stacks for known ids only (seed_<crop>, crop_<crop>, fish_<fish>), capped at 200 per stack
function validInv(v) {
  const out = { coins: 0, items: {} };
  if (!v || typeof v !== "object") return out;
  if (num(v.coins)) out.coins = Math.max(0, Math.floor(v.coins));
  if (v.items && typeof v.items === "object") for (const [id, n] of Object.entries(v.items)) {
    const [k, name] = [id.split("_")[0], id.slice(id.indexOf("_") + 1)];
    const known = (k === "seed" || k === "crop") ? CROP_IDS.includes(name) : (k === "fish" && !!FISH_PRICE[name]);
    if (known && num(n) && n >= 1) out.items[id] = Math.min(200, Math.floor(n));
  }
  return out;
}
// farm: site, selected seed and the non-empty plots (6x6 grid). Anything malformed is dropped, not repaired.
function validFarm(f) {
  const out = { plots: [], seedSel: null, site: null };
  if (!f || typeof f !== "object") return out;
  if (f.site && num(f.site.x) && num(f.site.z)) out.site = { x: f.site.x, z: f.site.z };
  if (CROP_IDS.includes(f.seedSel)) out.seedSel = f.seedSel;
  if (Array.isArray(f.plots)) for (const p of f.plots) {
    if (!p || !Number.isInteger(p.i) || !Number.isInteger(p.j) || p.i < 0 || p.i > 5 || p.j < 0 || p.j > 5) continue;
    out.plots.push({ i: p.i, j: p.j, tilled: !!p.tilled, crop: CROP_IDS.includes(p.crop) ? p.crop : null, watered: !!p.watered, progress: num(p.progress) ? Math.min(1, Math.max(0, p.progress)) : 0 });
  }
  return out;
}
const parse = txt => { try { return validate(JSON.parse(txt)); } catch (e) { return null; } };

export function readSave() {
  try { const a = parse(localStorage.getItem(KEY)); if (a) return a; const b = parse(localStorage.getItem(BAK)); if (b) return b; } catch (e) { /* storage blocked */ }
  return null;
}
export function hasSave() { return !!readSave(); }
export function writeSave(state) {
  try {
    const prev = localStorage.getItem(KEY); if (prev && parse(prev)) localStorage.setItem(BAK, prev);   // only ever back up a save that still parses
    localStorage.setItem(KEY, JSON.stringify({ ...state, v: SAVE_VERSION, savedAt: Date.now() })); return true;
  } catch (e) { return false; }
}
export function clearSave() { try { localStorage.removeItem(KEY); localStorage.removeItem(BAK); } catch (e) { /* ignore */ } }
export function exportSave(state) {
  const blob = new Blob([JSON.stringify({ ...state, v: SAVE_VERSION, savedAt: Date.now() }, null, 1)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "saint-aldric-save.json"; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
export function importSave(file) {
  return new Promise((res, rej) => {
    if (!file || file.size > 2e6) return rej(new Error("檔案太大或不存在"));
    const fr = new FileReader(); fr.onerror = () => rej(new Error("讀取失敗")); fr.onload = () => { const s = parse(String(fr.result)); s ? res(s) : rej(new Error("不是有效的存檔")); }; fr.readAsText(file);
  });
}
