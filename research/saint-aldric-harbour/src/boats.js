// Procedural boats: lofted clinker hulls (outer + inner shell), thwarts, oars, masts and sails. Local frame: +x bow, +y up, z starboard.
import * as THREE from "three";
import { MeshBuilder } from "./mesh.js";
import { L } from "./textures.js";
import { mulberry32 } from "./util.js";

function hull(T, Ln, B, D, o) {
  const S = o.S ?? 14, K = o.K ?? 6, sheer = o.sheer ?? 0.5, rows = [], flat = o.flat ?? 0, lap = o.lap ?? 0;
  for (let i = 0; i <= S; i++) {
    const t = i / S, x = (t - 0.5) * Ln, e = Math.abs(2 * t - 1);
    const beam = B * 0.5 * Math.pow(Math.max(0.0001, 1 - Math.pow(e, 2.4) * 0.92), 0.7) * (t > 0.5 ? 1 : 1) * (e > 0.96 ? 0.35 : 1) * (t < 0.5 ? 0.95 : 1); // fuller midships
    const keel = -D * (1 - Math.pow(e, 3) * 0.55), gun = o.freeboard + sheer * Math.pow(e, 2.2) * (t > 0.5 ? 1.0 : 0.6);
    const ring = [];
    for (let k = 0; k <= K; k++) { const s = k / K; ring.push([x, keel + (gun - keel) * Math.pow(s, 0.85), beam * (flat * Math.pow(1 - s, 3) * (1 - Math.pow(e, 2)) + (1 - flat * Math.pow(1 - s, 3)) * Math.sin(Math.PI / 2 * Math.pow(s, 0.7)) * (0.25 + 0.75 * Math.pow(s, 0.45)))]); }
    rows.push(ring);
  }
  const plank = { mat: L.wood, tint: o.tint, ao: 1 };
  for (let i = 0; i < S; i++) for (let k = 0; k < K; k++) for (const side of [1, -1]) {
    const a = rows[i][k], b = rows[i + 1][k], c = rows[i + 1][k + 1], d = rows[i][k + 1];
    const top = p => (lap > 0 ? [p[0], p[1], Math.max(0, p[2] - lap)] : p);   // lapstrake: the upper edge of each plank sits behind the lower edge of the next one
    const P = p => [p[0], p[1], p[2] * side], inner = (p) => [p[0], p[1] + 0.05, p[2] * side * 0.92];
    // outer: outward normal points to the side; winding depends on the side
    const c2 = top(c), d2 = top(d), q = side > 0 ? [P(a), P(b), P(c2), P(d2)] : [P(b), P(a), P(d2), P(c2)];
    T.quad(q[0], q[1], q[2], q[3], { ...plank, uvFn: p => [p[0] * 1.2, p[1] * 1.0 + p[2] * 0.4], aoB: 0.8 + 0.2 * k / K, aoT: 0.8 + 0.2 * (k + 1) / K });
    const iq = side > 0 ? [inner(b), inner(a), inner(d), inner(c)] : [inner(a), inner(b), inner(c), inner(d)];
    T.quad(iq[0], iq[1], iq[2], iq[3], { mat: L.wood, tint: o.inner, ao: 0.6 + 0.4 * (k / K), uvFn: p => [p[0] * 1.5, p[1] * 1.5] });
  }
  if (flat > 0) for (let i = 0; i < S; i++) { const a = rows[i][0], b = rows[i + 1][0];   // flat bottom plate (both windings, it is only seen through shallow water)
    for (const q of [[[a[0], a[1], -a[2]], [b[0], b[1], -b[2]], [b[0], b[1], b[2]], [a[0], a[1], a[2]]], [[a[0], a[1], a[2]], [b[0], b[1], b[2]], [b[0], b[1], -b[2]], [a[0], a[1], -a[2]]]]) T.quad(q[0], q[1], q[2], q[3], { mat: L.wood, tint: [0.25, 0.2, 0.16], ao: 0.5 }); }
  // gunwale cap
  for (let i = 0; i < S; i++) for (const side of [1, -1]) {
    const a = rows[i][K], b = rows[i + 1][K], t = 0.07;
    const A = [a[0], a[1], a[2] * side], B2 = [b[0], b[1], b[2] * side], Ai = [a[0], a[1] + 0.05, a[2] * side * 0.92], Bi = [b[0], b[1] + 0.05, b[2] * side * 0.92];
    void t; const q = side > 0 ? [A, B2, Bi, Ai] : [Ai, Bi, B2, A];
    T.quad(q[0], q[1], q[2], q[3], { mat: L.beam, tint: [1, 1, 1], ao: 1 });
  }
  // bow + transom
  const last = rows[S], first = rows[0];
  T.beam([last[0][0], last[0][1], 0], [last[K][0] + 0.1, last[K][1] + 0.04, 0], 0.1, 0.14, { mat: L.beam, tint: [1, 1, 1], up: [0, 0, 1], faces: "ABCD", ao: 1 });
  T.quad([last[0][0], last[0][1], 0], [last[K][0], last[K][1], 0.001], [last[K][0], last[K][1], -0.001], [last[0][0], last[0][1], 0], { mat: L.wood, tint: o.tint, ao: 1 });
  const tr = first[K]; const hw = tr[2];
  T.quad([first[0][0] - 0.02, first[0][1], hw * 0.3], [first[0][0] - 0.02, first[0][1], -hw * 0.3], [tr[0] - 0.02, tr[1] + 0.02, -hw], [tr[0] - 0.02, tr[1] + 0.02, hw], { mat: L.wood, tint: o.tint, ao: 1 });
  return { rows };
}

