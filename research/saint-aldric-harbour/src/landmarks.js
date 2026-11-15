// Landmarks: church, guildhall turret, curtain wall with towers and gates, hilltop castle ruin, stone quay wall and timber piers.
import { L } from "./textures.js";
import { MeshBuilder, cross, sub, norm, dot } from "./mesh.js";
import { houseGeometry } from "./houses.js";
import { mulberry32, clamp, lerp, smoothstep } from "./util.js";

const ST = [1, 1, 1];
const o = (mat, tint = ST, ao = 1, extra = {}) => ({ mat, tint, ao, ...extra });

/** gable roof with ridge along local x. Returns ridge height. */
function gable(T, x0, x1, zHalf, yEave, rise, ov, ovx, mat, tint, opts = {}) {
  const xa = x0 - ovx, xb = x1 + ovx, zf = zHalf + ov, ye = yEave - ov * rise / zHalf, yr = yEave + rise;
  const sl = Math.hypot(zHalf, rise), up = [0, rise / sl, zHalf / sl];
  T.quad([xa, ye, zf], [xb, ye, zf], [xb, yr, 0], [xa, yr, 0], o(mat, tint, 1, { uvFn: p => [p[0], (p[1] - ye) / (rise / sl)] }));
  T.quad([xb, ye, -zf], [xa, ye, -zf], [xa, yr, 0], [xb, yr, 0], o(mat, tint, 1, { uvFn: p => [-p[0], (p[1] - ye) / (rise / sl)] }));
  if (!opts.noEnds) {
    T.triFace([x1, yEave, zHalf], [x1, yEave, -zHalf], [x1, yr, 0], o(opts.endMat ?? L.ashlar, opts.endTint ?? ST, 1, { uvFn: p => [p[2], p[1]] }));
    T.triFace([x0, yEave, -zHalf], [x0, yEave, zHalf], [x0, yr, 0], o(opts.endMat ?? L.ashlar, opts.endTint ?? ST, 1, { uvFn: p => [-p[2], p[1]] }));
  }
  void up; return yr;
}
function pyramid(T, cx, cz, half, y0, h, mat, tint, sides = 4) {
  const top = [cx, y0 + h, cz]; const rot = sides === 4 ? Math.PI / 4 : 0;
  for (let i = 0; i < sides; i++) {
    const a0 = rot + i / sides * Math.PI * 2, a1 = rot + (i + 1) / sides * Math.PI * 2, r = half * (sides === 4 ? 1.4142 : 1);
    const A = [cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r], B = [cx + Math.cos(a0) * r, y0, cz + Math.sin(a0) * r];
    const sl = Math.hypot(h, half);
    T.triFace(A, B, top, o(mat, tint, 1, { uvFn: p => [Math.hypot(p[0] - cx, p[2] - cz) * 0 + (p[0] + p[2]) * 0.7, (p[1] - y0) * (sl / h)] }));
  }
}
function crenels(T, p, q, y, count, w, h, d, outerN, mat, tint) {
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count, x = p[0] + (q[0] - p[0]) * t, z = p[2] + (q[2] - p[2]) * t;
    if (i % 2) continue;
    const ang = Math.atan2(q[2] - p[2], q[0] - p[0]);
    T.setFrame(x + outerN[0] * d * 0.5, z + outerN[2] * d * 0.5, Math.cos(ang), Math.sin(ang), -Math.sin(ang), Math.cos(ang), 0);
    T.box(0, y + h / 2, 0, w, h, d, o(mat, tint, 1));
    T.resetFrame();
  }
}

/** stone wall run following the terrain, outer side chosen by the centre point */
function wallRun(T, H, a, b, height, thick, centre, mat, tint, opts = {}) {
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), n = Math.max(1, Math.round(len / 3.2)), seg = len / n;
  const nx = -dz / len, nz = dx / len, mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const sg = ((mid[0] - centre[0]) * nx + (mid[1] - centre[1]) * nz) >= 0 ? 1 : -1, on = [nx * sg, nz * sg];
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, p = [a[0] + dx * t0, a[1] + dz * t0], q = [a[0] + dx * t1, a[1] + dz * t1];
    if (opts.skip && opts.skip(p, q)) continue;
    const hh = Math.max(H(p[0], p[1]), H(q[0], q[1]), H(mid[0], mid[1])), lo = Math.min(H(p[0], p[1]), H(q[0], q[1])) - 1.2, top = hh + height + (opts.step ? Math.round((hh) / 1.5) * 0 : 0);
    const zb = Math.min(H(p[0], p[1]), H(q[0], q[1])) + 1.5;   // stone plinth (1.5 m) below the brick
    const hf = thick / 2, A0 = [p[0] + on[0] * hf, p[1] + on[1] * hf], B0 = [q[0] + on[0] * hf, q[1] + on[1] * hf], A1 = [p[0] - on[0] * hf, p[1] - on[1] * hf], B1 = [q[0] - on[0] * hf, q[1] - on[1] * hf];
    // outer face: viewed from outside, left->right is up x n = (nz, 0, -nx)
    const right = [on[1], -on[0]], dd = dx * right[0] + dz * right[1] >= 0;
    const f = (P, Q, y0, y1, outward, tn) => {
      const [u, v] = dd ? [P, Q] : [Q, P]; const flip = outward ? 1 : -1; void flip;
      const uu = (pp) => (pp[0] * right[0] + pp[1] * right[1]) * (outward ? 1 : -1);
      T.quad([u[0], y0, u[1]], [v[0], y0, v[1]], [v[0], y1, v[1]], [u[0], y1, u[1]], o(mat, tn, 0.95, { aoB: 0.7, aoT: 1, uvFn: p2 => [uu([p2[0], p2[2]]), p2[1]] }));
    };
    // outward face
    { const [u, v] = dd ? [A0, B0] : [B0, A0]; const uf = p2 => [p2[0] * right[0] + p2[2] * right[1], p2[1]];
      T.quad([u[0], lo, u[1]], [v[0], lo, v[1]], [v[0], zb, v[1]], [u[0], zb, u[1]], o(L.rubble, [0.9, 0.88, 0.84], 0.85, { aoB: 0.5, aoT: 0.7, uvFn: uf }));   // stone base
      T.quad([u[0], zb, u[1]], [v[0], zb, v[1]], [v[0], zb + 1.2, v[1]], [u[0], zb + 1.2, u[1]], o(mat, tint, 0.95, { aoB: 0.45, aoT: 1, uvFn: uf }));   // ground-contact AO band (0.45 -> 1 over 1.2 m)
      T.quad([u[0], zb + 1.2, u[1]], [v[0], zb + 1.2, v[1]], [v[0], top, v[1]], [u[0], top, u[1]], o(mat, tint, 0.95, { aoB: 1, aoT: 1, uvFn: uf })); }
    // inward face (opposite orientation)
    { const [u, v] = dd ? [B1, A1] : [A1, B1]; T.quad([u[0], lo, u[1]], [v[0], lo, v[1]], [v[0], top - 0.4, v[1]], [u[0], top - 0.4, u[1]], o(mat, tint, 0.95, { aoB: 0.7, aoT: 1, uvFn: p2 => [p2[0] * right[0] + p2[2] * right[1], p2[1]] })); }
    // walkway top
    T.quad([A1[0], top - 0.4, A1[1]], [B1[0], top - 0.4, B1[1]], [B0[0], top - 0.4, B0[1]], [A0[0], top - 0.4, A0[1]], o(L.cobble, [0.9, 0.9, 0.9], 1, { uvFn: p2 => [p2[0], p2[2]] }));
    f; // keep reference
    // parapet (outer) with merlons
    T.quad([A0[0], top - 0.4, A0[1]], [B0[0], top - 0.4, B0[1]], [B0[0], top, B0[1]], [A0[0], top, A0[1]], o(mat, tint, 1, { uvFn: p2 => [p2[0] * right[0] + p2[2] * right[1], p2[1]] }));   // zero-thickness cap hidden by merlons below
    if (!opts.noCrenels) {
      const cnt = Math.round(seg / 1.1);
      for (let k = 0; k < cnt; k += 2) {
        const t = (k + 0.5) / cnt, cx = p[0] + (q[0] - p[0]) * t + on[0] * (hf - 0.2), cz = p[1] + (q[1] - p[1]) * t + on[1] * (hf - 0.2), ang = Math.atan2(dz, dx);
        T.setFrame(cx, cz, Math.cos(ang), Math.sin(ang), -Math.sin(ang), Math.cos(ang), 0);
        T.box(0, top - 0.4 + 0.5, 0, seg / cnt * 0.95, 1.0, 0.45, o(mat, tint, 1, { faces: "+x-x+y+z-z" }));
        T.resetFrame();
      }
    }
  }
}

