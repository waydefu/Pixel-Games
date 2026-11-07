// Procedural fish, crab and boot: lofted bodies with fins, eyes and per-vertex colour. Pure (no Three.js): returns
// plain typed arrays, so it is testable in Node. Axes: x runs from the tail (0) to the nose (length), y is up,
// z is the fish's right. Lengths are in metres; the game scales them for display.
const RING = 16, STATIONS = 18;

const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const shade = (c, k) => [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k)];
const clamp01 = v => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };

/**
 * Each species: length (m), a body profile of [t, half-height, half-width] from the tail (t=0) to the nose (t=1), colours,
 * fins as [start t, end t, height] and a pattern (stripes, spots or blotches).
 */
export const FISH_SPECS = Object.freeze({
  mackerel: { length: .34, profile: [[0, .006, .004], [.12, .02, .014], [.4, .052, .036], [.68, .05, .034], [.9, .028, .02], [1, .008, .008]],
    back: "#27637a", flank: "#8fb3c2", belly: "#eef2f2", fin: "#37525e", iris: "#c9d4d8", pattern: "bars",
    dorsal: [.4, .6, .05], dorsals: [[.42, .62, .05], [.2, .3, .022]], finlets: 5, tail: [.085, .5], pectoral: .05, anal: [.2, .3, .02], anals: [[.2, .3, .02]] },
  herring: { length: .24, profile: [[0, .005, .003], [.12, .016, .01], [.45, .036, .022], [.72, .034, .02], [.92, .018, .012], [1, .006, .006]],
    back: "#3f6b80", flank: "#b9c8d0", belly: "#f4f6f6", fin: "#8fa0aa", iris: "#e8e8e0", pattern: "silver",
    dorsal: [.4, .55, .03], tail: [.058, .45], pectoral: .035, anal: [.2, .3, .016] },
  cod: { length: .6, profile: [[0, .01, .008], [.12, .04, .028], [.42, .1, .07], [.7, .097, .066], [.9, .055, .04], [1, .016, .014]],
    back: "#7a6c3c", flank: "#a39366", belly: "#eee6cc", fin: "#6a5d38", iris: "#cfae52", pattern: "mottled",
    dorsal: [.3, .75, .075], dorsals: [[.62, .82, .07], [.38, .58, .078], [.18, .34, .055]], tail: [.115, .6], pectoral: .08, anal: [.15, .4, .05], anals: [[.3, .52, .05], [.12, .28, .04]], barbel: true },
  flounder: { length: .36, flat: true, profile: [[0, .004, .014], [.15, .01, .06], [.45, .012, .105], [.72, .012, .09], [.92, .008, .04], [1, .004, .012]],
    back: "#7a6847", flank: "#8a7652", belly: "#f1ead9", fin: "#74633f", iris: "#d9b45a", pattern: "flounder",
    dorsal: [.12, .95, .03], tail: [.032, .72], pectoral: .0, anal: [.15, .9, .03] },
  lure: { length: .1, profile: [[0, .004, .003], [.15, .014, .01], [.45, .026, .018], [.75, .024, .016], [.93, .014, .01], [1, .006, .006]],
    back: "#c99f2a", flank: "#dfe4e6", belly: "#f3f5f5", fin: "#b83a2a", iris: "#f4e9a0", pattern: "lure",
    dorsal: [.45, .6, .012], tail: [.022, .5], pectoral: 0, anal: [.3, .4, .008] },
  salmon: { length: .7, profile: [[0, .008, .006], [.12, .036, .026], [.42, .09, .06], [.7, .088, .058], [.9, .04, .03], [1, .014, .012]],
    back: "#4a6a80", flank: "#b8c6ce", belly: "#f4d9cc", fin: "#b87a68", iris: "#d6b050", pattern: "spots",
    dorsal: [.4, .6, .06], adipose: .2, tail: [.105, .42], pectoral: .07, anal: [.2, .3, .035] },
});

