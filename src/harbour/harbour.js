// Harbour works: stone moles with a lighthouse, quay coping / fenders / stairs, a treadwheel crane, cargo props, beached boats.
import { L } from "./textures.js";
import { mulberry32, clamp } from "./util.js";

const o = (mat, tint = [1, 1, 1], ao = 1, extra = {}) => ({ mat, tint, ao, ...extra });
const nrm2 = (x, z) => { const l = Math.hypot(x, z) || 1; return [x / l, z / l]; };

/** quad on a wall line a->b whose visible side is `n` (xz normal); auto-orients the winding. y0/y1 absolute. */
function vquad(T, a, b, y0, y1, n, opt) {
  const r = [n[1], -n[0]], fwd = (b[0] - a[0]) * r[0] + (b[1] - a[1]) * r[1] >= 0, [p, q] = fwd ? [a, b] : [b, a];
  T.quad([p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]], [p[0], y1, p[1]], { uvFn: pp => [pp[0] * r[0] + pp[2] * r[1], pp[1]], ...opt });
}
function hquad(T, a, b, off0, off1, n, y, opt) {   // horizontal strip between lateral offsets off0..off1 along normal n, facing up
  const r = [n[1], -n[0]], fwd = (b[0] - a[0]) * r[0] + (b[1] - a[1]) * r[1] >= 0, [p, q] = fwd ? [a, b] : [b, a];
  const P = (pt, off) => [pt[0] + n[0] * off, y, pt[1] + n[1] * off];
  T.quad(P(p, off1), P(q, off1), P(q, off0), P(p, off0), { uvFn: pp => [pp[0], pp[2]], ...opt });   // outer edge first, then inner
}
function sloped(T, a, b, n, yTop, yBot, run, opt) {   // outward sloping face: top edge on the line, bottom edge `run` metres outwards
  const r = [n[1], -n[0]], fwd = (b[0] - a[0]) * r[0] + (b[1] - a[1]) * r[1] >= 0, [p, q] = fwd ? [a, b] : [b, a];
  T.quad([p[0] + n[0] * run, yBot, p[1] + n[1] * run], [q[0] + n[0] * run, yBot, q[1] + n[1] * run], [q[0], yTop, q[1]], [p[0], yTop, p[1]], { uvFn: pp => [pp[0] * r[0] + pp[2] * r[1], pp[1] * 1.4], ...opt });
}

function mole(W, C, poly, out, key) {
  const [cx, cz] = W.harbour.centre, DECK = 2.7, WID = 5.2, rnd = mulberry32(key);
  // resample to <= 4 m
  const pts = []; for (let i = 0; i < poly.length - 1; i++) { const a = poly[i], b = poly[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(l / 4)); for (let k = 0; k < n; k++) pts.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
  pts.push(poly[poly.length - 1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, T = C.at(mx, mz).T, t = nrm2(b[0] - a[0], b[1] - a[1]);
    let n = [-t[1], t[0]]; if ((mx - cx) * n[0] + (mz - cz) * n[1] < 0) n = [-n[0], -n[1]];   // n points away from the basin (seaward)
    const inn = [-n[0], -n[1]], h = WID / 2;
    const A0 = [a[0] + n[0] * h, a[1] + n[1] * h], B0 = [b[0] + n[0] * h, b[1] + n[1] * h], A1 = [a[0] + inn[0] * h, a[1] + inn[1] * h], B1 = [b[0] + inn[0] * h, b[1] + inn[1] * h];
    const stone = o(L.ashlar, [0.92, 0.9, 0.86], 0.95, { aoB: 0.5, aoT: 1 }), rub = o(L.rubble, [0.9, 0.88, 0.84], 0.9, { aoB: 0.4, aoT: 1 });
    vquad(T, A1, B1, -8, DECK, inn, stone);                                     // basin face: vertical ashlar
    sloped(T, A0, B0, n, DECK + 0.9, -9, 7.5, rub);                             // sea face: sloping armour of rubble
    vquad(T, [A0[0] - n[0] * 0.0, A0[1]], [B0[0], B0[1]], DECK, DECK + 0.9, n, stone);   // parapet on the sea side
    hquad(T, [a[0], a[1]], [b[0], b[1]], -h, h - 0.55, n, DECK, o(L.cobble, [0.85, 0.85, 0.82], 1));            // walkway
    hquad(T, [a[0], a[1]], [b[0], b[1]], h - 0.55, h, n, DECK + 0.9, o(L.ashlar, [1, 0.97, 0.9], 1));         // parapet cap (narrow)
    hquad(T, [a[0], a[1]], [b[0], b[1]], -h - 0.0, -h + 0.0, n, DECK, o(L.ashlar));
    // inner coping stones + bollards
    T.beam([A1[0], DECK + 0.08, A1[1]], [B1[0], DECK + 0.08, B1[1]], 0.45, 0.16, { mat: L.ashlar, tint: [1.08, 1.05, 1.0], up: [0, 1, 0], faces: "ABD", ao: 1 });
    if (i % 4 === 2) { const bx = mx + inn[0] * (h - 0.6), bz = mz + inn[1] * (h - 0.6); T.cyl(bx, DECK, bz, 0.16, 0.2, 0.5, 7, o(L.beam, [1.0, 0.95, 0.9], 1, { cap: true })); }
    out.decks.push({ x: a[0] + inn[0] * h, z: a[1] + inn[1] * h, dx: -inn[0] * 0 + n[0], dz: n[1], len: 0.01, wid: 0.01, y: DECK, seg: [a, b, h] });
    void rnd;
  }
  // deck rectangles for walking: use segment-aligned boxes expressed in the pier format (x,z origin, direction, length, width)
  out.decks = out.decks.filter(d => !d.seg);
  for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], t = nrm2(b[0] - a[0], b[1] - a[1]), l = Math.hypot(b[0] - a[0], b[1] - a[1]); out.decks.push({ x: a[0] - t[0] * 0.8, z: a[1] - t[1] * 0.8, dx: t[0], dz: t[1], len: l + 1.6, wid: WID - 0.2, y: DECK }); }
  return pts;
}

