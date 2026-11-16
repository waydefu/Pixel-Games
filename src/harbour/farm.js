// Farm: a 6x6 field of 2 m plots outside the town wall (site searched once from the world data, then saved), crops with seasons, growth and
// frost, rain watering, one E action per plot (till -> sow -> water -> harvest), a market stall to buy seeds and sell produce.
import * as THREE from "three";
import { patch, csmify } from "./materials.js";
import { CROPS, CROP_IDS } from "./inventory.js";
import { wallGeo } from "./geo.js";

const N = 6, CELL = 2;
const GREEN = new THREE.Color(0x5f9a3a);

export function findFarmSite(W) {
  const WG = wallGeo(W);
  let best = null, score = 1e18;
  for (let x = WG.minX - 90; x <= WG.maxX + 90; x += 6) for (let z = WG.minZ - 90; z <= WG.maxZ + 90; z += 6) {
    const dw = WG.sd(x, z); if (dw < 20 || dw > 80) continue;                      // 20–80 m outside the wall, clear of the moat band (3–15 m)
    if (W.coastS(x, z) > -40 || W.H(x, z) < 1.5) continue;                          // inland, above the flood plain
    if (W.normal(x, z)[1] < 0.99) continue;                                         // slope < ~8 degrees
    if (W.roadDistAt(x, z) < 8 || W.inSquare(x, z, 8)) continue;
    if (W.buildings.some(b => Math.hypot(b.x - x, b.z - z) < Math.hypot(b.hw, b.hd) + 8)) continue;
    const hs = [[-7, 0], [7, 0], [0, -7], [0, 7]].map(([dx, dz]) => W.H(x + dx, z + dz)); if (Math.max(...hs) - Math.min(...hs) > 0.8) continue;
    if (W.harbour && W.coastS(x, z) > -40) continue;
    const sc = Math.abs(dw - 40) + 0.02 * Math.hypot(x - WG.cx, z - WG.cz); if (sc < score) { score = sc; best = { x, z }; }
  }
  return best || { x: WG.cx, z: WG.maxZ + 40 };
}