function pushQuad(out, a, b, c, d, color) {
  for (const p of [a, b, c, a, c, d]) { out.positions.push(...p); out.colors.push(...color); }
}
function pushTri(out, a, b, c, color) {
  for (const p of [a, b, c]) { out.positions.push(...p); out.colors.push(...color); }
}
/** A flat fan (an eye, a disc) in the plane through `c` whose normal is `n`, radius r. */
function pushDisc(out, c, u, v, r, color, segments = 10) {
  for (let i = 0; i < segments; i++) {
    const a0 = i / segments * Math.PI * 2, a1 = (i + 1) / segments * Math.PI * 2;
    pushTri(out, c, [c[0] + (u[0] * Math.cos(a0) + v[0] * Math.sin(a0)) * r, c[1] + (u[1] * Math.cos(a0) + v[1] * Math.sin(a0)) * r, c[2] + (u[2] * Math.cos(a0) + v[2] * Math.sin(a0)) * r],
      [c[0] + (u[0] * Math.cos(a1) + v[0] * Math.sin(a1)) * r, c[1] + (u[1] * Math.cos(a1) + v[1] * Math.sin(a1)) * r, c[2] + (u[2] * Math.cos(a1) + v[2] * Math.sin(a1)) * r], color);
  }
}
/** A fin: n strips from a base curve to an edge curve; alternate strips are darker so the rays read. */
function pushFin(out, base, edge, n, color, rays = true) {
  for (let i = 0; i < n; i++) {
    const f0 = i / n, f1 = (i + 1) / n, c = rays && i % 2 ? shade(color, .8) : color;
    pushQuad(out, base(f0), base(f1), edge(f1), edge(f0), c);
  }
}
/** A thin three-sided tube through points (hooks, rings). */
function pushTube(out, points, r, color) {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len = Math.hypot(...d) || 1;
    const t = d.map(x => x / len), ref = Math.abs(t[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
    const u = [t[1] * ref[2] - t[2] * ref[1], t[2] * ref[0] - t[0] * ref[2], t[0] * ref[1] - t[1] * ref[0]], ul = Math.hypot(...u) || 1;
    const U = u.map(x => x / ul * r), V = [t[1] * U[2] - t[2] * U[1], t[2] * U[0] - t[0] * U[2], t[0] * U[1] - t[1] * U[0]];
    const ring = p => [0, 1, 2].map(k => { const a0 = k / 3 * Math.PI * 2; return [p[0] + U[0] * Math.cos(a0) + V[0] * Math.sin(a0), p[1] + U[1] * Math.cos(a0) + V[1] * Math.sin(a0), p[2] + U[2] * Math.cos(a0) + V[2] * Math.sin(a0)]; });
    const ra = ring(a), rb = ring(b);
    for (let k = 0; k < 3; k++) pushQuad(out, ra[k], ra[(k + 1) % 3], rb[(k + 1) % 3], rb[k], color);
  }
}

/** Lofted fish body with fins, gills, mouth and eyes. Non-indexed triangles with per-vertex colour. */
export function buildFish(kind) {
  const { out, L } = fishParts(kind);
  return finish(out, L);
}

/** Catmull-Rom resampling of the authored profile into smooth stations. */
function stationsOf(spec) {
  const pts = spec.profile, L = spec.length, n = pts.length, result = [];
  const at = (i, k) => pts[Math.min(n - 1, Math.max(0, i))][k];
  for (let s = 0; s < STATIONS; s++) {
    const t = s / (STATIONS - 1), f = t * (n - 1);
    let i = Math.min(n - 2, Math.floor(f)); const u = f - i;
    // the authored t values are not evenly spaced, so interpolate along index and read t from the same curve
    const cr = k => {
      const p0 = at(i - 1, k), p1 = at(i, k), p2 = at(i + 1, k), p3 = at(i + 2, k);
      return .5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
    };
    const tt = clamp01(cr(0)), h = Math.max(.0015, cr(1)), w = Math.max(.0015, cr(2));
    result.push({ x: tt * L, h: (spec.flat ? w : h) * .82, w: (spec.flat ? h : w) * .9, t: tt });
  }
  result[0].t = 0; result[0].x = 0; result[STATIONS - 1].t = 1; result[STATIONS - 1].x = L;
  return result;
}

function fishParts(kind) {
  const spec = FISH_SPECS[kind];
  if (!spec) throw new RangeError("unknown fish " + kind);
  const L = spec.length, back = hex(spec.back), flank = hex(spec.flank || spec.back), belly = hex(spec.belly), fin = hex(spec.fin), dark = mix(back, [0, 0, 0], .5);
  const out = { positions: [], colors: [] };
  const stations = stationsOf(spec);
  const ring = (s, i) => {
    const a = i / RING * Math.PI * 2, sy = Math.sin(a);
    return [s.x, sy * s.h * (sy < 0 ? .92 : 1), Math.cos(a) * s.w];
  };
  // Smooth base colour at a ring corner (countershaded back to flank to belly, a faint lateral line, a scale sheen) ...
  const baseColor = (s, i) => {
    const a = i / RING * Math.PI * 2, up = Math.sin(a), u = clamp01((up + 1) / 2);   // 0 on the belly, 1 on the back
    let c = u < .5 ? mix(belly, flank, smooth(.18, .46, u)) : mix(flank, back, smooth(.56, .86, u));
    if (!spec.flat && Math.abs(up - .12) < .1 && s.t > .15 && s.t < .8) c = mix(c, mix(flank, dark, .5), .25);
    return shade(c, .965 + .035 * Math.sin(s.t * 80) * Math.sin(a * 9));
  };
  // ... and the species pattern, decided per cell so the markings stay crisp: [target colour, amount] or null.
  const cellPattern = (s, i) => {
    const a = (i + .5) / RING * Math.PI * 2, up = Math.sin(a), upper = up > .05 || spec.flat;
    if (s.t > .74 && s.t < .79 && up > -.75) return [dark, .5];                                                  // the gill cover's edge
    if (s.t > .955 && up < -.1) return [dark, .75];                                                              // the mouth
    if (kind === "lure" && s.t > .72 && s.t < .8) return [[.78, .1, .08], 1];                                    // painted red gill
    switch (spec.pattern) {
      case "bars": if (up > .12 && Math.sin(s.t * 40 + Math.sin(a * 2.5 + 1) * 1.7) > .3) return [[.05, .12, .16], .85 * smooth(.12, .5, up)]; break;
      case "spots": if (up > -.05 && hash(Math.floor(s.t * 46), i + Math.floor(s.t * 7)) > .84) return [[.04, .05, .06], .85]; break;
      case "mottled":
        if (Math.abs(up - .1) < .09 && s.t > .15 && s.t < .85) return [[.95, .93, .82], .55];                    // the pale lateral line of a cod
        if (upper && Math.sin(s.t * 23 + Math.sin(a * 3) * 2) * Math.sin(s.t * 9 - a * 2.3) > .15) return [shade(back, .55), .55]; break;
      case "flounder":
        if (upper && hash(Math.floor(s.t * 30), i) > .91) return [[.85, .46, .16], .8];                          // orange spots
        if (upper && Math.sin(s.t * 29 + i * 1.7) * Math.sin(s.t * 13 - i * 2.9) > .2) return [shade(back, .6), .6]; break;
      case "lure": if (up > .1 && Math.sin(s.t * 34) > .45) return [shade(back, .55), .7]; break;
      default: break;
    }
    return null;
  };
  for (let k = 0; k < stations.length - 1; k++) {
    for (let i = 0; i < RING; i++) {
      const s0 = stations[k], s1 = stations[k + 1], pat = cellPattern(s1, i);
      const col = (s, j) => { const c = baseColor(s, j); return pat ? mix(c, pat[0], pat[1]) : c; };
      const q = [ring(s0, i), ring(s0, i + 1), ring(s1, i + 1), ring(s1, i)], c = [col(s0, i), col(s0, i + 1), col(s1, i + 1), col(s1, i)];
      for (const idx of [0, 1, 2, 0, 2, 3]) { out.positions.push(...q[idx]); out.colors.push(...c[idx]); }
    }
  }
  const body = (t, side = 0) => {
    // point on the back (side 0), belly (side 1) or right flank (side 2) at fraction t of the length
    let k = 0; while (k < stations.length - 2 && t > stations[k + 1].t) k++;
    const s0 = stations[k], s1 = stations[k + 1], f = clamp01((t - s0.t) / (s1.t - s0.t || 1));
    const h = s0.h + (s1.h - s0.h) * f, w = s0.w + (s1.w - s0.w) * f, x = s0.x + (s1.x - s0.x) * f;
    return side === 0 ? [x, h, 0] : side === 1 ? [x, -h * .92, 0] : [x, 0, w];
  };
  const flat = !!spec.flat;
  // ---- dorsal and anal fins: sails with rays (a flounder wears a fringe round its whole edge) ----
  const dorsals = spec.dorsals || [spec.dorsal], anals = spec.anals || (spec.anal ? [spec.anal] : []);
  if (flat) {
    for (const side of [1, -1]) {
      const [t0, t1, fh] = spec.dorsal;
      pushFin(out, f => { const p = body(t0 + (t1 - t0) * f, 2); return [p[0], 0, side * p[2]]; },
        f => { const p = body(t0 + (t1 - t0) * f, 2); return [p[0] - L * .01, 0, side * (p[2] + fh * (.55 + .45 * Math.sin(Math.PI * f)))]; }, 18, fin);
    }
  } else {
    for (const [t0, t1, fh] of dorsals) {
      pushFin(out, f => body(t0 + (t1 - t0) * f, 0),
        f => { const p = body(t0 + (t1 - t0) * f, 0); return [p[0] - L * .035 * f, p[1] + fh * (1 - .55 * f) * smooth(0, .12, f + .04), 0]; }, 6, fin);
    }
    for (const [t0, t1, fh] of anals) {
      pushFin(out, f => body(t0 + (t1 - t0) * f, 1),
        f => { const p = body(t0 + (t1 - t0) * f, 1); return [p[0] - L * .03 * f, p[1] - fh * (1 - .5 * f) * smooth(0, .12, f + .04), 0]; }, 5, fin);
    }
  }
  // mackerel finlets: a row of tiny fins on the back and the belly toward the tail
  for (let i = 0; i < (spec.finlets || 0); i++) {
    const t = .07 + i * .026;
    for (const side of [0, 1]) {
      const a = body(t, side), b = body(t + .02, side), sg = side ? -1 : 1;
      pushTri(out, a, b, [b[0] - L * .018, b[1] + sg * L * .02, 0], shade(fin, .85));
    }
  }
  if (spec.adipose) { const a = body(.2, 0), b = body(.27, 0); pushTri(out, a, b, [b[0] - L * .012, b[1] + L * .028, 0], shade(fin, .9)); }
  // pelvic fins under the belly
  if (!flat) for (const side of [1, -1]) {
    const root = body(.62, 1); root[2] = side * stations[8].w * .25;
    pushTri(out, root, [root[0] - L * .045, root[1] - L * .05, root[2] + side * L * .02], [root[0] - L * .07, root[1] - L * .015, root[2] + side * L * .012], shade(fin, .9));
  }
  // ---- forked tail with rays: its root is the tail end of the body (x = 0) and it trails behind, toward -x ----
  const [th, fork] = spec.tail, tailBase = stations[0].x, tl = L * .21, TAIL = 12;
  const tailEdge = f => { const y = (f * 2 - 1) * th; return [tailBase - tl * (fork + (1 - fork) * Math.pow(Math.abs(f * 2 - 1), 1.3)), y, 0]; };
  const tailRoot = f => [tailBase, (f * 2 - 1) * th * .12, 0];
  pushFin(out, tailRoot, tailEdge, TAIL, fin);
  // ---- pectoral fins ----
  if (spec.pectoral > 0) {
    for (const side of [1, -1]) {
      const root = body(.64, 2); root[2] *= side; root[1] -= stations[8].h * .22;
      pushFin(out, f => [root[0] - L * .012 * f, root[1] - spec.pectoral * .25 * f, root[2]],
        f => [root[0] - L * (.05 + .07 * f), root[1] - spec.pectoral * (.9 - .5 * f), root[2] + side * spec.pectoral * (.5 + .5 * Math.sin(f * 2.4))], 5, fin);
    }
  }
  // ---- eyes: gold iris, black pupil, a bright catch-light (both on the top for a flounder) ----
  const eyeT = .86, ex = body(eyeT, 2), eh = body(eyeT, 0)[1], er = Math.max(.007, L * .026);
  for (const side of [1, -1]) {
    const c = flat ? [ex[0], eh + .002, side * ex[2] * .38] : [ex[0], eh * .2, side * (ex[2] + .0015)];
    const u = [1, 0, 0], v = flat ? [0, 0, 1] : [0, 1, 0];
    pushDisc(out, c, u, v, er * 1.15, shade(hex(spec.iris || "#d4b24a"), .55), 12);          // dark socket
    const c2 = flat ? [c[0], c[1] + .0006, c[2]] : [c[0], c[1], c[2] + side * .0006];
    pushDisc(out, c2, u, v, er * .95, hex(spec.iris || "#d4b24a"), 12);
    const c3 = flat ? [c[0], c[1] + .0012, c[2]] : [c[0], c[1], c[2] + side * .0012];
    pushDisc(out, c3, u, v, er * .55, [.02, .02, .03], 10);
    const c4 = flat ? [c[0] + er * .3, c[1] + .0018, c[2] - er * .2] : [c[0] + er * .3, c[1] + er * .3, c[2] + side * .0018];
    pushDisc(out, c4, u, v, er * .18, [1, 1, 1], 6);
  }
  // ---- mouth line along each flank, and a nostril dot ----
  if (!flat) for (const side of [1, -1]) {
    const m0 = [L, -stations[STATIONS - 1].h * .2, 0], m1 = body(.94, 2); m1[1] = -stations[STATIONS - 3].h * .22; m1[2] *= side * .96;
    pushQuad(out, m0, m1, [m1[0], m1[1] - .0022, m1[2]], [m0[0], m0[1] - .0022, m0[2]], shade(dark, .5));
  }
  if (spec.barbel) { const m = body(.97, 1); pushTube(out, [m, [m[0] + .012, m[1] - .02, m[2]], [m[0] - .004, m[1] - .045, m[2]]], .0016, shade(back, .9)); }
  return { out, L };
}

/** A minnow lure: a small painted plug with a diving lip, an eye, split rings and two treble hooks. About 10 cm. */
export function buildLure() {
  const { out, L } = fishParts("lure"), steel = [.82, .84, .86], smoke = [.35, .5, .56];
  // diving lip under the nose: a smoky polycarbonate bill
  pushQuad(out, [L * .97, -.011, -.011], [L * 1.12, -.03, -.013], [L * 1.12, -.03, .013], [L * .97, -.011, .011], smoke);
  // a line-tie eye on the nose and split rings carrying two treble hooks under the belly
  pushTube(out, [[L * 1.0, .0, 0], [L * 1.035, .004, 0], [L * 1.06, 0, 0], [L * 1.035, -.004, 0], [L * 1.0, 0, 0]], .0009, steel);
  for (const x of [L * .3, L * .76]) {
    const ringPts = []; for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI * 2; ringPts.push([x + Math.cos(a) * .0045, -.025 + Math.sin(a) * .0045, 0]); }
    pushTube(out, ringPts, .0009, steel);
    pushTube(out, [[x, -.0295, 0], [x, -.04, 0]], .0011, steel);                                   // the shank
    for (let k = 0; k < 3; k++) {                                                                  // three barbed points curving back up
      const a = k / 3 * Math.PI * 2 + .5, ca = Math.cos(a), sa = Math.sin(a);
      pushTube(out, [[x, -.04, 0], [x + ca * .003, -.0455, sa * .003], [x + ca * .0085, -.0475, sa * .0085], [x + ca * .0125, -.0425, sa * .0125], [x + ca * .0118, -.0385, sa * .0118]], .0008, steel);
    }
  }
  return finish(out, L * 1.12);
}

