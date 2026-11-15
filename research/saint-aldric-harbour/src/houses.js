// Procedural medieval houses: half-timber, stone, cottages, merchant gables, warehouses. Local frame: x along the street, z towards the street, y up.
import { L } from "./textures.js";
import { MeshBuilder } from "./mesh.js";
import { dot, sub } from "./mesh.js";
import { mulberry32, clamp } from "./util.js";

export const PLASTER = [[1.0, 0.97, 0.90], [1.0, 0.86, 0.60], [1.0, 0.80, 0.70], [0.88, 0.94, 0.84], [0.88, 0.9, 0.95], [0.98, 0.92, 0.78], [0.95, 0.78, 0.55]];
const STONE_T = [[1, 1, 1], [1.05, 0.98, 0.88], [0.9, 0.92, 0.95], [1.1, 1.0, 0.85]];
const CLAY_T = [[1, 1, 1], [1.15, 0.95, 0.9], [0.85, 0.8, 0.8], [1.1, 1.05, 0.95]];
const T3 = (a, k = 1) => [a[0] * k, a[1] * k, a[2] * k];

class Face {
  constructor(o, r, n, w) { this.o = o; this.r = r; this.n = n; this.w = w; }
  P(s, y, d = 0) { return [this.o[0] + this.r[0] * s + this.n[0] * d, y, this.o[2] + this.r[2] * s + this.n[2] * d]; }
  uvFn(uo = 0, vo = 0, k = 1) { const o = this.o, r = this.r; return p => [((p[0] - o[0]) * r[0] + (p[2] - o[2]) * r[2] + uo) * k, (p[1] + vo) * k]; }
}

/** wall rectangle [ya,yb] across the whole face with openings cut out */
function cutWall(T, f, ya, yb, ops, o, gy) {
  const xs = new Set([0, f.w]); for (const op of ops) { xs.add(clamp(op.s0, 0, f.w)); xs.add(clamp(op.s1, 0, f.w)); }
  const S = [...xs].sort((a, b) => a - b);
  const emit = (sa, sb, y0, y1) => {
    if (sb - sa < 1e-3 || y1 - y0 < 1e-3) return;
    if (y0 <= gy + 0.01 && y1 - y0 > 1.25 && o.aoGround) { emit(sa, sb, y0, y0 + 1.2); emit(sa, sb, y0 + 1.2, y1); return; }
    T.quad(f.P(sa, y0), f.P(sb, y0), f.P(sb, y1), f.P(sa, y1), { mat: o.mat, tint: o.tint, aoB: (y0 <= gy + 0.01 && o.aoGround && y1 - y0 <= 1.25) ? 0.45 : 1, aoT: 1, uvFn: f.uvFn(o.uo || 0, o.vo || 0) });
  };
  for (let k = 0; k < S.length - 1; k++) {
    const sa = S[k], sb = S[k + 1], mid = (sa + sb) / 2;
    const blk = ops.filter(op => op.s0 < mid && mid < op.s1).sort((a, b) => a.ya - b.ya);
    let y = ya; for (const op of blk) { if (op.ya > y + 1e-3) emit(sa, sb, y, op.ya); y = Math.max(y, op.yb); }
    if (y < yb - 1e-3) emit(sa, sb, y, yb);
  }
}