// canvas: a bulged grid of quads facing +x (both faces), hung from a yard. Top width wT, bottom width wB (metres, half-widths), bulge towards the bow.
function cloth(T, x0, yTop, yBot, wT, wB, bulge, tint, nx = 8, ny = 5, skew = 0) {
  const P = (i, j) => { const u = i / nx * 2 - 1, v = j / ny, w = wT + (wB - wT) * v; return [x0 + bulge * (1 - u * u) * Math.sin(Math.PI * (0.08 + 0.84 * v)) + skew * v, yTop + (yBot - yTop) * v + 0.25 * bulge * (1 - u * u) * Math.sin(Math.PI * v) * 0.0, u * w]; };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const A = P(i, j), B = P(i + 1, j), C = P(i + 1, j + 1), D = P(i, j + 1), sh = 0.94 + 0.06 * Math.sin((i + j * 0.5) * 2.1);
    for (const q of [[A, B, C, D], [B, A, D, C]]) T.quad(q[0], q[1], q[2], q[3], { mat: L.plaster, tint: [tint[0] * sh, tint[1] * sh, tint[2] * sh], ao: 1, uvFn: p => [p[2] * 0.35, p[1] * 0.35] });
  }
}

export function makeBoat(kind, townMat) {
  const T = new MeshBuilder(), rnd = mulberry32(kind === "row" ? 5 : kind === "fish" ? 8 : 13);
  const tints = { row: [0.6, 0.46, 0.33], fish: [0.82, 0.68, 0.54], cog: [0.85, 0.68, 0.52] };
  const dims = { row: [4.2, 1.5, 0.45, 0.28], fish: [7.6, 2.5, 0.8, 0.55], cog: [23, 7.6, 1.9, 2.4] }[kind];
  const [Ln, B, D, fb] = dims;
  hull(T, Ln, B, D, { tint: tints[kind], inner: [0.8, 0.7, 0.6], freeboard: fb, sheer: kind === "cog" ? 1.1 : 0.45, S: kind === "cog" ? 30 : kind === "fish" ? 22 : 16, K: kind === "cog" ? 10 : kind === "fish" ? 8 : 6, flat: kind === "cog" ? 0.5 : 0, lap: kind === "cog" ? 0.05 : kind === "fish" ? 0.035 : 0.025 });
  const WOOD = [0.7, 0.55, 0.4], ROPE = [0.55, 0.45, 0.32], DARK = [0.35, 0.29, 0.24];
  const beam = (a, b, w, h, tint = [0.8, 0.7, 0.6]) => T.beam(a, b, w, h, { mat: L.beam, tint, up: [0, 1, 0], faces: "ABCD", ao: 1 });
  const rope = (a, b) => beam(a, b, 0.035, 0.035, ROPE);
  const info = { kind, length: Ln, beam: B, draft: D, seat: [0, fb - 0.15, 0], oarLocks: [] };
  if (kind === "row") {
    for (const x of [-0.9, 0.3]) beam([x, fb - 0.22, -B * 0.42], [x, fb - 0.22, B * 0.42], 0.28, 0.05, [0.9, 0.8, 0.7]);
    for (const s of [-1, 1]) { T.cyl(-0.3, fb - 0.04, s * B * 0.47, 0.025, 0.025, 0.14, 6, { mat: L.beam, tint: [0.7, 0.7, 0.72], ao: 1 }); info.oarLocks.push([-0.3, fb + 0.1, s * B * 0.47]); }
    info.seat = [-0.45, fb - 0.2, 0];
    beam([Ln / 2 - 0.1, -D * 0.3, 0], [Ln / 2 + 0.12, fb + 0.45, 0], 0.07, 0.1, [0.9, 0.8, 0.7]);   // stem post
  } else if (kind === "fish") {
    for (const x of [-2.2, -0.6, 1.2]) beam([x, fb - 0.2, -B * 0.4], [x, fb - 0.2, B * 0.4], 0.3, 0.06);
    beam([Ln / 2 - 0.1, -D * 0.4, 0], [Ln / 2 + 0.35, fb + 0.9, 0], 0.12, 0.16, [0.8, 0.65, 0.5]);   // stem
    beam([-Ln / 2 + 0.1, -D * 0.3, 0], [-Ln / 2 - 0.1, fb + 0.6, 0], 0.1, 0.14, [0.8, 0.65, 0.5]);   // stern post
    beam([0.4, fb + 0.1, 0], [0.4, fb + 5.6, 0], 0.16, 0.16, WOOD);   // mast
    beam([-1.9, fb + 3.0, 0.0], [2.7, fb + 5.0, 0.0], 0.1, 0.1, WOOD);   // lug yard, peaked up aft-to-fore
    cloth(T, 0.55, fb + 4.9, fb + 1.4, 1.2, 2.5, 0.5, [1.0, 0.9, 0.75], 6, 5, 0.0);
    rope([0.4, fb + 5.5, 0], [Ln / 2 - 0.4, fb + 0.8, 0]); rope([0.4, fb + 5.5, 0], [-Ln / 2 + 0.5, fb + 0.7, 0]);
    for (const s of [-1, 1]) rope([0.4, fb + 5.2, 0], [0.2, fb + 0.4, s * B * 0.46]);
    for (let i = 0; i < 4; i++) T.cyl(-3.0 + i * 0.5, fb - 0.2, (i % 2 ? 0.5 : -0.5), 0.28, 0.26, 0.38, 8, { mat: L.wood, tint: [0.7, 0.55, 0.4], ao: 1, cap: true });
    beam([-2.6, fb + 0.2, 0.2], [-3.3, fb - 0.5, 0.2], 0.05, 0.05, DARK);
  } else {
    // cog (Kogge): straight stem and stern posts, flat clinker bottom, plank-walled castles with rails, one mast with a bulged square sail, shrouds with ratlines
    const wall = (x0, x1, y, h, hw) => { T.box((x0 + x1) / 2, y + h / 2, 0, x1 - x0, h, hw * 2, { mat: L.wood, tint: [0.48, 0.4, 0.33], ao: 1, faces: "+x-x+y+z-z" }); };
    const rail = (x0, x1, y, hw) => { for (const sg of [-1, 1]) { beam([x0, y + 0.95, sg * hw], [x1, y + 0.95, sg * hw], 0.07, 0.09, WOOD); for (let x = x0; x <= x1 + 0.01; x += 0.9) beam([x, y, sg * hw], [x, y + 0.95, sg * hw], 0.07, 0.07, WOOD); } beam([x0, y + 0.95, -hw], [x0, y + 0.95, hw], 0.07, 0.09, WOOD); };
    const ay = fb + 1.7, fy = fb + 1.1;
    wall(-11.2, -7.0, fb - 0.3, ay - fb + 0.3, 2.85); rail(-11.2, -7.0, ay, 2.85);          // aftcastle
    wall(7.0, 10.0, fb - 0.3, fy - fb + 0.3, 2.1); rail(7.0, 10.0, fy, 2.1);                  // forecastle
    beam([L_(Ln) - 0.1, -D * 0.5, 0], [L_(Ln) + 1.2, fb + 2.9, 0], 0.34, 0.38, [0.6, 0.48, 0.37]);   // stem post
    beam([-L_(Ln) + 0.1, -D, 0], [-L_(Ln) - 0.9, fb + 3.5, 0], 0.34, 0.38, [0.6, 0.48, 0.37]);   // stern post
    for (const sg of [-1, 1]) { beam([-6.2, fb + 0.9, sg * 3.15], [6.2, fb + 0.9, sg * 3.15], 0.12, 0.2, [0.55, 0.45, 0.35]); for (const x of [-4, -1, 2, 5]) beam([x, fb - 0.8, sg * 3.0], [x, fb + 0.9, sg * 3.15], 0.1, 0.16, [0.5, 0.4, 0.3]); }   // wales and beam ends
    // mast, yard, sail
    T.cyl(0.8, fb - 0.3, 0, 0.3, 0.17, 21.5, 8, { mat: L.beam, tint: [0.7, 0.55, 0.42], ao: 1, cap: true });
    T.cyl(0.8, fb + 16.9, 0, 0.12, 0.08, 1.2, 8, { mat: L.beam, tint: [0.7, 0.55, 0.42], ao: 1, cap: true });   // masthead
    beam([0.55, fb + 16.5, -6.4], [0.55, fb + 16.5, 6.4], 0.22, 0.22, [0.7, 0.55, 0.42]);   // yard
    cloth(T, 0.62, fb + 16.3, fb + 5.0, 6.1, 6.6, 2.1, [0.98, 0.92, 0.8], 10, 7, -0.3);
    beam([0.55, fb + 5.0, -6.6], [0.55, fb + 5.0, 6.6], 0.07, 0.07, ROPE);
    for (const sg of [-1, 1]) for (let k = 0; k < 3; k++) {   // shrouds + ratlines
      const gx = -1.4 + k * 1.5, gz = sg * 3.05;
      rope([0.8, fb + 15.5, sg * 0.25], [gx, fb + 1.0, gz]);
      for (let r = 1; r <= 9; r++) { const t = r / 10, y = fb + 1.0 + t * 14.5, z = sg * (3.05 - t * 2.8), x = gx + (0.8 - gx) * t; if (k < 2) beam([x, y, z], [x + 1.5 * (1 - t) + 0.2, y, z * (1 - 0.05)], 0.02, 0.02, ROPE); }
    }
    rope([0.8, fb + 17, 0], [10.2, fb + fy - fb + 0.5, 0]); rope([0.8, fb + 17, 0], [-10.8, ay + 1.0, 0]);   // fore- and backstay
    for (const sg of [-1, 1]) { rope([0.55, fb + 16.5, sg * 6.4], [9.2, fy + 1.0, sg * 1.6]); rope([0.55 + 2.2, fb + 5.0, sg * 6.6], [-9, ay + 0.9, sg * 2.7]); }   // braces / sheets
    // rudder hung on the stern post with a tiller, anchor at the bow, hatch with cargo
    T.box(-12.2, -0.4, 0, 0.35, 2.9, 0.55, { mat: L.wood, tint: [0.4, 0.33, 0.28], ao: 1, faces: "+x-x+y-y+z-z" });
    beam([-12.2, fb - 0.2, 0], [-9.2, ay + 0.35, 0], 0.1, 0.1, DARK);
    T.box(-3.0, fb - 0.2, 0, 3.0, 0.35, 2.4, { mat: L.wood, tint: [0.45, 0.37, 0.3], ao: 1, faces: "+x-x+y+z-z" });   // hatch coaming
    for (let i = 0; i < 6; i++) T.cyl(-4.2 + (i % 3) * 0.9, fb + 0.2, (i < 3 ? -0.5 : 0.5), 0.3, 0.28, 0.5, 8, { mat: L.wood, tint: [0.7, 0.55, 0.4], ao: 1, cap: true });
    for (const sg of [-1, 1]) { beam([8.4, fy + 0.1, sg * 2.0], [8.4, fy - 1.4, sg * 2.3], 0.1, 0.1, [0.25, 0.25, 0.28]); beam([8.4, fy - 1.4, sg * 2.3], [8.4, fy - 1.9, sg * 2.4], 0.4, 0.07, [0.25, 0.25, 0.28]); }   // anchors hung at the bow
    // pennant
    T.quad([0.8, fb + 18.2, 0], [0.8 - 2.2, fb + 18.0, 0.02], [0.8 - 2.2, fb + 17.6, 0.02], [0.8, fb + 17.8, 0], { mat: L.plaster, tint: [0.75, 0.15, 0.1], ao: 1 });
    T.quad([0.8, fb + 17.8, 0], [0.8 - 2.2, fb + 17.6, 0.02], [0.8 - 2.2, fb + 18.0, 0.02], [0.8, fb + 18.2, 0], { mat: L.plaster, tint: [0.75, 0.15, 0.1], ao: 1 });
  }
  const geo = T.toGeometry(), mesh = new THREE.Mesh(geo, townMat); mesh.castShadow = true; mesh.receiveShadow = true;
  const g = new THREE.Group(); g.add(mesh); g.userData.info = info; g.userData.mesh = mesh;
  void rnd; return g;
}
const L_ = Ln => Ln / 2;

export function makeOar(townMat, len = 2.1) {
  const T = new MeshBuilder();
  T.beam([0, 0, 0], [len, 0, 0], 0.05, 0.05, { mat: L.beam, tint: [0.95, 0.85, 0.7], up: [0, 1, 0], faces: "ABCD", ao: 1 });
  T.box(len + 0.3, 0, 0, 0.6, 0.02, 0.17, { mat: L.wood, tint: [0.9, 0.8, 0.65], ao: 1 });
  T.beam([-0.5, 0, 0], [0, 0, 0], 0.07, 0.07, { mat: L.beam, tint: [1, 1, 1], up: [0, 1, 0], faces: "ABCD", ao: 1 });
  const m = new THREE.Mesh(T.toGeometry(), townMat); m.castShadow = true; return m;
}
