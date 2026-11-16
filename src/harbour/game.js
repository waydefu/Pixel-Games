// Gameplay: first-person walking with collision, rowing a boat, fishing (cast / wait / bite / hook / reel), interaction, HUD and touch controls.
import * as THREE from "three";
import { clamp, lerp, smoothstep, mulberry32 } from "./util.js";
import { makeBoat, makeOar } from "./boats.js";
import { patch, csmify } from "./materials.js";
import { createInventory } from "./inventory.js";
import { createFarm } from "./farm.js";

const WV = [[-0.62, -0.78, 62, 0.55], [-0.90, -0.43, 31, 0.5], [-0.25, -0.97, 17, 0.45], [-0.75, -0.66, 8.3, 0.4], [-0.45, -0.89, 3.6, 0.35]];
// the spectral ocean (ocean.js) when bound: boats and bobbers sample the very same wave field that is rendered
let OCEAN = null; export function bindOcean(o) { OCEAN = o; }
export function seaAt(W, x, z, t, sea, out = {}) {
  if (OCEAN) { OCEAN.sampleSurface(x, z, out); out.depth = Math.max(-W.H(x, z), 0); return out; }
  const depth = Math.max(-W.H(x, z), 0), damp = smoothstep(0.1, 2.5, depth) * (0.28 + 0.72 * smoothstep(55, 170, Math.hypot(x - 80, z - 125))); let y = 0, sx = 0, sz = 0;
  for (let i = 0; i < 5; i++) { const w = WV[i], l = Math.hypot(w[0], w[1]), dx = w[0] / l, dz = w[1] / l, k = 2 * Math.PI / w[2], c = Math.sqrt(9.81 / k), a = w[3] / k * sea * damp * (i < 2 ? 1 : 0.8), ph = k * (dx * x + dz * z - c * t); y += a * Math.sin(ph); sx += dx * a * k * Math.cos(ph); sz += dz * a * k * Math.cos(ph); }
  out.y = y; out.sx = sx; out.sz = sz; out.depth = depth; return out;
}

// season: relative bite weight per season [spring, summer, autumn, winter]; a weight under 0.25 in winter takes the species out of the winter catch
const FISH = [
  { id: "herring", n: "鯡魚", e: "Herring", len: [18, 30], w: 10, depth: [0.8, 40], night: 1, col: "#9fb4c4", season: [1.0, 1.2, 1.0, 0.0] },
  { id: "mackerel", n: "鯖魚", e: "Mackerel", len: [28, 44], w: 8, depth: [1.5, 40], night: 1, col: "#5d8aa8", season: [0.8, 1.8, 1.0, 0.0] },
  { id: "plaice", n: "比目魚", e: "Plaice", len: [24, 50], w: 7, depth: [0.8, 8], night: 1, col: "#b08968", season: [1.3, 1.0, 1.0, 0.6] },
  { id: "bass", n: "海鱸", e: "Sea bass", len: [38, 80], w: 5, depth: [1.5, 20], night: 1.1, col: "#8d9aa3", season: [1.3, 1.3, 0.9, 0.2] },
  { id: "cod", n: "鱈魚", e: "Cod", len: [50, 110], w: 4, depth: [6, 40], night: 1, col: "#a39a6a", season: [0.9, 0.6, 1.2, 1.6] },
  { id: "eel", n: "鰻魚", e: "Eel", len: [50, 95], w: 3, depth: [0.8, 30], night: 2.5, col: "#4c5448", season: [1, 1, 1.2, 0.6] },
  { id: "salmon", n: "鮭魚", e: "Salmon", len: [60, 100], w: 1.6, depth: [3, 40], night: 0.8, col: "#d49a8a", season: [0.6, 1.2, 3.0, 0.2] },
  { id: "tuna", n: "黑鮪魚", e: "Bluefin tuna", len: [110, 200], w: 0.5, depth: [12, 60], night: 0.6, col: "#2d4a6b", season: [0.5, 2.0, 0.8, 0.1] },
];

