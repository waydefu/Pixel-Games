// Plants v2: lofted bark tubes + clumped-crown species (oak, linden, birch, poplar, willow, apple, spruce, pine), shrubs, flower beds,
// and a denser GPU-placed grass / wildflower-meadow field. Everything procedural.
import * as THREE from "three";
import { patch, csmify, SEASON_GLSL, AU } from "./materials.js";
import { MeshBuilder, sub, cross, norm, add, mul, dot } from "./mesh.js";
import { L } from "./textures.js";
import { mulberry32, clamp, smoothstep, makeNoise } from "./util.js";
import { foliageCards, foliageGeometry, newFol, makeFoliageMaterial, WIND } from "./vegetation.js";
import { HRECT } from "./water.js";
import { MASK } from "./terrain.js";
import { wallGeo } from "./geo.js";

// ------------------------------------------------------------------------------------------------ lofted tubes (trunks, limbs)
let BARK_MAT = L.bark;
function tube(T, rings, sides, tint) {
  let acc = 0; const frames = [];
  for (let k = 0; k < rings.length; k++) {
    const a = rings[Math.max(0, k - 1)].p, b = rings[Math.min(rings.length - 1, k + 1)].p; const d = norm(sub(b, a));
    let u = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : norm(cross([0, 1, 0], d)); u = norm(sub(u, mul(d, dot(u, d)))); const v = cross(u, d);
    frames.push({ u, v, d });
  }
  const ring = (k, j) => { const r = rings[k], a = j / sides * Math.PI * 2, f = frames[k]; return add(r.p, add(mul(f.u, Math.cos(a) * r.r), mul(f.v, Math.sin(a) * r.r))); };
  const TILE = 1.2;   // metres per bark texture tile
  const nrm = (k, j) => { const r = rings[k], a = j / sides * Math.PI * 2, f = frames[k]; return add(mul(f.u, Math.cos(a)), mul(f.v, Math.sin(a))); };
  for (let k = 0; k < rings.length - 1; k++) {
    const segLen = Math.hypot(...sub(rings[k + 1].p, rings[k].p)), c0 = Math.PI * 2 * rings[k].r / TILE, c1 = Math.PI * 2 * rings[k + 1].r / TILE;
    for (let j = 0; j < sides; j++) {
      const j1 = j + 1, A = ring(k, j1), B = ring(k, j), C = ring(k + 1, j), D = ring(k + 1, j1);
      const nA = nrm(k, j1), nB = nrm(k, j), nC = nrm(k + 1, j), nD = nrm(k + 1, j1);
      const uA = [-j1 / sides * c0, acc / TILE], uB = [-j / sides * c0, acc / TILE], uC = [-j / sides * c1, (acc + segLen) / TILE], uD = [-j1 / sides * c1, (acc + segLen) / TILE];
      const ao = 0.85 + 0.15 * Math.min(1, acc / 2 + 0.3);
      T.triN([A, B, C], [nA, nB, nC], [uA, uB, uC], BARK_MAT, tint, ao);
      T.triN([A, C, D], [nA, nC, nD], [uA, uC, uD], BARK_MAT, tint, ao);
    }
    acc += segLen;
  }
}
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function limb(T, rnd, from, dir, len, r0, r1, bend, tint, sides = 7) {
  r0 *= 0.75; r1 *= 0.75;   // curved tapered branch; returns the end point
  const rings = [], n = 5; let p = from, d = norm(dir);
  for (let i = 0; i <= n; i++) { rings.push({ p, r: r0 + (r1 - r0) * i / n }); d = norm([d[0] + (rnd() - 0.5) * bend, d[1] - 0.05 * bend + 0.02, d[2] + (rnd() - 0.5) * bend]); p = add(p, mul(d, len / n)); }
  tube(T, rings, sides, tint); return rings[n].p;
}
function trunk(T, rnd, h, r0, lean, tint, sides = 10) {
  r0 *= 0.6;   // real trunks are slimmer than the first version (a 12 m beech has ~0.25 m radius)
  const rings = [{ p: [0, -0.2, 0], r: r0 * 1.55 }, { p: [0, 0.35, 0], r: r0 * 1.18 }];
  const n = 5, lx = (rnd() - 0.5) * lean, lz = (rnd() - 0.5) * lean;
  for (let i = 1; i <= n; i++) { const t = i / n; rings.push({ p: [lx * t * t, 0.35 + (h - 0.35) * t, lz * t * t], r: r0 * (1.1 - 0.38 * t) }); }
  tube(T, rings, sides, tint); return rings[rings.length - 1].p;
}
function hanging(rnd, F, centre, count, len, width, tint) {   // willow strands: tall narrow cards hanging from a point
  for (let i = 0; i < count; i++) {
    const a = rnd() * 6.283, r = 0.2 + rnd() * 0.9, p = [centre[0] + Math.cos(a) * r, centre[1] + rnd() * 0.4, centre[2] + Math.sin(a) * r], n = [Math.cos(a), 0.2, Math.sin(a)], t = [-Math.sin(a), 0, Math.cos(a)], l = len * (0.7 + rnd() * 0.5), base = F.pos.length / 3, ao = 0.55 + rnd() * 0.4;
    for (const [su, sy, uu, vv] of [[-1, 0, 0, 0], [1, 0, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]]) { F.pos.push(p[0] + t[0] * su * width * 0.5, p[1] - l * (1 - sy), p[2] + t[2] * su * width * 0.5); F.nor.push(n[0], n[1], n[2]); F.uv.push(uu, vv); F.col.push(tint[0] * ao, tint[1] * ao, tint[2] * ao); }
    F.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

// ------------------------------------------------------------------------------------------------ species
function crown(rnd, F, centres, R, cards, sMin, sMax, tint, shape) { for (const c of centres) foliageCards(rnd, c, R, cards, sMin, sMax, tint, shape, F); }
const SPECIES = {
  oak: (rnd, q) => {
    const T = new MeshBuilder(), F = newFol(), h = 2.4 + rnd() * 0.8, fork = trunk(T, rnd, h, 0.36 + rnd() * 0.06, 0.5, [0.95, 0.9, 0.85]), cl = [];
    const n = 5 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) { const a = i / n * 6.283 + rnd() * 0.6, e = 0.45 + rnd() * 0.5, d = [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)], len = 2.6 + rnd() * 1.6;
      const end = limb(T, rnd, [fork[0], h * (0.5 + 0.45 * i / n) + rnd() * 0.2, fork[2]], d, len, 0.2, 0.07, 0.5, [0.95, 0.9, 0.85]); cl.push([end[0], end[1] + 0.6, end[2]]); cl.push([(end[0] + fork[0]) * 0.55, end[1] * 0.8 + 0.5, (end[2] + fork[2]) * 0.55]);
      if (rnd() < 0.7) { const e2 = limb(T, rnd, lerp3([fork[0], h, fork[2]], end, 0.55), [d[0] + (rnd() - 0.5), d[1] + 0.3, d[2] + (rnd() - 0.5)], len * 0.55, 0.09, 0.04, 0.6, [0.95, 0.9, 0.85], 5); cl.push([e2[0], e2[1] + 0.5, e2[2]]); } }
    cl.push([fork[0], h + 3.6, fork[2]]);
    crown(rnd, F, cl, 2.0 + rnd() * 0.5, Math.round(34 * q), 1.3, 2.3, [1.0 + rnd() * 0.1, 1.0, 0.88 + rnd() * 0.1], "ellipsoid");
    return { T, F, kind: "leaf", height: h + 7 };
  },
  linden: (rnd, q) => {
    const T = new MeshBuilder(), F = newFol(), h = 3.2 + rnd() * 0.8, fork = trunk(T, rnd, h, 0.3, 0.3, [0.85, 0.82, 0.8]), cl = [];
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + rnd(), d = [Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5]; const end = limb(T, rnd, [fork[0], h * (0.5 + 0.4 * i / 6), fork[2]], d, 3 + rnd() * 2.5, 0.15, 0.05, 0.4, [0.85, 0.82, 0.8], 5); cl.push([end[0], end[1], end[2]]); }
    for (let i = 0; i < 3; i++) cl.push([(rnd() - 0.5) * 1.5, h + 3 + i * 2.1, (rnd() - 0.5) * 1.5]);
    crown(rnd, F, cl, 1.7, Math.round(30 * q), 1.2, 2.0, [0.92, 1.02, 0.85], "tall");
    return { T, F, kind: "leaf", height: h + 9 };
  },
  birch: (rnd, q) => {
    const T = new MeshBuilder(), F = newFol(), h = 4 + rnd() * 1.2, fork = trunk(T, rnd, h, 0.15, 0.9, [2.6, 2.5, 2.4], 7), cl = [];
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + rnd(), d = [Math.cos(a) * 0.7, 0.9 + rnd() * 0.4, Math.sin(a) * 0.7]; const end = limb(T, rnd, [fork[0] * 0.8, h * (0.6 + 0.07 * i), fork[2] * 0.8], d, 2 + rnd() * 1.6, 0.06, 0.025, 0.6, [2.6, 2.5, 2.4], 5); cl.push([end[0], end[1] + 0.3, end[2]]); }
    cl.push([fork[0], h + 1.8, fork[2]]);
    crown(rnd, F, cl, 1.35, Math.round(30 * q), 0.9, 1.5, [1.18, 1.3, 0.82], "ellipsoid");
    return { T, F, kind: "leaf", height: h + 5 };
  },
  poplar: (rnd, q) => {
    const T = new MeshBuilder(), F = newFol(), h = 2.5, fork = trunk(T, rnd, h, 0.28, 0.2, [0.85, 0.8, 0.75]), cl = [];
    for (let i = 0; i < 8; i++) cl.push([(rnd() - 0.5) * 0.8, h + 1.2 + i * 1.5, (rnd() - 0.5) * 0.8]);
    void fork; crown(rnd, F, cl, 1.25, Math.round(24 * q), 1.1, 1.8, [0.95, 1.05, 0.8], "ellipsoid");
    return { T, F, kind: "leaf", height: h + 13 };
  },
  willow: (rnd, q) => {
    const T = new MeshBuilder(), F = newFol(), h = 2.2, fork = trunk(T, rnd, h, 0.42, 0.9, [0.9, 0.85, 0.8]), ends = [];
    for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283 + rnd() * 0.5, d = [Math.cos(a), 0.9, Math.sin(a)]; const end = limb(T, rnd, [fork[0], h * 0.9, fork[2]], d, 2.8 + rnd() * 1.4, 0.17, 0.06, 0.5, [0.9, 0.85, 0.8], 5); ends.push(end); }
    for (const e of ends) { hanging(rnd, F, e, Math.round(16 * q), 3.4, 0.9, [1.15, 1.25, 0.85]); foliageCards(rnd, [e[0], e[1] + 0.3, e[2]], 1.2, Math.round(10 * q), 1.2, 1.8, [1.1, 1.2, 0.85], "ellipsoid", F); }
    return { T, F, kind: "leaf", height: h + 7 };
  },
  apple: (rnd, q) => {
    const T = new MeshBuilder(), F = newFol(), h = 1.5 + rnd() * 0.4, fork = trunk(T, rnd, h, 0.2, 0.5, [0.9, 0.85, 0.8]), cl = [];
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283 + rnd(), end = limb(T, rnd, [fork[0], h * 0.9, fork[2]], [Math.cos(a), 0.7, Math.sin(a)], 1.7 + rnd(), 0.1, 0.04, 0.5, [0.9, 0.85, 0.8], 5); cl.push([end[0], end[1] + 0.4, end[2]]); }
    cl.push([fork[0], h + 1.4, fork[2]]);
    crown(rnd, F, cl, 1.5, Math.round(28 * q), 1.0, 1.7, [1.05, 1.05, 0.95], "ellipsoid");
    return { T, F, kind: "blossom", height: h + 3.5 };
  },
  beech: (rnd, q) => {   // Fagus: tall, smooth grey trunk, dense rounded crown held high; forest canopy on the Baltic upland
    const T = new MeshBuilder(), F = newFol(), h = 4.2 + rnd() * 1.2, fork = trunk(T, rnd, h, 0.42, 0.35, [0.8, 0.8, 0.78]), cl = [];
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + rnd() * 0.5, d = [Math.cos(a) * 0.8, 0.55 + rnd() * 0.3, Math.sin(a) * 0.8], end = limb(T, rnd, [fork[0], h * (0.5 + 0.45 * i / 6), fork[2]], d, 3.2 + rnd() * 1.6, 0.16, 0.06, 0.45, [0.8, 0.8, 0.78], 5); cl.push([end[0], end[1] + 0.5, end[2]]); }
    cl.push([fork[0], h + 2.6, fork[2]]);
    crown(rnd, F, cl, 2.3 + rnd() * 0.4, Math.round(34 * q), 1.3, 2.2, [0.86, 1.0, 0.8], "ellipsoid");
    return { T, F, kind: "leaf", height: h + 6 };
  },
  alder: (rnd, q) => {   // Alnus glutinosa: wet ground, short leaning trunk, dark rounded-oval crown
    const T = new MeshBuilder(), F = newFol(), h = 2.6 + rnd() * 1.0, fork = trunk(T, rnd, h, 0.28, 0.6, [0.7, 0.66, 0.6], 6), cl = [];
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283 + rnd(), end = limb(T, rnd, [fork[0], h * 0.85, fork[2]], [Math.cos(a), 0.4, Math.sin(a)], 1.8 + rnd() * 1.0, 0.1, 0.04, 0.5, [0.7, 0.66, 0.6], 5); cl.push([end[0], end[1] + 0.4, end[2]]); }
    cl.push([fork[0], h + 1.2, fork[2]]);
    crown(rnd, F, cl, 1.6, Math.round(30 * q), 1.0, 1.7, [0.78, 0.98, 0.78], "ellipsoid");
    return { T, F, kind: "leaf", height: h + 5 };
  },
  spruce: (rnd, q) => {
    const T = new MeshBuilder(), F = newFol(), h = 12 + rnd() * 5, R = 2.3 + rnd() * 0.5;
    trunk(T, rnd, h * 0.96, 0.24, 0.3, [0.8, 0.72, 0.65], 6);
    const layers = Math.round(14 * q + 4);
    for (let i = 0; i < layers; i++) { const t = i / (layers - 1), y = h * (0.12 + 0.84 * t), rad = R * (1 - t * 0.92) + 0.2, per = Math.max(3, Math.round(10 * (1 - t * 0.6) * q + 2));
      for (let k = 0; k < per; k++) { const a = k / per * 6.283 + i * 0.7 + rnd() * 0.4, sz = 2.4 * (1 - t * 0.6) + 0.8, dir = [Math.cos(a), -0.4, Math.sin(a)], pos = [dir[0] * rad * 0.6, y, dir[2] * rad * 0.6];
        const nn = norm([dir[0], 0.55, dir[2]]), e1 = [-dir[2], 0, dir[0]], e2 = [dir[0] * 0.92, 0.38, dir[2] * 0.92], ao = 0.5 + 0.5 * (0.45 + 0.55 * t), base = F.pos.length / 3;
        for (const [su, sv, uu, vv] of [[-1, 0, 0, 0], [1, 0, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]]) { F.pos.push(pos[0] + (e1[0] * su * 0.5 + e2[0] * sv) * sz, pos[1] + (e1[1] * su * 0.5 + e2[1] * sv) * sz, pos[2] + (e1[2] * su * 0.5 + e2[2] * sv) * sz); F.nor.push(nn[0], nn[1], nn[2]); F.uv.push(uu, vv); F.col.push(ao, ao, ao); }
        F.idx.push(base, base + 1, base + 2, base, base + 2, base + 3); } }
    return { T, F, kind: "needle", height: h };
  },
  pine: (rnd, q) => {
    const T = new MeshBuilder(), F = newFol(), h = 9 + rnd() * 4, top = trunk(T, rnd, h, 0.3, 1.6, [0.9, 0.62, 0.5], 7), cl = [];
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + rnd(), end = limb(T, rnd, [top[0] * 0.9, h * (0.62 + 0.06 * i), top[2] * 0.9], [Math.cos(a), 0.5, Math.sin(a)], 1.8 + rnd() * 1.2, 0.08, 0.03, 0.4, [0.9, 0.62, 0.5], 5); cl.push([end[0], end[1] + 0.2, end[2]]); }
    cl.push([top[0], h + 0.8, top[2]]);
    for (const c of cl) foliageCards(rnd, c, 1.7, Math.round(16 * q), 1.5, 2.4, [1, 1, 1], "ellipsoid", F);
    return { T, F, kind: "needle", height: h + 3 };
  },
  shrub: (rnd, q) => { const T = new MeshBuilder(), F = newFol(); foliageCards(rnd, [0, 0.7, 0], 0.85, Math.round(46 * q), 0.6, 1.1, [1, 1.05, 0.9], "ellipsoid", F); return { T, F, kind: "leaf", height: 1.5 }; },
  bloom: (rnd, q) => { const T = new MeshBuilder(), F = newFol(); foliageCards(rnd, [0, 0.65, 0], 0.8, Math.round(46 * q), 0.6, 1.0, [1, 1.05, 0.95], "ellipsoid", F); return { T, F, kind: "blossom", height: 1.4 }; },
};