function roundTower(T, H, x, z, r, h, mat, tint, roofMat, roofTint, ruined = false, rnd = Math.random) {
  const y0 = H(x, z) - 1.5, top = H(x, z) + h, n = 12;
  for (let i = 0; i < n; i++) {
    const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
    const p0 = [x + Math.cos(a0) * r, z + Math.sin(a0) * r], p1 = [x + Math.cos(a1) * r, z + Math.sin(a1) * r];
    const th = ruined ? top - rnd() * 4 : top;
    // u follows the polar angle around the tower (unwrapped to the face's own angle range), so the texture runs round the drum instead of one column
    const uA = p => { let a = Math.atan2(p[2] - z, p[0] - x); while (a < a0 - Math.PI) a += 2 * Math.PI; while (a > a0 + Math.PI) a -= 2 * Math.PI; return a * r; };
    T.quad([p1[0], y0, p1[1]], [p0[0], y0, p0[1]], [p0[0], th, p0[1]], [p1[0], th, p1[1]], o(mat, tint, 0.95, { aoB: 0.45, aoT: 1, uvFn: p => [uA(p), p[1]] }));
  }
  if (!ruined) {
    for (let i = 0; i < n; i += 2) { const a = (i + 0.5) / n * Math.PI * 2, ang = a + Math.PI / 2; T.setFrame(x + Math.cos(a) * (r - 0.2), z + Math.sin(a) * (r - 0.2), Math.cos(ang), Math.sin(ang), -Math.sin(ang), Math.cos(ang), 0); T.box(0, top + 0.5, 0, 1.4, 1.0, 0.5, o(mat, tint, 1, { faces: "+x-x+y+z-z" })); T.resetFrame(); }
    if (roofMat != null) { for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, R = r + 0.5; T.triFace([x + Math.cos(a1) * R, top - 0.2, z + Math.sin(a1) * R], [x + Math.cos(a0) * R, top - 0.2, z + Math.sin(a0) * R], [x, top + r * 1.3, z], o(roofMat, roofTint, 1, { uvFn: p => [(p[0] + p[2]) * 0.8, p[1] * 1.2] })); } }
  }
}