/** The tackle box: the lures the player can switch between. Every model has its line-tie nose toward +x. */
export const LURES = Object.freeze([
  Object.freeze({ id: "minnow", name: "米諾硬餌" }),
  Object.freeze({ id: "spoon", name: "亮片湯匙" }),
  Object.freeze({ id: "frog", name: "雷蛙" }),
  Object.freeze({ id: "jig", name: "鉛頭鉤軟蟲" }),
]);
export function buildLureKind(id) {
  switch (id) {
    case "spoon": return buildSpoon();
    case "frog": return buildFrog();
    case "jig": return buildJig();
    default: return buildLure();
  }
}

/** A tube lofted along a path with a radius at each point (ribs, tails, legs). */
function pushLoft(out, path, radii, colorAt, sides = 8) {
  const rings = path.map((p, k) => {
    const q = path[Math.min(path.length - 1, k + 1)], o = path[Math.max(0, k - 1)];
    const t = [q[0] - o[0], q[1] - o[1], q[2] - o[2]], len = Math.hypot(...t) || 1, tn = t.map(v => v / len);
    const ref = Math.abs(tn[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
    const u = [tn[1] * ref[2] - tn[2] * ref[1], tn[2] * ref[0] - tn[0] * ref[2], tn[0] * ref[1] - tn[1] * ref[0]], ul = Math.hypot(...u) || 1;
    const U = u.map(v => v / ul), V = [tn[1] * U[2] - tn[2] * U[1], tn[2] * U[0] - tn[0] * U[2], tn[0] * U[1] - tn[1] * U[0]];
    const r = Array.isArray(radii[k]) ? radii[k] : [radii[k], radii[k]];
    return Array.from({ length: sides }, (_, i) => { const a = i / sides * Math.PI * 2; return [0, 1, 2].map(c => p[c] + U[c] * Math.cos(a) * r[0] + V[c] * Math.sin(a) * r[1]); });
  });
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < sides; i++) {
    pushQuad(out, rings[k][i], rings[k][(i + 1) % sides], rings[k + 1][(i + 1) % sides], rings[k + 1][i], colorAt(k, i));
  }
  const cap = (ring, c) => { const m = [0, 1, 2].map(k => ring.reduce((a, p) => a + p[k], 0) / ring.length); for (let i = 0; i < ring.length; i++) pushTri(out, m, ring[i], ring[(i + 1) % ring.length], c); };
  cap(rings[0], colorAt(0, 0)); cap(rings[rings.length - 1], colorAt(rings.length - 2, 0));
}
const STEEL = [.82, .84, .86];
/** A single or double hook: shank, bend and a barbed point, in the x/y plane at height y0 behind x0. */
function pushHook(out, x0, y0, z0, scale = 1) {
  pushTube(out, [[x0, y0, z0], [x0 - .006 * scale, y0 - .014 * scale, z0], [x0 - .004 * scale, y0 - .026 * scale, z0], [x0 + .006 * scale, y0 - .03 * scale, z0], [x0 + .013 * scale, y0 - .022 * scale, z0], [x0 + .012 * scale, y0 - .012 * scale, z0]], .0009 * scale, STEEL);
  pushTri(out, [x0 + .012 * scale, y0 - .012 * scale, z0 + .0012], [x0 + .012 * scale, y0 - .012 * scale, z0 - .0012], [x0 + .009 * scale, y0 - .016 * scale, z0], STEEL);   // the barb
}
function pushRing(out, c, r, color, tube = .0009) {
  const pts = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI * 2; pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2]]); }
  pushTube(out, pts, tube, color);
}