// ------------------------------------------------------------------------------------------------ forest-scale species (second round)
// Canopy trees of the broadleaf woods: 12–18 m, slender trunks (base radius ~0.3 m for beech), dense crowns; scaled per instance by age class.
const CS = q => 1 / Math.sqrt(Math.max(0.2, Math.min(1.2, q)));   // card size multiplier that keeps crown coverage constant when fewer cards are used
const SIDES = q => Math.max(4, Math.round(8 * Math.min(1, q / 0.45)));   // trunk facets: fewer for the far copies
Object.assign(SPECIES, {
  fBeech: (rnd, q) => {   // Fagus: smooth pale trunk, long limbs, dense rounded crown held high
    const T = new MeshBuilder(), F = newFol(), h = 7 + rnd() * 2.5, fork = trunk(T, rnd, h, 0.2, 0.25, [1.3, 1.32, 1.28], SIDES(q)), cl = [];
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + rnd() * 0.5, d = [Math.cos(a) * 0.9, 0.45 + rnd() * 0.3, Math.sin(a) * 0.9], end = limb(T, rnd, [fork[0], h * 0.62, fork[2]], d, 3.6 + rnd() * 2.2, 0.13, 0.05, 0.4, [1.3, 1.32, 1.28], 5); cl.push([end[0], end[1] + 0.8, end[2]]); }
    cl.push([fork[0], h + 3.6, fork[2]]); cl.push([fork[0] + 1.2, h + 2.6, fork[2] - 0.8]);
    crown(rnd, F, cl, 2.7 + rnd() * 0.6, Math.max(5, Math.round(32 * q)), 1.7 * CS(q), 2.8 * CS(q), [0.86, 1.0, 0.82], "ellipsoid");
    return { T, F, kind: "leaf", height: h + 8 };
  },
  fOak: (rnd, q) => {   // Quercus robur: short thick trunk, wide spreading crown
    const T = new MeshBuilder(), F = newFol(), h = 4.5 + rnd() * 1.2, fork = trunk(T, rnd, h, 0.3, 0.4, [1.0, 0.92, 0.82], SIDES(q)), cl = [];
    for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283 + rnd() * 0.6, e = 0.3 + rnd() * 0.4, d = [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)], end = limb(T, rnd, [fork[0], h * 0.6, fork[2]], d, 3.6 + rnd() * 2.0, 0.2, 0.07, 0.5, [1.0, 0.92, 0.82]); cl.push([end[0], end[1] + 0.7, end[2]]); }
    crown(rnd, F, cl, 2.8 + rnd() * 0.5, Math.max(5, Math.round(32 * q)), 1.7 * CS(q), 2.8 * CS(q), [0.9 + rnd() * 0.1, 0.96, 0.82], "ellipsoid");
    return { T, F, kind: "leaf", height: h + 6 };
  },
  fLinden: (rnd, q) => {   // Tilia: slender trunk, dense upright-oval crown (hornbeam and linden stand in for the lower canopy)
    const T = new MeshBuilder(), F = newFol(), h = 6 + rnd() * 2, fork = trunk(T, rnd, h, 0.24, 0.3, [0.82, 0.8, 0.76], SIDES(q)), cl = [];
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + rnd(), end = limb(T, rnd, [fork[0], h * 0.84, fork[2]], [Math.cos(a) * 0.5, 0.9, Math.sin(a) * 0.5], 3.0 + rnd() * 2, 0.14, 0.05, 0.4, [0.82, 0.8, 0.76], 5); cl.push([end[0], end[1], end[2]]); }
    for (let i = 0; i < 3; i++) cl.push([(rnd() - 0.5) * 1.6, h + 2.5 + i * 1.8, (rnd() - 0.5) * 1.6]);
    crown(rnd, F, cl, 2.3, Math.max(5, Math.round(28 * q)), 1.5 * CS(q), 2.4 * CS(q), [0.9, 1.0, 0.82], "tall");
    return { T, F, kind: "leaf", height: h + 7 };
  },
  fBirch: (rnd, q) => {   // Betula: white stem, tall, open crown with hanging twigs
    const T = new MeshBuilder(), F = newFol(), h = 8 + rnd() * 2, fork = trunk(T, rnd, h, 0.14, 0.8, [2.1, 2.1, 2.0], SIDES(q)), cl = [];
    for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283 + rnd(), d = [Math.cos(a) * 0.7, 0.8 + rnd() * 0.4, Math.sin(a) * 0.7], end = limb(T, rnd, [fork[0] * 0.8, h * (0.7 + 0.04 * i), fork[2] * 0.8], d, 2.2 + rnd() * 1.6, 0.06, 0.025, 0.6, [2.1, 2.1, 2.0], 5); cl.push([end[0], end[1] + 0.3, end[2]]); }
    cl.push([fork[0], h + 1.8, fork[2]]);
    crown(rnd, F, cl, 2.1, Math.max(5, Math.round(26 * q)), 1.3 * CS(q), 2.1 * CS(q), [1.12, 1.25, 0.82], "ellipsoid");
    return { T, F, kind: "leaf", height: h + 5 };
  },
  fAlder: (rnd, q) => {   // Alnus glutinosa: wet ground, dark rounded-oval crown
    const T = new MeshBuilder(), F = newFol(), h = 4 + rnd() * 1.5, fork = trunk(T, rnd, h, 0.2, 0.6, [0.66, 0.62, 0.56], SIDES(q)), cl = [];
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283 + rnd(), end = limb(T, rnd, [fork[0], h * 0.85, fork[2]], [Math.cos(a), 0.4, Math.sin(a)], 2.6 + rnd() * 1.2, 0.12, 0.05, 0.5, [0.66, 0.62, 0.56], 5); cl.push([end[0], end[1] + 0.4, end[2]]); }
    cl.push([fork[0], h + 1.4, fork[2]]);
    crown(rnd, F, cl, 2.2, Math.max(5, Math.round(26 * q)), 1.5 * CS(q), 2.3 * CS(q), [0.78, 0.98, 0.78], "ellipsoid");
    return { T, F, kind: "leaf", height: h + 6 };
  },
});