export function createFarm({ W, scene, csm, G, inv, toast, calendar, wellPos: TOWN_WELL = null }) {
  if (!G.farm.site) G.farm.site = findFarmSite(W);           // the site is saved, so later loads keep the same field
  const centre = (i, j) => ({ x: G.farm.site.x + (i - (N - 1) / 2) * CELL, z: G.farm.site.z + (j - (N - 1) / 2) * CELL });
  const plot = (i, j) => G.farm.plots.find(p => p.i === i && p.j === j) || null;
  const plotOrNew = (i, j) => { let p = plot(i, j); if (!p) { p = { i, j, tilled: false, crop: null, watered: false, progress: 0 }; G.farm.plots.push(p); } return p; };
  const litMat = (params, key) => csmify(csm, patch(new THREE.MeshStandardMaterial(params), null, key));

  // ------------------------------------------------------------------ visuals: one InstancedMesh for the soil and one for all crop slots
  const soilGeo = new THREE.BoxGeometry(CELL * 0.92, 0.07, CELL * 0.92), soilMat = litMat({ color: 0xffffff, roughness: 0.95 }, "farmSoil");
  const soil = new THREE.InstancedMesh(soilGeo, soilMat, N * N); soil.receiveShadow = true; soil.frustumCulled = false; scene.add(soil);
  const cropGeo = new THREE.ConeGeometry(0.22, 0.6, 5); cropGeo.translate(0, 0.3, 0);
  const SLOTS = 7, cropMat = litMat({ color: 0xffffff, roughness: 0.8 }, "farmCrop");
  const crops = new THREE.InstancedMesh(cropGeo, cropMat, N * N * SLOTS); crops.castShadow = true; crops.frustumCulled = false; scene.add(crops);
  const dummy = new THREE.Object3D(), tint = new THREE.Color();
  const SOIL_DRY = new THREE.Color(0x4a3420), SOIL_WET = new THREE.Color(0x2e2014);
  // deterministic slot layout inside each cell
  const slotXY = [[0, 0], [0.5, 0.45], [-0.5, 0.4], [0.45, -0.5], [-0.45, -0.45], [0.05, -0.1], [-0.05, 0.1]];
  function redraw() {
    let si = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const c = centre(i, j), p = plot(i, j), gy = W.H(c.x, c.z);
      const tilled = !!(p && p.tilled);
      dummy.position.set(c.x, gy + 0.02, c.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, tilled ? 1 : 0.0001, 1); dummy.updateMatrix(); soil.setMatrixAt(i * N + j, dummy.matrix);
      soil.setColorAt(i * N + j, (p && p.watered) ? SOIL_WET : SOIL_DRY);
      for (let k = 0; k < SLOTS; k++, si++) {
        const has = !!(p && p.crop), cr = has ? CROPS[p.crop] : null, pr = has ? p.progress : 0;
        const sc = has ? 0.35 + 0.65 * pr : 0.0001, ox = slotXY[k][0] * CELL * 0.8, oz = slotXY[k][1] * CELL * 0.8;
        dummy.position.set(c.x + ox, gy + 0.05, c.z + oz); dummy.rotation.set(0, k * 1.3, 0); dummy.scale.set(sc * 1.2, sc * (0.8 + 0.6 * pr), sc * 1.2); dummy.updateMatrix(); crops.setMatrixAt(si, dummy.matrix);
        if (has) { tint.copy(GREEN).lerp(new THREE.Color(cr.color ?? 0xffffff), pr > 0.6 ? (pr - 0.6) / 0.4 : 0); } else tint.set(0xffffff);
        crops.setColorAt(si, tint);
      }
    }
    soil.instanceMatrix.needsUpdate = true; crops.instanceMatrix.needsUpdate = true;
    if (soil.instanceColor) soil.instanceColor.needsUpdate = true; if (crops.instanceColor) crops.instanceColor.needsUpdate = true;
  }
  // ------------------------------------------------------------------ market stall (placed on the market square)
  const sq = W.square, stallPos = { x: sq.x + 13, z: sq.z - 4 }, stall = new THREE.Group();
  {
    const wood = litMat({ color: 0x5a3b1f, roughness: 0.85 }, "stallWood"), cloth = litMat({ color: 0xb8402c, roughness: 0.9 }, "stallCloth");
    const add = (g, m, x, y, z, sx, sy, sz) => { const b = new THREE.Mesh(g, m); b.position.set(x, y, z); b.scale.set(sx, sy, sz); b.castShadow = b.receiveShadow = true; stall.add(b); };
    const box = new THREE.BoxGeometry(1, 1, 1);
    add(box, wood, 0, 0.95, 0, 3.2, 0.1, 1.6); add(box, wood, 0, 0.5, 0, 3.0, 1.0, 1.4);
    for (const [x, z] of [[-1.5, -0.7], [1.5, -0.7], [-1.5, 0.7], [1.5, 0.7]]) add(box, wood, x, 1.6, z, 0.12, 3.2, 0.12);
    add(box, cloth, 0, 3.25, 0, 3.6, 0.08, 2.2);
    stall.position.set(stallPos.x, W.H(stallPos.x, stallPos.z), stallPos.z); stall.rotation.y = -sq.rot; scene.add(stall);
  }
  // ------------------------------------------------------------------ wooden fence: posts every 2 m around the field, two rails, a gap for the gate on the south side
  {
    const woodM = litMat({ color: 0x6b4a2b, roughness: 0.9 }, "fenceWood"), postG = new THREE.BoxGeometry(0.14, 1.1, 0.14), railG = new THREE.BoxGeometry(1, 0.08, 0.08);
    const H = CELL * N / 2 + 1.2, posts = [], rails = [];
    const at = (x, z) => ({ x: G.farm.site.x + x, z: G.farm.site.z + z, y: W.H(G.farm.site.x + x, G.farm.site.z + z) });
    for (let t = -H; t <= H + 1e-6; t += 2) for (const [x, z] of [[t, -H], [t, H], [-H, t], [H, t]]) { if (z === H && Math.abs(x) < 2.5) continue; posts.push(at(x, z)); }   // gate gap
    const seg = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2; for (const yy of [0.35, 0.8]) rails.push({ ...at(mx, mz), y: at(mx, mz).y + yy, r: -a, s: L }); };
    seg(-H, -H, H, -H); seg(H, -H, H, H); seg(-H, -H, -H, H); seg(-H, H, -2.5, H); seg(2.5, H, H, H);
    const P = new THREE.InstancedMesh(postG, woodM, posts.length), R = new THREE.InstancedMesh(railG, woodM, rails.length), d = new THREE.Object3D();
    posts.forEach((p, i) => { d.position.set(p.x, p.y + 0.5, p.z); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); d.updateMatrix(); P.setMatrixAt(i, d.matrix); });
    rails.forEach((r, i) => { d.position.set(r.x, r.y, r.z); d.rotation.set(0, r.r, 0); d.scale.set(r.s, 1, 1); d.updateMatrix(); R.setMatrixAt(i, d.matrix); });
    P.castShadow = R.castShadow = true; P.frustumCulled = R.frustumCulled = false; scene.add(P, R);
  }

  // ------------------------------------------------------------------ rules
  let lastDayDrawn = -1;
  let lastAbs = G.dayCount + G.hour / 24, lastDay = Math.floor(lastAbs), lastSeason = calendar().season, lastRain = false;
  const season = () => calendar().season;
  function frost() {   // winter kills sown crops that are not winter-hardy
    for (const p of G.farm.plots) if (p.crop && !CROPS[p.crop].winter) { p.crop = null; p.progress = 0; p.watered = false; toast("霜害：冬季的嫩苗枯死了"); }
  }
  function update(dt, wxKey) {
    const abs = G.dayCount + G.hour / 24; let dd = abs - lastAbs; if (dd < 0 || dd > 1) dd = 0; lastAbs = abs;   // ignore clock jumps (load / wrap)
    const d = Math.floor(abs), s = season();
    if (d !== lastDay) { lastDay = d; for (const p of G.farm.plots) p.watered = false; }   // watering lasts one day
    if (s === 3 && lastSeason !== 3) frost(); lastSeason = s;
    const raining = wxKey === "rain" || wxKey === "storm"; lastRain = raining;
    let changed = d !== lastDayDrawn;
    lastDayDrawn = d;
    for (const p of G.farm.plots) {
      if (!p.crop) continue;
      if (raining) p.watered = true;
      const cr = CROPS[p.crop]; if (s === 3 && !cr.winter) continue;
      const rate = (s === 3 ? 0.3 : 1) / cr.days * (p.watered ? 1 : 0.5);
      const before = p.progress; p.progress = Math.min(1, p.progress + dd * rate); if (p.progress !== before) changed = true;
    }
    if (changed || raining) redraw();
  }
  function near(px, pz, r = 2.6) { let best = null, bd = r * r; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const c = centre(i, j), dd = (c.x - px) ** 2 + (c.z - pz) ** 2; if (dd < bd) { bd = dd; best = { i, j }; } } return best; }
  const nearStall = (px, pz) => (stallPos.x - px) ** 2 + (stallPos.z - pz) ** 2 < 16;
  // water sources: the market well and the sea at the shore (depth > 0.25 m under the surface)
  const wellPos = () => (TOWN_WELL ? TOWN_WELL : null);
  const nearWater = (px, pz) => { const w = wellPos(); if (w && (w.x - px) ** 2 + (w.z - pz) ** 2 < 12.25) return true; for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) if (W.H(px + dx, pz + dz) < -0.25 && W.coastS(px, pz) > -6) return true; return false; };
  // one E press, acting with the tool in hand: hoe (till) / seed bag (sow the selected seed) / bucket (fill at water, then water a crop) / sickle (harvest).
  function use(px, pz) {
    if (nearStall(px, pz)) { inv.openMarket(); return true; }
    const n = near(px, pz); const tool = G.tool || "hoe";
    if (!n) { if (tool === "bucket" && nearWater(px, pz)) { G.water = 3; toast("水桶裝滿了水（3 次澆水）"); return true; } return false; }
    const p = plotOrNew(n.i, n.j), s = season(), raining = lastRain;
    if (tool === "hoe") { if (!p.tilled) { p.tilled = true; toast("翻土完成，可以播種"); } else toast("這一格已經翻好了"); }
    else if (tool === "seed") {
      if (!p.tilled) toast("先用鋤頭（1）翻土");
      else if (p.crop) toast(CROPS[p.crop].n + "生長中，不能再播");
      else { const seed = G.farm.seedSel; if (!seed || inv.count("seed_" + seed) < 1) toast(seed ? "沒有" + CROPS[seed].n + "種子，到市集購買" : "先按 G 選擇要播的種子");
        else if (!CROPS[seed].seasons.includes(s)) toast("現在不是" + CROPS[seed].n + "的播種季");
        else { inv.take("seed_" + seed, 1); p.crop = seed; p.progress = 0; p.watered = raining; toast("播下" + CROPS[seed].n); } }
    } else if (tool === "bucket") {
      if (!p.crop) toast("這一格沒有作物可以澆水");
      else if (p.watered) toast("已經澆過水了");
      else if (raining) { p.watered = true; toast("下雨了，不用澆水"); }
      else if ((G.water || 0) < 1) toast("水桶是空的，到井邊或海邊取水（靠近按 E）");
      else { G.water -= 1; p.watered = true; toast("澆水（水桶剩 " + G.water + "）"); }
    } else if (tool === "sickle") {
      if (p.crop && p.progress >= 1) { const y = CROPS[p.crop].yield; inv.add("crop_" + p.crop, y); toast("收成 " + CROPS[p.crop].n + " ×" + y); p.crop = null; p.progress = 0; p.watered = false; }   // the plot stays tilled
      else if (p.crop) toast(CROPS[p.crop].n + "還沒成熟（" + Math.round(p.progress * 100) + "%）");
      else toast("鐮刀：這一格沒有成熟的作物");
    }
    redraw(); inv.refresh(); return true;
  }
  const TOOLS = { hoe: "鋤頭", seed: "種子袋", bucket: "水桶", sickle: "鐮刀" };
  function setTool(t) { if (!TOOLS[t]) return; G.tool = t; toast("手上工具：" + TOOLS[t]); }
  function cycleSeed() {
    const have = CROP_IDS.filter(c => inv.count("seed_" + c) > 0);
    if (!have.length) { G.farm.seedSel = null; toast("背包裡沒有種子"); return; }
    const i = have.indexOf(G.farm.seedSel); G.farm.seedSel = have[(i + 1) % have.length]; toast("選取種子：" + CROPS[G.farm.seedSel].n); inv.refresh();
  }
  function hintFor(px, pz) {
    if (nearStall(px, pz)) return "按 E 進入市集攤位（買種子、賣作物與魚）";
    const tool = G.tool || "hoe", n = near(px, pz, 2.6);
    if (!n) return tool === "bucket" && nearWater(px, pz) ? "按 E 取水（水桶）" : null;
    const p = plot(n.i, n.j), T = TOOLS[tool];
    if (tool === "hoe") return !p || !p.tilled ? "按 E 翻土（" + T + "）" : null;
    if (tool === "seed") return p && p.tilled && !p.crop ? "按 E 播種（" + T + "，G 切換種子）" : null;
    if (tool === "bucket") return p && p.crop && !p.watered ? "按 E 澆水（" + T + "：" + (G.water || 0) + "）" : null;
    return p && p.crop && p.progress >= 1 ? "按 E 收成（" + T + "）" : null;
  }
  function restore() { if (!G.farm.site) G.farm.site = findFarmSite(W); lastAbs = G.dayCount + G.hour / 24; lastDay = Math.floor(lastAbs); lastSeason = season(); lastDayDrawn = -1; redraw(); }
  redraw();
  return { update, use, cycleSeed, setTool, hintFor, restore, redraw, stallPos };
}