/** A casting spoon: a cupped, hammered silver-and-brass blade with a nose hole, a split ring and a red-tufted single hook. */
function buildSpoon() {
  const out = { positions: [], colors: [] }, L = .07, halfW = .0155, U = 12, V = 5;
  const silver = [.86, .88, .9], brass = [.86, .66, .26];
  const pt = (iu, iv) => {
    const u = iu / U, w = halfW * Math.pow(Math.sin(Math.PI * (.1 + .8 * u)), .7) * (1.05 - .45 * u), z = iv / V * w;
    return [L * u, .006 * (1 - (iv / V) ** 2) * Math.sin(Math.PI * (.05 + .9 * u)) + .005 * Math.sin(Math.PI * u) - .004, z];
  };
  for (let iu = 0; iu < U; iu++) for (let iv = -V; iv < V; iv++) {
    const hammer = hash(iu * 3 + 1, iv + 9) > .7 ? .93 : 1, c = shade(Math.abs(iv) < 2 ? silver : mix(silver, brass, .55), hammer);
    pushQuad(out, pt(iu, iv), pt(iu + 1, iv), pt(iu + 1, iv + 1), pt(iu, iv + 1), iu % 2 ? shade(c, .94) : c);
  }
  pushRing(out, [L * .96, -.004, 0], .0034, STEEL, .0008);                                   // the line hole's eyelet
  pushRing(out, [-.002, -.004, 0], .0042, STEEL, .0009);                                     // split ring at the tail
  pushHook(out, -.002, -.008, 0, 1.15);
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; pushTri(out, [-.002, -.03, 0], [-.012 + Math.cos(a) * .003, -.046, Math.sin(a) * .005], [-.004 + Math.cos(a) * .004, -.048, Math.sin(a) * .006], [.8, .1, .08]); }
  return finish(out, L);
}