// ------------------------------------------------------------------------------------------------ branch-grown broadleaf trees (near copies)
// A real branch hierarchy (trunk -> limbs -> boughs -> twigs, each level a tapered curved tube) with leaf tufts only at the twig tips and along the last boughs,
// so crowns have a skeleton, gaps and a ragged outline instead of an ellipsoid shell of plates. Leaf normals bend outward from the crown centre (soft, volumetric shading);
// per-tuft AO darkens the inside of the crown and the underside.
const unitRnd = rnd => norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]);
function addCard(F, pos, nCard, nShade, size, roll, tint, ao) {
  let t = Math.abs(nCard[1]) > 0.95 ? [1, 0, 0] : norm(cross([0, 1, 0], nCard)); const b = cross(nCard, t), c = Math.cos(roll), s = Math.sin(roll);
  const e1 = [t[0] * c + b[0] * s, t[1] * c + b[1] * s, t[2] * c + b[2] * s], e2 = [-t[0] * s + b[0] * c, -t[1] * s + b[1] * c, -t[2] * s + b[2] * c], base = F.pos.length / 3;
  for (const [su, sv, uu, vv] of [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]]) {
    F.pos.push(pos[0] + (e1[0] * su + e2[0] * sv) * size * 0.5, pos[1] + (e1[1] * su + e2[1] * sv) * size * 0.5, pos[2] + (e1[2] * su + e2[2] * sv) * size * 0.5);
    F.nor.push(nShade[0], nShade[1], nShade[2]); F.uv.push(uu, vv); F.col.push(tint[0] * ao, tint[1] * ao, tint[2] * ao);
  }
  F.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}