export function createGame(ctx) {
  const { W, camera, scene, townMat: baseMat, csm, TOWN, PLACED, weather, ambience, sky, renderer, canvas, getTime } = ctx;
  const townMat = ctx.boatMat || baseMat;
  const el = id => document.getElementById(id);
  const ui = { clock: el("clock"), wx: el("wx"), where: el("where"), hint: el("hint"), catchBox: el("catch"), log: el("log"), tension: el("tension"), prog: el("prog"), fps: el("fps") };
  const keys = new Set(), G = { mode: "walk", yaw: 0.6, pitch: -0.05, bob: 0, stepDist: 0, hour: 17.4, dayCount: 0, yd0: 9.0, tspeed: 1 / 60, locked: false, started: false, paused: false, inv: { coins: 0, items: {} }, farm: { plots: [], seedSel: null, site: null }, dex: {}, tool: "hoe", water: 0 };
  const YEAR = 32, SEASONS = ["春", "夏", "秋", "冬"];
  const calendar = () => { const yd = (G.yd0 + G.dayCount + G.hour / 24) % YEAR, season = Math.floor(yd / (YEAR / 4)); return { yd, season, seasonName: SEASONS[season], dayOfYear: (80 + yd / YEAR * 365) % 365, seasonT: (yd % (YEAR / 4)) / (YEAR / 4), day: G.dayCount + 1 }; };
  const P = { x: 60, z: 40, y: 3, vx: 0, vz: 0 };
  const rnd = mulberry32(Date.now() & 0xffffff);
  const litMat = (params, key) => csmify(csm, patch(new THREE.MeshStandardMaterial(params), null, key));
  const toast = m => { const t = el("toast"); if (!t) return; t.textContent = m; t.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("on"), 2400); };

  // -------------------------------------------------------------------------------- colliders
  const cell = 16, grid = new Map(), key = (x, z) => Math.floor(x / cell) + "," + Math.floor(z / cell), obbs = [], circles = [];
  const addObb = b => { obbs.push(b); const r = Math.hypot(b.hw, b.hd) + 2; for (let x = b.x - r; x <= b.x + r + cell; x += cell) for (let z = b.z - r; z <= b.z + r + cell; z += cell) { const k = key(x, z); (grid.get(k) || grid.set(k, []).get(k)).push(b); } };
  for (const b of W.buildings) addObb(b);
  for (const c of TOWN.lm.colliders) addObb(c);
  for (const t of PLACED.trees) addObb({ x: t.x, z: t.z, ax: 1, az: 0, hw: 0.4, hd: 0.4, tree: true });
  const wallSegs = []; for (let i = 0; i < W.wall.pts.length - 1; i++) wallSegs.push([W.wall.pts[i], W.wall.pts[i + 1]]);
  const gates = W.wall.gates;
  function pushOut(px, pz, r) {
    const list = grid.get(key(px, pz)); let x = px, z = pz;
    if (list) for (const b of list) {
      const dx = x - b.x, dz = z - b.z, lx = dx * b.ax + dz * b.az, lz = -dx * b.az + dz * b.ax;
      const ex = Math.max(Math.abs(lx) - b.hw, 0), ez = Math.max(Math.abs(lz) - b.hd, 0), d = Math.hypot(ex, ez);
      if (d < r) {
        let nx, nz;
        if (d > 1e-4) { nx = ex * Math.sign(lx) / d; nz = ez * Math.sign(lz) / d; }
        else { if (b.hw - Math.abs(lx) < b.hd - Math.abs(lz)) { nx = Math.sign(lx); nz = 0; } else { nx = 0; nz = Math.sign(lz); } }
        const push = r - d + (d > 1e-4 ? 0 : (nx ? b.hw - Math.abs(lx) : b.hd - Math.abs(lz)));
        x += (nx * b.ax - nz * b.az) * push; z += (nx * b.az + nz * b.ax) * push;
      }
    }
    // curtain wall (except at the gates)
    for (const [a, c] of wallSegs) {
      const dx = c.x - a.x, dz = c.z - a.z, l2 = dx * dx + dz * dz, t = clamp(((x - a.x) * dx + (z - a.z) * dz) / l2, 0, 1), cx = a.x + dx * t, cz = a.z + dz * t, d = Math.hypot(x - cx, z - cz);
      if (d < 1.6 + r && !gates.some(g => Math.hypot(cx - g.x, cz - g.z) < 3.6)) { const nx = (x - cx) / (d || 1), nz = (z - cz) / (d || 1), push = 1.6 + r - d; x += nx * push; z += nz * push; }
    }
    return [x, z];
  }
  const piers = TOWN.hb.piers, decks = piers.concat(TOWN.hb.decks || []);
  const onPier = (x, z, pad = 0) => { for (const p of decks) { const dx = x - p.x, dz = z - p.z, u = dx * p.dx + dz * p.dz, v = -dx * p.dz + dz * p.dx; if (u > -1.5 - pad && u < p.len + pad && Math.abs(v) < p.wid / 2 + pad) return p; } return null; };
  const groundY = (x, z) => { const p = onPier(x, z); return p ? Math.max(p.y, W.H(x, z)) : W.H(x, z); };

  // -------------------------------------------------------------------------------- boats
  const boats = [];
  const seaState = { y: 0, sx: 0, sz: 0, depth: 0 };
  function placeBoat(kind, pier, along, side, yaw0) {
    const b = makeBoat(kind, townMat); scene.add(b);
    const off = pier.wid / 2 + (kind === "cog" ? 4.4 : kind === "fish" ? 2.9 : 2.3), px = pier.x + pier.dx * along - pier.dz * off * side, pz = pier.z + pier.dz * along + pier.dx * off * side;
    const o = { obj: b, kind, x: px, z: pz, yaw: Math.atan2(pier.dz, pier.dx) + (yaw0 || 0), vx: 0, vz: 0, om: 0, stroke: 0, phase: 0, info: b.userData.info, oars: [] };
    if (kind === "row") for (const s of [-1, 1]) { const oar = makeOar(townMat); b.add(oar); o.oars.push({ m: oar, s }); }
    boats.push(o); return o;
  }
  const pa = piers[0] || { x: 90, z: 70, dx: 0.6, dz: 0.8, len: 24, wid: 3.2, y: 1.3 };
  const myBoat = placeBoat("row", pa, pa.len * 0.55, 1, 0);
  if (piers[1]) { placeBoat("fish", piers[1], piers[1].len * 0.6, 1, 0); placeBoat("row", piers[1], piers[1].len * 0.25, -1, 0.1); }
  if (piers[2]) { placeBoat("fish", piers[2], piers[2].len * 0.5, -1, 0); placeBoat("cog", piers[2], piers[2].len * 0.85, 1, 0); }
  if (piers[3]) { placeBoat("fish", piers[3], piers[3].len * 0.7, 1, 0.05); placeBoat("cog", piers[3], piers[3].len * 0.8, -1, 0); }   // a second cog on the far pier

  // more boats moored along the inner face of the southern mole, plus rowing boats hauled up on the beach
  {
    const mole = (TOWN.hb.decks || []).slice(piers.length), cen = W.harbour.centre;
    for (const [frac, kind] of [[0.22, "fish"], [0.4, "fish"], [0.56, "row"], [0.7, "fish"]]) {
      const d = mole[Math.floor(mole.length * 0.6 * frac * 1.4)]; if (!d) continue;
      const mx = d.x + d.dx * d.len * 0.5, mz = d.z + d.dz * d.len * 0.5; let nx = -d.dz, nz = d.dx; if ((cen[0] - mx) * nx + (cen[1] - mz) * nz < 0) { nx = -nx; nz = -nz; }
      const off = d.wid / 2 + (kind === "fish" ? 3.2 : 2.5), b = makeBoat(kind, townMat); scene.add(b);
      const o = { obj: b, kind, x: mx + nx * off, z: mz + nz * off, yaw: Math.atan2(d.dz, d.dx), vx: 0, vz: 0, om: 0, stroke: 0, phase: 0, info: b.userData.info, oars: [] };
      if (kind === "row") for (const s of [-1, 1]) { const oar = makeOar(townMat); b.add(oar); o.oars.push({ m: oar, s }); }
      boats.push(o);
    }
    for (const bp of TOWN.hb.beached || []) { const b = makeBoat("row", townMat); b.position.set(bp.x, W.H(bp.x, bp.z) + 0.28, bp.z); b.rotation.y = -bp.yaw; b.rotateZ(0.12); scene.add(b); }
  }
  function boatWater(b, px, pz) { return W.H(px, pz) < -0.45 && !onPier(px, pz, 0.1); }
  // one cog cruises slowly around the bay (a fixed route over open water, not the player's boat); it never blocks the harbour
  const cruiser = boats.find(b => b.kind === "cog" && b !== myBoat);
  const CRUISE = { x: 150, z: 130, r: 70, w: 0.012 };   // route centre / radius (m) / angular speed (rad/s)
  let cruiseA = 0;
  function cruiseStep(dt) {
    if (!cruiser) return; cruiseA += dt * CRUISE.w;
    const nx = CRUISE.x + Math.cos(cruiseA) * CRUISE.r, nz = CRUISE.z + Math.sin(cruiseA) * CRUISE.r;
    if (!boatWater(cruiser, nx, nz) || W.coastS(nx, nz) < 6) return;   // keep off the shore and the moles
    cruiser.yaw = Math.atan2(Math.cos(cruiseA), -Math.sin(cruiseA)); cruiser.x = nx; cruiser.z = nz; cruiser.vx = cruiser.vz = cruiser.om = 0;
  }
  function updateBoats(dt, time, sea) {
    cruiseStep(dt);
    for (const b of boats) {
      const player = b === myBoat && G.mode === "boat";
      if (b === cruiser) { const sc = seaAt(W, b.x, b.z, time, sea, seaState); b.obj.position.set(b.x, sc.y * 0.5 + 0.3, b.z); b.obj.rotation.set(0, 0, 0); b.obj.rotation.y = -b.yaw; continue; }
      if (player) {
        const fwd = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0), turn = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0) + ctx.touch.turn;
        const f = fwd + (-ctx.touch.my); b.stroke += dt * (Math.abs(f) > 0.1 ? 1 / 1.5 : 0); if (Math.abs(f) > 0.1 && Math.floor(b.stroke * 2) !== Math.floor((b.stroke - dt / 1.5) * 2)) ambience.tick("splash");
        const pulse = Math.max(0, Math.sin(b.stroke * Math.PI * 2)) ** 1.5, thrust = Math.sign(f) * (Math.abs(f) > 0.1 ? 1 : 0) * (0.5 + 2.8 * pulse), cy = Math.cos(b.yaw), sy = Math.sin(b.yaw);
        b.vx += cy * thrust * dt; b.vz += sy * thrust * dt; b.om += (turn * 1.1 - (Math.abs(f) < 0.1 ? 0 : 0)) * dt * 1.6;
        if (Math.abs(f) < 0.1 && Math.abs(turn) > 0.1) { b.vx += cy * 0.4 * dt; b.vz += sy * 0.4 * dt; }
      }
      const sp = Math.hypot(b.vx, b.vz), drag = 0.9 + sp * 0.45; b.vx -= b.vx * drag * dt; b.vz -= b.vz * drag * dt; b.om -= b.om * 2.2 * dt;
      // sideways slip damping
      const cy = Math.cos(b.yaw), sy = Math.sin(b.yaw), lat = -b.vx * sy + b.vz * cy; b.vx -= -sy * lat * 3.0 * dt; b.vz -= cy * lat * 3.0 * dt;
      if (b.kind !== "row" || sp > 0.001 || Math.abs(b.om) > 0.001) {
        const nx = b.x + b.vx * dt, nz = b.z + b.vz * dt, ny = b.yaw + b.om * dt, L2 = b.info.length * 0.5, B2 = b.info.beam * 0.5;
        let ok = true; const c2 = Math.cos(ny), s2 = Math.sin(ny);
        for (const [lx, lz] of [[L2, 0], [-L2, 0], [0, B2], [0, -B2], [L2 * 0.6, B2], [L2 * 0.6, -B2], [-L2 * 0.6, B2], [-L2 * 0.6, -B2]]) if (!boatWater(b, nx + c2 * lx - s2 * lz, nz + s2 * lx + c2 * lz)) { ok = false; break; }
        if (ok && player || ok && (sp > 0.001)) { b.x = nx; b.z = nz; b.yaw = ny; } else { b.vx *= -0.3; b.vz *= -0.3; b.om *= -0.3; }
      }
      const s = seaAt(W, b.x, b.z, time, sea, seaState); const mooredBob = b.kind === "cog" ? 0.5 : 1;
      b.obj.position.set(b.x, s.y * mooredBob + (b.kind === "row" ? 0.12 : b.kind === "fish" ? 0.18 : 0.3), b.z);
      const slopeF = (s.sx * Math.cos(b.yaw) + s.sz * Math.sin(b.yaw)), slopeS = (-s.sx * Math.sin(b.yaw) + s.sz * Math.cos(b.yaw));
      b.obj.rotation.set(0, 0, 0); b.obj.rotation.y = -b.yaw; b.obj.rotateZ(Math.atan(slopeF) * 0.7 * mooredBob); b.obj.rotateX(-Math.atan(slopeS) * 0.7 * mooredBob);
      if (b.kind === "row") for (const o of b.oars) {
        const sw = player ? Math.sin(b.stroke * Math.PI * 2) : 0, lock = b.info.oarLocks[o.s < 0 ? 0 : 1];
        o.m.position.set(lock[0], lock[1], lock[2]); o.m.rotation.set(0, o.s * (Math.PI / 2 - 0.15) * 1 + (player ? -sw * 0.5 * o.s : 0), 0);
        o.m.rotation.order = "YXZ"; o.m.rotation.y = (o.s > 0 ? -1 : 1) * (Math.PI / 2 - 0.2 * 0 ) * (o.s > 0 ? 1 : -1) * 0 + (o.s > 0 ? -Math.PI / 2 : Math.PI / 2) + (player ? sw * 0.55 * (o.s > 0 ? 1 : -1) : 0); o.m.rotation.z = player ? (sw > 0 ? -0.35 : 0.1) : 0.12;
      }
    }
  }
  // -------------------------------------------------------------------------------- rod, line, bobber
  const rodMat = litMat({ color: 0x2a1c10, roughness: 0.55 }, "rod"), redMat = litMat({ color: 0xd8321e, roughness: 0.4 }, "bobR"), whiteMat = litMat({ color: 0xeeeeee, roughness: 0.4 }, "bobW");
  const rod = new THREE.Group(); camera.add(rod); scene.add(camera);
  { const g = new THREE.CylinderGeometry(0.006, 0.014, 1.5, 6); g.translate(0, 0.75, 0); g.rotateX(-Math.PI / 2 * 0.0); const m = new THREE.Mesh(g, rodMat); m.rotation.x = Math.PI / 2 * 0.0; rod.add(m); m.rotation.set(-1.15, 0, -0.25); m.position.set(0.0, 0, 0); rod.position.set(0.26, -0.3, -0.45); rod.visible = false; rod.userData.tip = new THREE.Vector3(); }
  const bobber = new THREE.Group(); { const a = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), redMat), b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), whiteMat); bobber.add(a, b); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 4), rodMat); st.position.y = 0.08; bobber.add(st); bobber.visible = false; scene.add(bobber); }
  const lineGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 14 }, () => new THREE.Vector3())), line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xe9e6dc, transparent: true, opacity: 0.55 })); line.frustumCulled = false; line.visible = false; scene.add(line);
  const F = { state: "off", t: 0, charge: 0, bx: 0, bz: 0, vx: 0, vz: 0, by: 0, flight: 0, wait: 0, fish: null, prog: 0, tens: 0.5, pull: 0, caught: [], last: null };
  const tipWorld = new THREE.Vector3();
  function rodTip() { rod.updateWorldMatrix(true, true); tipWorld.set(0, 0.0, 0).copy(rod.children[0].localToWorld(new THREE.Vector3(0, 1.5, 0))); return tipWorld; }
  function hint(msg) { if (msg) { ui.hint.textContent = msg; ui.hint.classList.add("on"); } else ui.hint.classList.remove("on"); }
  function pickFish(depth, night, o = {}) {   // o overrides season / hour / rain for odds tests
    const s = o.season ?? calendar().season, h = o.hour ?? G.hour, dusk = (h > 4.5 && h < 8.5) || (h > 16 && h < 21), rainy = o.rainy ?? (weather.key === "rain" || weather.key === "storm");
    const cand = FISH.filter(f => depth >= f.depth[0] && depth <= f.depth[1] && !(s === 3 && f.season[3] < 0.25));
    const wOf = f => f.w * (night ? f.night : 1) * f.season[s] * (dusk && (f.id === "herring" || f.id === "mackerel") ? 1.3 : 1) * (rainy && f.id === "eel" ? 1.5 : 1);
    const w = cand.map(wOf), tot = w.reduce((a, b) => a + b, 0); let r = rnd() * tot;
    for (let i = 0; i < cand.length; i++) { r -= w[i]; if (r <= 0) return cand[i]; } return cand[0] || FISH[0];
  }
  function showCatch(f, len) {
    el("cn").textContent = f.n + "  ·  " + f.e; el("cl").textContent = "體長 " + len.toFixed(0) + " cm　重量 " + (len ** 3 * 0.000009 * (f.e === "Eel" ? 0.5 : 1)).toFixed(1) + " kg"; el("cx").textContent = "第 " + F.caught.length + " 條 · " + (len > f.len[1] * 0.9 ? "大物！" : "漂亮的一條");
    el("cs").innerHTML = `<g fill="${f.col}"><path d="M14 23 C45 3 105 3 148 23 C105 43 45 43 14 23Z"/><path d="M148 23 L186 5 L178 23 L186 41Z"/></g><circle cx="42" cy="19" r="3" fill="#111"/><path d="M60 8 C90 -2 110 6 118 14 C95 12 78 12 60 8Z" fill="${f.col}" opacity=".8"/>`;
    ui.catchBox.classList.add("on"); clearTimeout(showCatch.t); showCatch.t = setTimeout(() => ui.catchBox.classList.remove("on"), 5500);
    ui.log.innerHTML = F.caught.slice(-4).map(c => `${c.n} ${c.len.toFixed(0)}cm`).reverse().join("<br>");
  }
  function cast() {
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir); const power = 6 + 16 * F.charge; const h = Math.hypot(dir.x, dir.z) || 1;
    const t0 = rodTip(); F.bx = t0.x; F.bz = t0.z; F.by = t0.y; F.vx = dir.x / h * power * 0.9; F.vz = dir.z / h * power * 0.9; F.vy = 4.5 + Math.max(0, dir.y) * 6 + F.charge * 3; F.state = "flight"; bobber.visible = true; line.visible = true; F.t = 0;
  }
  function reelIn(fail) { F.state = "ready"; bobber.visible = false; line.visible = false; ui.tension.style.display = ui.prog.style.display = "none"; if (fail) hint(fail); }
  let pointerDown = false, pointerWas = false;
  function updateFishing(dt, time, sea) {
    const tip = rod.visible ? rodTip() : null;
    if (F.state === "off") return;
    const down = pointerDown || keys.has(" ") || ctx.touch.act, pressed = down && !pointerWas, released = !down && pointerWas; pointerWas = down;
    if (F.state === "ready") { hint("按住滑鼠左鍵／空白蓄力，放開拋竿"); if (pressed) { F.state = "charge"; F.charge = 0; } }
    else if (F.state === "charge") { F.charge = Math.min(1, F.charge + dt * 0.9); hint("蓄力 " + Math.round(F.charge * 100) + "%　放開拋竿"); if (released) cast(); }
    else if (F.state === "flight") {
      F.vy -= 9.8 * dt; F.bx += F.vx * dt; F.bz += F.vz * dt; F.by += F.vy * dt; F.vx *= 1 - 0.2 * dt; F.vz *= 1 - 0.2 * dt;
      const s = seaAt(W, F.bx, F.bz, time, sea, seaState), gy = Math.max(W.H(F.bx, F.bz), onPier(F.bx, F.bz) ? onPier(F.bx, F.bz).y : -99);
      if (F.by < s.y + 0.04 && W.H(F.bx, F.bz) < -0.5 && !onPier(F.bx, F.bz)) { F.state = "wait"; F.t = 0; F.wait = 3 + rnd() * 7 * (weather.key === "rain" ? 0.7 : 1); F.depth = s.depth; ambience.tick("splash"); }
      else if (F.by < gy || F.t > 4) { reelIn("沒有落在水裡，再試一次"); }
      F.t += dt;
    } else if (F.state === "wait") {
      F.t += dt; hint(F.t < F.wait ? "等待魚上鉤…（點擊收線）" : "有魚！快點擊！"); if (pressed && F.t < F.wait) reelIn("太早收線了");
      if (F.t >= F.wait && !F.fish) { const night = sky.state.nightness > 0.5; F.fish = pickFish(F.depth, night); F.len = lerp(F.fish.len[0], F.fish.len[1], Math.pow(rnd(), 1.6)); F.bite = 0; ambience.tick("splash"); }
      if (F.fish) { F.bite += dt; if (pressed) { F.state = "reel"; F.prog = 0.15; F.tens = 0.5; F.pull = 0; F.fishPos = 0; } else if (F.bite > 1.6) { F.fish = null; reelIn("魚跑掉了"); } }
    } else if (F.state === "reel") {
      const strength = (F.len / 100) * 0.9 + 0.35; F.pull = lerp(F.pull, (Math.sin(time * (1.6 + strength)) * 0.5 + 0.5 + Math.sin(time * 5.1 + 1.0) * 0.25) * strength, 0.05);
      const reeling = down ? 1 : 0; F.tens = clamp(F.tens + (F.pull * 0.9 + reeling * 0.55 - 0.45) * dt * 1.5, 0, 1);
      const good = F.tens > 0.3 && F.tens < 0.72; F.prog += (good ? (reeling ? 0.22 : 0.0) : -0.12) * dt * (1.2 - strength * 0.3); F.prog = clamp(F.prog, 0, 1);
      ui.tension.style.display = ui.prog.style.display = "block"; ui.tension.lastElementChild.style.left = (F.tens * 100) + "%"; ui.prog.firstElementChild.style.width = (F.prog * 100) + "%";
      hint(F.tens > 0.72 ? "線太緊了，放鬆！" : F.tens < 0.3 ? "線太鬆，快收！" : "保持綠區，按住收線");
      if (F.tens >= 0.999 || F.prog <= 0) { F.fish = null; reelIn("線斷了／魚脫鉤了"); }
      else if (F.prog >= 1) {
        const f = F.fish; F.caught.push({ n: f.n, id: f.id, len: F.len }); F.fish = null; reelIn(); showCatch(f, F.len); ambience.tick("splash"); hint("");
        INV.add("fish_" + f.id, 1); const dx = G.dex[f.id] || (G.dex[f.id] = { count: 0, max: 0 }); dx.count++; dx.max = Math.max(dx.max, F.len);
      }
      const k = F.prog; F.bx = lerp(F.bx, tip.x, dt * 0.35 * k); F.bz = lerp(F.bz, tip.z, dt * 0.35 * k);
    }
    // bobber on water + line
    if (F.state === "wait" || F.state === "reel") {
      const s = seaAt(W, F.bx, F.bz, time, sea, seaState); let dip = 0; if (F.fish && F.state === "wait") dip = -0.06 - Math.abs(Math.sin(time * 30)) * 0.03; if (F.state === "reel") dip = Math.sin(time * 14) * 0.03;
      bobber.position.set(F.bx, s.y + 0.02 + dip, F.bz); bobber.rotation.set(s.sz * 0.5, 0, -s.sx * 0.5);
    } else if (F.state === "flight") bobber.position.set(F.bx, F.by, F.bz);
    if (line.visible && tip) {
      const p = lineGeo.attributes.position, a = tip, b = bobber.position, slack = F.state === "reel" ? 0.1 : F.state === "wait" ? 0.45 : 0.9;
      for (let i = 0; i < 14; i++) { const t = i / 13; p.setXYZ(i, lerp(a.x, b.x, t), lerp(a.y, b.y, t) - Math.sin(Math.PI * t) * slack * (F.state === "flight" ? 0.3 : 1) * Math.min(1, Math.hypot(b.x - a.x, b.z - a.z) / 8 + 0.2), lerp(a.z, b.z, t)); } p.needsUpdate = true;
    }
  }
  // inventory / market and farm
  const INV = createInventory({ G, toast });
  const FARM = createFarm({ W, scene, csm, G, inv: INV, toast, calendar, wellPos: ctx.TOWN && ctx.TOWN.lm && ctx.TOWN.lm.well ? { x: ctx.TOWN.lm.well.x, z: ctx.TOWN.lm.well.z } : null });
  function toggleRod() {
    if (G.mode === "walk" || G.mode === "boat") { rod.visible = !rod.visible; if (!rod.visible) { F.state = "off"; bobber.visible = line.visible = false; hint(""); ui.tension.style.display = ui.prog.style.display = "none"; } else { F.state = "ready"; tip("rod"); } }
  }

  // -------------------------------------------------------------------------------- input
  const touch = { mx: 0, my: 0, lx: 0, ly: 0, act: false, turn: 0, active: false };
  ctx.touch = touch;
  // just-in-time tips: each shows once (remembered in localStorage), as a short toast, the first time the situation arises
  const TIPS = (() => { try { return JSON.parse(localStorage.getItem("aldric.tips") || "{}"); } catch (e) { return {}; } })();
  const TIP_TEXT = { move: "", look: "", rod: "按住左鍵／「釣魚」鈕蓄力，放開拋竿；有魚時快速點擊，並讓張力維持在綠區", farm: "農地：先翻土，再播種、澆水，等作物成熟後收成（E／互動鈕；長按切換工具）", boat: "靠近船按 E 上船；用 WASD 划槳，靠岸或碼頭再按 E 下船", bag: "按 I 開背包：賣魚、賣作物、買種子", save: "遊戲每 30 秒自動存檔；也可在選單手動存檔或匯出檔案" };
  function tip(id, msg) { if (TIPS[id]) return; TIPS[id] = 1; try { localStorage.setItem("aldric.tips", JSON.stringify(TIPS)); } catch (e) { /* private mode */ } const t = msg || TIP_TEXT[id]; if (!t) return; const n = document.getElementById("toast"); n.textContent = t; n.classList.add("on"); clearTimeout(tip.t); tip.t = setTimeout(() => n.classList.remove("on"), 5500); }
  ctx.tip = tip;
  const isTouch = matchMedia("(pointer:coarse)").matches || "ontouchstart" in window; if (isTouch) document.body.classList.add("touch");
  addEventListener("keydown", e => {
    if (!G.started) return; const k = e.key.toLowerCase();
    if (k === "i") { INV.toggle(); return; }
    if (G.paused) return; keys.add(k);
    if (k === "e") interact(); if (k === "f") toggleRod(); if (k === "t") cycleTime(); if (k === "r") cycleWeather(); if (k === "m") { ambience.setMuted(!ambience.muted); }
    if (k === "g") FARM.cycleSeed();
    if (k >= "1" && k <= "4") FARM.setTool(["hoe", "seed", "bucket", "sickle"][+k - 1]);
    if (k === "q") ctx.cycleQuality?.(); if (k === "shift") G.sprint = true; if (k === "p") ctx.photo?.(); if (e.key === " ") e.preventDefault();
  });
  addEventListener("keyup", e => { keys.delete(e.key.toLowerCase()); if (e.key === "Shift") G.sprint = false; });
  canvas.addEventListener("pointerdown", e => { if (!G.started) return; if (e.pointerType === "mouse") { if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.(); pointerDown = true; } else if (e.clientX < innerWidth * 0.45 && e.clientY > innerHeight * 0.3 && touch.stickId == null) {   // floating joystick: appears under the thumb anywhere in the lower-left
      const st = el("stick"); st.style.left = Math.max(8, e.clientX - 60) + "px"; st.style.top = Math.max(8, e.clientY - 60) + "px"; st.style.bottom = "auto"; touch.stickId = e.pointerId; tip("move", "");
    } else { touch.lookId = e.pointerId; touch.lx = e.clientX; touch.ly = e.clientY; tip("look", ""); } });
  addEventListener("pointerup", e => { if (e.pointerType === "mouse") pointerDown = false; if (e.pointerId === touch.lookId) touch.lookId = null; if (e.pointerId === touch.stickId) { touch.stickId = null; touch.mx = touch.my = 0; const st = el("stick"); st.firstElementChild.style.transform = ""; st.style.left = st.style.top = st.style.bottom = ""; } });
  addEventListener("pointermove", e => {
    if (e.pointerType === "mouse") { if (document.pointerLockElement === canvas) { G.yaw -= e.movementX * 0.0022; G.pitch = clamp(G.pitch - e.movementY * 0.0022, -1.4, 1.3); } }
    else if (e.pointerId === touch.lookId) { G.yaw -= (e.clientX - touch.lx) * 0.005; G.pitch = clamp(G.pitch - (e.clientY - touch.ly) * 0.005, -1.4, 1.3); touch.lx = e.clientX; touch.ly = e.clientY; }
    else if (e.pointerId === touch.stickId) { const r = el("stick").getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), l = Math.hypot(dx, dy), m = Math.min(1, l / 52); touch.mx = dx / (l || 1) * m; touch.my = dy / (l || 1) * m; el("stick").firstElementChild.style.transform = `translate(${touch.mx * 44}px,${touch.my * 44}px)`; }
  });
  el("stick").addEventListener("pointerdown", e => { e.stopPropagation(); touch.stickId = e.pointerId; el("stick").setPointerCapture?.(e.pointerId); });
  el("bAct").addEventListener("pointerdown", e => { e.stopPropagation(); if (F.state === "off") toggleRod(); touch.act = true; }); el("bAct").addEventListener("pointerup", () => { touch.act = false; });
  // the interact button: a tap acts with the tool in hand, a long press (0.5 s) cycles to the next tool
  { let t0 = 0, lp = 0; const TL = ["hoe", "seed", "bucket", "sickle"];
    el("bUse").addEventListener("pointerdown", e => { e.stopPropagation(); t0 = performance.now(); clearTimeout(lp); lp = setTimeout(() => { lp = 0; FARM.setTool(TL[(TL.indexOf(G.tool) + 1) % TL.length]); }, 500); });
    el("bUse").addEventListener("pointerup", () => { if (lp) { clearTimeout(lp); lp = 0; interact(); } }); }
  el("bInv").addEventListener("pointerdown", e => { e.stopPropagation(); INV.toggle(); }); el("bSeed").addEventListener("pointerdown", e => { e.stopPropagation(); FARM.cycleSeed(); }); el("bWx").addEventListener("pointerdown", e => { e.stopPropagation(); cycleWeather(); }); el("bTm").addEventListener("pointerdown", e => { e.stopPropagation(); cycleTime(); });
  document.addEventListener("pointerlockchange", () => { G.locked = document.pointerLockElement === canvas; });
  function cycleWeather() { const n = weather.next(); ui.wx.textContent = n; }
  function cycleTime() { const h = G.hour, order = [6.2, 12, 17.6, 22.5], nx = order.find(o => o > h + 0.05); if (nx === undefined) { G.hour = order[0]; G.dayCount++; } else G.hour = nx; }
  function nearBoat() { let best = null, bd = 1e9; for (const b of boats) { if (b.kind !== "row") continue; const d = Math.hypot(b.x - P.x, b.z - P.z); if (d < bd) { bd = d; best = b; } } return bd < 5 ? best : null; }
  function interact() {
    if (G.mode === "walk" && FARM.use(P.x, P.z)) return;
    if (G.mode === "walk") { const b = nearBoat(); if (b === myBoat || b) { G.boat = b; G.mode = "boat"; G.yaw = Math.atan2(-Math.cos(b.yaw), -Math.sin(b.yaw)); G.pitch = -0.12; if (F.state !== "off") reelIn(); hint("划船：W/S 前進後退，A/D 轉向；E 靠岸下船"); setTimeout(() => hint(""), 3500); } }
    else if (G.mode === "boat") {
      const b = G.boat; let best = null, bd = 1e9;
      for (let a = 0; a < 24; a++) for (let r = 2; r <= 9; r += 1.5) { const x = b.x + Math.cos(a / 24 * 6.283) * r, z = b.z + Math.sin(a / 24 * 6.283) * r, y = groundY(x, z); if (y > 0.35 && (onPier(x, z) || W.H(x, z) > 0.4)) { const d = r + (onPier(x, z) ? -1.5 : 0); if (d < bd) { bd = d; best = [x, z]; } } }
      if (best) { P.x = best[0]; P.z = best[1]; G.mode = "walk"; if (F.state !== "off") reelIn(); b.vx = b.vz = 0; } else hint("靠近碼頭或岸邊才能下船");
    }
  }

  // -------------------------------------------------------------------------------- per-frame
  let lastHour = Math.floor(G.hour), stepCooldown = 0, hintT = 0;
  function update(dt, time, sea) {
    if (!G.started) { updateBoats(dt, time, sea); return; }   // boats must sit on the water (and bob) during the intro / still shots too, not at the world origin
    if (G.paused) return;
    { const h0 = G.hour; G.hour += dt * G.tspeed; if (G.hour >= 24) { G.hour -= 24; G.dayCount++; } void h0; } const hh = Math.floor(G.hour); if (hh !== lastHour) { lastHour = hh; ambience.bell(1); }
    const mx = ((keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0)) + touch.mx, mz = ((keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0)) + touch.my;
    if (G.mode === "walk") {
      const sp = (G.sprint ? 7.2 : 4.1) * (F.state === "charge" ? 0.5 : 1) * (F.state === "reel" ? 0.0 : 1), cy = Math.cos(G.yaw), sy = Math.sin(G.yaw);
      let l = Math.hypot(mx, mz); if (l > 1) { /* normalise */ }
      const nx = l > 0.01 ? (mx * cy + mz * sy) / Math.max(1, l) : 0, nz = l > 0.01 ? (-mx * sy + mz * cy) / Math.max(1, l) : 0;
      P.vx = lerp(P.vx, nx * sp, 1 - Math.exp(-dt * 10)); P.vz = lerp(P.vz, nz * sp, 1 - Math.exp(-dt * 10));
      let tx = P.x + P.vx * dt, tz = P.z + P.vz * dt; [tx, tz] = pushOut(tx, tz, 0.42);
      const hNew = W.H(tx, tz), onP = onPier(tx, tz); if (hNew < -0.3 && !onP) { tx = P.x; tz = P.z; P.vx = P.vz = 0; }
      const moved = Math.hypot(tx - P.x, tz - P.z); P.x = tx; P.z = tz; P.y = lerp(P.y, groundY(P.x, P.z), 1 - Math.exp(-dt * 18));
      G.stepDist += moved; if (G.stepDist > (G.sprint ? 2.2 : 1.6)) { G.stepDist = 0; const m = onP ? "wood" : W.grid.maskRoad[0] !== undefined && roadAt(P.x, P.z) ? "cobble" : "grass"; ambience.tick(m); }
      G.bob += moved * 3.4; const bobY = Math.sin(G.bob) * 0.035 * Math.min(1, moved / dt / 3);
      camera.position.set(P.x, P.y + 1.68 + bobY, P.z);
    } else if (G.mode === "boat") {
      const b = G.boat, s = b.info.seat, c = Math.cos(b.yaw), sn = Math.sin(b.yaw); const wp = new THREE.Vector3(s[0], s[1] + 1.05, s[2]); b.obj.localToWorld(wp); camera.position.copy(wp); P.x = b.x; P.z = b.z;
    }
    camera.rotation.order = "YXZ"; camera.rotation.set(G.pitch, G.yaw, 0);
    updateBoats(dt, time, sea); updateFishing(dt, time, sea); FARM.update(dt, weather.key);
    if (F.state === "off" && G.mode === "walk" && F.state !== "reel") {
      const b = nearBoat(); const onP = onPier(P.x, P.z);
      if ((hintT -= dt) < 0) { hintT = 0.25; const fh = !b && G.mode === "walk" && FARM.hintFor(P.x, P.z); if (b) tip("boat"); else if (fh) tip("farm"); hint(b ? "按 E 上船" : fh || ""); }
    }
    const h = G.hour, hhh = Math.floor(h), mm = Math.floor((h - hhh) * 60); ui.wx.textContent = weather.target.name; { const cal = calendar(); ui.clock.textContent = cal.seasonName + "・第" + cal.day + "日 " + String(hhh).padStart(2, "0") + ":" + String(mm).padStart(2, "0"); }
    const d = Math.hypot(P.x + 24, P.z + 6); ui.where.textContent = G.mode === "boat" ? "海灣" : onPier(P.x, P.z) ? "碼頭" : W.coastS(P.x, P.z) > -30 ? "港口" : Math.hypot(P.x - W.square.x, P.z - W.square.z) < 35 ? "市集廣場" : d < 135 ? "城內" : "城外";
    document.body.classList.toggle("tool-cross", !!rod.visible);
    ui.where.textContent += "　· 工具：" + { hoe: "鋤頭", seed: "種子袋", bucket: "水桶" + (G.water ? "(" + G.water + ")" : ""), sickle: "鐮刀" }[G.tool || "hoe"];
  }
  const roadAt = (x, z) => W.roadDistAt(x, z) < 0.3;
  function collect() { return { v: 1, clock: { hour: G.hour, dayCount: G.dayCount }, weather: weather.key, player: { x: P.x, z: P.z, yaw: G.yaw, pitch: G.pitch, mode: G.mode }, boat: { x: myBoat.x, z: myBoat.z, yaw: myBoat.yaw }, inv: G.inv, farm: G.farm, dex: G.dex, tool: G.tool, water: G.water, fish: F.caught.slice(-300) }; }
  function restore(s) {
    G.hour = s.clock.hour; G.dayCount = s.clock.dayCount; G.inv = s.inv; G.farm = s.farm; G.dex = s.dex || {}; G.tool = s.tool || "hoe"; G.water = s.water || 0; F.caught = (s.fish || []).slice(); FARM.restore(); INV.refresh();
    if (s.boat) { myBoat.x = s.boat.x; myBoat.z = s.boat.z; myBoat.yaw = s.boat.yaw; myBoat.vx = myBoat.vz = myBoat.om = 0; }
    if (F.state !== "off") { F.state = "off"; rod.visible = false; bobber.visible = line.visible = false; ui.tension.style.display = ui.prog.style.display = "none"; }
    P.x = s.player.x; P.z = s.player.z; P.y = groundY(P.x, P.z); G.yaw = s.player.yaw; G.pitch = s.player.pitch; G.mode = s.player.mode === "boat" ? "boat" : "walk"; if (G.mode === "boat") G.boat = myBoat;
    weather.set(s.weather); Object.assign(weather.s, weather.target);
  }
  ctx.touch = ctx.touch || { mx: 0, my: 0, turn: 0, act: false };
  updateBoats(0.0001, 0, 0.3);   // place every boat once at creation
  const canStand = (x, z) => { const [px, pz] = pushOut(x, z, 0.42); if (Math.hypot(px - x, pz - z) > 0.04) return false; return !(W.H(x, z) < -0.3 && !onPier(x, z)); };
  return { canStand, update, calendar, collect, restore, G, P, boats, keys, F, toggleRod, groundY, onPier, interact, seaAt, inv: INV, farm: FARM, pickFish, FISH, mode: () => G.mode, setStarted: v => { G.started = v; } };
}