/** A hollow-body frog: green back with dark spots, yellow belly, bulging eyes, folded legs and a soft skirt. */
function buildFrog() {
  const out = { positions: [], colors: [] }, L = .07, green = [.31, .55, .22], dark = [.1, .22, .1], yellow = [.9, .83, .38];
  const prof = [[0, .004, .01], [.18, .014, .021], [.55, .019, .024], [.85, .014, .018], [1, .004, .007]];
  const SIDES = 14, ST = 9;
  const at = f => { const x = f * (prof.length - 1), i = Math.min(prof.length - 2, Math.floor(x)), u = x - i; return [prof[i][0] + (prof[i + 1][0] - prof[i][0]) * u, prof[i][1] + (prof[i + 1][1] - prof[i][1]) * u, prof[i][2] + (prof[i + 1][2] - prof[i][2]) * u]; };
  const ringAt = (k, j) => { const [t, h, w] = at(k / (ST - 1)), a = j / SIDES * Math.PI * 2; return [t * L, Math.sin(a) * h * (Math.sin(a) < 0 ? .7 : 1), Math.cos(a) * w]; };
  for (let k = 0; k < ST - 1; k++) for (let j = 0; j < SIDES; j++) {
    const up = Math.sin((j + .5) / SIDES * Math.PI * 2), spot = up > .1 && hash(k * 5, j) > .78;
    pushQuad(out, ringAt(k, j), ringAt(k, j + 1), ringAt(k + 1, j + 1), ringAt(k + 1, j), spot ? dark : up < -.15 ? yellow : mix(yellow, green, smooth(-.15, .5, up)));
  }
  for (const side of [1, -1]) {
    // bulging eyes on the top of the head
    const e = [L * .86, .02, side * .012];
    pushDisc(out, e, [1, 0, 0], [0, 0, 1], .0058, shade(green, .8), 10);
    pushDisc(out, [e[0], e[1] + .0012, e[2]], [1, 0, 0], [0, 0, 1], .0045, [.92, .86, .3], 10);
    pushDisc(out, [e[0], e[1] + .0022, e[2]], [1, 0, 0], [0, 0, 1], .0024, [.02, .02, .02], 8);
    // folded back legs: thigh, shank and a webbed foot
    const leg = [[L * .3, .004, side * .026], [L * .12, .006, side * .04], [-.006, .002, side * .034], [-.016, .001, side * .024]];
    pushLoft(out, leg, [.0045, .0036, .0026, .002], (k) => (k % 2 ? shade(green, .9) : green), 6);
    pushTri(out, leg[3], [-.03, .001, side * .016], [-.03, .001, side * .034], mix(yellow, green, .4));
  }
  // soft skirt: a bundle of thin strands trailing behind
  for (let k = 0; k < 9; k++) {
    const a = (k / 9 - .5) * 1.7, strand = [[.004, 0, Math.sin(a) * .008], [-.014, -.002 + Math.cos(a) * .001, Math.sin(a) * .016], [-.034, -.004, Math.sin(a) * .026]];
    pushLoft(out, strand, [.0016, .0012, .0006], () => (k % 2 ? yellow : [.55, .75, .3]), 4);
  }
  // the weedless double hook folded flat on the back
  for (const side of [1, -1]) pushTube(out, [[L * .55, .03, side * .004], [L * .3, .03, side * .012], [L * .16, .019, side * .014]], .0009, STEEL);
  pushRing(out, [L * 1.02, .002, 0], .003, STEEL, .0008);
  return finish(out, L * 1.04);
}