function leafTuft(F, rnd, at, crownC, crownR, size, count, tint) {
  for (let i = 0; i < count; i++) {
    const o = mul(unitRnd(rnd), size * 0.55 * (0.4 + rnd() * 0.6)), p = add(at, o);
    const rel = sub(p, crownC), dist = Math.hypot(rel[0] / crownR[0], rel[1] / crownR[1], rel[2] / crownR[2]);
    const out = norm(add(norm(rel), [0, 0.28, 0]));
    const nCard = norm(add(mul(out, 0.5), mul(unitRnd(rnd), 1.0)));
    const nShade = norm(add(mul(out, 0.8), mul(nCard, 0.2)));
    const ao = 0.5 + 0.5 * smoothstep(0.15, 1.0, dist) * (0.8 + 0.2 * smoothstep(-0.6, 0.6, nShade[1]));
    addCard(F, p, nCard, nShade, size * (0.8 + 0.4 * rnd()), rnd() * 6.283, [tint[0] * (0.9 + 0.2 * rnd()), tint[1] * (0.92 + 0.16 * rnd()), tint[2] * (0.9 + 0.2 * rnd())], ao);
  }
}
function limbN(T, rnd, from, dir, len, r0, r1, bend, tint, sides, segs, grav) {
  const rings = [], n = segs; let p = from, d = norm(dir);
  for (let i = 0; i <= n; i++) { rings.push({ p, r: r0 + (r1 - r0) * i / n }); d = norm([d[0] + (rnd() - 0.5) * bend, d[1] + (rnd() - 0.5) * bend * 0.5 + grav, d[2] + (rnd() - 0.5) * bend]); p = add(p, mul(d, len / n)); }
  tube(T, rings, sides, tint); return { end: rings[n].p, dir: d };
}
const TREE_P = {
  oak:    { h: [2.4, 0.8], r0: 0.38, lean: 0.5, bark: [0.95, 0.9, 0.85], n0: [6, 8], start: 0.62, elev: [0.15, 0.5], len0: [3.6, 5.2], decay: 0.62, n1: 3, n2: 3, phot: 0.22, bend: 0.5, grav: 0.0, cone: 0.0, tuft: 1.5, tufts: 4, tint: [1.0, 1.0, 0.88], crownR: [4.8, 3.6, 4.8], cy: 0.5 },
  beech:  { mat: "beechbark", h: [4.4, 1.2], r0: 0.42, lean: 0.35, bark: [1.0, 1.0, 1.0], n0: [6, 7], start: 0.55, elev: [0.45, 0.9], len0: [3.4, 4.8], decay: 0.62, n1: 3, n2: 3, phot: 0.3, bend: 0.42, grav: 0.0, cone: 0.1, tuft: 1.5, tufts: 4, tint: [0.86, 1.0, 0.8], crownR: [4.2, 4.2, 4.2], cy: 0.55 },
  linden: { h: [3.4, 0.8], r0: 0.3, lean: 0.3, bark: [0.85, 0.82, 0.8], n0: [6, 7], start: 0.5, elev: [0.7, 1.15], len0: [2.8, 4.2], decay: 0.64, n1: 3, n2: 3, phot: 0.35, bend: 0.4, grav: 0.0, cone: 0.25, tuft: 1.4, tufts: 4, tint: [0.92, 1.02, 0.85], crownR: [3.2, 4.8, 3.2], cy: 0.6 },
  birch:  { mat: "birch", h: [4.2, 1.2], r0: 0.16, lean: 0.9, bark: [1.0, 1.0, 1.0], n0: [6, 7], start: 0.6, elev: [0.7, 1.1], len0: [2.2, 3.4], decay: 0.66, n1: 3, n2: 3, phot: 0.12, bend: 0.6, grav: -0.04, cone: 0.15, tuft: 1.2, tufts: 4, tint: [1.15, 1.28, 0.82], crownR: [2.8, 3.8, 2.8], cy: 0.62 },
  alder:  { h: [2.8, 1.0], r0: 0.28, lean: 0.6, bark: [0.7, 0.66, 0.6], n0: [5, 6], start: 0.6, elev: [0.5, 0.95], len0: [2.2, 3.4], decay: 0.64, n1: 3, n2: 3, phot: 0.25, bend: 0.5, grav: 0.0, cone: 0.1, tuft: 1.3, tufts: 4, tint: [0.78, 0.98, 0.78], crownR: [3.2, 3.2, 3.2], cy: 0.6 },
};
function growTree(P, rnd, q, hScale = 1, kind = "leaf") {
  const T = new MeshBuilder(), F = newFol(), h = (P.h[0] + rnd() * P.h[1]) * hScale;
  BARK_MAT = P.mat ? L[P.mat] : L.bark;   // species bark layer for every tube built below
  const lv = q >= 0.8 ? 3 : 2, sidesTrunk = SIDES(q);
  const fork = trunk(T, rnd, h, P.r0, P.lean, P.bark, sidesTrunk);
  const crownC = [fork[0], h * P.start + P.crownR[1] * P.cy, fork[2]], crownR = P.crownR.map(v => v * (0.9 + 0.2 * rnd()) * hScale ** 0.5);
  const tint = [P.tint[0] * (0.95 + rnd() * 0.1), P.tint[1], P.tint[2] * (0.92 + rnd() * 0.12)];
  const nT = Math.max(2, Math.round(P.tufts * (q >= 0.8 ? 1 : 0.6)));
  const tip = (end, last) => leafTuft(F, rnd, end, crownC, crownR, P.tuft * (q >= 0.8 ? 1 : 1.25), last ? nT : Math.max(2, nT - 2), tint);
  const branch = (from, dir, len, r, depth) => {
    const sides = depth === 0 ? 6 : depth === 1 ? 5 : 4, segs = depth === 0 ? 5 : depth === 1 ? 4 : 3;
    const { end, dir: ed } = limbN(T, rnd, from, dir, len, r, r * 0.42, P.bend, P.bark, sides, segs, 0.025 * (P.phot - 0.2) + P.grav * 0.02);
    if (depth >= lv - 1) { tip(end, true); if (depth === lv - 1) tip(lerp3(from, end, 0.55), false); }
    if (depth < lv - 1) {
      const m = depth === 0 ? P.n1 : P.n2;
      for (let k = 0; k < m; k++) {
        const t = 0.3 + 0.65 * (k + rnd() * 0.8) / m, pos = lerp3(from, end, t), cd = norm(add(add(mul(norm(ed), 0.5), mul(unitRnd(rnd), 0.95)), [0, P.phot * 0.6, 0]));
        branch(pos, cd, len * P.decay * (1.05 - 0.4 * t), r * 0.5, depth + 1);
      }
      tip(end, false);
    }
  };
  const n0 = P.n0[0] + Math.floor(rnd() * (P.n0[1] - P.n0[0] + 1));
  for (let i = 0; i < n0; i++) {
    const a = i * 2.39996 + rnd() * 0.6, tt = i / Math.max(1, n0 - 1), e = P.elev[0] + (P.elev[1] - P.elev[0]) * (0.3 + 0.7 * tt) * (0.8 + 0.4 * rnd());
    const len = (P.len0[0] + rnd() * (P.len0[1] - P.len0[0])) * (1 - P.cone * tt) * hScale ** 0.5;
    branch([fork[0] * 0.9, h * (P.start + (1 - P.start) * tt * 0.9), fork[2] * 0.9], [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)], len, P.r0 * 0.34 * (1 - 0.3 * tt) * (P.start > 0.55 ? 1 : 1), 0);
  }
  // crown top: one leader with its own tufts so the crown closes over the stem
  { const top = fork, ex = limbN(T, rnd, top, [0, 1, 0], P.len0[0] * 0.5, P.r0 * 0.25, P.r0 * 0.1, 0.3, P.bark, 5, 3, 0); leafTuft(F, rnd, ex.end, crownC, crownR, P.tuft, nT + 1, tint); }
  BARK_MAT = L.bark;
  return { T, F, kind, height: h + crownR[1] * 1.6 };
}
{
  const old = { ...SPECIES };
  const wrap = (name, pk, hs) => { SPECIES[name] = (rnd, q) => q >= 0.5 ? growTree(TREE_P[pk], rnd, q, hs) : old[name](rnd, q); };
  wrap("oak", "oak", 1); wrap("beech", "beech", 1); wrap("linden", "linden", 1); wrap("birch", "birch", 1); wrap("alder", "alder", 1);
  wrap("fOak", "oak", 1.55); wrap("fBeech", "beech", 1.7); wrap("fLinden", "linden", 1.55); wrap("fBirch", "birch", 1.6); wrap("fAlder", "alder", 1.45);
}
const FOREST_SP = ["fBeech", "fOak", "fLinden", "fBirch", "fAlder"];

export function buildPlantLibrary(quality = 1) {
  const lib = { near: {}, far: {} };
  // far forest copies: a plain 4-sided stem instead of the full limbed trunk (limbs are sub-pixel at 150 m+)
  const simpleTrunk = (H, nm = "") => { const T = new MeshBuilder(); T.cyl(0, -0.2, 0, 0.3, 0.14, H * 0.55, 4, { mat: /irch/.test(nm) ? L.birch : /eech/.test(nm) ? L.beechbark : L.bark, tint: [1, 1, 1], ao: 1 }); return T.toGeometry(); };
  const mk = (name, variants, detail, set) => { set[name] = []; for (let v = 0; v < variants; v++) { const r = mulberry32(4000 + name.length * 131 + v * 977), s = SPECIES[name](r, detail); const far = set === lib.far && FOREST_SP.includes(name); set[name].push({ trunk: far ? simpleTrunk(s.height, name) : (s.T.count ? s.T.toGeometry() : null), fol: foliageGeometry(s.F), kind: s.kind }); } };
  for (const n of ["oak", "linden", "birch", "poplar", "willow", "apple", "beech", "alder", "spruce", "pine"]) mk(n, 3, quality, lib.near);
  for (const n of ["shrub", "bloom"]) mk(n, 3, quality, lib.near);
  for (const n of ["oak", "linden", "birch", "poplar", "willow", "apple", "beech", "alder", "spruce", "pine"]) mk(n, 3, quality * 0.38, lib.far);
  for (const n of FOREST_SP) { mk(n, 5, quality, lib.near); mk(n, 3, quality * 0.35, lib.far); }   // 5 near / 3 far variants per species   // far: 45% of the crown cards, still a closed canopy
  return lib;
}

// Instanced placement split into CELL_M x CELL_M cells: one InstancedMesh per cell with a bounding sphere, so the frustum can drop whole cells.
export function instCells(scene, geo, mat, items, { shadow = true, cell = 64, dummy = new THREE.Object3D(), tint = null, radius = 8, list = null } = {}) {
  const cells = new Map(); for (const t of items) { const k = Math.floor(t.x / cell) + "," + Math.floor(t.z / cell); (cells.get(k) || cells.set(k, []).get(k)).push(t); }
  let last = null;
  for (const cellItems of cells.values()) {
    const m = new THREE.InstancedMesh(geo, mat, cellItems.length);
    cellItems.forEach((t, i) => { dummy.position.set(t.x, t.y, t.z); dummy.rotation.set(0, t.r, 0); dummy.scale.setScalar(t.s); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); if (tint) { const c = tint(t); m.setColorAt(i, new THREE.Color(c[0], c[1], c[2])); } });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.castShadow = shadow; m.receiveShadow = true; m.frustumCulled = true;
    m.computeBoundingSphere(); m.boundingSphere.radius += radius;
    scene.add(m); last = m; if (list) list.push(m);
  }
  return last;
}

// ------------------------------------------------------------------------------------------------ flower beds (baked-colour clumps)
function flowerClump(rnd, col, center) {
  const T = new MeshBuilder();
  for (let i = 0; i < 7; i++) {
    const a = rnd() * 6.283, r = rnd() * 0.22, x = Math.cos(a) * r, z = Math.sin(a) * r, h = 0.35 + rnd() * 0.3, tilt = (rnd() - 0.5) * 0.18;
    T.beam([x, 0, z], [x + tilt, h, z + tilt * 0.6], 0.012, 0.012, { mat: L.beam, tint: [0.08, 0.2, 0.04].map(v => v * 5), up: [1, 0, 0], faces: "ABCD", ao: 1 });
    const hx = x + tilt, hz = z + tilt * 0.6, pr = 0.045 + rnd() * 0.02;
    for (let k = 0; k < 6; k++) { const a0 = k / 6 * 6.283, a1 = (k + 1) / 6 * 6.283; T.triFace([hx, h + 0.02, hz], [hx + Math.cos(a1) * pr, h, hz + Math.sin(a1) * pr], [hx + Math.cos(a0) * pr, h, hz + Math.sin(a0) * pr], { mat: L.plaster, tint: col, ao: 1, uvFn: () => [0.5, 0.5] }); }
    for (let k = 0; k < 4; k++) { const a0 = k / 4 * 6.283, a1 = (k + 1) / 4 * 6.283; T.triFace([hx, h + 0.035, hz], [hx + Math.cos(a1) * pr * 0.35, h + 0.02, hz + Math.sin(a1) * pr * 0.35], [hx + Math.cos(a0) * pr * 0.35, h + 0.02, hz + Math.sin(a0) * pr * 0.35], { mat: L.plaster, tint: [1.2, 0.9, 0.1], ao: 1, uvFn: () => [0.5, 0.5] }); }
  }
  void center; return T.toGeometry();
}
const BED_COLS = [[2.2, 2.2, 2.1], [1.9, 1.4, 0.1], [1.2, 0.5, 1.5], [2.0, 0.2, 0.15], [0.5, 0.8, 2.0], [2.0, 1.0, 1.2]];