function opening(T, G, f, op, st) {
  const d = op.depth ?? 0.14, { s0, s1, ya, yb } = op, tint = st.plasterTint || [1, 1, 1];
  const rv = { mat: L.plaster, tint: T3(tint, 0.9), ao: 0.55 };   // window reveals darker (inset openings)
  T.quad(f.P(s0, ya, 0), f.P(s0, ya, -d), f.P(s0, yb, -d), f.P(s0, yb, 0), { ...rv, uvFn: f.uvFn() });
  T.quad(f.P(s1, ya, -d), f.P(s1, ya, 0), f.P(s1, yb, 0), f.P(s1, yb, -d), { ...rv, uvFn: f.uvFn() });
  T.quad(f.P(s0, yb, -d), f.P(s1, yb, -d), f.P(s1, yb, 0), f.P(s0, yb, 0), { ...rv, uvFn: f.uvFn() });
  if (op.type === "door") {
    const leaf = { mat: L.wood, tint: [0.75, 0.62, 0.5], ao: 1 };
    T.quad(f.P(s0, ya, -d - 0.04), f.P(s1, ya, -d - 0.04), f.P(s1, yb, -d - 0.04), f.P(s0, yb, -d - 0.04), { ...leaf, uvFn: f.uvFn(0, 0, 1) });
    T.quad(f.P(s0, ya, -d), f.P(s1, ya, -d), f.P(s1, ya, 0.45), f.P(s0, ya, 0.45), { mat: L.ashlar, tint: [1, 1, 1], ao: 0.9 });   // step
  } else {
    T.quad(f.P(s0, ya, 0), f.P(s1, ya, 0), f.P(s1, ya, -d), f.P(s0, ya, -d), { ...rv, tint: tint });
    const lit = st.rnd() < 0.55 ? 0.35 + st.rnd() * 0.65 : 0;
    G.quad(f.P(s0, ya, -d - 0.02), f.P(s1, ya, -d - 0.02), f.P(s1, yb, -d - 0.02), f.P(s0, yb, -d - 0.02), { mat: 0, tint: [1, 1, 1], ao: lit });
    if (st.detail >= 1) {   // frame + mullions + sill
      const fr = { mat: st.frameMat || L.beam, tint: st.frameMat ? [1.05, 1.02, 0.97] : [1, 1, 1], up: f.n, faces: "ABD", ao: 1 }, tk = 0.05, c = (s, y) => f.P(s, y, 0.02);
      T.beam(c(s0 - tk * 0.5, ya), c(s0 - tk * 0.5, yb), 0.08, 0.1, fr); T.beam(c(s1 + tk * 0.5, ya), c(s1 + tk * 0.5, yb), 0.08, 0.1, fr);
      T.beam(c(s0 - 0.08, yb + 0.03), c(s1 + 0.08, yb + 0.03), 0.08, 0.1, fr); T.beam(c(s0 - 0.1, ya - 0.02), c(s1 + 0.1, ya - 0.02), 0.1, 0.14, { ...fr, up: f.n });
      T.beam(f.P((s0 + s1) / 2, ya, -d + 0.01), f.P((s0 + s1) / 2, yb, -d + 0.01), 0.03, 0.04, fr);
      T.beam(f.P(s0, (ya + yb) / 2, -d + 0.01), f.P(s1, (ya + yb) / 2, -d + 0.01), 0.03, 0.04, fr);
      if (st.detail >= 2 && op.shutters && !st.frameMat) {   // half-timber houses keep a few wooden shutters; brick houses have none   // open shutters flat against the wall
        const w = (s1 - s0) / 2, sh = { mat: L.wood, tint: op.shutterTint, ao: 1 };
        T.quad(f.P(s0 - w - 0.04, ya, 0.035), f.P(s0 - 0.04, ya, 0.035), f.P(s0 - 0.04, yb, 0.035), f.P(s0 - w - 0.04, yb, 0.035), { ...sh, uvFn: f.uvFn(0, 0, 1) });
        T.quad(f.P(s1 + 0.04, ya, 0.035), f.P(s1 + w + 0.04, ya, 0.035), f.P(s1 + w + 0.04, yb, 0.035), f.P(s1 + 0.04, yb, 0.035), { ...sh, uvFn: f.uvFn(3, 0, 1) });
      }
    }
  }
}

function timberFrame(T, f, ya, yb, ops, st) {
  const fr = { mat: L.beam, tint: st.beamTint, up: f.n, faces: "ABD", ao: 1 }, th = 0.13, off = 0.015;
  const c = (s, y) => f.P(s, y, off);
  T.beam(c(0, ya), c(f.w, ya), 0.17, th, fr); T.beam(c(0, yb), c(f.w, yb), 0.17, th, fr);      // sill + top plate
  const n = Math.max(1, Math.round(f.w / st.bay)), step = f.w / n;
  for (let i = 0; i <= n; i++) T.beam(c(i * step, ya), c(i * step, yb), th, th, fr);        // posts
  if (st.detail >= 1) for (let i = 0; i < n; i++) {
    const s0 = i * step, s1 = (i + 1) * step;
    const win = ops.some(op => op.s0 > s0 - 0.05 && op.s1 < s1 + 0.05 && op.type === "win"); if (win) continue;
    if (st.rnd() < 0.7) { const dir = st.rnd() < 0.5; T.beam(dir ? c(s0, ya) : c(s1, ya), dir ? c(s1, yb) : c(s0, yb), 0.11, 0.1, fr); }
  }
}