/** A jig head with a curled soft-plastic grub: round red head with an eye, ribbed chartreuse body, paddle tail. */
function buildJig() {
  const out = { positions: [], colors: [] }, L = .075, red = [.82, .2, .14], lime = [.7, .88, .22];
  const sides = 14, head = (la, lo) => [L * .86 + Math.cos(la) * .0095, Math.sin(la) * Math.cos(lo) * .0095, Math.sin(la) * Math.sin(lo) * .0095];
  for (let i = 0; i < 8; i++) for (let j = 0; j < sides; j++) {
    const la0 = i / 8 * Math.PI, la1 = (i + 1) / 8 * Math.PI, lo0 = j / sides * Math.PI * 2, lo1 = (j + 1) / sides * Math.PI * 2;
    pushQuad(out, head(la0, lo0), head(la0, lo1), head(la1, lo1), head(la1, lo0), shade(red, .85 + .25 * Math.cos(la0)));
  }
  for (const side of [1, -1]) { const e = [L * .86 + .0045, .003, side * .0082]; pushDisc(out, e, [1, 0, 0], [0, 1, 0], .0034, [.96, .96, .94], 10); pushDisc(out, [e[0] + .0004, e[1], e[2] + side * .0004], [1, 0, 0], [0, 1, 0], .0019, [.02, .02, .02], 8); }
  // the hook eye and shank rising from the head, the bend lying along the grub
  pushRing(out, [L * .86 - .004, .0112, 0], .0034, STEEL, .0008);
  pushTube(out, [[L * .86, .0085, 0], [L * .5, .008, 0], [L * .22, .0075, 0], [L * .1, .002, 0], [L * .13, -.005, 0], [L * .17, -.002, 0]], .0009, STEEL);
  // the grub: a ribbed curl from the head back and up to a paddle tail
  const path = [], radii = [];
  for (let k = 0; k <= 12; k++) { const u = k / 12; path.push([L * .78 - u * L * .78, .0005 + .014 * u * u, 0]); radii.push((.0085 * (1 - .78 * u)) * (k % 2 ? 1.14 : .95)); }
  pushLoft(out, path, radii, k => (k % 2 ? shade(lime, .88) : lime), 10);
  const tip = path[path.length - 1];
  pushTri(out, tip, [tip[0] - .016, tip[1] + .006, .009], [tip[0] - .016, tip[1] + .006, -.009], shade(lime, 1.05));
  pushTri(out, tip, [tip[0] - .016, tip[1] + .006, -.009], [tip[0] - .016, tip[1] + .006, .009], shade(lime, .95));
  return finish(out, L);
}