// ------------------------------------------------------------------------------------------------ forest communities
// Conifers only on the high ground and on the sandy patches (Scots pine); flat land is broadleaf: beech/oak mixed woods, linden and birch
// groves, alder + willow in the wet lowland by the water. Planting spruce on the flat is deliberately not done (modern forestry).
function forestSpecies(rnd, c) {
  if (c.high) return rnd() < 0.75 ? "spruce" : "pine";
  if (c.s > -30 && c.h < 3.2 && rnd() < 0.65) return rnd() < 0.55 ? "alder" : "willow";          // wet lowland / carr
  if (c.sandy > 0.22 && rnd() < 0.5) return rnd() < 0.6 ? "pine" : "birch";                      // sand: pine and birch
  if (c.g < -0.25 && rnd() < 0.5) return "birch";
  if (c.g > 0.2) return rnd() < 0.55 ? "beech" : "oak";                                             // beech-oak canopy
  const u = rnd(); return u < 0.12 ? "poplar" : u < 0.45 ? "linden" : u < 0.75 ? "beech" : "oak";
}

// ------------------------------------------------------------------------------------------------ placement
export function placePlants(W, opts = {}) {
  const rnd = mulberry32(2025), N = makeNoise(77), q = opts.quality ?? 1, WG = wallGeo(W), KO = opts.keepOut || null;
  const inKeepOut = (x, z) => !!KO && (x - KO.x) ** 2 + (z - KO.z) ** 2 < KO.r * KO.r;   // farm field etc.
  const list = W.buildings.concat(Object.values(W.landmarks).filter(b => b && b.hw)), cell = 16, bucket = new Map(), key = (x, z) => Math.floor(x / cell) + "," + Math.floor(z / cell);
  for (const b of list) { const r = Math.hypot(b.hw, b.hd) + 4; for (let x = b.x - r; x <= b.x + r + cell; x += cell) for (let z = b.z - r; z <= b.z + r + cell; z += cell) { const k = key(x, z); (bucket.get(k) || bucket.set(k, []).get(k)).push(b); } }
  const buildDist = (x, z) => { const l = bucket.get(key(x, z)); if (!l) return 99; let m = 99; for (const b of l) { const dx = x - b.x, dz = z - b.z, lx = Math.abs(dx * b.ax + dz * b.az) - b.hw, lz = Math.abs(-dx * b.az + dz * b.ax) - b.hd; m = Math.min(m, Math.hypot(Math.max(lx, 0), Math.max(lz, 0)) + Math.min(Math.max(lx, lz), 0)); } return m; };
  const free = (x, z, bpad, rpad) => buildDist(x, z) > bpad && W.roadDistAt(x, z) > rpad && !W.inSquare(x, z, 6) && !inKeepOut(x, z);
  const trees = [], shrubs = [], beds = [], forest = [], pts = [];
  const spaced = (x, z, d) => { for (const p of pts) if ((p[0] - x) ** 2 + (p[1] - z) ** 2 < d * d) return false; pts.push([x, z]); return true; };
  const castle = W.landmarkSites.CASTLE;
  // town trees: orchards near houses, lindens/oaks in the open, birches in small groves, willows by the water, poplars at the edges
  // town trees: sampled over the wall's bounding box, kept inside the wall (8 m from it, so the moat and the wall walk stay clear)
  for (let i = 0; i < 16000 * q && trees.length < 520 * q; i++) {
    const x = WG.minX + rnd() * (WG.maxX - WG.minX), z = WG.minZ + rnd() * (WG.maxZ - WG.minZ), s = W.coastS(x, z);
    if (WG.sd(x, z) > -8 || s > -6) continue; const h = W.H(x, z); if (h < 1.6) continue; if (!free(x, z, 3.0, 3.0)) continue; if (W.normal(x, z)[1] < 0.88) continue; if (castle && Math.hypot(x - castle.x, z - castle.z) < 36) continue;
    const bd = buildDist(x, z), nearWater = s > -30;
    let sp = "oak"; const u = rnd();
    if (nearWater && u < 0.5) sp = "willow"; else if (bd < 12 && u < 0.45) sp = "apple"; else if (u < 0.2) sp = "birch"; else if (u < 0.5) sp = "linden"; else if (WG.sd(x, z) > -40 && u < 0.7) sp = "poplar";
    if (!spaced(x, z, sp === "apple" ? 6 : sp === "poplar" ? 5 : 8 + rnd() * 5)) continue;
    trees.push({ x, y: h - 0.12, z, s: (sp === "apple" ? 0.9 : 0.8) + rnd() * 0.5, r: rnd() * 6.28, v: Math.floor(rnd() * 3), sp });
  }
  // forest: stands and clearings from a cluster field, spaced trees, age classes, species patches (see forestStands)
  { const F2 = forestStands(W, { N, WG, q, inKeepOut, buildDist, castle, rnd }); forest.push(...F2.trees); shrubs.push(...F2.under); }
  // shrubs and flower beds around houses; hedges of shrubs along the plot backs
  for (const b of W.buildings) {
    const n = 3 + Math.floor(rnd() * 4 * q);
    for (let i = 0; i < n; i++) {
      const side = rnd() < 0.5 ? -1 : 1, along = (rnd() - 0.5) * b.w, back = rnd() < 0.6; const lx = back ? along : side * (b.hw + 0.9), lz = back ? -(b.hd + 0.9 + rnd() * 0.8) : (rnd() - 0.5) * b.d * 0.8;
      const x = b.x + b.ax * lx + b.az * lz * -1 * -1 * 0 + (-b.az) * lz, z = b.z + b.az * lx + b.ax * lz; if (W.H(x, z) < 1.2 || buildDist(x, z) < 0.5 || W.roadDistAt(x, z) < 1.4) continue;
      shrubs.push({ x, y: W.H(x, z) - 0.05, z, s: 0.7 + rnd() * 0.7, r: rnd() * 6.28, v: Math.floor(rnd() * 3), bloom: rnd() < 0.4 });
    }
    // front garden bed beside the door
    for (let k = 0; k < 2; k++) {
      const fx = b.front.nx, fz = b.front.nz, side = k ? 1 : -1, off = b.hd + 0.8; const x = b.x + fx * off + b.ax * side * (b.hw * 0.7), z = b.z + fz * off + b.az * side * (b.hw * 0.7);
      if (buildDist(x, z) < 0.4 || W.roadDistAt(x, z) < 1.0 || W.H(x, z) < 1.2) continue; const col = BED_COLS[Math.floor(rnd() * BED_COLS.length)];
      for (let c = 0; c < 5; c++) beds.push({ x: x + (rnd() - 0.5) * 1.8, y: W.H(x, z) - 0.02, z: z + (rnd() - 0.5) * 1.4, s: 0.8 + rnd() * 0.5, r: rnd() * 6.28, col: BED_COLS.indexOf(col) });
    }
  }
  // wild shrubs along the shore and hedgerows
  for (let i = 0; i < 900 * q; i++) { const x = (rnd() - 0.5) * 700, z = (rnd() - 0.5) * 700, s = W.coastS(x, z); if (s > -3 || s < -18) continue; const h = W.H(x, z); if (h < 1.3 || !free(x, z, 1.5, 2.0)) continue; shrubs.push({ x, y: h - 0.05, z, s: 0.8 + rnd() * 1.0, r: rnd() * 6.28, v: Math.floor(rnd() * 3), bloom: rnd() < 0.25 }); }
  return { trees, forest, shrubs, beds, buildDist };
}

const CELL_M = 64;

