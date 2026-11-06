// Procedural fish, crab and boot: lofted bodies with fins, eyes and per-vertex colour. Pure (no Three.js): returns
// plain typed arrays, so it is testable in Node. Axes: x runs from the tail (0) to the nose (length), y is up,
// z is the fish's right. Lengths are in metres; the game scales them for display.
const RING = 12;

const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export const FISH_SPECS = Object.freeze({
  mackerel: { length: .34, profile: [[0, .006, .004], [.12, .02, .014], [.4, .052, .036], [.68, .05, .034], [.9, .028, .02], [1, .008, .008]],
    back: "#2f6f86", belly: "#e8eef0", fin: "#37525e", stripes: 9, dorsal: [.38, .62, .045], tail: [.075, .5], pectoral: .05, anal: [.2, .3, .02] },
  herring: { length: .24, profile: [[0, .005, .003], [.12, .016, .01], [.45, .036, .022], [.72, .034, .02], [.92, .018, .012], [1, .006, .006]],
    back: "#5d7f93", belly: "#f0f3f4", fin: "#9aa9b2", dorsal: [.4, .55, .028], tail: [.055, .45], pectoral: .035, anal: [.2, .3, .015] },
  cod: { length: .6, profile: [[0, .01, .008], [.12, .04, .028], [.42, .1, .07], [.7, .095, .066], [.9, .05, .036], [1, .014, .012]],
    back: "#8b7b50", belly: "#e6dcc0", fin: "#6e623f", spots: true, dorsal: [.3, .75, .075], tail: [.11, .15], pectoral: .08, anal: [.15, .4, .05], barbel: true },
  flounder: { length: .36, flat: true, profile: [[0, .004, .014], [.15, .01, .06], [.45, .012, .105], [.72, .012, .09], [.92, .008, .04], [1, .004, .012]],
    back: "#7d6b4c", belly: "#efe8d8", fin: "#6a5a40", spots: true, dorsal: [.12, .95, .03], tail: [.04, .1], pectoral: .0, anal: [.15, .9, .03] },
  lure: { length: .1, profile: [[0, .004, .003], [.15, .014, .01], [.45, .026, .018], [.75, .024, .016], [.93, .014, .01], [1, .006, .006]],
    back: "#c9a227", belly: "#e9eef0", fin: "#b83a2a", stripes: 5, dorsal: [.45, .6, .012], tail: [.02, .5], pectoral: 0, anal: [.3, .4, .008] },
  salmon: { length: .7, profile: [[0, .008, .006], [.12, .036, .026], [.42, .09, .06], [.7, .088, .058], [.9, .04, .03], [1, .012, .01]],
    back: "#5a7a8e", belly: "#f1d4c8", fin: "#c88a78", spots: true, dorsal: [.4, .6, .06], tail: [.1, .3], pectoral: .07, anal: [.2, .3, .035] },
});

function pushQuad(out, a, b, c, d, color) {
  for (const p of [a, b, c, a, c, d]) { out.positions.push(...p); out.colors.push(...color); }
}
function pushTri(out, a, b, c, color) {
  for (const p of [a, b, c]) { out.positions.push(...p); out.colors.push(...color); }
}

/** Lofted fish body with fins and eyes. Non-indexed triangles with per-vertex colour. */
export function buildFish(kind) {
  const { out, L } = fishParts(kind);
  return finish(out, L);
}