/** Brick Gothic church (Marien type when cfg.main, Nikolai type otherwise). Heights in metres, nave eave + ridge, tower + spire. */
function buildChurch(ch, cfg, C, out) {
    const c = C.at(ch.x, ch.z), T = c.T, G = c.G, y0 = ch.y0;
    const f = [-ch.az, ch.ax]; T.setFrame(ch.x, ch.z, ch.ax, ch.az, f[0], f[1], y0); G.setFrame(ch.x, ch.z, ch.ax, ch.az, f[0], f[1], y0);
    const stone = o(L.brick, [1.02, 0.97, 0.9]);
    const hall = (x0, x1, hz, h, name) => {   // stone box (four walls) with plinth
      T.quad([x0, -1.5, hz], [x1, -1.5, hz], [x1, h, hz], [x0, h, hz], { ...stone, aoB: 0.7, uvFn: p => [p[0], p[1]] });
      T.quad([x1, -1.5, -hz], [x0, -1.5, -hz], [x0, h, -hz], [x1, h, -hz], { ...stone, aoB: 0.7, uvFn: p => [-p[0], p[1]] });
      T.quad([x1, -1.5, hz], [x1, -1.5, -hz], [x1, h, -hz], [x1, h, hz], { ...stone, aoB: 0.7, uvFn: p => [p[2] + 17, p[1]] });
      T.quad([x0, -1.5, -hz], [x0, -1.5, hz], [x0, h, hz], [x0, h, -hz], { ...stone, aoB: 0.7, uvFn: p => [-p[2], p[1]] });
      void name;
    };
    const { naveX0, naveX1, naveH, naveHz, chX1, chH, chHz, twX0, twX1, twH, twHz } = cfg;
    hall(naveX0, naveX1, naveHz, naveH);
    hall(naveX1, chX1, chHz, chH);
    hall(twX0, twX1, twHz, twH);
    // lancet windows
    const lancet = (cx, z, nz, w, h0, h, lit) => {   // nz = +-1 outward direction along z
      const s = nz > 0 ? 1 : -1, x0 = cx - w / 2, x1 = cx + w / 2, zz = z + s * 0.04, hh = h0 + h;
      const pts = s > 0 ? [[x0, h0], [x1, h0], [x1, hh], [x0, hh]] : [[x1, h0], [x0, h0], [x0, hh], [x1, hh]];
      G.quad([pts[0][0], pts[0][1], zz], [pts[1][0], pts[1][1], zz], [pts[2][0], pts[2][1], zz], [pts[3][0], pts[3][1], zz], { mat: 0, ao: lit });
      const apex = [cx, hh + w * 0.75, zz];
      if (s > 0) G.triFace([x0, hh, zz], [x1, hh, zz], apex, { mat: 0, ao: lit }); else G.triFace([x1, hh, zz], [x0, hh, zz], apex, { mat: 0, ao: lit });
      const fr = { mat: L.brick, tint: [1.1, 1.05, 1], up: [0, 0, s], faces: "ABD", ao: 1 };
      T.beam([x0 - 0.12, h0, zz + s * 0.05], [x0 - 0.12, hh, zz + s * 0.05], 0.22, 0.2, fr); T.beam([x1 + 0.12, h0, zz + s * 0.05], [x1 + 0.12, hh, zz + s * 0.05], 0.22, 0.2, fr);
      T.beam([x0 - 0.2, h0 - 0.05, zz + s * 0.05], [x1 + 0.2, h0 - 0.05, zz + s * 0.05], 0.22, 0.2, fr);
      T.beam([x0 - 0.12, hh, zz + s * 0.05], [cx, hh + w * 0.75 + 0.1, zz + s * 0.05], 0.2, 0.2, fr); T.beam([x1 + 0.12, hh, zz + s * 0.05], [cx, hh + w * 0.75 + 0.1, zz + s * 0.05], 0.2, 0.2, fr);
      T.beam([cx, h0, zz + s * 0.04], [cx, hh + 0.4, zz + s * 0.04], 0.1, 0.12, fr);
    };
    for (let i = 0; i < 4; i++) { const cx = naveX0 + 3 + i * 4.6; for (const s of [1, -1]) lancet(cx, s * naveHz, s, cfg.winW, cfg.winY, cfg.winH, 0.75); }
    for (let i = 0; i < 2; i++) for (const s of [1, -1]) lancet(naveX1 + 2.8 + i * 4.4, s * chHz, s, 1.0, 2.0, cfg.chWinH, 0.7);
    // buttresses
    const bH = naveH * 0.82;
    for (let i = 0; i <= 4; i++) for (const s of [1, -1]) { const cx = naveX0 + 0.8 + i * 4.6; T.box(cx, bH / 2, s * (naveHz + 0.45), 1.1, bH, 1.1, o(L.brick, [1, 0.97, 0.92], 1, { faces: "+x-x+y+z-z" })); T.box(cx, bH + 0.2, s * (naveHz + 0.45), 1.5, 0.4, 1.5, o(L.brick, [1, 0.97, 0.92], 1, { faces: "+x-x+y+z-z" }));
      if (cfg.flying) T.beam([cx, bH - 0.6, s * (naveHz + 0.45)], [cx, naveH * 0.66, s * (naveHz + 0.1)], 0.45, 0.5, { mat: L.brick, tint: [1, 0.97, 0.92], up: [0, 1, 0], faces: "ABCD", ao: 1 }); }
    // west door in the tower, south door in the nave
    {
      const dz = naveHz; G.quad([twX0 - 0.01, 0, 1.0], [twX0 - 0.01, 0, -1.0], [twX0 - 0.01, 3.2, -1.0], [twX0 - 0.01, 3.2, 1.0], { mat: 0, ao: 0 });   // dark doorway (unlit glass)
      T.quad([twX0 - 0.02, 0, 1.1], [twX0 - 0.02, 0, -1.1], [twX0 - 0.02, 3.3, -1.1], [twX0 - 0.02, 3.3, 1.1], o(L.wood, [0.6, 0.45, 0.3], 1, { uvFn: p => [p[2], p[1]] }));
      void dz;
    }
    // roofs
    gable(T, naveX0, naveX1, naveHz, naveH, cfg.naveRise, 0.6, 0.0, L.slate, [1, 1, 1.05], { endMat: L.brick, endTint: [1.02, 0.97, 0.9] });
    gable(T, naveX1, chX1, chHz, chH, cfg.chRise, 0.5, 0.2, L.slate, [1, 1, 1.05]);
    // tower: belfry openings, parapet, spire
    for (const [px, pz, dir] of [[0, twHz, 1], [0, -twHz, -1]]) void px, pz, dir;
    for (const s of [1, -1]) lancet((twX0 + twX1) / 2, s * twHz, s, 1.0, cfg.belfryY, cfg.belfryH, 0.55);
    for (const e of [-1, 1]) { void e; }
    G.quad([twX1 + 0.02, cfg.belfryY, -0.8], [twX1 + 0.02, cfg.belfryY, 0.8], [twX1 + 0.02, cfg.belfryY + cfg.belfryH, 0.8], [twX1 + 0.02, cfg.belfryY + cfg.belfryH, -0.8], { mat: 0, ao: 0.5 });
    T.box((twX0 + twX1) / 2, twH + 0.3, 0, twX1 - twX0 + 0.5, 0.6, twHz * 2 + 0.5, o(L.brick, [1, 0.97, 0.92], 1, { faces: "+x-x+z-z+y" }));
    for (let i = 0; i < 6; i++) for (const s of [1, -1]) { T.box(twX0 + 0.2 + i * 1.3, twH + 1.1, s * (twHz + 0.1), 0.7, 1.0, 0.4, o(L.brick, [1, 0.97, 0.92], 1, { faces: "+x-x+y+z-z" })); }
    const SP = cfg.spire;
    pyramid(T, (twX0 + twX1) / 2, 0, twHz + 0.3, twH + 0.6, SP, L.slate, [0.9, 0.95, 1.05], 4);
    // cross on top
    T.beam([(twX0 + twX1) / 2, twH + SP + 0.4, 0], [(twX0 + twX1) / 2, twH + SP + 3.0, 0], 0.16, 0.16, { mat: L.beam, tint: [0.4, 0.4, 0.45], up: [1, 0, 0], faces: "ABCD", ao: 1 });
    T.beam([(twX0 + twX1) / 2, twH + SP + 2.2, -0.7], [(twX0 + twX1) / 2, twH + SP + 2.2, 0.7], 0.14, 0.14, { mat: L.beam, tint: [0.4, 0.4, 0.45], up: [0, 1, 0], faces: "ABCD", ao: 1 });
    // south porch
    { const px = -1.5; T.box(px, 1.8, naveHz + 1.6, 3.6, 3.6, 3.2, o(L.brick, [1, 0.97, 0.9], 1, { faces: "+x-x+z" })); gable(T, px - 1.8, px + 1.8, 1.7, 3.6, 1.3, 0.35, 0.15, L.slate, [1, 1, 1.05], { noEnds: false }); }
    T.resetFrame(); G.resetFrame();
    out.colliders.push({ x: ch.x, z: ch.z, ax: ch.ax, az: ch.az, hw: (chX1 - twX0) / 2, hd: Math.max(naveHz, twHz) + 0.5 });
    if (cfg.main) out.church = { x: ch.x, z: ch.z, y: y0 };
}