/** places windows/doors for one floor of one face */
function layoutOpenings(f, ya, fh, o, st) {
  const ops = []; const wW = o.winW, wH = o.winH, sill = o.sill ?? 0.85;
  const nBays = Math.max(1, Math.round(f.w / o.winSpacing)), step = f.w / nBays;
  for (let i = 0; i < nBays; i++) {
    const sc = (i + 0.5) * step; if (o.doorAt != null && Math.abs(sc - o.doorAt) < (wW + o.doorW) / 2 + 0.35) continue;
    if (o.skip && st.rnd() < o.skip) continue;
    ops.push({ type: "win", s0: sc - wW / 2, s1: sc + wW / 2, ya: ya + sill, yb: ya + sill + wH, shutters: st.rnd() < 0.5, shutterTint: st.shutterTint });
  }
  if (o.doorAt != null) ops.push({ type: "door", s0: o.doorAt - o.doorW / 2, s1: o.doorAt + o.doorW / 2, ya: ya, yb: ya + o.doorH, depth: 0.2 });
  return ops;
}

function roofPlanes(T, R, ridgeLen, span, yEave, rise, ov, ovg, mat, tint, st) {
  // R maps ridge-space (u along ridge, v across) to local x,z. span = half depth to the eave wall. Normals are right-handed after R().
  const hx = ridgeLen / 2 + ovg, zf = span + ov, ye = yEave - ov * rise / span, yr = yEave + rise;
  const ro = { mat, tint, ao: 1, uvFn: null };
  const q = (a, b, c, d, extra) => T.quad(R(...a), R(...b), R(...c), R(...d), { ...ro, ...extra });
  const roofUV = (p0, dirU, dirV) => p => [dot(sub(p, p0), dirU), dot(sub(p, p0), dirV)];
  const sl = Math.hypot(span, rise); const dv = [0, rise / sl, 0];
  void dv;
  const mk = (sign) => {
    const A = R(-hx, ye, sign * zf), B = R(hx, ye, sign * zf), C = R(hx, yr, 0), D = R(-hx, yr, 0);
    const dU = [(B[0] - A[0]) / (2 * hx), (B[1] - A[1]) / (2 * hx), (B[2] - A[2]) / (2 * hx)], up = [D[0] - A[0], D[1] - A[1], D[2] - A[2]], l = Math.hypot(...up);
    const dV = [up[0] / l, up[1] / l, up[2] / l];
    const p0 = sign > 0 ? A : B;
    if (sign > 0) q([-hx, ye, zf], [hx, ye, zf], [hx, yr, 0], [-hx, yr, 0], { uvFn: roofUV(A, dU, dV) });
    else q([hx, ye, -zf], [-hx, ye, -zf], [-hx, yr, 0], [hx, yr, 0], { uvFn: roofUV(B, [-dU[0], -dU[1], -dU[2]], dV) });
    void p0;
    if (st.detail >= 1) {   // underside + fascia so the overhang is not paper thin
      const dk = { mat: L.wood, tint: [0.7, 0.62, 0.55], ao: 0.5 };
      const th = 0.16;
      if (sign > 0) q([hx, ye - th, zf], [-hx, ye - th, zf], [-hx, yEave - th, span], [hx, yEave - th, span], dk);
      else q([-hx, ye - th, -zf], [hx, ye - th, -zf], [hx, yEave - th, -span], [-hx, yEave - th, -span], dk);
      T.beam(R(-hx, ye, sign * zf), R(hx, ye, sign * zf), 0.07, 0.16, { mat: L.beam, tint: [1, 1, 1], up: [0, 1, 0], faces: "ABD", ao: 1 });
    }
  };
  mk(1); mk(-1);
  // ridge cap
  if (mat !== L.thatch) T.beam(R(-hx, yr + 0.03, 0), R(hx, yr + 0.03, 0), 0.22, 0.14, { mat: mat === L.slate ? L.slate : L.clay, tint, up: [0, 1, 0], faces: "ABD", ao: 1 });
  return { yr, ye, hx, zf };
}

