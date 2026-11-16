// Ecology layers (second round): reed belt and cattails in the shallow bay, dune and shore plants (marram, sea holly, sea buckthorn, sea rocket),
// salt-marsh flowers, field hedgerows (Knick) with standard trees, beech-forest understory (deadwood, autumn mushrooms) and the forest density map
// that terrain and grass sample (leaf litter, moss, dark understory, spring anemones). Everything is procedural and instanced.
import * as THREE from "three";
import { patch, csmify, AU } from "./materials.js";
import { WIND } from "./vegetation.js";
import { batchPlace } from "./plants.js";
import { wallGeo } from "./geo.js";
import { mulberry32, makeNoise, smoothstep } from "./util.js";

export const FOREST_RECT = { x0: -500, z0: -500, size: 1000 }, FOREST_RES = 256;

// ------------------------------------------------------------------------------------------------ small geometry builder (vertex colours)
class GB {
  constructor() { this.p = []; this.c = []; this.i = []; }
  v(x, y, z, c) { this.p.push(x, y, z); this.c.push(c[0], c[1], c[2]); return this.p.length / 3 - 1; }
  box(x, y, z, sx, sy, sz, c) {
    const h = [sx / 2, sy / 2, sz / 2], vs = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(([a, b, d]) => this.v(x + a * h[0], y + b * h[1], z + d * h[2], c));
    for (const f of [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]]) this.i.push(vs[f[0]], vs[f[1]], vs[f[2]], vs[f[0]], vs[f[2]], vs[f[3]]);
  }
  // a tapering curved strip rising from (ox,0,oz): width w0 at the base to w1 at the tip, bending by (lx,lz)
  blade(ox, oz, ang, h, w0, w1, lx, lz, n, cb, ct) {
    const ax = -Math.sin(ang), az = Math.cos(ang); let prev = null;
    for (let k = 0; k <= n; k++) {
      const t = k / n, y = h * t, cx = ox + lx * t * t, cz = oz + lz * t * t, hw = (w0 * (1 - t) + w1 * t) * 0.5, c = cb.map((v, q) => v + (ct[q] - v) * t);
      const a = this.v(cx - ax * hw, y, cz - az * hw, c), b = this.v(cx + ax * hw, y, cz + az * hw, c);
      if (prev) this.i.push(prev[0], a, b, prev[0], b, prev[1]);
      prev = [a, b];
    }
  }
  geo() { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(this.c, 3)); g.setIndex(this.i); g.computeVertexNormals(); return g; }
}
// vertex sway for thin plants: height-weighted, phase from the instance position; uses the shared wind and time
function swayMat(key, csm, params, swayH) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, ...params });
  patch(mat, (sh) => {
    sh.uniforms.uWind = WIND;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", `#include <common>
uniform float uWind; uniform float uTime;`).replace("#include <begin_vertex>", `#include <begin_vertex>
      { vec3 ip_ = vec3(0.0);
        #ifdef USE_INSTANCING
        ip_ = vec3(instanceMatrix[3].x, 0.0, instanceMatrix[3].z);
        #endif
        #ifdef USE_BATCHING
        ip_ = vec3(batchingMatrix[3].x, 0.0, batchingMatrix[3].z);
        #endif
        float ph_ = ip_.x * 0.13 + ip_.z * 0.21; float hw_ = pow(clamp(position.y / ${swayH.toFixed(2)}, 0.0, 1.0), 1.6);
        float sw_ = sin(uTime * 1.7 + ph_) * 0.1 + sin(uTime * 3.1 + ph_ * 2.0 + position.x) * 0.035;
        transformed.x += sw_ * hw_ * (0.6 + uWind * 1.4); transformed.z += sw_ * 0.6 * hw_ * (0.6 + uWind * 1.4); }`);
  }, key);
  return csmify(csm, mat);
}
const litMat = (csm, params, key) => csmify(csm, patch(new THREE.MeshStandardMaterial(params), null, key));

// ------------------------------------------------------------------------------------------------ geometry for each plant type
function reedGeo(rnd) {
  const g = new GB(), base = [0.26, 0.42, 0.18], top = [0.6, 0.55, 0.3];
  for (let k = 0; k < 14; k++) { const a = rnd() * 6.28, r = rnd() * 0.3; g.blade(Math.cos(a) * r, Math.sin(a) * r, rnd() * 3, 3.0, 0.09, 0.02, (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.5, 3, base, top); }
  for (let k = 0; k < 4; k++) { const a = rnd() * 6.28, r = rnd() * 0.25; g.box(Math.cos(a) * r, 2.55 + rnd() * 0.25, Math.sin(a) * r, 0.05, 0.3, 0.05, [0.38, 0.27, 0.2]); }   // brown-purple seed heads
  return g.geo();
}
function cattailGeo(rnd) {
  const g = new GB();
  for (let k = 0; k < 4; k++) { const a = rnd() * 6.28, r = rnd() * 0.12; g.blade(Math.cos(a) * r, Math.sin(a) * r, rnd() * 3, 2.0, 0.06, 0.02, (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3, 3, [0.3, 0.45, 0.2], [0.5, 0.5, 0.25]); }
  g.box(0, 1.55, 0, 0.09, 0.42, 0.09, [0.36, 0.22, 0.1]);   // cattail spike
  return g.geo();
}
function marramGeo(rnd) {   // Ammophila: grey-blue, rolled long blades in dense tufts
  const g = new GB();
  for (let k = 0; k < 14; k++) { const a = rnd() * 6.28, r = rnd() * 0.22; g.blade(Math.cos(a) * r, Math.sin(a) * r, rnd() * 3, 1.0, 0.07, 0.012, (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.4, 4, [0.4, 0.5, 0.46], [0.72, 0.68, 0.45]); }
  return g.geo();
}
function seaHollyGeo(rnd) {   // Eryngium maritimum: blue-grey spiny rosette with blue-violet heads
  const g = new GB();
  for (let k = 0; k < 9; k++) { const a = k / 9 * 6.28; g.blade(0, 0, a, 0.35, 0.08, 0.01, Math.cos(a) * 0.25, Math.sin(a) * 0.25, 2, [0.35, 0.5, 0.56], [0.4, 0.6, 0.66]); }
  for (let k = 0; k < 3; k++) { const a = rnd() * 6.28, r = 0.1 + rnd() * 0.1; g.box(Math.cos(a) * r, 0.5, Math.sin(a) * r, 0.1, 0.14, 0.1, [0.32, 0.4, 0.86]); }
  return g.geo();
}
function seaRocketGeo(rnd) {   // Cakile maritima: flat low leaves, small lilac flowers
  const g = new GB();
  for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28 + rnd() * 0.3; g.blade(0, 0, a, 0.06, 0.16, 0.02, Math.cos(a) * 0.05, Math.sin(a) * 0.05, 1, [0.4, 0.58, 0.24], [0.46, 0.62, 0.28]); }
  g.box(0, 0.1, 0, 0.12, 0.08, 0.12, [0.8, 0.6, 0.8]);
  return g.geo();
}
function spikeGeo(rnd, head) {   // salt-marsh lavender / sea aster: thin stems with a small spike head
  const g = new GB();
  for (let k = 0; k < 7; k++) { const a = rnd() * 6.28, r = rnd() * 0.18, h = 0.5 + rnd() * 0.3; g.blade(Math.cos(a) * r, Math.sin(a) * r, 0, h, 0.02, 0.012, (rnd() - 0.5) * 0.12, (rnd() - 0.5) * 0.12, 2, [0.3, 0.4, 0.2], [0.3, 0.4, 0.2]); g.box(Math.cos(a) * r, h, Math.sin(a) * r, 0.09, 0.2, 0.09, head); }
  return g.geo();
}
function logGeo() { const g = new THREE.CylinderGeometry(0.2, 0.26, 4, 7); g.rotateZ(Math.PI / 2); g.translate(0, 0.22, 0); return g; }
function fernGeo(rnd) {   // Pteridium-like fern: seven arching fronds from one crown, pale green to dark at the base
  const g = new GB();
  for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283 + rnd() * 0.4; g.blade(0, 0, a, 0.7 + rnd() * 0.2, 0.2, 0.03, Math.cos(a) * 0.25, Math.sin(a) * 0.25, 4, [0.12, 0.3, 0.08], [0.25, 0.5, 0.14]); }
  return g.geo();
}
function mushroomGeo() { const g = new GB(); g.box(0, 0.05, 0, 0.04, 0.1, 0.04, [0.85, 0.82, 0.74]); g.box(0, 0.12, 0, 0.14, 0.05, 0.14, [1, 1, 1]); return g.geo(); }

// ------------------------------------------------------------------------------------------------ forest density map (shared by terrain and grass)
export function makeForestMap() {
  const data = new Uint8Array(FOREST_RES * FOREST_RES * 4);
  const tex = new THREE.DataTexture(data, FOREST_RES, FOREST_RES, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true;
  tex.userData.data = data; return tex;
}
// broadleaf forest cover (beech, oak, linden, birch, alder): splats of radius ~9 m, then a 3x3 blur; the R channel is the cover 0..1
export function fillForestMap(tex, forest) {
  const data = tex.userData.data, N = FOREST_RES, cell = FOREST_RECT.size / N, acc = new Float32Array(N * N);
  const broad = new Set(["fBeech", "fOak", "fLinden", "fBirch", "fAlder", "beech", "oak", "linden", "birch", "alder"]);
  for (const t of forest) {
    if (!broad.has(t.sp)) continue;
    const ci = Math.floor((t.x - FOREST_RECT.x0) / cell), cj = Math.floor((t.z - FOREST_RECT.z0) / cell), R = Math.ceil(9 / cell);
    for (let j = cj - R; j <= cj + R; j++) for (let i = ci - R; i <= ci + R; i++) if (i >= 0 && j >= 0 && i < N && j < N) { const d = Math.hypot(i - ci, j - cj) * cell; if (d < 9) acc[j * N + i] = Math.min(1, acc[j * N + i] + 0.35 * (1 - d / 9)); }
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let s = 0, c = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < N && b < N) { s += acc[b * N + a]; c++; } }
    const v = Math.round(Math.min(1, s / c * 1.6) * 255), k = (j * N + i) * 4; data[k] = v; data[k + 1] = v; data[k + 2] = v; data[k + 3] = 255;
  }
  tex.needsUpdate = true;
}

// ------------------------------------------------------------------------------------------------ the ecology layers
export function buildEcology(scene, W, PLACED, { csm, LIB, mats, townMat, quality = 1, keepOut = null, seed = 515 }) {
  const rnd = mulberry32(seed), N = makeNoise(91), WG = wallGeo(W), q = quality, B = W.landmarkSites.BAY || { x: 92, z: 88, r: 96 };
  const inKO = (x, z) => !!keepOut && (x - keepOut.x) ** 2 + (z - keepOut.z) ** 2 < keepOut.r * keepOut.r;
  const built = { reed: 0, cattail: 0, marram: 0, holly: 0, buck: 0, rocket: 0, marsh: 0, hedge: 0, hedgeTree: 0, log: 0, mush: 0 };
  const groups = { autumn: [] };   // objects toggled by season (mushrooms)
  // every ecology item is queued per material and placed as one BatchedMesh per material at the end (see batchPlace)
  const JOBS = new Map(), dummy = new THREE.Object3D();
  const put = (geo, mat, items, o = {}) => { if (!items.length) return; let e = JOBS.get(mat); if (!e) JOBS.set(mat, e = { shadow: o.shadow !== false, jobs: [] }); e.jobs.push({ geo, items: o.tint ? items.map(t => ({ ...t, tint: o.tint(t) })) : items }); };
  const mid = a => a[a.length >> 1] || null;   // a representative item (for screenshots / tests)
  const sample = (fn, step, max) => { const out = []; for (let x = -460; x < 300 && out.length < max; x += step) for (let z = -330; z < 330 && out.length < max; z += step) { const p = fn(x + (rnd() - 0.5) * step, z + (rnd() - 0.5) * step); if (p) out.push(p); } return out; };

  // (a) reeds: shallow shore of the bay (|coastS| < 18 m, depth -0.9..-0.05) and the land edge just above it; cattails rarer
  const reedMat = swayMat("reed", csm, { roughness: 0.8, metalness: 0 }, 3.0), cattailMat = swayMat("cattail", csm, { roughness: 0.7 }, 2.0);
  const reedDens = Math.min(1, q * 2.2);
  const reedPts = sample((x, z) => {
    const s = W.coastS(x, z), h = W.H(x, z);
    if ((x - B.x) ** 2 + (z - B.z) ** 2 > (B.r + 60) ** 2) return null;
    const shallow = h > -0.9 && h < -0.05 && s > 0 && s < 26, landEdge = h > -0.1 && h < 0.9 && s > -14 && s <= 0;
    if (!(shallow || landEdge) || inKO(x, z) || rnd() > reedDens) return null;
    return { x, y: h - 0.2, z, s: 0.8 + rnd() * 0.5, r: rnd() * 6.28, v: rnd() < 0.2 ? 1 : 0, cat: rnd() < 0.12 };
  }, 2.2, 7000);
  const reeds = reedPts.filter(p => !p.cat), cats = reedPts.filter(p => p.cat);
  const rv = [reedGeo(mulberry32(1)), reedGeo(mulberry32(2))], cv = [cattailGeo(mulberry32(3))];
  for (let v = 0; v < 2; v++) { const items = reeds.filter(p => p.v === v); built.reed += items.length; put(rv[v], reedMat, items, { shadow: false, cell: 128, radius: 6 }); }
  built.cattail += cats.length; put(cv[0], cattailMat, cats, { shadow: false, cell: 128, radius: 6 });

  // (b) dunes and shore: sand-coloured low ground just inland (|coastS| < 40 m, height 0.7..4 m); marram, sea holly, sea buckthorn, sea rocket
  const marramM = swayMat("marram", csm, { roughness: 0.75 }, 1.0), hollyM = swayMat("holly", csm, { roughness: 0.6 }, 0.4);
  const dunePts = sample((x, z) => {
    const s = W.coastS(x, z), h = W.H(x, z);
    if (s > -2 || s < -40 || h < 0.7 || h > 4 || inKO(x, z) || W.roadDistAt(x, z) < 2 || W.inSquare(x, z, 4)) return null;
    if (W.buildings.some(b => Math.hypot(b.x - x, b.z - z) < Math.hypot(b.hw, b.hd) + 3)) return null;
    const u = rnd(); return rnd() < Math.min(1, (1 - (-s) / 40) * 2.2 * q) ? { x, y: h - 0.05, z, s: 0.6 + rnd() * 0.7, r: rnd() * 6.28, kind: u < 0.45 ? "marram" : u < 0.7 ? "holly" : u < 0.85 ? "rocket" : "buck" } : null;
  }, 3, 6000);
  const pick = k => dunePts.filter(p => p.kind === k);
  built.marram += pick("marram").length; put(marramGeo(mulberry32(4)), marramM, pick("marram"), { cell: 128, radius: 4 });
  built.holly += pick("holly").length; put(seaHollyGeo(mulberry32(5)), hollyM, pick("holly"), { cell: 128, radius: 4 });
  built.rocket += pick("rocket").length; put(seaRocketGeo(mulberry32(6)), hollyM, pick("rocket"), { cell: 128, radius: 3 });
  const buckItems = pick("buck"); built.buck += buckItems.length;
  if (LIB && mats) put(LIB.near.shrub[0].fol, mats[0], buckItems, { cell: 128, radius: 4, tint: () => [0.72, 0.82, 0.8] });   // silver-grey leaves via instance colour

  // (c) salt marsh: flat, low (H < 2.2) ground near the coast: lavender and sea aster in small colonies
  const lavM = litMat(csm, { roughness: 0.8, vertexColors: true }, "lavender");
  const marshPts = sample((x, z) => {
    const s = W.coastS(x, z), h = W.H(x, z);
    if (s > -3 || s < -45 || WG.sd(x, z) < 12 || h < 0.3 || h > 2.2 || inKO(x, z) || W.roadDistAt(x, z) < 3 || W.inSquare(x, z, 4) || W.normal(x, z)[1] < 0.985) return null;
    if (N.fbm(x / 40, z / 40, 2) < 0.05) return null;   // colonies, not an even carpet
    return rnd() < Math.min(1, 1.6 * q) ? { x, y: h - 0.02, z, s: 1.4 + rnd() * 0.7, r: rnd() * 6.28, col: rnd() < 0.5 ? "lav" : "aster" } : null;
  }, 3, 4000);
  built.marsh += marshPts.length;
  put(spikeGeo(mulberry32(7), [0.5, 0.25, 0.75]), lavM, marshPts.filter(p => p.col === "lav"), { shadow: false, cell: 128, radius: 3 });
  put(spikeGeo(mulberry32(8), [0.75, 0.66, 0.92]), lavM, marshPts.filter(p => p.col === "aster"), { shadow: false, cell: 128, radius: 3 });

  // (d) hedgerows (Knick) on the zero contour of a low-frequency field outside the wall; standard tree every ~25 m on the line
  const hedges = [], trees = [], occ = new Set(), cellK = (x, z, c) => Math.floor(x / c) + "," + Math.floor(z / c);
  for (const t of PLACED.forest) occ.add(cellK(t.x, t.z, 8));
  for (let x = -460; x < 460; x += 2.2) for (let z = -460; z < 460; z += 2.2) {
    const jx = x + (rnd() - 0.5), jz = z + (rnd() - 0.5), sd = WG.sd(jx, jz);
    if (sd < 26 || W.coastS(jx, jz) > -40 || W.H(jx, jz) < 1.5 || W.H(jx, jz) > 25 || inKO(jx, jz)) continue;
    if (Math.abs(N.fbm(jx / 110 + 3, jz / 110 - 7, 2)) > 0.012) continue;    // thin band
    if (W.roadDistAt(jx, jz) < 4 || W.buildings.some(b => Math.hypot(b.x - jx, b.z - jz) < Math.hypot(b.hw, b.hd) + 4) || occ.has(cellK(jx, jz, 8))) continue;
    if (rnd() > 0.7 * q) continue;
    const species = rnd(); hedges.push({ x: jx, y: W.H(jx, jz) - 0.02, z: jz, s: 0.8 + rnd() * 0.5, r: rnd() * 6.28, bloom: species < 0.5, tint: species < 0.25 ? [1.0, 1.0, 1.0] : species < 0.5 ? [1.15, 1.15, 1.1] : species < 0.75 ? [0.9, 1.05, 0.8] : [1.25, 0.9, 1.05] });
    if (rnd() < 0.05 * q) trees.push({ x: jx, y: W.H(jx, jz), z: jz, s: 0.9 + rnd() * 0.3, r: rnd() * 6.28, v: 0, sp: rnd() < 0.6 ? "fBeech" : "fOak" });
  }
  // thin the band: one shrub per cell of 3 m, one tree per cell of 25 m (first candidate wins)
  const hedgeOut = [], seen = new Set(); for (const h of hedges) { const k = cellK(h.x, h.z, 3); if (!seen.has(k)) { seen.add(k); hedgeOut.push(h); } }
  const treeOut = [], seenT = new Set(); for (const t of trees) { const k = cellK(t.x, t.z, 25); if (!seenT.has(k)) { seenT.add(k); treeOut.push(t); } }
  built.hedge += hedgeOut.length; built.hedgeTree += treeOut.length;
  if (LIB && mats) {
    put(LIB.near.shrub[1].fol, mats[0], hedgeOut.filter(h => !h.bloom), { cell: 128, radius: 4, tint: h => h.tint });
    put(LIB.near.bloom[1].fol, mats[0], hedgeOut.filter(h => h.bloom), { cell: 128, radius: 4, tint: h => h.tint });
    for (const sp of ["fBeech", "fOak"]) { const e = LIB.near[sp] && LIB.near[sp][0]; const items = treeOut.filter(t => t.sp === sp.replace("f", "").toLowerCase() || t.sp === sp); if (e && items.length) { if (e.trunk) put(e.trunk, townMat, items, { cell: 128, radius: 8 }); put(e.fol, mats[0], items, { cell: 128, radius: 8 }); } }
  }

  // (e0) ferns in the beech woods (wide fronds, swaying): about one clump per four trees
  const ferns = [], fernM = swayMat("fern", csm, { roughness: 0.7 }, 0.8);
  for (const t of PLACED.forest) if ((t.sp === "fBeech" || t.sp === "fOak") && rnd() < 0.3 * q) ferns.push({ x: t.x + (rnd() - 0.5) * 6, y: W.H(t.x, t.z) - 0.02, z: t.z + (rnd() - 0.5) * 6, s: 0.8 + rnd() * 0.6, r: rnd() * 6.28 });
  built.fern = ferns.length; put(fernGeo(mulberry32(12)), fernM, ferns, { shadow: false });

  // (e) beech understory: deadwood logs on the forest floor and autumn mushrooms in their shade
  const beech = PLACED.forest.filter(t => t.sp === "fBeech" || t.sp === "fOak");
  const logItems = beech.filter(() => rnd() < 0.05 * q).map(t => ({ x: t.x + (rnd() - 0.5) * 6, y: W.H(t.x, t.z) + 0.05, z: t.z + (rnd() - 0.5) * 6, s: 0.8 + rnd() * 0.6, r: rnd() * 6.28 }));
  const logM = litMat(csm, { color: 0x4b3420, roughness: 0.9 }, "deadwood");
  put(logGeo(), logM, logItems, { cell: 128, radius: 6 }); built.log += logItems.length;
  const mushItems = beech.filter(() => rnd() < 0.12 * q).map(t => ({ x: t.x + (rnd() - 0.5) * 5, y: W.H(t.x, t.z), z: t.z + (rnd() - 0.5) * 5, s: 0.7 + rnd() * 0.6, r: rnd() * 6.28, red: rnd() < 0.5 }));
  const mushM = litMat(csm, { roughness: 0.6 }, "mushroom");
  put(mushroomGeo(), mushM, mushItems, { shadow: false, cell: 128, radius: 3, tint: t => (t.red ? [0.85, 0.15, 0.08] : [0.45, 0.3, 0.18]), list: groups.autumn }); built.mush += mushItems.length;

  // place: one BatchedMesh per material
  const entries = [];
  for (const [mat, e] of JOBS) { const ents = batchPlace(scene, mat, e.jobs, { dummy, shadow: e.shadow, name: "eco" }); entries.push(...ents); if (mat === mushM) groups.autumn.push(...ents); }
  return {
    built,
    samples: { hedgeLand: hedgeOut.find(h => W.H(h.x, h.z) > 3 && W.coastS(h.x, h.z) < -60) || null, reed: mid(reeds), cattail: mid(cats), marram: mid(pick("marram")), rocket: mid(pick("rocket")), marsh: mid(marshPts), hedge: mid(hedgeOut), log: mid(logItems), mush: mid(mushItems), beech: mid(beech) },
    // mushrooms only show in autumn (season 2)
    setSeason(season) { for (const e of groups.autumn) e.bm.setVisibleAt(e.id, season === 2); },
    dispose() {},
  };
}