/* Marien-type cathedral: nave eave 24 m, ridge ~31.5 m; tower 48 m + 20 m spire (~71 m). Nikolai-type: nave ridge ~35 m, plainer, tower 40 m + 14 m spire. */
const MARIEN = { main: true, naveX0: -11, naveX1: 8, naveH: 24, naveHz: 6.5, naveRise: 7.5, chX1: 18, chH: 14, chHz: 4.5, chRise: 4.5, twX0: -18, twX1: -11, twH: 48, twHz: 4.5,
  winW: 1.4, winY: 5.5, winH: 12, chWinH: 6, belfryY: 36, belfryH: 6, spire: 20, flying: true };
const NIKOLAI = { main: false, naveX0: -14, naveX1: 12, naveH: 25, naveHz: 6.5, naveRise: 10, chX1: 15, chH: 16, chHz: 5, chRise: 5, twX0: -20, twX1: -14, twH: 40, twHz: 3.4,
  winW: 1.2, winY: 6, winH: 13, chWinH: 7, belfryY: 31, belfryH: 5, spire: 14, flying: false };

/** Market well house: stone curb, dark water, four oak posts with a winch beam and a hipped roof. Sits at the market centre. */
function wellHouse(C, out, x, z, y0) {
  const sq = { x, z }, c = C.at(sq.x, sq.z), T = c.T, rim = 1.1;
  T.cyl(sq.x, y0 - 0.3, sq.z, rim + 0.3, rim + 0.3, 0.6, 12, o(L.ashlar, [1, 0.98, 0.94], 0.9));   // footing
  T.cyl(sq.x, y0, sq.z, rim, rim - 0.04, 0.95, 12, o(L.ashlar, [1, 0.98, 0.94], 0.95, { cap: true, capMat: L.ashlar }));
  T.cyl(sq.x, y0 + 0.9, sq.z, rim - 0.05, rim - 0.05, 0.03, 12, o(L.rubble, [0.12, 0.12, 0.13], 1));   // water surface (dark, unlit)
  for (const [px, pz] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) T.beam([sq.x + px, y0, sq.z + pz], [sq.x + px, y0 + 3.1, sq.z + pz], 0.24, 0.24, { mat: L.beam, tint: [0.8, 0.7, 0.6], up: [0, 1, 0], faces: "ABCD", ao: 1 });
  T.beam([sq.x - 1.7, y0 + 2.7, sq.z], [sq.x + 1.7, y0 + 2.7, sq.z], 0.22, 0.22, { mat: L.beam, tint: [0.8, 0.7, 0.6], up: [0, 1, 0], faces: "ABCD", ao: 1 });
  T.beam([sq.x, y0 + 2.7, sq.z], [sq.x, y0 + 2.7, sq.z], 0.1, 0.1, { mat: L.beam, tint: [0.5, 0.4, 0.3], up: [0, 1, 0], faces: "ABCD", ao: 1 });
  T.beam([sq.x, y0 + 2.7, sq.z - 1.7], [sq.x, y0 + 2.7, sq.z - 0.4], 0.1, 0.1, { mat: L.beam, tint: [0.5, 0.4, 0.3], up: [0, 1, 0], faces: "ABCD", ao: 1 });
  pyramid(T, sq.x, sq.z, 2.4, y0 + 3.1, 1.7, L.clay, [1, 0.9, 0.85], 4);
  out.colliders.push({ x: sq.x, z: sq.z, ax: 1, az: 0, hw: rim + 0.2, hd: rim + 0.2 });
  out.well = { x: sq.x, z: sq.z, y: y0 };
}