function lighthouse(W, C, x, z, out) {
  const T = C.at(x, z).T, G = C.at(x, z).G, base = 2.6, r0 = 3.3, r1 = 2.2, h = 17, n = 12;
  T.cyl(x, base - 8, z, 4.2, 4.0, 8 + 1.2, n, o(L.ashlar, [0.95, 0.92, 0.88], 0.9, { aoB: 0.5 }));
  T.cyl(x, base + 1.2, z, r0, r1, h, n, o(L.ashlar, [1.08, 1.05, 1.0], 0.95, { aoB: 0.6 }));
  T.cyl(x, base + 1.2 + h, z, r1 + 1.0, r1 + 1.0, 0.45, n, o(L.ashlar, [0.9, 0.88, 0.85], 1, { cap: true, capMat: L.cobble }));   // gallery
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; T.cyl(x + Math.cos(a) * (r1 + 0.9), base + 1.2 + h + 0.45, z + Math.sin(a) * (r1 + 0.9), 0.05, 0.05, 1.0, 5, o(L.beam, [0.3, 0.3, 0.33], 1)); }
  const ly = base + 1.2 + h + 0.45;
  for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, R = r1 - 0.35;
    G.quad([x + Math.cos(a1) * R, ly, z + Math.sin(a1) * R], [x + Math.cos(a0) * R, ly, z + Math.sin(a0) * R], [x + Math.cos(a0) * R, ly + 2.1, z + Math.sin(a0) * R], [x + Math.cos(a1) * R, ly + 2.1, z + Math.sin(a1) * R], { mat: 0, ao: 1 }); }
  T.cyl(x, ly + 2.1, z, r1 - 0.1, 0.2, 1.5, n, o(L.slate, [0.9, 0.95, 1.05], 1, { cap: true }));
  T.beam([x, ly + 3.5, z], [x, ly + 4.8, z], 0.08, 0.08, { mat: L.beam, tint: [0.3, 0.3, 0.33], up: [1, 0, 0], faces: "ABCD", ao: 1 });
  out.lamps.push({ x, y: ly + 1.0, z, power: 3 }); out.lighthouse = { x, z, y: ly };
}