/** North German stepped gable (Treppengiebel) on the street front: stacked brick blocks following the roof slope, coping stones on the steps and a pinnacle. Local frame must be active. */
function steppedGable(T, W, zf, yb, rise, mat, tint) {
  const n = 6, top = yb + rise + 0.5, dy = (top - yb) / n, half = W / 2;
  const hwAt = y => Math.max(0.25, half * (1 - (y - yb) / rise));
  for (let k = 0; k < n; k++) {
    const lo = yb + k * dy, hi = lo + dy, hw = k === 0 ? half : hwAt(lo);
    T.box(0, (lo + hi) / 2, zf - 0.1, hw * 2, dy + 0.02, 0.4, { mat, tint, ao: 1, faces: "+x-x+y-y+z-z" });
    if (k >= 1) for (const sx of [-1, 1]) T.box(sx * hw, lo + 0.05, zf - 0.1, 0.36, 0.14, 0.4, { mat: L.ashlar, tint: [1.05, 1.0, 0.95], ao: 1, faces: "+x-x+y-y+z-z" });   // stone coping on each step
  }
  T.box(0, top + 0.5, zf - 0.1, 0.35, 1.0, 0.35, { mat: L.ashlar, tint: [1.05, 1.0, 0.95], ao: 1, faces: "+x-x+y-y+z-z" });   // apex pinnacle
}