function box(out, cx, cy, cz, sx, sy, sz, color) {
  const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
  const v = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  for (const [a, b, c, d] of [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]]) pushQuad(out, v[a], v[b], v[c], v[d], color);
}

/** A crab: domed shell, eight legs, two claws, eye stalks. */
export function buildCrab() {
  const out = { positions: [], colors: [] }, shell = hex("#c8553a"), light = hex("#e8866a"), dark = hex("#8a3624");
  const L = .14;
  const profile = [[0, .002, .002], [.12, .03, .06], [.5, .045, .085], [.88, .03, .06], [1, .002, .002]];
  for (let k = 0; k < profile.length - 1; k++) for (let i = 0; i < RING; i++) {
    const p = (s, j) => { const a = j / RING * Math.PI * 2; return [s[0] * L, Math.max(0, Math.sin(a)) * s[1] * 1.1 + Math.min(0, Math.sin(a)) * s[1] * .3, Math.cos(a) * s[2]]; };
    pushQuad(out, p(profile[k], i), p(profile[k], i + 1), p(profile[k + 1], i + 1), p(profile[k + 1], i), mix(dark, shell, Math.sin(i / RING * Math.PI * 2) > 0 ? .8 : .3));
  }
  for (const side of [1, -1]) {
    for (let i = 0; i < 4; i++) box(out, L * (.25 + i * .15), .012, side * .09, .012, .012, .07, dark);
    box(out, L * .98, .03, side * .06, .05, .03, .03, light);                 // claw arm
    box(out, L * 1.18, .035, side * .075, .05, .035, .045, shell);           // claw
    box(out, L * .92, .055, side * .02, .006, .02, .006, dark);                // eye stalk
  }
  return finish(out, L * 1.2);
}

/** An old leather boot with a sole and a worn cuff: the rare joke catch. */
export function buildBoot() {
  const out = { positions: [], colors: [] }, leather = hex("#4a3a2a"), sole = hex("#26201a"), mud = hex("#6b5b3a");
  box(out, .1, .09, 0, .11, .22, .09, leather);             // shaft
  box(out, .1, .205, 0, .13, .035, .105, mud);              // cuff
  box(out, .16, .035, 0, .24, .07, .09, leather);           // foot
  box(out, .17, .005, 0, .26, .03, .1, sole);               // sole
  box(out, .1, .02, 0, .1, .04, .095, sole);                // heel
  return finish(out, .28);
}

function finish(out, length) {
  return { positions: new Float32Array(out.positions), colors: new Float32Array(out.colors), length, triangles: out.positions.length / 9 };
}

export function buildCatchModel(id) {
  if (id === "lure") return buildLure();
  if (id === "crab") return buildCrab();
  if (id === "boot") return buildBoot();
  return buildFish(id);
}