function crane(C, x, z, ang, out) {
  const T = C.at(x, z).T, c = Math.cos(ang), s = Math.sin(ang), y0 = 1.45, HC = 26.5;   // tower height ~26 m (real treadwheel cranes 20-28 m)
  T.setFrame(x, z, c, s, -s, c, y0);   // local +x runs towards the sea
  const beam = (a, b, w, h, tint = [1, 1, 1]) => T.beam(a, b, w, h, { mat: L.beam, tint, up: [0, 1, 0], faces: "ABCD", ao: 1 });
  for (const [px, pz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) beam([px, 0, pz], [px * 0.62, HC, pz * 0.62], 0.36, 0.36);
  for (const y of [3, 7.5, 12, 16.5, 21, 24.5]) { const k = 1 - y / HC * 0.38; for (const [a, b] of [[[-1.4 * k, y, -1.4 * k], [1.4 * k, y, -1.4 * k]], [[1.4 * k, y, -1.4 * k], [1.4 * k, y, 1.4 * k]], [[1.4 * k, y, 1.4 * k], [-1.4 * k, y, 1.4 * k]], [[-1.4 * k, y, 1.4 * k], [-1.4 * k, y, -1.4 * k]]]) beam(a, b, 0.16, 0.16); }
  beam([-1.4, 0, -1.4], [0.9, HC * 0.5, -0.9], 0.14, 0.14); beam([1.4, 0, 1.4], [-0.9, HC * 0.5, 0.9], 0.14, 0.14);
  // jib out over the water, with a pulley and a hanging crate
  beam([-2.5, HC, 0], [8.2, HC, 0], 0.4, 0.4, [0.9, 0.85, 0.8]); beam([0, HC - 0.2, 0], [7.4, HC, 0], 0.22, 0.22); beam([0.6, HC - 0.3, 0], [6.8, HC - 1.4, 0], 0.16, 0.16);
  beam([7.4, HC - 0.1, 0], [7.4, 4.5, 0], 0.04, 0.04, [0.4, 0.35, 0.3]);
  T.box(7.4, 3.9, 0, 1.0, 0.9, 1.0, o(L.wood, [0.9, 0.75, 0.55], 1, { faces: "+x-x+y+z-z" }));
  // treadwheel: two rims joined by treads, beside the tower
  const R = 2.5, n = 12;   // wheel diameter 5 m
  for (const zz of [-2.4, -3.8]) for (let i = 0; i < n; i++) { const a0 = i / n * 6.283, a1 = (i + 1) / n * 6.283; beam([Math.cos(a0) * R, 2.6 + Math.sin(a0) * R, zz], [Math.cos(a1) * R, 2.6 + Math.sin(a1) * R, zz], 0.16, 0.16); }
  for (let i = 0; i < n; i++) { const a = i / n * 6.283; beam([Math.cos(a) * R, 2.6 + Math.sin(a) * R, -2.4], [Math.cos(a) * R, 2.6 + Math.sin(a) * R, -3.8], 0.12, 0.12); beam([0, 2.6, -3.1], [Math.cos(a) * R, 2.6 + Math.sin(a) * R, -3.1], 0.08, 0.08); }
  // little roof
  T.quad([-2.0, HC - 0.4, 2.0], [2.0, HC - 0.4, 2.0], [2.0, HC + 0.2, 0], [-2.0, HC + 0.2, 0], o(L.clay)); T.quad([2.0, HC - 0.4, -2.0], [-2.0, HC - 0.4, -2.0], [-2.0, HC + 0.2, 0], [2.0, HC + 0.2, 0], o(L.clay));
  T.resetFrame();
  out.colliders.push({ x, z, ax: c, az: s, hw: 1.6, hd: 1.6 });
}

function barrel(T, x, y, z, r = 0.34, h = 0.9, tint = [0.9, 0.7, 0.5]) {
  T.cyl(x, y, z, r * 0.88, r, h * 0.5, 10, o(L.wood, tint, 1)); T.cyl(x, y + h * 0.5, z, r, r * 0.88, h * 0.5, 10, o(L.wood, tint, 1, { cap: true }));
  for (const f of [0.12, 0.5, 0.88]) T.cyl(x, y + h * f - 0.02, z, r * (1.0 + 0.04 * (1 - Math.abs(f - 0.5) * 2)) + 0.012, r * (1.0 + 0.04 * (1 - Math.abs(f - 0.5) * 2)) + 0.012, 0.05, 10, o(L.beam, [0.35, 0.35, 0.38], 1));
}
function crate(T, x, y, z, s, yaw, tint) { T.setFrame(x, z, Math.cos(yaw), Math.sin(yaw), -Math.sin(yaw), Math.cos(yaw), y); T.box(0, s / 2, 0, s, s, s, o(L.wood, tint, 1, { faces: "+x-x+y+z-z" })); for (const e of [-1, 1]) T.box(0, s / 2, e * s / 2, s * 1.02, 0.07, 0.07, o(L.beam, [1, 1, 1], 1, { faces: "+x-x+y+z-z" })); T.resetFrame(); }
function sack(T, x, y, z, yaw) { T.setFrame(x, z, Math.cos(yaw), Math.sin(yaw), -Math.sin(yaw), Math.cos(yaw), y); T.box(0, 0.22, 0, 0.62, 0.44, 0.38, o(L.plaster, [0.9, 0.8, 0.6], 0.9, { faces: "+x-x+y+z-z" })); T.box(0, 0.46, 0, 0.4, 0.1, 0.28, o(L.plaster, [0.85, 0.75, 0.55], 0.9, { faces: "+x-x+y+z-z" })); T.resetFrame(); }

export function buildHarbourWorks(W, C, quayPts) {
  const out = { decks: [], lamps: [], colliders: [], beached: [], stairs: [] };
  const rnd = mulberry32(31415);
  // moles + lighthouse
  const ps = mole(W, C, W.harbour.moleS, out, 11), pn = mole(W, C, W.harbour.moleN, out, 12);
  const hs = ps[ps.length - 1], hn = pn[pn.length - 1];
  lighthouse(W, C, hs[0], hs[1], out);
  { // north head: small beacon (stone plinth + lantern)
    const T = C.at(hn[0], hn[1]).T, G = C.at(hn[0], hn[1]).G; T.cyl(hn[0], 2.7, hn[1], 1.0, 0.8, 3.2, 8, o(L.ashlar, [1, 1, 1], 1, { cap: true }));
    G.box(hn[0], 6.3, hn[1], 0.7, 0.8, 0.7, { mat: 0, ao: 1 }); T.cyl(hn[0], 6.7, hn[1], 0.55, 0.05, 0.6, 8, o(L.slate, [1, 1, 1], 1)); out.lamps.push({ x: hn[0], y: 6.3, z: hn[1], power: 1 });
  }
  // quay details along the shoreline
  const Q = quayPts.filter(p => Math.abs(W.coastS(p.x, p.z)) < 1.2);
  let acc = 0, nextStairs = 22, nextPost = 0, nextProp = 14;
  for (let i = 0; i < Q.length - 1; i++) {
    const a = Q[i], b = Q[i + 1], l = Math.hypot(b.x - a.x, b.z - a.z); acc += l; if (l > 12) continue;
    const gx = W.coastS(a.x + 1.5, a.z) - W.coastS(a.x - 1.5, a.z), gz = W.coastS(a.x, a.z + 1.5) - W.coastS(a.x, a.z - 1.5), sd = nrm2(gx, gz), land = [-sd[0], -sd[1]], T = C.at(a.x, a.z).T;
    const QY = 1.45;
    // coping along the quay edge
    T.beam([a.x + sd[0] * 0.02, QY + 0.07, a.z + sd[1] * 0.02], [b.x + sd[0] * 0.02, QY + 0.07, b.z + sd[1] * 0.02], 0.55, 0.16, { mat: L.ashlar, tint: [1.1, 1.07, 1.02], up: [0, 1, 0], faces: "ABD", ao: 1 });
    // timber fender piles every ~7 m
    if (acc > nextPost) { nextPost = acc + 7; T.cyl(a.x + sd[0] * 0.38, -2.2, a.z + sd[1] * 0.38, 0.17, 0.15, QY + 2.2 + 0.35, 8, o(L.beam, [1.2, 1.1, 1.0], 1, { cap: true })); }
    // stairs down to the water
    if (acc > nextStairs) {
      nextStairs = acc + 48; const ang = Math.atan2(sd[1], sd[0]);
      T.setFrame(a.x, a.z, Math.cos(ang), Math.sin(ang), -Math.sin(ang), Math.cos(ang), 0);   // local +x = towards the sea
      for (let k = 0; k < 7; k++) { const top = QY - k * 0.5, run = 0.5 * (k + 1); T.box(run / 2 + 0.02, (top - 2.6) / 2, 0, run, top + 2.6, 2.0, o(L.ashlar, [1.05, 1.02, 0.98], 0.9, { faces: "+x+y+z-z", aoB: 0.6 })); }
      T.resetFrame(); out.stairs.push({ x: a.x, z: a.z });
    }
    // cargo props on the quay slab
    if (acc > nextProp) {
      nextProp = acc + 10 + rnd() * 16; const px = a.x + land[0] * 1.9, pz = a.z + land[1] * 1.9, k = Math.floor(rnd() * 4);
      if (k === 0) { for (let u = 0; u < 3; u++) for (let v = 0; v < 2; v++) barrel(T, px + u * 0.72 - v * 0.1, QY, pz + v * 0.7, 0.34, 0.9); barrel(T, px + 0.36, QY + 0.9, pz + 0.3, 0.34, 0.9); }
      else if (k === 1) { for (let u = 0; u < 3; u++) crate(T, px + u * 1.1, QY, pz, 1.0, rnd() * 0.3, [0.85 + rnd() * 0.2, 0.75, 0.6]); crate(T, px + 0.5, QY + 1.0, pz + 0.05, 0.9, rnd() * 0.4, [0.9, 0.8, 0.65]); }
      else if (k === 2) { for (let u = 0; u < 5; u++) sack(T, px + (u % 3) * 0.7, QY + Math.floor(u / 3) * 0.42, pz + 0.1 * u, rnd() * 3); }
      else { // cart: bed, two wheels, shafts
        const yaw = Math.atan2(land[1], land[0]); T.setFrame(px, pz, Math.cos(yaw), Math.sin(yaw), -Math.sin(yaw), Math.cos(yaw), QY);
        T.box(0, 0.75, 0, 2.2, 0.12, 1.2, o(L.wood, [0.9, 0.8, 0.7], 1, { faces: "+x-x+y-y+z-z" })); for (const e of [-1, 1]) { T.box(0, 1.05, e * 0.6, 2.2, 0.5, 0.06, o(L.wood, [0.85, 0.75, 0.65], 1, { faces: "+x-x+y+z-z" })); T.cyl(0, 0.0, e * 0.72, 0.02, 0.02, 0.01, 4, o(L.beam)); for (let w = 0; w < 8; w++) { const a0 = w / 8 * 6.283; T.beam([0, 0.55, e * 0.72], [Math.cos(a0) * 0.55, 0.55 + Math.sin(a0) * 0.55, e * 0.72], 0.06, 0.06, { mat: L.beam, tint: [1, 1, 1], up: [0, 0, 1], faces: "ABCD", ao: 1 }); } }
        T.beam([1.1, 0.8, -0.3], [3.0, 0.45, -0.3], 0.07, 0.07, { mat: L.beam, tint: [1, 1, 1], up: [0, 1, 0], faces: "ABCD", ao: 1 }); T.beam([1.1, 0.8, 0.3], [3.0, 0.45, 0.3], 0.07, 0.07, { mat: L.beam, tint: [1, 1, 1], up: [0, 1, 0], faces: "ABCD", ao: 1 });
        T.resetFrame();
      }
    }
  }
  // crane near the middle of the quay
  { const q = Q[Math.floor(Q.length * 0.42)]; if (q) { const gx = W.coastS(q.x + 1.5, q.z) - W.coastS(q.x - 1.5, q.z), gz = W.coastS(q.x, q.z + 1.5) - W.coastS(q.x, q.z - 1.5), sd = nrm2(gx, gz); crane(C, q.x - sd[0] * 4.2, q.z - sd[1] * 4.2, Math.atan2(sd[1], sd[0]), out); out.crane = { x: q.x, z: q.z }; } }
  // beached rowing boats at the northern end of the shore (sand), pulled up on the slip
  for (const idx of [Math.floor(Q.length * 0.08), Math.floor(Q.length * 0.14), Math.floor(Q.length * 0.9)]) { const q = Q[idx]; if (!q) continue; const gx = W.coastS(q.x + 1.5, q.z) - W.coastS(q.x - 1.5, q.z), gz = W.coastS(q.x, q.z + 1.5) - W.coastS(q.x, q.z - 1.5), sd = nrm2(gx, gz); out.beached.push({ x: q.x - sd[0] * 2.4, z: q.z - sd[1] * 2.4, yaw: Math.atan2(sd[1], sd[0]) + (rnd() - 0.5) * 0.5 }); }
  return out;
}