export function houseGeometry(T, G, b, detail = 2) {
  const rnd = mulberry32(b.seed || 1);
  const st = { rnd, detail, frameMat: null, bay: rnd.range(1.7, 2.2), plasterTint: rnd.pick(PLASTER), beamTint: [0.9 + rnd() * 0.2, 0.9 + rnd() * 0.2, 0.9 + rnd() * 0.2], shutterTint: rnd.pick([[0.55, 0.7, 0.55], [0.5, 0.58, 0.75], [0.7, 0.35, 0.3], [0.8, 0.7, 0.5], [0.6, 0.6, 0.6]]) };
  const kind = b.kind, W = b.w, D = b.d;
  const isBrick = kind === "dielen" || kind === "brickgable";
  const brickTint = rnd.pick([[1, 1, 1], [1.05, 0.95, 0.92], [1.14, 0.8, 0.72], [1.1, 1.0, 0.8], [0.9, 0.85, 0.86], [1.2, 0.92, 0.82]]);   // red-brown, deep red, yellowish, dark-glazed mix
  T.setFrame(b.x, b.z, b.ax, b.az, b.front.nx, b.front.nz, b.y0); G.setFrame(b.x, b.z, b.ax, b.az, b.front.nx, b.front.nz, b.y0);
  const isStone = kind === "stone" || kind === "stepgable", isWare = kind === "warehouse", isCot = kind === "cottage";
  const floors = isCot ? 1 : clamp(b.floors, 1, 4);
  const fh = isWare ? [3.6, 3.0, 2.7, 2.5] : isBrick ? [3.2, 2.6, 2.6, 2.6] : [2.7, 2.45, 2.35, 2.3];
  const jetty = (kind === "timber" || kind === "tavern") && floors >= 2 && rnd() < 0.8 ? 0.42 : 0;
  const stoneT = rnd.pick(STONE_T);
  let yb = 0;
  const gy = 0;
  const roofKind = isBrick ? (rnd() < 0.5 ? L.clay : L.tileRed2) : isCot ? (rnd() < 0.85 ? L.thatch : L.clay) : isWare ? (rnd() < 0.5 ? L.slate : L.clay) : isStone ? (rnd() < 0.7 ? L.slate : L.clay) : (rnd() < 0.78 ? L.clay : L.thatch);
  const roofTint = roofKind === L.clay ? rnd.pick(CLAY_T) : roofKind === L.slate ? [1, 1, 1.02] : [1.05, 1, 0.92];
  const doorAt = clamp((rnd() < 0.5 ? -1 : 1) * rnd.range(0.2, 0.35) * W, -W / 2 + 1.2, W / 2 - 1.2);
  // footing: stone plinth
  const plinth = 0.55;
  const foot = (z0, z1, w) => {
    const fo = { mat: L.rubble, tint: [1, 1, 1], ao: 0.8 };
    T.quad([-w / 2, -0.4, z1 + 0.04], [w / 2, -0.4, z1 + 0.04], [w / 2, plinth, z1 + 0.04], [-w / 2, plinth, z1 + 0.04], { ...fo, uvFn: p => [p[0], p[1]] });
    T.quad([w / 2, -0.4, z0 - 0.04], [-w / 2, -0.4, z0 - 0.04], [-w / 2, plinth, z0 - 0.04], [w / 2, plinth, z0 - 0.04], { ...fo, uvFn: p => [p[0], p[1]] });
    T.quad([w / 2 + 0.04, -0.4, z1], [w / 2 + 0.04, -0.4, z0], [w / 2 + 0.04, plinth, z0], [w / 2 + 0.04, plinth, z1], { ...fo, uvFn: p => [p[2], p[1]] });
    T.quad([-w / 2 - 0.04, -0.4, z0], [-w / 2 - 0.04, -0.4, z1], [-w / 2 - 0.04, plinth, z1], [-w / 2 - 0.04, plinth, z0], { ...fo, uvFn: p => [p[2], p[1]] });
  };
  foot(-D / 2, D / 2, W);
  let zf = D / 2, ztop = D / 2;
  for (let k = 0; k < floors; k++) {
    const h = fh[Math.min(k, 3)] + (k === 0 && isCot ? 0.0 : 0), ya = yb; yb = ya + h;
    const jt = k >= 1 ? jetty : 0; zf = D / 2 + jt; ztop = zf;
    const style = isBrick ? "brick" : isWare ? (k === 0 ? "stone" : "plank") : isStone ? (k === 0 || rnd() < 0.3 ? "stone" : "plaster") : isCot ? (rnd() < 0.35 ? "stone" : "timber") : (k === 0 && rnd() < 0.25 ? "stone" : "timber");
    const mat = style === "stone" ? L.ashlar : style === "plank" ? L.wood : style === "brick" ? L.brick : L.plaster;
    const tint = style === "stone" ? stoneT : style === "plank" ? [1.05, 0.95, 0.85] : style === "brick" ? brickTint : st.plasterTint;
    st.plasterTint = st.plasterTint;
    const faces = [
      new Face([-W / 2, 0, zf], [1, 0, 0], [0, 0, 1], W),
      new Face([W / 2, 0, -D / 2], [-1, 0, 0], [0, 0, -1], W),
      new Face([W / 2, 0, zf], [0, 0, -1], [1, 0, 0], zf + D / 2),
      new Face([-W / 2, 0, -D / 2], [0, 0, 1], [-1, 0, 0], zf + D / 2),
    ];
    faces.forEach((f, fi) => {
      const front = fi === 0, back = fi === 1;
      const o = { mat, tint, uo: rnd() * 9, vo: 0, aoGround: k === 0 };
      st.frameMat = isBrick ? L.ashlar : null;   // stone window frames on brick houses
      const opts = isBrick
        ? { winW: k === 0 && front && kind === "dielen" ? 1.9 : 0.55, winH: k === 0 ? 2.1 : (k === floors - 1 ? 1.4 : 1.7), winSpacing: front ? 2.4 : 2.8, sill: k === 0 ? 0.95 : 0.9, doorAt: front && k === 0 ? doorAt : null, doorW: 1.2, doorH: 2.2, skip: front ? 0.05 : 0.3 }
        : isWare
        ? { winW: 0.7, winH: 1.0, winSpacing: front ? 3.2 : 4.0, sill: 1.0, doorAt: front && k === 0 ? doorAt : null, doorW: 2.2, doorH: 2.9, skip: 0.25 }
        : { winW: style === "stone" ? 0.75 : 0.9, winH: style === "stone" ? 1.1 : 1.15, winSpacing: front ? st.bay * 1.0 : 2.8, sill: k === 0 ? 0.95 : 0.8, doorAt: front && k === 0 ? doorAt : null, doorW: 1.1, doorH: 2.1, skip: front ? 0.05 : back ? 0.45 : 0.35 };
      if (k === 0 && !front && !back && !isWare) opts.skip = 0.55;
      if (!isCot || k < floors) { /* all floors get windows */ }
      const ops = layoutOpenings(f, ya, h, opts, st);
      if (kind === "brickgable" && front) for (const op of ops.slice()) if (op.type === "win") {   // pointed-arch heads: a narrower second light above each window
        const mid = (op.s0 + op.s1) / 2, hw = (op.s1 - op.s0) * 0.3;
        ops.push({ type: "win", s0: mid - hw, s1: mid + hw, ya: op.yb, yb: op.yb + (op.s1 - op.s0) * 0.45, shutters: false });
      }
      cutWall(T, f, ya, yb, ops, o, 0);
      for (const op of ops) opening(T, G, f, { ...op, shutters: op.shutters && style !== "plank" && !isBrick }, { ...st, plasterTint: tint });
      if (style === "timber") timberFrame(T, f, ya, yb, ops, st);
      if (isWare && front && k >= 1 && detail >= 1) {   // hoist beam + loading hatch
        if (k === floors - 1) { const sc = W * 0.22; T.beam(f.P(sc, yb - 0.4, 0.05), f.P(sc, yb - 0.4, 1.3), 0.16, 0.18, { mat: L.beam, tint: [1, 1, 1], up: [0, 1, 0], faces: "ABD", ao: 1 }); }
      }
    });
    if (k >= 1 && jetty > 0) {   // jetty underside + brackets
      T.quad([-W / 2, ya, D / 2], [W / 2, ya, D / 2], [W / 2, ya, D / 2 + jt], [-W / 2, ya, D / 2 + jt], { mat: L.wood, tint: [0.65, 0.58, 0.5], ao: 0.45 });   // underside: normal must point down
      if (detail >= 1) for (let i = 0; i <= Math.round(W / 1.8); i++) { const x = -W / 2 + i * W / Math.round(W / 1.8); T.beam([x, ya - 0.55, D / 2 + 0.05], [x, ya - 0.02, D / 2 + jt - 0.05], 0.13, 0.13, { mat: L.beam, tint: st.beamTint, up: [1, 0, 0], faces: "ABCD", ao: 1 }); }
    }
    if (k < floors - 1 && detail >= 1 && style !== "timber" && jetty === 0) {   // string course between floors
      T.beam([-W / 2 - 0.03, yb, D / 2 + 0.03], [W / 2 + 0.03, yb, D / 2 + 0.03], 0.12, 0.2, { mat: L.ashlar, tint: stoneT, up: [0, 0, 1], faces: "ABCD", ao: 1 });
    }
  }
  // ---- roof
  const gableFront = b.gable !== undefined ? b.gable : (kind === "stepgable" || isBrick ? true : (!isWare && !isCot && rnd() < 0.18 && W < D + 1));   // b.gable forces the ridge direction (used by __checkHouseFaces)
  const hipless = true; void hipless;
  const pitch = roofKind === L.thatch ? rnd.range(48, 56) : rnd.range(38, 50), tn = Math.tan(pitch * Math.PI / 180);
  const dTop = D / 2 + (ztop - D / 2) / 2, zc = (ztop - D / 2) / 2;   // roof span centred on the (jetty-widened) footprint
  void dTop;
  let ridgeLen, span, R;
  if (!gableFront) {
    ridgeLen = W; span = (D + (ztop - D / 2)) / 2; R = (u, y, v) => [u, y, v + zc];
  } else {
    ridgeLen = D + (ztop - D / 2); span = W / 2; R = (u, y, v) => [v, y, -u + zc];   // rotated 90 degrees: ridge runs along z (towards the street)
  }
  const rise = span * tn, ov = roofKind === L.thatch ? 0.5 : 0.38, ovg = roofKind === L.thatch ? 0.4 : 0.3;
  const rp = roofPlanes(T, R, ridgeLen, span, yb, rise, ov, ovg, roofKind, roofTint, st);
  // gable triangles (end walls in the roof space)
  const gm = isBrick ? L.brick : isStone || isWare ? L.ashlar : L.plaster, gt = isBrick ? brickTint : isStone ? stoneT : st.plasterTint;
  const gfaceOf = (uSign) => {
    // end wall at u = +-ridgeLen/2 (in ridge space)
    const u = uSign * ridgeLen / 2, A = R(u, yb, -span), B = R(u, yb, span), C = R(u, yb + rise, 0);
    const outward = uSign > 0 ? [R(1, 0, 0)[0] - R(0, 0, 0)[0], 0, R(1, 0, 0)[2] - R(0, 0, 0)[2]] : [-(R(1, 0, 0)[0] - R(0, 0, 0)[0]), 0, -(R(1, 0, 0)[2] - R(0, 0, 0)[2])];
    const n = [(B[1] - A[1]) * 0, 0, 0]; void n; void outward;
    // choose winding so the normal points outward (away from the building centre)
    const cx = (A[0] + B[0] + C[0]) / 3, cz = (A[2] + B[2] + C[2]) / 3;
    const nx = cx - 0, nz = cz - zc; const cr = (B[2] - A[2]) * (C[1] - A[1]) * 0; void cr;
    const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const nn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const flip = (nn[0] * nx + nn[2] * nz) < 0;
    const tr = flip ? [B, A, C] : [A, B, C];
    T.triFace(tr[0], tr[1], tr[2], { mat: gm, tint: gt, ao: 1, uvFn: p => [p[0] + p[2], p[1]] });
  };
  gfaceOf(1);
  if (kind === "brickgable") steppedGable(T, W, zf, yb, rise, L.brick, brickTint); else gfaceOf(-1);
  if (kind === "dielen") {   // attic: two small lit gable lights under the ridge and a hoist beam with a pulley above the door
    for (const sx of [-1, 1]) { const x = sx * W * 0.22, ay = yb + rise * 0.3; G.quad([x - 0.3, ay, zf + 0.03], [x + 0.3, ay, zf + 0.03], [x + 0.3, ay + 0.75, zf + 0.03], [x - 0.3, ay + 0.75, zf + 0.03], { mat: 0, ao: 0.3 + st.rnd() * 0.5 }); }
    T.beam([0, yb + rise * 0.7, zf + 0.05], [0, yb + rise * 0.7, zf + 1.4], 0.12, 0.12, { mat: L.beam, tint: [1, 1, 1], up: [0, 1, 0], faces: "ABCD", ao: 1 });
  }
  // chimney
  if (floors >= 1 && !(isWare && rnd() < 0.5)) {
    const side = rnd() < 0.5 ? -1 : 1, u = side * (ridgeLen / 2 - 0.85), p = R(u, 0, 0), cy = rp.yr;
    const sx = 0.8, sz = 0.7, top = cy + 1.1;
    const cm = { mat: L.ashlar, tint: [0.9, 0.85, 0.8], ao: 1 };
    T.box(p[0], (yb - 0.5 + top) / 2, p[2], sx, top - (yb - 0.5), sz, { ...cm, faces: "+x-x+z-z", uvFn: undefined });
    T.box(p[0], top + 0.08, p[2], sx + 0.2, 0.16, sz + 0.2, { ...cm, faces: "+x-x+z-z+y" });
    b.chimney = { x: p[0], y: top + 0.2, z: p[2] };
  }
  // door lantern (emissive glass at night + a real light picked up by the light pool)
  {
    const lx = clamp(doorAt + 0.9, -W / 2 + 0.4, W / 2 - 0.4), ly = 2.35;
    T.beam([lx, ly + 0.1, D / 2 + 0.02], [lx, ly + 0.1, D / 2 + 0.34], 0.03, 0.03, { mat: L.beam, tint: [0.2, 0.2, 0.22], up: [0, 1, 0], faces: "ABCD", ao: 1 });
    G.box(lx, ly - 0.05, D / 2 + 0.34, 0.14, 0.22, 0.14, { mat: 0, ao: 1 });
    const w = T.P([lx, ly, D / 2 + 0.55]); b.lamp = { x: w[0], y: w[1], z: w[2] };
  }
  // street-side extras
  if (kind === "tavern") {   // hanging sign on an iron bracket
    const sx = clamp(doorAt + 1.6, -W / 2 + 0.8, W / 2 - 0.8);
    T.beam([sx, 2.8, D / 2], [sx, 2.8, D / 2 + 1.3], 0.05, 0.05, { mat: L.beam, tint: [0.2, 0.2, 0.22], up: [0, 1, 0], faces: "ABCD", ao: 1 });
    T.box(sx, 2.35, D / 2 + 1.15, 0.05, 0.8, 0.7, { mat: L.wood, tint: [0.9, 0.7, 0.4], faces: "+x-x", ao: 1 });
    b.sign = { x: sx, y: 2.35, z: D / 2 + 1.15 };
  }
  T.resetFrame(); G.resetFrame();
  return { height: yb + rise };
}