export function buildLandmarks(W, C, detail = 2) {
  const H = W.H, rnd = mulberry32(991), out = { colliders: [], torches: [], docks: [], piers: [] };
  // ------------------------------------------------------------------ churches (brick Gothic, real proportions)
  buildChurch(W.landmarks.church, MARIEN, C, out);
  if (W.landmarks.nikolai) buildChurch(W.landmarks.nikolai, NIKOLAI, C, out);
  wellHouse(C, out, W.square.x, W.square.z, W.square.h);
  for (const w of W.wells) wellHouse(C, out, w.x, w.z, W.H(w.x, w.z));
  // garden fences: posts at corners and mid-sides, two rails, one gap on the road side
  for (const g of W.gardens) {
    const P = (u, v) => [g.x + g.ax * u - g.az * v, g.z + g.az * u + g.ax * v];
    const pts = [P(-g.hw, -g.hd), P(0, -g.hd), P(g.hw, -g.hd), P(g.hw, 0), P(g.hw, g.hd), P(0, g.hd), P(-g.hw, g.hd), P(-g.hw, 0)];
    for (let k = 0; k < pts.length; k++) {
      const [x, z] = pts[k], cc = C.at(x, z), y = W.H(x, z);
      cc.T.beam([x, y - 0.1, z], [x, y + 1.25, z], 0.14, 0.14, { mat: L.beam, tint: [0.75, 0.62, 0.48], up: [0, 1, 0], faces: "ABCD", ao: 1 });
      const [nx, nz] = pts[(k + 1) % pts.length];
      if (k === 0 || k === 4) continue;   // gap on the south/west side (gate)
      for (const hgt of [0.55, 1.0]) cc.T.beam([x, y + hgt, z], [nx, W.H(nx, nz) + hgt, nz], 0.08, 0.08, { mat: L.beam, tint: [0.75, 0.62, 0.48], up: [0, 1, 0], faces: "ABCD", ao: 1 });
    }
  }
  // ------------------------------------------------------------------ guildhall (stone hall + clock turret)
  {
    const gh = W.landmarks.guildhall, sq = W.square, c = C.at(gh.x, gh.z);
    const toSq = norm([sq.x - gh.x, 0, sq.z - gh.z]);
    const b = { ...gh, kind: "stone", floors: 3, w: gh.w, d: gh.d, y0: gh.y0, front: { nx: toSq[0], nz: toSq[2] }, seed: 4242 };
    const r = houseGeometry(c.T, c.G, b, detail);
    const T = c.T; T.setFrame(gh.x, gh.z, gh.ax, gh.az, toSq[0], toSq[2], gh.y0);
    const top = r.height;
    T.box(0, top + 0.4, 0, 3.4, 3.2, 3.4, o(L.ashlar, [1, 0.97, 0.9], 1, { faces: "+x-x+z-z" }));
    for (const s of [1, -1]) {   // clock faces
      c.G.setFrame(gh.x, gh.z, gh.ax, gh.az, toSq[0], toSq[2], gh.y0);
      c.G.quad([-0.8, top + 0.2, 1.72 * s * (s > 0 ? 1 : -1)], [0.8, top + 0.2, 1.72 * s * (s > 0 ? 1 : -1)], [0.8, top + 1.8, 1.72 * s * (s > 0 ? 1 : -1)], [-0.8, top + 1.8, 1.72 * s * (s > 0 ? 1 : -1)], { mat: 0, ao: 0 });
      break;
    }
    pyramid(T, 0, 0, 1.9, top + 2.0, 4.2, L.slate, [0.9, 0.95, 1.05], 4);
    T.resetFrame(); c.G.resetFrame();
    out.colliders.push({ x: gh.x, z: gh.z, ax: gh.ax, az: gh.az, hw: gh.hw, hd: gh.hd });
    // open stone arcade (colonnade) between the hall and the market: piers, round arches built as thin radial quad strips, flat slate roof
    const aT = c.T, zA = gh.d / 2 + 3.4, span = gh.w + 4, nb = 5, bay = span / nb, RA = bay / 2 - 0.05, rA = RA - 0.5, Y0 = 3.2;
    aT.setFrame(gh.x, gh.z, gh.ax, gh.az, toSq[0], toSq[2], gh.y0);
    for (let i = 0; i <= nb; i++) {
      const x = -span / 2 + i * bay;
      aT.box(x, Y0 / 2, zA, 0.8, Y0, 0.8, o(L.ashlar, [1.02, 0.98, 0.92], 1, { faces: "+x-x+y+z-z" }));
      out.colliders.push({ x: gh.x + gh.ax * x + toSq[0] * zA, z: gh.z + gh.az * x + toSq[2] * zA, ax: 1, az: 0, hw: 0.45, hd: 0.45 });
    }
    for (let i = 0; i < nb; i++) {
      const xc = -span / 2 + (i + 0.5) * bay, K = 8;
      for (let k = 0; k < K; k++) {   // arch band: voussoir-like radial strips with a brick soffit
        const a0 = Math.PI * k / K, a1 = Math.PI * (k + 1) / K;
        const P = (rad, a) => [xc + Math.cos(a) * rad, Y0 + Math.sin(a) * rad, zA];
        aT.quad(P(RA, a0), P(RA, a1), P(rA, a1), P(rA, a0), o(k % 2 ? L.ashlar : L.brick, [1.02, 0.98, 0.92], 1, { faces: "+z" }));
      }
      aT.box(xc, Y0 + RA + 0.15, zA, bay, 0.25, 0.9, o(L.ashlar, [1.02, 0.98, 0.92], 1, { faces: "+x-x+y-y+z-z" }));   // string course over the arches
    }
    aT.box(0, Y0 + RA + 0.9, zA, span + 1.0, 0.35, 2.2, o(L.slate, [0.9, 0.95, 1.05], 1, { faces: "+x-x+y-y+z-z" }));    // slate roof over the arcade
    aT.resetFrame();
  }
  // ------------------------------------------------------------------ curtain wall, towers and gates
  {
    const wl = W.wall, pts = wl.pts, centre = [-60, -40];   // city wall: brick above a stone plinth
    const gateCentres = wl.gates;
    const nearGate = (p) => gateCentres.some(g => Math.hypot(p[0] - g.x, p[1] - g.z) < 5.6);
    for (let k = 0; k < pts.length; k++) {   // closed loop
      const a = [pts[k].x, pts[k].z], b = [pts[(k + 1) % pts.length].x, pts[(k + 1) % pts.length].z], c = C.at((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      wallRun(c.T, H, a, b, 7.2, 2.2, centre, L.brick, [0.6, 0.46, 0.42], { skip: (p, q) => nearGate([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]) });
    }
    for (let k = 0; k < pts.length; k++) {   // one tower per wall vertex (~44 m apart)
      const p = pts[k], c = C.at(p.x, p.z);
      if (gateCentres.some(g => Math.hypot(p.x - g.x, p.z - g.z) < 11)) continue;   // never put a wall tower in a gate passage
      roundTower(c.T, H, p.x, p.z, 4.3, 11.5, L.brick, [0.62, 0.48, 0.44], L.slate, [0.9, 0.95, 1.05]);
      out.colliders.push({ x: p.x, z: p.z, ax: 1, az: 0, hw: 4.3, hd: 4.3 });
      // arrow slits
      for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5; c.G.setFrame(p.x, p.z, 1, 0, 0, 1, 0); c.G.quad([Math.cos(a) * 4.32 - 0.05, H(p.x, p.z) + 4, Math.sin(a) * 4.32 - 0.05], [Math.cos(a) * 4.32 + 0.05, H(p.x, p.z) + 4, Math.sin(a) * 4.32 + 0.05], [Math.cos(a) * 4.32 + 0.05, H(p.x, p.z) + 5.6, Math.sin(a) * 4.32 + 0.05], [Math.cos(a) * 4.32 - 0.05, H(p.x, p.z) + 5.6, Math.sin(a) * 4.32 - 0.05], { mat: 0, ao: 0 }); c.G.resetFrame(); }
    }
    for (const g of gateCentres) {
      const c = C.at(g.x, g.z), T = c.T, ang = Math.atan2(g.tz, g.tx);
      const gy = H(g.x, g.z);
      T.setFrame(g.x, g.z, Math.cos(ang), Math.sin(ang), -Math.sin(ang), Math.cos(ang), gy);
      for (const s of [-1, 1]) {   // flanking square towers (local z across the road, x along it)
        const cz = s * 5.4;
        T.box(0, 6.2, cz, 6.4, 13.4, 6.0, o(L.brick, [0.62, 0.48, 0.44], 0.95, { faces: "+x-x+z-z", aoB: 0.7 }));
        for (let i = 0; i < 5; i++) { for (const e of [-1, 1]) T.box(e * 2.9, 13.9, cz - 2.5 + i * 1.25, 0.5, 1.0, 0.7, o(L.ashlar, [0.97, 0.93, 0.87], 1, { faces: "+x-x+y+z-z" })); }
        T.quad([-3.2, 12.6, cz + 3.0], [3.2, 12.6, cz + 3.0], [3.2, 12.6, cz - 3.0], [-3.2, 12.6, cz - 3.0], o(L.slate));
      }
      T.box(0, 7.8, 0, 6.4, 2.6, 5.0, o(L.ashlar, [0.97, 0.93, 0.87], 0.95, { faces: "+x-x+y-y" }));    // bridge over the passage
      T.box(0, 8.9, 0, 6.4, 0.3, 5.2, o(L.ashlar, [1, 1, 1], 1, { faces: "+y" }));
      T.resetFrame();
      out.colliders.push({ x: g.x + Math.cos(ang + Math.PI / 2) * 5.4, z: g.z + Math.sin(ang + Math.PI / 2) * 5.4, ax: Math.cos(ang), az: Math.sin(ang), hw: 3.2, hd: 3.0 });
      out.colliders.push({ x: g.x - Math.cos(ang + Math.PI / 2) * 5.4, z: g.z - Math.sin(ang + Math.PI / 2) * 5.4, ax: Math.cos(ang), az: Math.sin(ang), hw: 3.2, hd: 3.0 });
    }
  }
  // ------------------------------------------------------------------ castle ruin on the hill
  {
    const K = W.landmarkSites.CASTLE, cx = K.x, cz = K.z, base = H(cx, cz), R = 27, c = C.at(cx, cz);
    const ring = []; const n = 10;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + 0.3, r = R * (1 + (rnd() - 0.5) * 0.14); ring.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); }
    for (let i = 0; i < n; i++) {
      const a = ring[i], b = ring[(i + 1) % n], cc = C.at((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      if (i === 3) continue;   // breach
      wallRun(cc.T, H, a, b, 9, 2.6, [cx, cz], L.rubble, [1, 0.97, 0.92], { noCrenels: i % 3 === 0 });
    }
    for (let i = 0; i < n; i++) { const t = C.at(ring[i][0], ring[i][1]); roundTower(t.T, H, ring[i][0], ring[i][1], 4.6, 13 - (i % 3) * 2.5, L.rubble, [1, 0.97, 0.92], i % 4 === 1 ? L.slate : null, [0.9, 0.95, 1.05], i % 3 === 2, rnd); out.colliders.push({ x: ring[i][0], z: ring[i][1], ax: 1, az: 0, hw: 4.6, hd: 4.6 }); }
    // keep
    const T = c.T, G = c.G; T.setFrame(cx, cz, 1, 0, 0, 1, base - 1.0);
    T.box(0, 12, 0, 13, 26, 13, o(L.ashlar, [0.95, 0.92, 0.86], 0.95, { faces: "+x-x+z-z", aoB: 0.7 }));
    for (let i = 0; i < 6; i++) for (const [ax, az] of [[1, 0], [0, 1]]) for (const s of [-1, 1]) { const t = -5.5 + i * 2.2; T.box(ax ? s * 6.7 : t, 25.5, ax ? t : s * 6.7, ax ? 0.5 : 1.2, 1.0, ax ? 1.2 : 0.5, o(L.ashlar, [0.95, 0.92, 0.86], 1, { faces: "+x-x+y+z-z" })); }
    T.quad([-6.5, 25.0, 6.5], [6.5, 25.0, 6.5], [6.5, 25.0, -6.5], [-6.5, 25.0, -6.5], o(L.slate));
    for (let i = 0; i < 3; i++) for (const s of [1, -1]) { G.setFrame(cx, cz, 1, 0, 0, 1, base - 1.0); G.quad([-5 + i * 4.5, 12, 6.52 * s], [-5 + i * 4.5 + 0.9 * s, 12, 6.52 * s], [-5 + i * 4.5 + 0.9 * s, 14.2, 6.52 * s], [-5 + i * 4.5, 14.2, 6.52 * s], { mat: 0, ao: 0 }); G.resetFrame(); }
    T.resetFrame();
    out.colliders.push({ x: cx, z: cz, ax: 1, az: 0, hw: 6.8, hd: 6.8 });
    out.castle = { x: cx, z: cz, y: base };
  }
  return out;
}

/** Quay wall along the harbour shoreline, bollards, timber piers. Needs the sea direction at the shore. */
export function buildHarbour(W, C) {
  const out = { piers: [], bollards: [], quay: [], colliders: [] };
  const rnd = mulberry32(555);
  const pts = W.quayPts.filter(p => Math.abs(W.coastS(p.x, p.z)) < 1.2);
  const seaDir = (x, z) => { const e = 1.5, gx = W.coastS(x + e, z) - W.coastS(x - e, z), gz = W.coastS(x, z + e) - W.coastS(x, z - e), l = Math.hypot(gx, gz) || 1; return [gx / l, gz / l]; };
  const QY = 1.45;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz); if (len < 0.3 || len > 15) continue;
    const sd = seaDir((a.x + b.x) / 2, (a.z + b.z) / 2), c = C.at(a.x, a.z), T = c.T;
    // quay face towards the sea
    const right = [-sd[1] * -1, 0, 0]; void right;
    // inward (landward) offset for the slab
    const land = [-sd[0], -sd[1]], slabW = 2.6;
    const A = [a.x, a.z], B = [b.x, b.z], A2 = [a.x + land[0] * slabW, a.z + land[1] * slabW], B2 = [b.x + land[0] * slabW, b.z + land[1] * slabW];
    // face: normal = sea direction. Orientation: right vector r = up x n = (nz,0,-nx); ensure A->B follows r
    const r = [sd[1], -sd[0]], fwd = dx * r[0] + dz * r[1] >= 0;
    const [P, Q] = fwd ? [A, B] : [B, A], [P2, Q2] = fwd ? [A2, B2] : [B2, A2];
    T.quad([P[0], -3, P[1]], [Q[0], -3, Q[1]], [Q[0], QY, Q[1]], [P[0], QY, P[1]], o(L.ashlar, [0.95, 0.93, 0.9], 0.9, { aoB: 0.5, aoT: 1, uvFn: p => [p[0] * r[0] + p[2] * r[1], p[1]] }));
    // top slab (normal up): P->Q along r, then towards land
    T.quad([P2[0], QY, P2[1]], [Q2[0], QY, Q2[1]], [Q[0], QY, Q[1]], [P[0], QY, P[1]], o(L.cobble, [0.85, 0.85, 0.85], 1, { uvFn: p => [p[0], p[2]] }));
    // bollards
    if (rnd() < 0.2) { const mx = (A[0] + B[0]) / 2 + land[0] * 0.7, mz = (A[1] + B[1]) / 2 + land[1] * 0.7; T.cyl(mx, QY, mz, 0.17, 0.2, 0.55, 7, o(L.beam, [0.5, 0.5, 0.55], 1, { cap: true })); out.bollards.push({ x: mx, z: mz }); }
    out.quay.push({ x: (A[0] + B[0]) / 2, z: (A[1] + B[1]) / 2, nx: sd[0], nz: sd[1] });
  }
  // piers: pick spaced points
  const picks = [];
  for (let i = 4; i < pts.length - 4; i++) { const p = pts[i]; if (!picks.length || picks.every(q => Math.hypot(q.x - p.x, q.z - p.z) > 38)) picks.push(p); }
  for (const p of picks.slice(0, 4)) {
    const sd = seaDir(p.x, p.z), len = 20 + rnd() * 20, wid = 3.2, c = C.at(p.x, p.z), T = c.T, ang = Math.atan2(sd[1], sd[0]);
    T.setFrame(p.x, p.z, Math.cos(ang), Math.sin(ang), -Math.sin(ang), Math.cos(ang), 0);   // local x = out to sea, z = across
    const DY = QY - 0.15;
    // deck planks
    T.quad([-1, DY, wid / 2], [len, DY, wid / 2], [len, DY, -wid / 2], [-1, DY, -wid / 2], o(L.wood, [1.1, 1.0, 0.9], 1, { uvFn: p2 => [p2[2] + 0.0, p2[0]] }));
    T.quad([-1, DY - 0.28, -wid / 2], [len, DY - 0.28, -wid / 2], [len, DY - 0.28, wid / 2], [-1, DY - 0.28, wid / 2], o(L.wood, [0.6, 0.55, 0.5], 0.5));
    for (const s of [-1, 1]) {
      T.quad([len, DY - 0.28, s * wid / 2], [-1, DY - 0.28, s * wid / 2], [-1, DY, s * wid / 2], [len, DY, s * wid / 2], o(L.wood, [0.85, 0.8, 0.75], 0.8, { uvFn: p2 => [p2[0], p2[1]] }));
      if (s < 0) { T.quad([-1, DY - 0.28, s * wid / 2], [len, DY - 0.28, s * wid / 2], [len, DY, s * wid / 2], [-1, DY, s * wid / 2], o(L.wood, [0.85, 0.8, 0.75], 0.8, { uvFn: p2 => [p2[0], p2[1]] })); }
    }
    for (let x = 0.5; x <= len; x += 2.4) for (const s of [-1, 1]) T.cyl(x, -5, s * (wid / 2 - 0.1), 0.13, 0.12, DY + 5 + 0.32, 8, o(L.beam, [1.35, 1.25, 1.15], 1, { cap: true }));   // slim weathered piles every 2.4 m, standing 0.3 m above the deck
    for (let x = 0.5; x <= len; x += 2.4) for (const s of [-1, 1]) T.box(x, DY - 0.5, s * (wid / 2 + 0.12), 0.16, 0.16, 0.22, o(L.wood, [0.6, 0.5, 0.42], 1, { faces: "+x-x+y-y+z-z" }));   // outer wale
    for (let x = 6; x <= len - 2; x += 7) for (const s of [-1, 1]) { T.cyl(x, DY, s * (wid / 2 - 0.15), 0.13, 0.15, 0.45, 8, o(L.beam, [1.1, 1.05, 1.0], 1, { cap: true })); }   // mooring bollard every 7 m
    T.resetFrame();
    const dir = [Math.cos(ang), Math.sin(ang)];
    out.piers.push({ x: p.x, z: p.z, dx: dir[0], dz: dir[1], len, wid, y: DY });
  }
  // ---------------------------------------------------------------- Speicher, fish shed, net racks, slipway, Baumhaus
  const sdAt = (x, z) => seaDir(x, z);
  const landAt = (p, d) => { const sd = sdAt(p.x, p.z); return { x: p.x - sd[0] * d, z: p.z - sd[1] * d, sd }; };
  const free = (x, z, r) => W.coastS(x, z) < -8 && !W.buildings.some(b => Math.hypot(b.x - x, b.z - z) < r);
  const frameOf = (x, z, sd, y) => { const c = C.at(x, z); c.T.setFrame(x, z, -sd[1], sd[0], sd[0], sd[1], y); return c.T; };   // local x along the shore, z towards the sea
  const pickAt = f => pts[Math.min(pts.length - 1, Math.floor(f * pts.length))];
  // Speicher: narrow warehouses, narrow side to the water, hoist beam on the quay side
  let nSp = 0;
  for (const f of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]) {
    if (nSp >= 5) break;
    const p = pickAt(f); if (!p) continue;
    const L = landAt(p, 15); if (!free(L.x, L.z, 10)) continue;
    const sd = L.sd, b = { kind: "warehouse", x: L.x, z: L.z, ax: -sd[1], az: sd[0], hw: 3.25, hd: 5, w: 6.5, d: 10, floors: 3, front: { nx: sd[0], nz: sd[1] }, y0: QY - 0.05, seed: 9100 + nSp, district: "quay", road: "quay" };
    const cc = C.at(L.x, L.z); houseGeometry(cc.T, cc.G, b, 2); W.buildings.push(b); nSp++;
    out.colliders.push({ x: L.x, z: L.z, ax: b.ax, az: b.az, hw: 3.4, hd: 5.2 });
  }
  // fish market: open timber shed (posts, wide roof, trestle and crates)
  {
    const p = pickAt(0.9), L = landAt(p, 9);
    if (free(L.x, L.z, 8)) {
      const T = frameOf(L.x, L.z, L.sd, QY);
      for (const [px, pz] of [[-4, -2.6], [4, -2.6], [-4, 2.6], [4, 2.6], [0, -2.6], [0, 2.6]]) T.beam([px, 0, pz], [px, 3.4, pz], 0.28, 0.28, { mat: L.beam, tint: [0.8, 0.7, 0.6], up: [0, 1, 0], faces: "ABCD", ao: 1 });
      T.quad([-4.9, 3.5, 3.5], [4.9, 3.5, 3.5], [4.9, 3.5, -3.5], [-4.9, 3.5, -3.5], o(L.clay, [1, 0.9, 0.8], 1));
      T.box(0, 0.45, 0, 6.5, 0.9, 1.2, o(L.wood, [0.85, 0.7, 0.55], 1, { faces: "+x-x+y-y+z-z" }));
      for (let i = 0; i < 5; i++) T.box(-3.6 + i * 1.8, 1.1, 0.8, 0.9, 0.5, 0.5, o(L.wood, [0.6, 0.5, 0.4], 1, { faces: "+x-x+y-y+z-z" }));
    }
  }
  // net racks: rows of A-frames with a hung net of thin battens
  {
    const p = pickAt(0.55), L = landAt(p, 7);
    if (free(L.x, L.z, 6)) {
      const T = frameOf(L.x, L.z, L.sd, QY);
      for (let i = -3; i <= 3; i++) { const x = i * 2.2;
        T.beam([x, 0, -1.1], [x, 2.3, 0], 0.16, 0.16, { mat: L.beam, tint: [0.7, 0.6, 0.5], up: [0, 1, 0], faces: "ABCD", ao: 1 });
        T.beam([x, 0, 1.1], [x, 2.3, 0], 0.16, 0.16, { mat: L.beam, tint: [0.7, 0.6, 0.5], up: [0, 1, 0], faces: "ABCD", ao: 1 }); }
      for (let i = -3; i <= 3; i++) for (const z of [-1, 1]) T.beam([i * 2.2, 2.3, 0], [i * 2.2 + 1.1, 0.4, z * 0.7], 0.035, 0.035, { mat: L.beam, tint: [0.9, 0.85, 0.75], up: [0, 1, 0], faces: "ABCD", ao: 1 });
    }
  }
  // slipway: two timber rails down the shingle into the water, with an upturned small boat
  {
    const p = pickAt(0.2), sd = sdAt(p.x, p.z), A = landAt(p, 6), E = { x: p.x + sd[0] * 5, z: p.z + sd[1] * 5 };
    for (const off of [-1.4, 1.4]) {
      const ox = -sd[1] * off, oz = sd[0] * off;
      C.at(A.x, A.z).T.beam([A.x + ox, QY, A.z + oz], [E.x + ox, -1.2, E.z + oz], 0.3, 0.22, { mat: L.beam, tint: [0.7, 0.6, 0.5], up: [0, 1, 0], faces: "ABCD", ao: 1 });
    }
    const mx = (A.x + E.x) / 2, mz = (A.z + E.z) / 2, c = C.at(mx, mz);
    c.T.setFrame(mx, mz, -sd[1], sd[0], sd[0], sd[1], 0.2);
    c.T.box(0, 0.5, 0, 4.2, 0.5, 1.6, o(L.wood, [0.6, 0.45, 0.32], 1, { faces: "+x-x+y-y+z-z" }));
    c.T.resetFrame();
  }
  // Baumhaus: floating timber boom across the harbour mouth, open on its north half; winch on the north mole head
  {
    const N0 = W.harbour.moleN[W.harbour.moleN.length - 1], S0 = W.harbour.moleS[W.harbour.moleS.length - 1];
    const M = { x: (N0[0] + S0[0]) / 2, z: (N0[1] + S0[1]) / 2 }, logs = 9;
    for (let i = 0; i < logs; i++) {
      const a = { x: N0[0] + (M.x - N0[0]) * i / logs, z: N0[1] + (M.z - N0[1]) * i / logs }, b = { x: N0[0] + (M.x - N0[0]) * (i + 1) / logs, z: N0[1] + (M.z - N0[1]) * (i + 1) / logs };
      C.at(a.x, a.z).T.beam([a.x, 0.1, a.z], [b.x, 0.1, b.z], 0.5, 0.5, { mat: L.beam, tint: [0.75, 0.6, 0.45], up: [0, 1, 0], faces: "ABCD", ao: 1 });
    }
    const cc = C.at(N0[0], N0[1]);
    cc.T.cyl(N0[0], -1.2, N0[1], 0.22, 0.22, 4.2, 7, o(L.beam, [0.5, 0.45, 0.4], 1, { cap: true }));
    cc.T.box(N0[0] - 1.2, QY + 0.6, N0[1], 0.9, 1.2, 0.9, o(L.wood, [0.6, 0.5, 0.4], 1, { faces: "+x-x+y-y+z-z" }));
    out.baumhaus = { from: N0, to: M };
  }
  return out;
}