// ------------------------------------------------------------------------------------------------ forest stands
// Trees come from a cluster field: dense woods where a large-scale noise is high, edges and clearings where it is low, a small-scale noise breaks the
// stands into patches. Trees keep a minimum spacing (no grid), species form patches, and each tree has an age class (sapling / mature / old).
function forestStands(W, { N, WG, q, inKeepOut, buildDist, castle, rnd }) {
  const trees = [], under = [], R = 4.5, cells = new Map(), step = 4;
  const near = (x, z) => { const i0 = Math.floor(x / R), j0 = Math.floor(z / R); for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) { const l = cells.get(i + "," + j); if (l) for (const p of l) if ((p.x - x) ** 2 + (p.z - z) ** 2 < R * R) return true; } return false; };
  const put = o => { const k = Math.floor(o.x / R) + "," + Math.floor(o.z / R); (cells.get(k) || cells.set(k, []).get(k)).push(o); };
  for (let x = -480; x < 480; x += step) for (let z = -480; z < 480; z += step) {
    const jx = x + (rnd() - 0.5) * step, jz = z + (rnd() - 0.5) * step;
    if (WG.sd(jx, jz) < 22 || inKeepOut(jx, jz)) continue;
    const s = W.coastS(jx, jz), h = W.H(jx, jz); if (s > -20 || h < 2.5 || h > 60) continue;
    if (castle && Math.hypot(jx - castle.x, jz - castle.z) < 50) continue;
    if (W.roadDistAt(jx, jz) < 6 || buildDist(jx, jz) < 8 || W.normal(jx, jz)[1] < 0.72) continue;
    const big = N.fbm(jx / 140 + 20, jz / 140 - 11, 3) * 0.5 + 0.5, small = N.fbm(jx / 35 + 4, jz / 35 + 9, 2) * 0.5 + 0.5;
    const dens = smoothstep(0.36, 0.62, big) * (0.35 + 0.65 * smoothstep(0.35, 0.65, small));
    if (rnd() > dens * Math.min(1, 0.6 + 0.4 * q)) continue;
    if (near(jx, jz)) continue;
    const wet = h < 3.2 && s > -40, sandy = N.fbm(jx / 45 - 12, jz / 45 + 9, 2) > 0.22, high = h > 35 + N.fbm(jx / 50, jz / 50, 2) * 15, pt = N.fbm(jx / 80 + 5, jz / 80 - 7, 2);
    let sp;
    if (high) sp = rnd() < 0.6 ? "spruce" : rnd() < 0.7 ? "pine" : "fBeech";
    else if (wet) sp = rnd() < 0.6 ? "fAlder" : rnd() < 0.5 ? "willow" : "fBirch";
    else if (sandy) sp = rnd() < 0.55 ? "pine" : rnd() < 0.7 ? "fBirch" : "fOak";
    else if (pt > 0.05) sp = rnd() < 0.8 ? "fBeech" : "fOak";
    else if (pt < -0.12) sp = rnd() < 0.5 ? "fOak" : rnd() < 0.5 ? "fLinden" : "fBeech";
    else sp = rnd() < 0.55 ? "fBeech" : rnd() < 0.5 ? "fOak" : "fLinden";
    const a = rnd(), age = a < 0.35 ? 0.4 + rnd() * 0.12 : a < 0.8 ? 0.8 + rnd() * 0.2 : 1.05 + rnd() * 0.3;   // sapling / mature / old
    const t = { x: jx, y: h - 0.2, z: jz, s: age * (0.65 + rnd() * 0.7), r: rnd() * 6.28, v: Math.floor(rnd() * 5), sp };   // +-35 % height variation
    put(t); trees.push(t);
    if (rnd() < 0.3) { const d = 2 + rnd() * 2, ang = rnd() * 6.28; under.push({ x: jx + Math.cos(ang) * d, y: W.H(jx + Math.cos(ang) * d, jz + Math.sin(ang) * d) - 0.05, z: jz + Math.sin(ang) * d, s: 0.7 + rnd() * 0.7, r: rnd() * 6.28, v: Math.floor(rnd() * 3), bloom: rnd() < 0.4 }); }   // hazel / hawthorn understory
  }
  return { trees, under };
}

// ------------------------------------------------------------------------------------------------ BatchedMesh placement (one batch per material)
// jobs: [{ geo, items:[{x,y,z,s,r,tint?}], zone?, lod? }]. All geometries in one batch share an attribute set (the caller guarantees this). Instances get
// per-instance frustum culling and multi-draw in three r187. `lod` near/far entries switch by distance; `zone` keeps batch/shadow policy separate.
export function batchPlace(scene, mat, jobs, { dummy = new THREE.Object3D(), shadow = true, name = "" } = {}) {
  const uniq = new Map(); let V = 0, I = 0, N = 0;
  for (const j of jobs) { if (!j.items.length) continue; if (!uniq.has(j.geo)) { uniq.set(j.geo, true); V += j.geo.attributes.position.count; I += j.geo.index ? j.geo.index.count : j.geo.attributes.position.count; } N += j.items.length; }
  if (!N) return [];
  const bm = new THREE.BatchedMesh(N, V, I, mat); bm.name = name;
  bm.castShadow = shadow; bm.receiveShadow = true; bm.perObjectFrustumCulled = true; bm.sortObjects = false; bm.frustumCulled = false;
  const gid = new Map(); for (const g of uniq.keys()) gid.set(g, bm.addGeometry(g));
  const out = [];
  for (const j of jobs) for (const t of j.items) {
    const id = bm.addInstance(gid.get(j.geo)); dummy.position.set(t.x, t.y, t.z); dummy.rotation.set(0, t.r, 0); dummy.scale.setScalar(t.s); dummy.updateMatrix(); bm.setMatrixAt(id, dummy.matrix);
    if (t.tint) bm.setColorAt(id, new THREE.Color(t.tint[0], t.tint[1], t.tint[2]));
    out.push({ bm, id, tree: t, zone: j.zone || null, lod: j.lod ?? j.zone ?? null, x: t.x, z: t.z });
  }
  scene.add(bm); return out;
}
export function batchVisibility(entries, { near = 150, hysteresis = 10 } = {}) {
  const groups = new Map(), list = entries.filter(e => e.lod || e.zone), R2 = near * near, enter2 = Math.max(0, near - hysteresis) ** 2, exit2 = (near + hysteresis) ** 2;
  for (const e of list) {
    const key = e.tree ?? `${e.x},${e.z}`;
    let g = groups.get(key);
    if (!g) { g = { x: e.x, z: e.z, entries: [], near: null, visible: false, hasNear: false, hasFar: false }; groups.set(key, g); }
    g.entries.push(e); if ((e.lod ?? e.zone) === "near") g.hasNear = true; else g.hasFar = true;
  }
  let lastX = null, lastZ = null;
  return { update(cx, cz) {
    if (!Number.isFinite(cx) || !Number.isFinite(cz) || (lastX !== null && (cx - lastX) ** 2 + (cz - lastZ) ** 2 < 0.25)) return;
    lastX = cx; lastZ = cz;
    for (const g of groups.values()) {
      if (!g.hasNear || !g.hasFar) {
        if (!g.visible) { for (const e of g.entries) e.bm.setVisibleAt(e.id, true); g.visible = true; }
        continue;
      }
      const d2 = (g.x - cx) ** 2 + (g.z - cz) ** 2;
      const isNear = g.near === null ? d2 < R2 : g.near ? d2 <= exit2 : d2 < enter2;
      if (g.near === isNear) continue;
      g.near = isNear;
      for (const e of g.entries) e.bm.setVisibleAt(e.id, (e.lod ?? e.zone) === "near" ? isNear : !isNear);
    }
  }, count: list.length };
}

export function buildPlantMeshesBatched(scene, placed, lib, tex, townMat, csm, opts = {}) {
  const leaf = makeFoliageMaterial(tex, csm, "leaf"), needle = makeFoliageMaterial(tex, csm, "needle"), bloomM = makeFoliageMaterial(tex, csm, "blossom"), dummy = new THREE.Object3D();
  const J = { trunk: [], leaf: [], needle: [], blossom: [] }, kindOf = k => (k === "needle" ? "needle" : k === "blossom" ? "blossom" : "leaf");
  let count = 0;
  const addTree = (t, set, zone, lod = zone) => {
    const sp = set[t.sp] ? t.sp : "oak", v = t.v % set[sp].length, e = set[sp][v], items = [t];
    if (e.trunk) J.trunk.push({ geo: e.trunk, items, zone, lod });
    J[kindOf(e.kind)].push({ geo: e.fol, items, zone, lod }); count++;
  };
  const forestNear = placed.forest.filter(t => t.sp && lib.near[t.sp]), forestFar = placed.forest.filter(t => t.sp && lib.far[t.sp]);
  for (const t of placed.trees) {
    if (t.sp && lib.far[t.sp]) { addTree(t, lib.near, null, "near"); addTree(t, lib.far, null, "far"); }
    else addTree(t, lib.near, null);
  }
  // Town LOD copies keep the original shadow batch; forest copies keep their existing near/far shadow policy.
  for (const t of forestNear) addTree(t, lib.near, "near");
  for (const t of forestFar) addTree(t, lib.far, "far");
  const sh = { shrub: [], bloom: [] }; for (const s of placed.shrubs) sh[s.bloom ? "bloom" : "shrub"].push(s);
  for (const k of ["shrub", "bloom"]) for (let v = 0; v < 3; v++) { const items = sh[k].filter(s => s.v % 3 === v); if (!items.length) continue; const e = lib.near[k][v]; J[kindOf(e.kind)].push({ geo: e.fol, items }); count += items.length; }
  // one batch per material and zone; the far forest does not cast shadows (it lies beyond the shadow cascades)
  // vegetation shadows by quality tier: none (low), near trees only (medium), everything (high and up)
  const vs = opts.vegShadow || "all", shadowOf = zone => (vs === "all" ? zone !== "far" : vs === "near" ? zone !== "far" : false);
  const place = (mat, jobs, name) => { const out = []; for (const zone of [null, "near", "far"]) { const js = jobs.filter(j => (j.zone || null) === zone); out.push(...batchPlace(scene, mat, js, { dummy, name: name + (zone ? "-" + zone : ""), shadow: shadowOf(zone) && (vs !== "near" || zone !== "far") })); } return out; };
  const entries = [...place(townMat, J.trunk, "trunks"), ...place(leaf, J.leaf, "leaves"), ...place(needle, J.needle, "needles"), ...place(bloomM, J.blossom, "blossom")];
  const vis = batchVisibility(entries, { near: 150 });
  // flower beds stay as plain instanced meshes (a handful of draw calls)
  const rnd = mulberry32(77), bedMat = makeBedMaterial(townMat), byCol = BED_COLS.map(() => []); for (const b of placed.beds) byCol[b.col].push(b);
  byCol.forEach((items, ci) => { if (items.length) { const m = instCells(scene, flowerClump(rnd, BED_COLS[ci]), bedMat, items, { shadow: false, cell: 256, dummy }); if (m) m.castShadow = false; count += items.length; } });
  return { count, mats: [leaf, needle, bloomM], vis, entries };
}

