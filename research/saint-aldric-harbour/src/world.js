// World generation (pure JS, no GPU): coast + terrain height, street network, market square, flattened plots, building lots,
// landmarks, walls and harbour. Runs in Node too, so the layout can be previewed as a top-down map.
import { clamp, lerp, smoothstep, gauss, mulberry32, makeNoise, segDist, TAU } from "./util.js";

export const SEA = 0;
export const GRID = { x0: -520, z0: -520, size: 1040, cell: 0.5 };   // fine grid for roads/plots (metres)
GRID.n = Math.round(GRID.size / GRID.cell);

export function buildWorld(seed = 7) {
  const rnd = mulberry32(seed);
  const N = makeNoise(seed);
  const W = { seed, rnd };

  // ------------------------------------------------------------------ base terrain
  const SEA_N = [0.62, 0.78];                // direction towards open sea (south-east)
  const BAY = { x: 92, z: 88, r: 96 };       // sheltered bay the harbour sits in
  W.coastS = (x, z) => {
    let s = x * SEA_N[0] + z * SEA_N[1] - 150 + N.fbm(x / 210, z / 210, 3) * 46;
    s += 70 * gauss((x - BAY.x) ** 2 + (z - BAY.z) ** 2, BAY.r);
    return s;                               // > 0 sea, < 0 land
  };
  const depthAt = d => Math.min(30, 0.06 * d + 8 * (1 - Math.exp(-d / 180)));
  const CASTLE = { x: -190, z: -160, r: 80, h: 40 };
  const CHURCH = { x: -52, z: -62, r: 46, h: 4.5 };
  W.landmarkSites = { CASTLE, CHURCH, BAY };
  W.harbour = {   // breakwater arms (polylines in the sea) leaving a ~40 m mouth facing east; basin centre for orientation
    moleS: [[4, 178], [30, 195], [60, 198], [90, 190], [115, 172], [128, 150]],
    moleN: [[118, 47], [133, 68], [136, 92], [131, 112]],
    centre: [80, 125],
  };
  // city wall: closed 32-point loop around an ellipse centre pulled inland; sea-side points are pushed back to coastS < -12 so the port lies outside
  const WALL_C = { x: -60, z: -40 }, WALL_RX = 250, WALL_RZ = 200;
  const wallRing = (off = 0, nPts = 32) => {
    const pts = [];
    for (let k = 0; k < nPts; k++) {
      const a = k / nPts * TAU, j = 1 + N.noise2(Math.cos(a) * 2.1, Math.sin(a) * 2.1) * 0.05;
      const rx = WALL_RX * j - off, rz = WALL_RZ * j - off;
      let x = 0, z = 0;
      for (let t = 1; t > 0.2; t -= 0.01) { x = WALL_C.x + Math.cos(a) * rx * t; z = WALL_C.z + Math.sin(a) * rz * t; if (W.coastS(x, z) < -12) break; }
      pts.push({ x, z });
    }
    return pts;
  };
  W.wall = { pts: wallRing(0, 32), towers: [], segments: [], gates: [] };
  const pointInPoly = (pts, x, z) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) c = !c; } return c; };
  const wallDist = (x, z) => { let d = 1e9; const P = W.wall.pts; for (let k = 0; k < P.length; k++) d = Math.min(d, segDist(x, z, P[k].x, P[k].z, P[(k + 1) % P.length].x, P[(k + 1) % P.length].z).d); return d; };
  // extend a road's end outward (ellipse march) until it meets the wall; stops before it reaches the sea
  const extendToWall = (pts, atStart = false) => {
    const P = (atStart ? pts.slice().reverse() : pts.slice()).map(p => Array.isArray(p) ? { x: p[0], z: p[1] } : p);
    const e = P[P.length - 1], q = P[P.length - 2];
    let dx = e.x - q.x, dz = e.z - q.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    let x = e.x, z = e.z;
    for (let s = 0; s < 260; s += 3) {
      const nx = x + dx * 3, nz = z + dz * 3;
      if (W.coastS(nx, nz) > -12 || !pointInPoly(W.wall.pts, nx, nz)) break;
      x = nx; z = nz; P.push({ x, z });
    }
    const out = atStart ? P.reverse() : P;
    return out.map(p => [p.x, p.z]);
  };
  // ring road, 40 m inside the wall: longest run of dry points
  const ringRoadPts = () => {
    const R = [];
    for (let k = 0; k < 96; k++) {
      const a = k / 96 * TAU; let x = 0, z = 0;
      for (let t = 1; t > 0.2; t -= 0.01) { x = WALL_C.x + Math.cos(a) * (WALL_RX - 40) * t; z = WALL_C.z + Math.sin(a) * (WALL_RZ - 40) * t; if (W.coastS(x, z) < -8) break; }
      R.push({ x, z, ok: W.coastS(x, z) < -8 && pointInPoly(W.wall.pts, x, z) });
    }
    let best = [], cur = [];
    for (const p of R) { if (p.ok) { cur.push({ x: p.x, z: p.z }); if (cur.length > best.length) best = cur; } else cur = []; }
    return best.length >= 8 ? best : null;
  };
  W.baseH = (x, z) => {
    const s = W.coastS(x, z);
    if (s >= 0) {
      let d = depthAt(s);
      const bd = Math.hypot(x - 78, z - 122), w = 1 - smoothstep(70, 110, bd);        // dredged basin: deep water right up to the quay
      if (w > 0) d = Math.max(d, lerp(d, Math.min(6.5, 2.0 + 0.6 * s), w));
      return -d;
    }
    const L = -s;
    let h = 1.8 * (1 - Math.exp(-L / 14)) + 0.024 * L;
    const hills = (N.fbm(x / 240 + 31, z / 240 - 12, 4) * .5 + .5);
    h += hills * 16 * smoothstep(120, 520, L);
    h += (N.ridged(x / 420 - 5, z / 420 + 9, 4) ** 1.6) * 150 * smoothstep(520, 1500, L);
    h += N.fbm(x / 38, z / 38, 3) * 0.55 * smoothstep(10, 60, L);          // small undulations
    h += CASTLE.h * gauss((x - CASTLE.x) ** 2 + (z - CASTLE.z) ** 2, CASTLE.r);
    h += CHURCH.h * gauss((x - CHURCH.x) ** 2 + (z - CHURCH.z) ** 2, CHURCH.r);
    return h;
  };

  // ------------------------------------------------------------------ fine grid + street network
  const n = GRID.n;
  const delta = new Float32Array(n * n);
  const touched = new Uint8Array(n * n);
  const maskRoad = new Uint8Array(n * n);      // cobbled street weight
  const maskPlaza = new Uint8Array(n * n);     // market square paving weight
  const maskYard = new Uint8Array(n * n);      // trampled dirt around buildings
  const roadD = new Float32Array(n * n).fill(999);   // distance to nearest road edge (negative inside)
  const cellOf = (x, z) => [Math.floor((x - GRID.x0) / GRID.cell), Math.floor((z - GRID.z0) / GRID.cell)];
  const baseCache = new Float32Array(n * n).fill(NaN);
  const baseAt = (i, j) => {
    const k = j * n + i;
    if (Number.isNaN(baseCache[k])) baseCache[k] = W.baseH(GRID.x0 + (i + .5) * GRID.cell, GRID.z0 + (j + .5) * GRID.cell);
    return baseCache[k];
  };
  const hv = new Float32Array(n * n).fill(NaN);
  function applyH(i, j, target, w) {
    if (i < 0 || j < 0 || i >= n || j >= n || w <= 0) return;
    const k = j * n + i; const cur = Number.isNaN(hv[k]) ? baseAt(i, j) : hv[k];
    hv[k] = lerp(cur, target, w); touched[k] = 1;
  }
  W.roadDistAt = (x, z) => {
    const i = Math.floor((x - GRID.x0) / GRID.cell), j = Math.floor((z - GRID.z0) / GRID.cell);
    if (i < 0 || j < 0 || i >= n || j >= n) return 999; return roadD[j * n + i];
  };
  W.roads = [];
  function addRoad(id, kind, width, pts, dense0) {
    const r = { id, kind, width, pts: pts ? pts.map(p => ({ x: p[0], z: p[1] })) : [] };
    let dense = [];
    if (dense0) dense = dense0.map(p => ({ x: p.x, z: p.z }));
    else for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1], len = Math.hypot(b.x - a.x, b.z - a.z), nn = Math.max(1, Math.round(len / 4));
      for (let k = 0; k < nn; k++) { const t = k / nn; dense.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }); }
      if (i === r.pts.length - 2) dense.push({ x: b.x, z: b.z });
    }
    for (let pass = 0; pass < 3; pass++) for (let i = 1; i < dense.length - 1; i++) dense[i] = { x: (dense[i - 1].x + dense[i].x * 2 + dense[i + 1].x) / 4, z: (dense[i - 1].z + dense[i].z * 2 + dense[i + 1].z) / 4 };
    let sLen = 0; dense[0].s = 0;
    for (let i = 1; i < dense.length; i++) { sLen += Math.hypot(dense[i].x - dense[i - 1].x, dense[i].z - dense[i - 1].z); dense[i].s = sLen; }
    { // never let a street run into the sea (it would raise a causeway): cut at the first wet point
      const k = dense.findIndex(q => W.coastS(q.x, q.z) > -3.5);
      if (k > 3 && k < dense.length) { dense = dense.slice(0, k); sLen = dense[dense.length - 1].s; }
    }
    r.dense = dense; r.length = sLen;
    const hs = dense.map(p => Math.max(1.5, W.baseH(p.x, p.z)));
    const sm = hs.slice();
    for (let pass = 0; pass < 14; pass++) for (let i = 1; i < sm.length - 1; i++) sm[i] = (sm[i - 1] + sm[i] * 2 + sm[i + 1]) / 4;
    for (let i = 0; i < dense.length; i++) dense[i].h = sm[i] + 0.04;
    for (let i = 0; i < dense.length; i++) {
      const a = dense[Math.max(0, i - 1)], b = dense[Math.min(dense.length - 1, i + 1)];
      const l = Math.hypot(b.x - a.x, b.z - a.z) || 1; dense[i].tx = (b.x - a.x) / l; dense[i].tz = (b.z - a.z) / l;
    }
    const half = width / 2, margin = half + 5;
    for (let q = 0; q < dense.length - 1; q++) {
      const a = dense[q], b = dense[q + 1];
      const [i0, j0] = cellOf(Math.min(a.x, b.x) - margin, Math.min(a.z, b.z) - margin), [i1, j1] = cellOf(Math.max(a.x, b.x) + margin, Math.max(a.z, b.z) + margin);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        if (i < 0 || j < 0 || i >= n || j >= n) continue;
        const px = GRID.x0 + (i + .5) * GRID.cell, pz = GRID.z0 + (j + .5) * GRID.cell;
        const sd = segDist(px, pz, a.x, a.z, b.x, b.z);
        const edge = sd.d - half, k = j * n + i;
        if (edge < roadD[k]) roadD[k] = edge;
        if (edge > 5) continue;
        applyH(i, j, lerp(a.h, b.h, sd.t), 1 - smoothstep(0.4, 5.0, edge));
        if (edge < 0.15) {
          const cw = 1 - smoothstep(-0.25, 0.35, edge + N.noise2(px * 1.9, pz * 1.9) * 0.32);
          maskRoad[k] = Math.max(maskRoad[k], Math.round(255 * cw * (kind === "lane" ? 0.8 : 1)));
        }
      }
    }
    W.roads.push(r); return r;
  }
  W.square = { x: -6, z: 12, rx: 35, rz: 35, rot: -0.42, shape: 'superellipse4' };
  W.inSquare = (x, z, pad = 0) => {
    const sq = W.square, c = Math.cos(sq.rot), s = Math.sin(sq.rot), dx = x - sq.x, dz = z - sq.z;
    const lx = dx * c + dz * s, lz = -dx * s + dz * c;
    return Math.abs(lx / (sq.rx + pad)) ** 4 + Math.abs(lz / (sq.rz + pad)) ** 4 < 1;   // superellipse: a rounded 70 x 70 m square
  };
  // 1. harbour shoreline contour + quay street just inland of it
  W.quayPts = [];
  for (let a = -3.14; a <= 3.14; a += 0.05) {
    const cx = BAY.x, cz = BAY.z + 4; let r = 0;
    for (r = 6; r < 230; r += 0.5) { if (W.coastS(cx + Math.cos(a) * r, cz + Math.sin(a) * r) < 0) break; }
    if (r < 200) W.quayPts.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, a, r });
  }
  // 2. primary roads
  addRoad("main", "main", 6.5, extendToWall([[-182, -24], [-146, -19], [-108, -10], [-70, -1], [-36, 6], [-6, 12], [22, 26], [46, 42]], true));
  addRoad("north", "street", 5.2, extendToWall([[-14, -4], [-24, -24], [-38, -42], [-50, -52], [-58, -80], [-58, -112], [-52, -146]]));
  addRoad("hill", "lane", 3.8, extendToWall([[-96, -12], [-116, -40], [-132, -74], [-160, -118], [-186, -142]]));
  addRoad("east", "street", 5.0, extendToWall([[46, 42], [72, 30], [100, 30], [122, 42]]));
  { const rp = ringRoadPts(); if (rp) addRoad("ring", "street", 4.6, rp); }
  addRoad("radial", "street", 4.6, [[-6, 12], [-30, 50], [-50, 90]]);
  addRoad("radialE", "street", 4.6, [[24, 6], [50, -18], [72, -52], [88, -84]]);
  addRoad("radialW", "street", 4.6, [[-30, 34], [-80, 46], [-120, 70], [-150, 96]]);
  addRoad("radialS", "street", 4.6, [[2, 30], [18, 78], [34, 118]]);
  // quay street: follow the shoreline, 9 m inland
  {
    const pts = W.quayPts.filter((p, i) => i % 2 === 0).map(p => { const dx = p.x - BAY.x, dz = p.z - (BAY.z + 4), l = Math.hypot(dx, dz); return { x: p.x + dx / l * 9, z: p.z + dz / l * 9 }; });
    if (pts.length > 4) addRoad("quay", "street", 5.6, null, pts);
  }
  // main road continues to the quay road
  {
    const q = W.roads.find(r => r.id === "quay");
    if (q) { let best = q.dense[0], bd = 1e9; for (const p of q.dense) { const d = Math.hypot(p.x - 46, p.z - 42); if (d < bd) { bd = d; best = p; } }
      addRoad("harbourroad", "street", 5.8, [[46, 42], [60, 58], [best.x, best.z]]); }
  }
  // market square: slightly sloped paved ellipse
  {
    const sq = W.square, c = Math.cos(sq.rot), s = Math.sin(sq.rot);
    // fit a plane to the natural terrain under the square so the cut/fill is as small as possible (the old flat-at-centre plaza left a wall on the uphill side)
    let sh = 0, sxh = 0, szh = 0, sxx = 0, szz = 0, cnt = 0;
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) { const dx0 = a * sq.rx / 3, dz0 = b * sq.rz / 3, X = sq.x + dx0 * c - dz0 * s, Z = sq.z + dx0 * s + dz0 * c, h = Math.max(2.6, W.baseH(X, Z)); sh += h; sxh += (X - sq.x) * h; szh += (Z - sq.z) * h; sxx += (X - sq.x) ** 2; szz += (Z - sq.z) ** 2; cnt++; }
    const hBase = sh / cnt + 0.05, gx = Math.max(-0.05, Math.min(0.05, sxh / sxx)), gz = Math.max(-0.05, Math.min(0.05, szh / szz));
    W.square.h = hBase;
    const R = Math.hypot(sq.rx, sq.rz) * 1.5 + 8;
    const [i0, j0] = cellOf(sq.x - R, sq.z - R), [i1, j1] = cellOf(sq.x + R, sq.z + R);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (i < 0 || j < 0 || i >= n || j >= n) continue;
      const px = GRID.x0 + (i + .5) * GRID.cell, pz = GRID.z0 + (j + .5) * GRID.cell;
      const dx = px - sq.x, dz = pz - sq.z;
      const lx = dx * c + dz * s, lz = -dx * s + dz * c;
      const e = Math.pow(Math.abs(lx / sq.rx) ** 4 + Math.abs(lz / sq.rz) ** 4, 0.25);
      const wob = N.noise2(px * 0.09, pz * 0.09) * 0.06;
      const ee = e + wob, plane = hBase + gx * dx + gz * dz;
      const k = j * n + i;
      if (ee < 1) { applyH(i, j, plane, 1); maskPlaza[k] = 255; roadD[k] = Math.min(roadD[k], -1); }
      else if (ee < 1.55) { const w = 1 - smoothstep(1, 1.55, ee); applyH(i, j, plane, w); if (ee < 1.18) maskPlaza[k] = Math.max(maskPlaza[k], Math.round(255 * (1 - smoothstep(1, 1.18, ee)))); }
    }
  }

  // ------------------------------------------------------------------ organic lanes grown off the primary streets
  {
    const lr = rnd.fork();
    let laneNo = 0;
    const tryLane = (parent, s0, side, gen) => {
      let idx = parent.dense.findIndex(p => p.s >= s0); if (idx < 1) return;
      const p = parent.dense[idx];
      let dx = -p.tz * side, dz = p.tx * side;
      const jit = lr.range(-0.28, 0.28), cj = Math.cos(jit), sj = Math.sin(jit);
      [dx, dz] = [dx * cj - dz * sj, dx * sj + dz * cj];
      const pts = [{ x: p.x + dx * (parent.width / 2 + 0.2), z: p.z + dz * (parent.width / 2 + 0.2) }];
      let traveled = 0, connected = false;
      const maxLen = lr.range(40, gen === 1 ? 120 : 70);
      while (traveled < maxLen) {
        const cur = pts[pts.length - 1];
        const turn = (N.noise2(cur.x * 0.05 + 7, cur.z * 0.05 - 3)) * 0.1 + lr.range(-0.03, 0.03);
        const ct = Math.cos(turn), st = Math.sin(turn); [dx, dz] = [dx * ct - dz * st, dx * st + dz * ct];
        const nx = cur.x + dx * 3, nz = cur.z + dz * 3;
        if (W.baseH(nx, nz) < 1.9 || -W.coastS(nx, nz) < 7 || !pointInPoly(W.wall.pts, nx, nz)) break;
        if (Math.abs(W.baseH(nx, nz) - W.baseH(cur.x, cur.z)) > 0.42) break;
        if (W.inSquare(nx, nz, 3)) break;
        const rd = W.roadDistAt(nx, nz);
        if (rd < 2.2 && traveled > 14) { pts.push({ x: nx, z: nz }); connected = true; break; }
        if (rd < 6 && traveled <= 14 && traveled > 3) return;
        pts.push({ x: nx, z: nz }); traveled += 3;
      }
      if (pts.length < 8 && !connected) return;
      const r = addRoad("lane" + (laneNo++), "lane", gen === 1 ? 3.6 : 3.0, null, pts);
      r.gen = gen; r.parent = parent.id;
      return r;
    };
    const parents1 = W.roads.filter(r => r.kind !== "lane" || r.id === "hill");
    for (const par of parents1) {
      let s0 = lr.range(14, 26);
      while (s0 < par.length - 16) {
        for (const side of [-1, 1]) if (lr() < 0.9) tryLane(par, s0 + lr.range(-5, 5), side, 1);
        s0 += lr.range(20, 30);
      }
    }
    const gen1 = W.roads.filter(r => r.gen === 1);
    for (const par of gen1) {
      let s0 = lr.range(18, 28);
      while (s0 < par.length - 12) { for (const side of [-1, 1]) if (lr() < 0.7) tryLane(par, s0, side, 2); s0 += lr.range(20, 30); }
    }
  }

  // ------------------------------------------------------------------ city gates (5) and dry moat outside the wall
  W.wall.gates = [];
  for (const rid of ["main", "north", "hill", "east", "harbourroad"]) {
    const r = W.roads.find(q => q.id === rid); if (!r) continue;
    let best = null, bd = 1e9; const P = W.wall.pts;
    for (const p of r.dense) for (let k = 0; k < P.length; k++) { const sd = segDist(p.x, p.z, P[k].x, P[k].z, P[(k + 1) % P.length].x, P[(k + 1) % P.length].z); if (sd.d < bd) { bd = sd.d; best = { x: p.x, z: p.z, seg: k, road: r, tx: p.tx, tz: p.tz }; } }
    if (best && bd < 12) W.wall.gates.push(best);
  }
  {   // dry ditch: trapezoid profile centred 12 m outside the wall line (d 3..21 m): flat bottom 6 m, sides 1:3, depth 2 m.
    // The bottom never goes below 0.9 m (sea level is 0), and the ditch fades out towards the coast (coastS > -25 gets nothing).
    const P = W.wall.pts, mD = new Float32Array(n * n).fill(999);
    const side = (a, b, x, z) => (b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x);
    for (let k = 0; k < P.length; k++) {
      const a = P[k], b = P[(k + 1) % P.length], pad = 24;
      const [i0, j0] = cellOf(Math.min(a.x, b.x) - pad, Math.min(a.z, b.z) - pad), [i1, j1] = cellOf(Math.max(a.x, b.x) + pad, Math.max(a.z, b.z) + pad);
      const sC = side(a, b, WALL_C.x, WALL_C.z);
      for (let j = Math.max(0, j0); j <= Math.min(n - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(n - 1, i1); i++) {
        const px = GRID.x0 + (i + .5) * GRID.cell, pz = GRID.z0 + (j + .5) * GRID.cell;
        if (side(a, b, px, pz) * sC > 0) continue;   // inside the wall
        const d = segDist(px, pz, a.x, a.z, b.x, b.z).d, kk = j * n + i;
        if (d < mD[kk]) mD[kk] = d;
      }
    }
    const DITCH_C = 12, DITCH_HALF = 9, DEPTH = 2.0;
    for (let kk = 0; kk < n * n; kk++) {
      const d = mD[kk]; if (d > DITCH_HALF + DITCH_C || d < DITCH_C - DITCH_HALF) continue;
      const i = kk % n, j = (kk / n) | 0, x = GRID.x0 + (i + .5) * GRID.cell, z = GRID.z0 + (j + .5) * GRID.cell;
      const fade = clamp((-W.coastS(x, z) - 25) / 15, 0, 1);
      if (fade <= 0 || roadD[kk] < 2.5 || maskPlaza[kk] > 0) continue;       // no ditch on the coast side, under roads or in the square
      if (W.wall.gates.some(g => Math.hypot(x - g.x, z - g.z) < 7)) continue; // causeways at the gates
      const e = Math.abs(d - DITCH_C);                                       // distance from the ditch centre line
      const t = clamp((DITCH_HALF - Math.max(0, e - 3)) / 6, 0, 1);             // 1 on the bottom, falls off 1:3 over the sides
      const depth = DEPTH * t * t * (3 - 2 * t) * fade;                      // smoothstep edges, no hard step
      if (depth <= 0.01) continue;
      const cur = Number.isNaN(hv[kk]) ? baseAt(i, j) : hv[kk];
      applyH(i, j, Math.max(cur - depth, Math.min(cur, 0.9)), 1);
      if (t > 0.5) maskYard[kk] = Math.max(maskYard[kk], 200);               // bottom and inner slope: trodden mud, not grey stone
    }
  }

  // ------------------------------------------------------------------ building lots along the streets
  W.buildings = [];
  const placed = [];                                      // oriented boxes for overlap tests
  const obbOverlap = (A, B, pad = 0) => {
    const axes = [[A.ax, A.az], [-A.az, A.ax], [B.ax, B.az], [-B.az, B.ax]];
    for (const [ux, uz] of axes) {
      const proj = (O) => { const c = O.x * ux + O.z * uz; const r = Math.abs(O.ax * ux + O.az * uz) * O.hw + Math.abs(-O.az * ux + O.ax * uz) * O.hd; return [c - r, c + r]; };
      const [a0, a1] = proj(A), [b0, b1] = proj(B);
      if (a1 + pad < b0 || b1 + pad < a0) return false;
    }
    return true;
  };
  const seaCheck = (x, z) => W.baseH(x, z) > 1.35;
  function landmark(kind, x, z, ax, az, w, d, extra = {}) {
    const b = { kind, x, z, ax, az, hw: w / 2, hd: d / 2, w, d, ...extra };
    placed.push(b); return b;
  }
  W.landmarks = {};
  // church on the rise north-west of the square, nave pointing east-west
  {
    const L = CHURCH, ang = -0.18;
    W.landmarks.church = landmark("church", L.x, L.z, Math.cos(ang), Math.sin(ang), 36, 14, { angle: ang });
  }
  // Nikolai-type sailors' church on the land side of the quay (reserved here so no lot is placed on it)
  {
    const hc = W.harbour.centre, P0 = { x: hc[0] + 30, z: hc[1] - 45 };
    let best = null, bd = 1e9;
    for (const q of W.quayPts) { const d = Math.hypot(q.x - P0.x, q.z - P0.z); if (d < bd) { bd = d; best = q; } }
    if (best) {
      const ox = best.x - BAY.x, oz = best.z - (BAY.z + 4), ol = Math.hypot(ox, oz) || 1;   // outward (landward) normal of the shoreline
      const cx = best.x + ox / ol * 22, cz = best.z + oz / ol * 22;
      const ang = Math.atan2(oz, ox) + Math.PI / 2;                                     // nave axis parallel to the quay
      W.landmarks.nikolai = landmark("church", cx, cz, Math.cos(ang), Math.sin(ang), 36, 14, { angle: ang, harbour: true });
    }
  }
  // guildhall on the square, tavern towards the quay, crane on the quay head
  {
    const sq = W.square;
    const hallC = { x: sq.x + 6, z: sq.z - sq.rz - 9 };
    const ang = sq.rot; W.landmarks.guildhall = landmark("guildhall", hallC.x - 8, hallC.z - 2, Math.cos(ang), Math.sin(ang), 20, 12, { angle: ang });
  }

  const district = (x, z) => {
    const ds = Math.hypot(x - W.square.x, z - W.square.z);
    const coast = -W.coastS(x, z);
    if (coast < 55 && x > 20) return "quay";
    if (ds < 110) return "centre";
    if (ds < 200) return "inner";
    return "edge";
  };
  W.district = district;
  const roadOrder = W.roads.map(r => r.id);
  for (const rid of roadOrder) {
    const r = W.roads.find(q => q.id === rid); if (!r) continue;
    for (const side of [-1, 1]) {
      let s = rnd.range(2, 8);
      while (s < r.length - 6) {
        // find the road point at arc length s
        let idx = r.dense.findIndex(p => p.s >= s); if (idx < 1) { s += 3; continue; }
        const p = r.dense[idx];
        const nxn = -p.tz * side, nzn = p.tx * side;                     // unit normal pointing away from the road
        const dist0 = district(p.x, p.z);
        // Dielenhaus (narrow front, long plot) and brick gable (Giebelhaus) take most of the town centre and inner ring
        const kr = rnd();
        const isDielen = dist0 !== "edge" && kr < 0.2;
        const isBrickG = !isDielen && dist0 !== "edge" && kr < 0.5;
        const wBase = isDielen ? rnd.range(6, 10) : dist0 === "centre" ? rnd.range(6, 11) : dist0 === "quay" ? rnd.range(7, 13) : dist0 === "inner" ? rnd.range(5.5, 9) : rnd.range(4.8, 7.5);
        const w = Math.round(wBase * 4) / 4;
        const dep = isDielen ? rnd.range(16, 22) : (dist0 === "edge" ? rnd.range(6.5, 9.5) : dist0 === "quay" ? rnd.range(9, 16) : rnd.range(7, 11.5));
        const off = r.width / 2 + 0.55 + dep / 2;
        const mid = r.dense[Math.min(r.dense.length - 1, Math.max(0, r.dense.findIndex(q => q.s >= s + w / 2)))] || p;
        const cx = mid.x + nxn * off, cz = mid.z + nzn * off;
        const jitter = rnd.range(-0.04, 0.04);
        const ax = mid.tx * Math.cos(jitter) - mid.tz * Math.sin(jitter), az = mid.tx * Math.sin(jitter) + mid.tz * Math.cos(jitter);
        const cand = { x: cx, z: cz, ax, az, hw: w / 2, hd: dep / 2, w, d: dep };
        let ok = seaCheck(cx, cz) && seaCheck(cx + nxn * dep * .5, cz + nzn * dep * .5);
        if (ok && W.inSquare(cx, cz, 2)) ok = false;
        if (ok && (!pointInPoly(W.wall.pts, cx, cz) || wallDist(cx, cz) < 6)) ok = false;
        if (ok) for (const o of placed) if (obbOverlap(cand, o, 0.4)) { ok = false; break; }
        // keep clear of other roads (any road, measured with the fine grid)
        if (ok) for (const [fx, fz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const px = cx + ax * fx * cand.hw + (-az) * fz * cand.hd, pz = cz + az * fx * cand.hw + ax * fz * cand.hd;
          if (W.roadDistAt(px, pz) < 0.25 && Math.hypot(px - mid.x, pz - mid.z) > r.width / 2 + 1.2) { ok = false; break; }
        }
        if (ok) {
          const tall = isDielen ? rnd.pick([3, 3, 4]) : isBrickG ? rnd.pick([2, 3, 3]) : dist0 === "centre" ? (rnd() < 0.55 ? 3 : 2) : dist0 === "inner" ? (rnd() < 0.35 ? 3 : 2) : dist0 === "quay" ? rnd.pick([2, 3, 3, 4]) : rnd.pick([1, 1, 2]);
          const kind = isDielen ? "dielen" : isBrickG ? "brickgable" : dist0 === "edge" ? (rnd() < 0.6 ? "cottage" : "timber") : dist0 === "quay" ? (rnd() < 0.45 ? "warehouse" : rnd() < 0.6 ? "stone" : "timber") : (rnd() < 0.2 ? "stone" : rnd() < 0.12 ? "stepgable" : "timber");
          const b = { kind, x: cx, z: cz, ax, az, hw: cand.hw, hd: cand.hd, w, d: dep, floors: tall, district: dist0, road: rid, side, front: { nx: -nxn, nz: -nzn }, seed: Math.floor(rnd() * 1e9) };
          placed.push(b); W.buildings.push(b);
        }
        s += w + rnd.range(0.1, 0.5);
      }
    }
  }
  // tavern: the largest timber house closest to the harbour end of the main street
  {
    let best = null, bd = 1e9;
    for (const b of W.buildings) if (b.kind === "timber" && b.floors >= 2 && b.w > 8) { const d = Math.hypot(b.x - 60, b.z - 56); if (d < bd) { bd = d; best = b; } }
    if (best) { best.kind = "tavern"; W.landmarks.tavern = best; }
  }
  // second row: cottages and small houses in the backyards behind street frontages (centre and inner ring)
  {
    for (const b of W.buildings.slice()) {
      if (b.district === "edge" || b.kind === "warehouse" || b.kind === "tavern" || rnd() > 0.45) continue;
      const wd = rnd.range(4.5, 6.5), dep = rnd.range(5, 7), off = b.hd + 1.6 + dep / 2;
      const cx = b.x - b.front.nx * off, cz = b.z - b.front.nz * off;
      const cand = { x: cx, z: cz, ax: b.ax, az: b.az, hw: wd / 2, hd: dep / 2, w: wd, d: dep };
      let ok = pointInPoly(W.wall.pts, cx, cz) && wallDist(cx, cz) > 6 && seaCheck(cx, cz) && W.roadDistAt(cx, cz) > 3.5 && !W.inSquare(cx, cz, 2);
      if (ok) for (const o of placed) if (obbOverlap(cand, o, 0.4)) { ok = false; break; }
      if (!ok) continue;
      const nb = { kind: rnd() < 0.7 ? "cottage" : "timber", x: cx, z: cz, ax: b.ax, az: b.az, hw: wd / 2, hd: dep / 2, w: wd, d: dep, floors: rnd() < 0.6 ? 1 : 2, district: b.district, road: b.road, side: b.side, front: { nx: b.front.nx, nz: b.front.nz }, seed: Math.floor(rnd() * 1e9), backyard: true };
      placed.push(nb); W.buildings.push(nb);
    }
  }
  // ground height under every building: flatten to the frontage road height (+ small plinth)
  for (const b of W.buildings) {
    const road = W.roads.find(r => r.id === b.road);
    const sd = (() => { let best = { d: 1e9, h: 2 }; for (let q = 0; q < road.dense.length - 1; q++) { const a = road.dense[q], c = road.dense[q + 1]; const r2 = segDist(b.x, b.z, a.x, a.z, c.x, c.z); if (r2.d < best.d) best = { d: r2.d, h: lerp(a.h, c.h, r2.t) }; } return best; })();
    { const bh = Math.max(1.6, W.baseH(b.x, b.z)); b.y0 = (sd.d > 18 ? bh : sd.h) + 0.18; b.y0 = Math.max(bh - 1.2, Math.min(bh + 1.2, b.y0)); }   // back-row houses follow the local ground, never a distant street (that made 3 m mounds)
  }
  // flatten plots (the lot rectangle + 3 m yard) onto y0
  const stampRect = (cx, cz, ax, az, hw, hd, target, blend, yard = true) => {
    const R = Math.hypot(hw, hd) + blend + 1;
    const [i0, j0] = cellOf(cx - R, cz - R), [i1, j1] = cellOf(cx + R, cz + R);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (i < 0 || j < 0 || i >= n || j >= n) continue;
      const px = GRID.x0 + (i + .5) * GRID.cell, pz = GRID.z0 + (j + .5) * GRID.cell;
      const dx = px - cx, dz = pz - cz;
      const lx = dx * ax + dz * az, lz = -dx * az + dz * ax;
      const ex = Math.max(0, Math.abs(lx) - hw), ez = Math.max(0, Math.abs(lz) - hd);
      const e = Math.hypot(ex, ez);
      if (e > blend) continue;
      const w = 1 - smoothstep(0, blend, e);
      const k = j * n + i; if (roadD[k] < -0.0 && roadD[k] > -99) { /* keep road surface */ if (roadD[k] < 0.2) continue; }
      applyH(i, j, target, w);
      if (yard && e < 2.5 && roadD[k] > 0.3) maskYard[k] = Math.max(maskYard[k], Math.round(255 * (1 - smoothstep(0.5, 2.5, e))));
    }
  };
  for (const b of W.buildings) stampRect(b.x, b.z, b.ax, b.az, b.hw + 0.4, b.hd + 0.4, b.y0, 4.5);
  {
    const L = W.landmarks.church; L.y0 = Math.max(W.baseH(L.x, L.z), 3) + 0.1;
    stampRect(L.x, L.z, L.ax, L.az, L.hw + 6, L.hd + 12, L.y0, 8, false);
    if (W.landmarks.nikolai) { const N = W.landmarks.nikolai; N.y0 = Math.max(W.baseH(N.x, N.z), 2.5) + 0.1; stampRect(N.x, N.z, N.ax, N.az, N.hw + 4, N.hd + 4, N.y0, 8, false); }
    const G = W.landmarks.guildhall; G.y0 = W.square.h + 0.1;
    stampRect(G.x, G.z, G.ax, G.az, G.hw + 1, G.hd + 1, G.y0, 3, false);
  }
  // gardens (fenced vegetable/herb plots, mud ground) and public wells on free inland spots inside the wall
  W.gardens = []; W.wells = [];
  {
    const free = (x, z, r) => pointInPoly(W.wall.pts, x, z) && wallDist(x, z) > 10 && W.coastS(x, z) < -40 && W.roadDistAt(x, z) > 4 && !W.inSquare(x, z, 6) && W.buildings.every(b => Math.hypot(b.x - x, b.z - z) > r) && W.gardens.every(g => Math.hypot(g.x - x, g.z - z) > 30) && W.wells.every(q => Math.hypot(q.x - x, q.z - z) > 40);
    const spots = [];
    for (let x = -290; x <= 150; x += 10) for (let z = -220; z <= 180; z += 10) spots.push([x + rnd.range(-3, 3), z + rnd.range(-3, 3)]);
    for (let k = spots.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [spots[k], spots[j]] = [spots[j], spots[k]]; }
    for (const [x, z] of spots) {
      if (W.gardens.length < 4 && free(x, z, 9)) {
        const g = { x, z, ax: rnd() < 0.5 ? 1 : 0, az: 0, hw: 6, hd: 4.5 }; g.az = 1 - g.ax;
        const hH = Math.max(W.baseH(x, z), 1.6);
        stampRect(x, z, g.ax, g.az, g.hw, g.hd, hH, 3, false);
        for (let u = -g.hw; u <= g.hw; u += 0.5) for (let v = -g.hd; v <= g.hd; v += 0.5) {
          const px = x + g.ax * u - g.az * v, pz = z + g.az * u + g.ax * v, i = Math.floor((px - GRID.x0) / GRID.cell), j = Math.floor((pz - GRID.z0) / GRID.cell);
          if (i >= 0 && j >= 0 && i < n && j < n) maskYard[j * n + i] = 220;
        }
        W.gardens.push(g);
      } else if (W.wells.length < 3 && free(x, z, 6)) W.wells.push({ x, z });
      if (W.gardens.length >= 4 && W.wells.length >= 3) break;
    }
  }
  // quay apron: the strip between the shoreline and the quay street is raised to deck height so the harbour reads as paved ground, not a sand basin
  {
    const QY = 1.4;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = GRID.x0 + (i + .5) * GRID.cell, z = GRID.z0 + (j + .5) * GRID.cell;
      if (x < 10 || x > 190 || z < -10 || z > 190) continue;
      const sc = W.coastS(x, z); if (sc > 0.0 || sc < -42) continue;
      if (-sc > 55) continue;
      const k = j * n + i, cur = Number.isNaN(hv[k]) ? baseAt(i, j) : hv[k];
      if (cur < QY) applyH(i, j, QY, 1 - smoothstep(26, 42, -sc));
    }
  }
  // finalise delta
  for (let k = 0; k < n * n; k++) if (touched[k]) delta[k] = hv[k] - baseAt(k % n, (k / n) | 0);

  W.deltaAt = (x, z) => {
    const fx = (x - GRID.x0) / GRID.cell - .5, fz = (z - GRID.z0) / GRID.cell - .5;
    const i = Math.floor(fx), j = Math.floor(fz);
    if (i < 0 || j < 0 || i >= n - 1 || j >= n - 1) return 0;
    const u = fx - i, v = fz - j, k = j * n + i;
    return (delta[k] * (1 - u) + delta[k + 1] * u) * (1 - v) + (delta[k + n] * (1 - u) + delta[k + n + 1] * u) * v;
  };
  W.H = (x, z) => W.baseH(x, z) + W.deltaAt(x, z);
  W.normal = (x, z, e = 0.7) => {
    const hx = W.H(x + e, z) - W.H(x - e, z), hz = W.H(x, z + e) - W.H(x, z - e);
    const l = Math.hypot(hx, 2 * e, hz); return [-hx / l, 2 * e / l, -hz / l];
  };
  W.grid = { delta, maskRoad, maskPlaza, maskYard, roadD, n };

  // quay line along the water edge of the bay (used for stone quay wall + bollards)
  W.quayPts = [];
  for (let a = 1.9; a <= 4.3; a += 0.012) {                      // sweep the sheltered western shore of the bay for the s = 0 contour
    const cx = BAY.x, cz = BAY.z - 20; let r = 0;
    for (r = 5; r < 260; r += 0.4) { if (W.coastS(cx + Math.cos(a) * r, cz + Math.sin(a) * r) < 0) break; }
    if (r >= 259) continue;
    W.quayPts.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, a });
  }
  return W;
}