/** Harness: builds one house of each kind with both ridge directions and reports roof-material triangles whose normal points down (inside-out or back-facing roof). */
export function __checkHouseFaces(kinds = ["timber", "cottage", "stone", "stepgable", "warehouse", "tavern", "dielen", "brickgable"], detail = 2) {
  const out = [];
  for (const kind of kinds) for (const gable of [false, true]) {
    const T = new MeshBuilder(), G = new MeshBuilder(), b = { kind, x: 0, z: 0, ax: 1, az: 0, w: 7, d: 10, floors: 2, front: { nx: 0, nz: 1 }, y0: 0, seed: 11, gable };
    houseGeometry(T, G, b, detail);
    const roofMats = new Set([L.clay, L.slate, L.thatch, L.tileRed2]);
    let roofTris = 0, down = 0, upOK = 0, outward = 0;
    for (let t = 0; t < T.mat.length; t++) {
      if (!roofMats.has(T.mat[t])) continue;
      const k = t * 3 + 0;   // vertex 0 of this triangle (3 vertices per triangle, t indexes triangles via mat array per vertex)
      void k;
    }
    for (let v = 0; v + 2 < T.mat.length; v += 3) {
      if (!roofMats.has(T.mat[v])) continue;
      roofTris++;
      const ny = T.nor[v * 3 + 1];
      if (ny < -0.01 && Math.abs(ny) > 0.5) down++; else upOK++;
      const cx = (T.pos[v * 3] + T.pos[v * 3 + 3] + T.pos[v * 3 + 6]) / 3, cy = (T.pos[v * 3 + 1] + T.pos[v * 3 + 4] + T.pos[v * 3 + 7]) / 3, cz = (T.pos[v * 3 + 2] + T.pos[v * 3 + 5] + T.pos[v * 3 + 8]) / 3;
      const nx = T.nor[v * 3], nz = T.nor[v * 3 + 2];
      if (Math.abs(ny) > 0.5 && nx * cx + ny * cy + nz * cz <= 0) outward++;   // roof planes must face away from the building centre (origin is inside the roof)
    }
    // wood underside boards at the eave that face up would show as black boards from above
    let woodUp = 0;
    for (let v = 0; v + 2 < T.mat.length; v += 3) if (T.mat[v] === L.wood && T.nor[v * 3 + 1] > 0.5 && T.pos[v * 3 + 1] > 1 && T.pos[v * 3 + 1] < 11) woodUp++;
    out.push({ kind, gable, roofTris, roofDownFacing: down, roofUp: upOK, roofInward: outward, woodUpAtEave: woodUp, ok: down === 0 && outward === 0 && roofTris > 0 });
  }
  return out;
}