// Legacy InstancedMesh path (debug: ?inst=1), one InstancedMesh per 64/160 m cell.
export function buildPlantMeshesInst(scene, placed, lib, tex, townMat, csm, opts = {}) {
  const leaf = makeFoliageMaterial(tex, csm, "leaf"), needle = makeFoliageMaterial(tex, csm, "needle"), bloomM = makeFoliageMaterial(tex, csm, "blossom");
  const matFor = k => k === "needle" ? needle : k === "blossom" ? bloomM : leaf, dummy = new THREE.Object3D(); let count = 0;
  // instances are split into 64 m cells: one InstancedMesh per cell with a tight bounding sphere, so the GPU/CPU frustum can drop whole cells
  const inst = (geo, mat, items, shadow = true, cell = 64) => { const r = instCells(scene, geo, mat, items, { shadow, dummy, cell }); count += items.length; return r; };
  const group = (list, set, cell = 64) => { const by = {}; for (const t of list) { const sp = set[t.sp] ? t.sp : "oak", v = t.v % set[sp].length, k = sp + ":" + v; (by[k] = by[k] || { sp, v, items: [] }).items.push(t); } for (const g of Object.values(by)) { const e = set[g.sp][g.v]; if (e.trunk) inst(e.trunk, townMat, g.items, true, cell); inst(e.fol, matFor(e.kind), g.items, true, cell); } };
  group(placed.trees, lib.near, 64); group(placed.forest, lib.far, 160);   // forest is lower detail and sparser: bigger culling cells keep the draw-call count down
  const sh = { shrub: [], bloom: [] }; for (const s of placed.shrubs) sh[s.bloom ? "bloom" : "shrub"].push(s);
  for (const k of ["shrub", "bloom"]) { const by = [[], [], []]; for (const s of sh[k]) by[s.v % 3].push(s); by.forEach((items, v) => { if (items.length) inst(lib.near[k][v].fol, matFor(lib.near[k][v].kind), items, true, 160); }); }
  // flower beds
  const rnd = mulberry32(77), flowerMat = patch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0, vertexColors: true }), null, "bedflower");
  const bedMat = makeBedMaterial(townMat); void flowerMat;
  const byCol = BED_COLS.map(() => []); for (const b of placed.beds) byCol[b.col].push(b);
  byCol.forEach((items, ci) => { if (items.length) { const g = flowerClump(rnd, BED_COLS[ci]); const m = inst(g, bedMat, items, false); m.castShadow = false; } });
  return { count, mats: [leaf, needle, bloomM] };
}
function makeBedMaterial(townMat) { return townMat; }