function fishParts(kind) {
  const spec = FISH_SPECS[kind];
  if (!spec) throw new RangeError("unknown fish " + kind);
  const L = spec.length, back = hex(spec.back), belly = hex(spec.belly), fin = hex(spec.fin), dark = mix(back, [0, 0, 0], .45);
  const out = { positions: [], colors: [] };
  const stations = spec.profile.map(([t, h, w]) => ({ x: t * L, h: (spec.flat ? w : h) * .82, w: (spec.flat ? h : w) * .9, t }));
  const ring = (s, i) => {
    const a = i / RING * Math.PI * 2;
    return [s.x, Math.sin(a) * s.h, Math.cos(a) * s.w];
  };
  const bodyColor = (s, i) => {
    const a = i / RING * Math.PI * 2, up = Math.sin(a);   // +1 on the back, -1 on the belly
    let c = mix(belly, back, Math.min(1, Math.max(0, up * 1.6 + .6)));
    if (spec.stripes && up > .15 && Math.sin(s.t * spec.stripes * Math.PI * 1.3 + up * 3) > .25) c = mix(c, dark, .75);
    if (spec.spots && up > .05 && Math.sin(s.t * 31 + i * 2.3) * Math.sin(s.t * 17 - i * 1.9) > .45) c = mix(c, dark, .55);
    return c;
  };
  for (let k = 0; k < stations.length - 1; k++) {
    for (let i = 0; i < RING; i++) {
      const a = ring(stations[k], i), b = ring(stations[k], i + 1), c = ring(stations[k + 1], i + 1), d = ring(stations[k + 1], i);
      pushQuad(out, a, b, c, d, bodyColor(stations[k + 1], i));
    }
  }
  const body = (t, side = 0) => {
    // point on the back (side 0), belly (side 1) or right flank (side 2) at fraction t of the length
    let k = 0; while (k < stations.length - 2 && t > stations[k + 1].t) k++;
    const s0 = stations[k], s1 = stations[k + 1], f = (t - s0.t) / (s1.t - s0.t || 1);
    const h = s0.h + (s1.h - s0.h) * f, w = s0.w + (s1.w - s0.w) * f, x = (s0.t + (s1.t - s0.t) * f) * L;
    return side === 0 ? [x, h, 0] : side === 1 ? [x, -h, 0] : [x, 0, w];
  };
  // dorsal fin (a sail along the back) and anal fin
  const [d0, d1, dh] = spec.dorsal;
  const fh = spec.flat ? 0 : 1;
  for (const side of [1, -1]) {
    const a = body(d0, 0), b = body(d1, 0);
    if (spec.flat) { a[1] = 0; b[1] = 0; a[2] = side * stations[1].w; }
    pushQuad(out, a, b, [b[0] - L * .04, b[1] + dh * (spec.flat ? 0 : 1), b[2] + (spec.flat ? side * dh : 0)], [a[0] - L * .02, a[1] + dh * (spec.flat ? 0 : 1), a[2] + (spec.flat ? side * dh : 0)], fin);
    if (spec.flat) break;
  }
  if (spec.anal) {
    const [a0, a1, ah] = spec.anal, a = body(a0, 1), b = body(a1, 1);
    pushQuad(out, a, b, [b[0] - L * .02, b[1] - ah, b[2]], [a[0], a[1] - ah, a[2]], fin);
  }
  // forked tail: its root is the tail end of the body (x = 0) and it trails behind, toward -x
  const [th, fork] = spec.tail, tailBase = stations[0].x, tl = L * .21;
  pushTri(out, [tailBase, 0, 0], [tailBase - tl, th, 0], [tailBase - tl * fork, 0, 0], fin);
  pushTri(out, [tailBase, 0, 0], [tailBase - tl * fork, 0, 0], [tailBase - tl, -th, 0], fin);
  pushTri(out, [tailBase, 0, 0], [tailBase - tl * fork, 0, 0], [tailBase - tl, th, 0], fin);
  pushTri(out, [tailBase, 0, 0], [tailBase - tl, -th, 0], [tailBase - tl * fork, 0, 0], fin);
  // pectoral fins
  if (spec.pectoral > 0) {
    for (const side of [1, -1]) {
      const root = body(.62, 2); root[2] *= side; root[1] -= stations[2].h * .25;
      pushTri(out, root, [root[0] - L * .07, root[1] - spec.pectoral * .6, root[2] + side * spec.pectoral], [root[0] - L * .13, root[1], root[2] + side * spec.pectoral * .4], fin);
    }
  }
  // eyes: dark discs on both flanks (both on the top for a flounder)
  const eyeX = .82 * L, ex = stations.find(s => s.t >= .82) || stations[stations.length - 1];
  for (const side of [1, -1]) {
    const e = spec.flat ? [eyeX, ex.h * .9, side * ex.w * .35] : [eyeX, ex.h * .25, side * ex.w * .93];
    const r = Math.max(.006, L * .022);
    pushTri(out, [e[0] + r, e[1] + r, e[2]], [e[0] - r, e[1] + r, e[2]], [e[0], e[1] - r, e[2]], [.05, .05, .06]);
    pushTri(out, [e[0] + r, e[1] + r, e[2]], [e[0], e[1] - r, e[2]], [e[0] - r, e[1] + r, e[2]], [.05, .05, .06]);
  }
  if (spec.barbel) { const m = body(.97, 1); pushTri(out, m, [m[0] + .02, m[1] - .05, m[2]], [m[0] - .01, m[1] - .045, m[2]], dark); }
  return { out, L };
}

/** A minnow lure: a small painted plug with a diving lip and two treble hooks. Lengths are real (about 10 cm). */
export function buildLure() {
  const { out, L } = fishParts("lure"), steel = [.78, .8, .82];
  // diving lip under the nose
  pushQuad(out, [L * .98, -.012, -.012], [L * 1.1, -.026, -.012], [L * 1.1, -.026, .012], [L * .98, -.012, .012], steel);
  // two treble hooks hanging from the belly: three barbed prongs each
  for (const x of [L * .32, L * .78]) {
    for (let k = 0; k < 3; k++) {
      const a = k / 3 * Math.PI * 2, dz = Math.cos(a) * .016, dy = Math.sin(a) * .006;
      pushTri(out, [x - .002, -.022, 0], [x + .002, -.022, 0], [x + .004, -.05 + dy, dz], steel);
      pushTri(out, [x + .004, -.05 + dy, dz], [x + .001 + .008, -.044 + dy, dz * 1.3], [x + .002, -.05 + dy, dz], steel);
    }
  }
  return finish(out, L * 1.1);
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