// ------------------------------------------------------------------------------------------------ grass + meadow flowers (denser, clustered flower patches)
export function makeGrass2(heightTex, maskTex, csm, opts = {}) {
  const forestTex = opts.forestTex || null, forestRect = opts.forestRect || { x0: 0, z0: 0, size: 1 }, exclTex = opts.exclTex || null, exclRect = opts.exclRect || { x0: 0, z0: 0, size: 1 };
  const side = opts.side ?? 170, cell = opts.cell ?? 0.45, R = side * cell * 0.5;
  const pos = [], uv = [], idx = [];
  const blade = (ang, w, hgt, lean, segs = 3, ox = 0, oz = 0) => {
    const base = pos.length / 3, ca = Math.cos(ang), sa = Math.sin(ang);
    for (let i = 0; i <= segs; i++) { const t = i / segs, ww = w * (1 - Math.pow(t, 1.5) * 0.97) * 0.5, bend = lean * t * t, y = hgt * t * (1 - 0.1 * t * t); pos.push(ox - ca * ww, y, oz - sa * ww + bend); uv.push(0, t); pos.push(ox + ca * ww, y, oz + sa * ww + bend); uv.push(1, t); }
    for (let i = 0; i < segs; i++) { const a = base + i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  };
  { const N = 7; for (let k = 0; k < N; k++) { const a = k * 2.39996, f = (k % 3) / 3, r = 0.02 + 0.03 * ((k * 7) % 5) / 5; blade(a, 0.05 + 0.012 * (k % 3), 0.26 + 0.3 * (((k * 5) % 7) / 7), (k % 2 ? -1 : 1) * (0.06 + 0.1 * f), 3, Math.cos(a * 1.7) * r, Math.sin(a * 1.7) * r); } }
  // seed-head stalks of meadow grasses (uv.x=-4 stalk, -5 panicle): tall, thin, slightly bent
  for (let k = 0; k < 2; k++) { const a = k * 2.4 + 0.5, hgt = 0.78 + 0.2 * k, lean = 0.12 * (k ? -1 : 1), b0 = pos.length / 3, ca = Math.cos(a), sa = Math.sin(a);
    for (let i = 0; i <= 3; i++) { const t = i / 3, ww = 0.0045 * (1 - t * 0.5), y = hgt * t, bend = lean * t * t; pos.push(-ca * ww, y, -sa * ww + bend); uv.push(-4, t); pos.push(ca * ww, y, sa * ww + bend); uv.push(-4, t); }
    for (let i = 0; i < 3; i++) { const q = b0 + i * 2; idx.push(q, q + 1, q + 3, q, q + 3, q + 2); }
    const pb = pos.length / 3, top = hgt, tb = lean; const ph = 0.2;
    for (let i = 0; i <= 3; i++) { const t = i / 3, ww = 0.011 * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.12)) ; pos.push(-ca * ww, top + ph * t - 0.02, -sa * ww + tb + 0.03 * t); uv.push(-5, t); pos.push(ca * ww, top + ph * t - 0.02, sa * ww + tb + 0.03 * t); uv.push(-5, t); }
    for (let i = 0; i < 3; i++) { const q = pb + i * 2; idx.push(q, q + 1, q + 3, q, q + 3, q + 2); } }
  // flower: stem (uv.x=-3), petals (-1), centre (-2)
  { const b0 = pos.length / 3, fh = 0.46; pos.push(-0.008, 0, 0, 0.008, 0, 0, 0.008, fh, 0, -0.008, fh, 0); uv.push(-3, 0, -3, 0, -3, 1, -3, 1); idx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
    const c = pos.length / 3; pos.push(0, fh + 0.015, 0); uv.push(-2, 0); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283; pos.push(Math.cos(a) * 0.016, fh + 0.02, Math.sin(a) * 0.016); uv.push(-2, 0); } for (let k = 0; k < 6; k++) idx.push(c, c + 1 + k, c + 1 + (k + 1) % 6);
    const p0 = pos.length / 3; pos.push(0, fh + 0.008, 0); uv.push(-1, 0); for (let k = 0; k < 10; k++) { const a = k / 10 * 6.283, r = k % 2 ? 0.035 : 0.062; pos.push(Math.cos(a) * r, fh - 0.02 + (k % 2 ? 0 : 0.012), Math.sin(a) * r); uv.push(-1, 0); } for (let k = 0; k < 10; k++) idx.push(p0, p0 + 1 + k, p0 + 1 + (k + 1) % 10); }
  const tuft = new THREE.BufferGeometry(); tuft.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); tuft.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); tuft.setIndex(idx);
  const geo = new THREE.InstancedBufferGeometry(); geo.index = tuft.index; geo.attributes = tuft.attributes; geo.instanceCount = side * side; geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0, side: THREE.DoubleSide });
  const U = { uGrassCam: { value: new THREE.Vector3() }, uGrassSide: { value: side }, uGrassCell: { value: cell }, uGrassR: { value: R }, uHeight: { value: heightTex }, uHRect: { value: new THREE.Vector3(HRECT.x0, HRECT.z0, HRECT.size) },
    uMask: { value: maskTex }, uMaskRect: { value: new THREE.Vector3(MASK.x0, MASK.z0, MASK.size) }, uWind: WIND, uGrassDensity: { value: 1 },
    uFarm: { value: new THREE.Vector4(0, 0, -1, -1) }, uForestTex: { value: forestTex }, uForestRect: { value: new THREE.Vector3(forestRect.x0, forestRect.z0, forestRect.size) }, uSunDirW: AU.uSunDirW, uNight: AU.uNight, uNightG: AU.uNight, uExcl: { value: exclTex }, uExclRect: { value: new THREE.Vector3(exclRect.x0, exclRect.z0, exclRect.size) } };   // farm field rectangle (x0,z0,x1,z1) where no grass grows; set by main.js
  const edit = function grass2Edit(sh) {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>
${SEASON_GLSL}
uniform float uTime; uniform vec3 uGrassCam; uniform vec4 uFarm; uniform sampler2D uExcl; uniform vec3 uExclRect; uniform sampler2D uForestTex; uniform vec3 uForestRect; uniform vec3 uSunDirW; uniform float uNight; uniform float uGrassSide, uGrassCell, uGrassR, uWind, uGrassDensity; uniform highp sampler2D uHeight; uniform sampler2D uMask; uniform vec3 uHRect, uMaskRect;
varying vec3 vGrassCol; varying float vGrassAO; varying float vFl; varying float vU; varying float vSt;
float gh21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(gh21(i), gh21(i + vec2(1, 0)), f.x), mix(gh21(i + vec2(0, 1)), gh21(i + vec2(1, 1)), f.x), f.y); }
`)
      .replace("#include <begin_vertex>", `
        float id_ = float(gl_InstanceID); float iy_ = floor(id_ / uGrassSide), ix_ = id_ - iy_ * uGrassSide;
        vec2 gp_ = (floor(uGrassCam.xz / uGrassCell) + vec2(ix_, iy_) - uGrassSide * 0.5) * uGrassCell;
        float h1_ = gh21(gp_), h2_ = gh21(gp_ + 17.3), h3_ = gh21(gp_ + 3.9);
        gp_ += (vec2(h1_, h2_) - 0.5) * uGrassCell * 1.5;
        float dcam_ = length(gp_ - uGrassCam.xz);
        float keep_ = step(dcam_, uGrassR) * step(h3_, uGrassDensity * (1.0 - 0.9 * smoothstep(uGrassR * 0.5, uGrassR, dcam_)));
        vec2 huv_ = (gp_ - uHRect.xy) / uHRect.z; float gy_ = textureLod(uHeight, huv_, 0.0).r;
        vec2 muv_ = (gp_ - uMaskRect.xy) / uMaskRect.z; vec4 mk_ = textureLod(uMask, muv_, 0.0);
        float inMask_ = step(0.0, muv_.x) * step(muv_.x, 1.0) * step(0.0, muv_.y) * step(muv_.y, 1.0);
        float paved_ = inMask_ * max(max(mk_.r, mk_.g), mk_.b * 0.9); float rdist_ = mix(99.0, mk_.a * 24.0 - 4.0, inMask_);
        keep_ *= step(paved_, 0.12) * step(0.4, rdist_ + 0.9) * step(1.8, gy_);
        keep_ *= 1.0 - step(uFarm.x, gp_.x) * step(gp_.x, uFarm.z) * step(uFarm.y, gp_.y) * step(gp_.y, uFarm.w);   // no grass on the farm plots
        vec2 euv_ = (gp_ - uExclRect.xy) / uExclRect.z; float ex_ = (euv_.x > 0.0 && euv_.x < 1.0 && euv_.y > 0.0 && euv_.y < 1.0) ? textureLod(uExcl, euv_, 0.0).r : 0.0;
        keep_ *= 1.0 - step(0.5, ex_);   // no grass on buildings, landmarks, the wall band, the market or the castle courtyard
        vec2 fuv_ = (gp_ - uForestRect.xy) / uForestRect.z; float fo_ = (fuv_.x > 0.0 && fuv_.x < 1.0 && fuv_.y > 0.0 && fuv_.y < 1.0) ? textureLod(uForestTex, fuv_, 0.0).r : 0.0;
        keep_ *= 1.0 - fo_ * 0.5 * step(0.5, uSeason);   // summer and autumn canopy: thinner, darker understory
        float anem_ = step(uSeason, 0.5) * smoothstep(0.12, 0.4, fo_);   // spring: white wood anemones in the beech woods
        float isFl_ = step(uv.x, -0.5) * step(-3.5, uv.x), isSt_ = step(uv.x, -3.5);
        float pid_ = gh21(floor(gp_ * 0.05 + 3.0)); int ci_ = int(pid_ * 4.99); if (anem_ > 0.5) ci_ = 0;   // flower species of this patch: 0 daisy / anemone, 1 buttercup, 2 clover-vetch, 3 poppy, 4 cornflower
        float patch_ = smoothstep(0.52, 0.74, vn(gp_ * 0.05 + 7.0)); float chance_ = mix(0.015, 0.6, patch_);
        chance_ = mix(chance_, 0.8, anem_);
        float pick_ = step(gh21(gp_ * 1.7 + 9.1), chance_);
        keep_ *= mix(1.0, pick_, isFl_);
        { float gm_ = smoothstep(0.42, 0.68, vn(gp_ * 0.035 + 19.0)); float stp_ = step(gh21(gp_ * 2.3 + 4.7), 0.1 + 0.5 * gm_); keep_ *= mix(1.0, stp_ * step(0.5, uSeason + step(0.5, uSeasonT)), isSt_); }   // seed-head grasses grow in meadow patches from late spring
        keep_ *= mix(1.0, float(uSeason < 2.5 && (uSeason > 0.5 || uSeasonT > 0.5)), isFl_);   // flowers only in spring (late) to early autumn
        float sc_ = (0.7 + 0.75 * h2_) * mix(1.0, 0.65 + 0.5 * h1_, isFl_) * mix(1.0, 0.85 + 0.4 * h1_, isSt_) * mix(1.0, 1.7, anem_ * isFl_) * (1.0 + 0.35 * smoothstep(0.55, 0.8, vn(gp_ * 0.11 + 31.0)) * (1.0 - isFl_));
        float dcam_w_ = length(gp_ - uGrassCam.xz); float sideK_ = 1.0 - abs(normalize(vec3(gp_.x, gy_, gp_.y) - uGrassCam).y);
        float wide_ = (1.0 + 0.45 * sideK_ * (1.0 - isFl_)) * (1.0 + 0.6 * smoothstep(25.0, 70.0, dcam_w_));   // blades widen when seen edge-on and far away
        float ang_ = h1_ * 6.2831853; float ca_ = cos(ang_), sa_ = sin(ang_);
        vec3 lp_ = position * sc_; lp_.x *= wide_;
        if (isFl_ > 0.5 && uv.x > -1.5 && uv.x < -0.5) {   // petals: species-specific outline and cupping
          float rr_ = length(position.xz) / 0.062; float srad_[5] = float[5](1.05, 0.62, 0.5, 1.35, 1.1), slift_[5] = float[5](0.0, 0.03, 0.045, 0.035, 0.012);
          lp_.xz *= srad_[ci_]; lp_.y += slift_[ci_] * rr_ * sc_ + (ci_ == 2 ? 0.03 * (1.0 - rr_) : 0.0);
        } vec3 rp_ = vec3(ca_ * lp_.x - sa_ * lp_.z, lp_.y, sa_ * lp_.x + ca_ * lp_.z);
        float wv_ = sin(uTime * 2.1 + gp_.x * 0.7 + gp_.y * 0.5) * 0.5 + sin(uTime * 3.7 + gp_.x * 1.9) * 0.25;
        rp_.xz += vec2(wv_, wv_ * 0.6) * (0.05 + 0.15 * uWind) * (position.y / 0.5) * (position.y / 0.5);
        vec3 transformed = vec3(gp_.x + rp_.x, gy_ - 0.04 + rp_.y, gp_.y + rp_.z) * keep_ + vec3(0.0, -400.0, 0.0) * (1.0 - keep_);
        vGrassAO = mix(0.3, 1.0, clamp(position.y / 0.38, 0.0, 1.0));
        vec3 gcol_ = mix(vec3(0.06, 0.13, 0.03), vec3(0.2, 0.27, 0.06), h2_);
        gcol_ = mix(gcol_ * 0.78, gcol_ * 1.3 + vec3(0.03, 0.04, 0.0), smoothstep(0.0, 0.45, position.y));   // darker, cooler base; lighter, yellower tip
        { vec3 Vd_ = normalize(vec3(gp_.x, gy_, gp_.y) - uGrassCam); float bl_ = pow(clamp(dot(Vd_, uSunDirW), 0.0, 1.0), 4.0); gcol_ += vec3(0.16, 0.2, 0.03) * bl_ * (1.0 - uNight) * (0.5 + 0.5 * position.y); }   // light through blades when looking into the sun gcol_ = mix(gcol_, vec3(0.3, 0.25, 0.09), step(0.84, h3_) * 0.85); gcol_ *= 0.85 + 0.3 * vn(gp_ * 0.2);
        gcol_ *= uSeason < 0.5 ? mix(vec3(1.2, 1.25, 0.8), vec3(1.0), uSeasonT) : vec3(1.0);             // fresh spring green
        gcol_ = mix(gcol_, vec3(0.42, 0.34, 0.16) * (0.8 + 0.4 * h1_), seasonDry() * (0.7 + 0.3 * h2_));   // dead, straw-coloured grass in autumn / winter
        gcol_ = mix(gcol_, vec3(0.9, 0.92, 0.95), uSnow * smoothstep(0.12, 0.4, position.y) * 0.9);        // snow on blade tips and cover
        vec3 pal_[5] = vec3[5](vec3(0.62, 0.62, 0.58), vec3(0.72, 0.5, 0.03), vec3(0.4, 0.17, 0.5), vec3(0.62, 0.05, 0.035), vec3(0.16, 0.26, 0.62));   // albedo kept below ~0.65 so sunlit petals do not bloom into white blobs
        vec3 petal_ = pal_[ci_] * (0.85 + 0.3 * h1_);
        vec3 fcol_ = uv.x < -2.5 ? vec3(0.07, 0.18, 0.035) : uv.x < -1.5 ? vec3(0.62, 0.45, 0.04) : petal_;
        vec3 stCol_ = mix(mix(vec3(0.16, 0.26, 0.07), vec3(0.42, 0.36, 0.15), smoothstep(0.0, 1.0, uv.x < -4.5 ? 0.7 : 0.15)), vec3(0.5, 0.42, 0.2), seasonDry());
        vGrassCol = isSt_ > 0.5 ? stCol_ * 0.55 * (0.85 + 0.3 * h1_) : mix(gcol_, fcol_, isFl_); vFl = max(isFl_, isSt_ * 0.6); vU = uv.x; vSt = isSt_;
      `)
      .replace("#include <beginnormal_vertex>", "vec3 objectNormal = vec3(0.0, 1.0, 0.0);");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vGrassCol; varying float vGrassAO; varying float vFl; varying float vU; varying float vSt; uniform float uNightG;")
      .replace("#include <map_fragment>", "diffuseColor.rgb = vGrassCol * mix(vGrassAO, 1.0, vFl);")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * vec3(0.36, 0.5, 0.26) * 0.28 * (1.0 - uNightG);")
      .replace("#include <normal_fragment_begin>", `#include <normal_fragment_begin>
        normal = normalize(mix(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz), 0.6));`);
  };
  patch(mat, edit, "grass2"); if (csm) csmify(csm, mat);
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true;
  return { mesh, uniforms: U, mat };
}
