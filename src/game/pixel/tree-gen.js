// Procedural trees: recursive tapered branches carrying many small leaf cards.
// Pure geometry (typed arrays, no Three.js) so it is deterministic and unit-testable.
//
// Structure follows the well-known branch-level parameterisation used by ez-tree
// (github.com/dgreenheck/ez-tree, MIT): trunk = level 0, each level has its own length, radius,
// sections, children, start, angle, taper, gnarliness and twist, plus an upward/downward force.
// This is an original, compact implementation tuned for the pixel world and our own leaf sprites.
import { makeRng } from "./painter.js";

export const TREE_SPECIES = Object.freeze(["oak", "birch", "pine"]);
export const TREE_DETAIL = Object.freeze(["high", "low"]);

// Per level arrays are indexed by level 0..3 (0 = trunk). Lengths and radii are world units.
const PRESETS = {
  oak: {
    levels: 3, length: [2.7, 1.6, 1.3, 0.85], radius: [0.21, 0.11, 0.07, 0.04], sections: [7, 5, 3, 2], segments: [8, 6, 4, 3],
    children: [6, 4, 3], angle: [0, 56, 58, 34], start: [0, 0.46, 0.08, 0.12], taper: [0.7, 0.45, 0.69, 0.75],
    gnarl: [0.07, 0.16, 0.2, 0.1], force: 0.045, cone: 0, spiral: 137.5,
    leaf: { sheet: "oak", cards: 3, tipCards: 3, size: 1.2, variance: 0.32, start: 0.25, crossed: true, spread: 0.4 },
  },
  birch: {
    levels: 2, length: [4.1, 0.95, 0.9, 0.5], radius: [0.10, 0.045, 0.03, 0.02], sections: [9, 4, 3, 2], segments: [6, 4, 3, 3],
    children: [11, 3], angle: [0, 68, 36, 20], start: [0, 0.36, 0.3, 0], taper: [0.45, 0.4, 0.6, 0.7],
    gnarl: [0.05, 0.14, 0.16, 0.05], force: 0.03, cone: 0.15, spiral: 137.5,
    leaf: { sheet: "birch", cards: 3, tipCards: 3, size: 0.95, variance: 0.3, start: 0.2, crossed: true, spread: 0.3 },
  },
  pine: {
    levels: 1, length: [5.2, 1.75, 0.8, 0.5], radius: [0.14, 0.03, 0.02, 0.02], sections: [9, 3, 2, 2], segments: [7, 3, 3, 3],
    children: [36], angle: [0, 104, 30, 20], start: [0, 0.2, 0.3, 0], taper: [0.95, 0.5, 0.6, 0.7],
    gnarl: [0.025, 0.05, 0.05, 0], force: -0.05, cone: 0.92, spiral: 137.5,
    leaf: { sheet: "pine", frond: true, cards: 3, size: 1.0, variance: 0.18, start: 0.1 },
  },
};

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const perp = a => norm(Math.abs(a[1]) < 0.9 ? cross(a, [0, 1, 0]) : cross(a, [1, 0, 0]));
/** Rotate v about unit axis by angle (Rodrigues). */
const rotate = (v, axis, angle) => {
  const c = Math.cos(angle), s = Math.sin(angle), d = dot(axis, v), x = cross(axis, v);
  return [v[0] * c + x[0] * s + axis[0] * d * (1 - c), v[1] * c + x[1] * s + axis[1] * d * (1 - c), v[2] * c + x[2] * s + axis[2] * d * (1 - c)];
};

class MeshBuilder {
  constructor() { this.positions = []; this.normals = []; this.uvs = []; this.colors = []; this.indices = []; }
  get vertexCount() { return this.positions.length / 3; }
  vertex(p, n, uv, c = [1, 1, 1]) { this.positions.push(...p); this.normals.push(...n); this.uvs.push(...uv); this.colors.push(...c); }
  tri(a, b, c) { this.indices.push(a, b, c); }
  toArrays() {
    return {
      positions: new Float32Array(this.positions), normals: new Float32Array(this.normals), uvs: new Float32Array(this.uvs),
      colors: new Float32Array(this.colors), indices: new Uint32Array(this.indices),
    };
  }
}

/** A tapered tube along a polyline with per-point radii (parallel-transport frames). */
function addTube(mesh, points, radii, sides, vScale = 1) {
  const first = mesh.vertexCount;
  let normal = perp(norm(sub(points[1], points[0])));
  let v = 0;
  for (let i = 0; i < points.length; i++) {
    const t = norm(sub(points[Math.min(points.length - 1, i + 1)], points[Math.max(0, i - 1)]));
    normal = norm(sub(normal, mul(t, dot(normal, t))));
    const binormal = cross(t, normal);
    if (i) v += len(sub(points[i], points[i - 1])) * vScale;
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * Math.PI * 2, d = add(mul(normal, Math.cos(a)), mul(binormal, Math.sin(a)));
      mesh.vertex(add(points[i], mul(d, radii[i])), d, [s / sides, v]);
    }
  }
  for (let i = 0; i < points.length - 1; i++) {
    for (let s = 0; s < sides; s++) {
      const a = first + i * (sides + 1) + s, b = a + sides + 1;
      mesh.tri(a, b, a + 1); mesh.tri(a + 1, b, b + 1);
    }
  }
}

/**
 * @param {"oak"|"birch"|"pine"} species
 * @param {number} seed
 * @param {"high"|"low"} detail  high: crossed, double-sided cards (town trees); low: sparse single cards (distant forest)
 */
export function generateTree(species, seed = 1, detail = "high") {
  const P = PRESETS[species];
  if (!P) throw new RangeError("Unknown tree species: " + String(species));
  if (!TREE_DETAIL.includes(detail)) throw new RangeError("Unknown tree detail: " + String(detail));
  const low = detail === "low";
  const maxLevel = low ? Math.min(1, P.levels) : P.levels; // distant trees: trunk + one tier of limbs
  const rand = makeRng(seed * 7919 + species.length * 131 + 17);
  const trunk = new MeshBuilder(), leaves = new MeshBuilder();
  const terminals = []; // { points, level }
  const rv = () => [rand() - 0.5, rand() - 0.5, rand() - 0.5];

  function grow(start, dir, level, lengthScale, radiusScale) {
    const sections = Math.max(2, low ? Math.ceil(P.sections[level] * 0.55) : P.sections[level]);
    const sides = low ? 3 : P.segments[level];
    const L = P.length[level] * lengthScale, r0 = P.radius[level] * radiusScale;
    const points = [start], radii = [level === 0 ? r0 * (low ? 1.25 : 1.5) : r0];
    let d = dir;
    for (let i = 1; i <= sections; i++) {
      d = norm(add(add(d, mul(rv(), P.gnarl[level] * 2)), [0, P.force * (level + 1), 0]));
      points.push(add(points[i - 1], mul(d, L / sections)));
      radii.push(r0 * (1 - (i / sections) * (1 - P.taper[level])) * (i === sections ? 0.35 : 1));
    }
    if (level === 0 && sections >= 2) radii[1] = r0; // flare only the first ring
    addTube(trunk, points, radii, sides);
    const childCount = level < maxLevel ? Math.max(1, Math.round(P.children[level] * (low && P.cone > 0.5 ? 0.35 : 1))) : 0;
    for (let c = 0; c < childCount; c++) {
      const t = P.start[level + 1] + (1 - P.start[level + 1]) * ((c + rand() * 0.5) / childCount);
      const idx = Math.min(sections - 1, Math.floor(t * sections));
      const base = points[idx], axis = norm(sub(points[idx + 1], points[idx]));
      const yaw = ((c * P.spiral + rand() * 40) * Math.PI) / 180;
      const side = rotate(perp(axis), axis, yaw);
      const out = norm(rotate(axis, side, (P.angle[level + 1] * Math.PI) / 180));
      const shrink = 1 - P.cone * t; // conifers: lower branches are longer (cone silhouette)
      grow(base, out, level + 1, Math.max(0.18, shrink) * (0.85 + rand() * 0.3), 1);
    }
    if (level === maxLevel) terminals.push({ points, level });
  }
  grow([0, 0, 0], [rand() * 0.14 - 0.07, 1, rand() * 0.14 - 0.07], 0, 0.92 + rand() * 0.16, 0.92 + rand() * 0.16);

  // Crown centre: leaves are lit as a soft volume (normals point away from it), not as flat cards.
  const tips = terminals.map(t => t.points[t.points.length - 1]);
  const centre = tips.reduce((acc, p) => add(acc, p), [0, 0, 0]).map(v => v / Math.max(1, tips.length));
  centre[1] -= 0.25;
  let top = 0, radius = 0;
  for (const p of tips) { top = Math.max(top, p[1]); radius = Math.max(radius, Math.hypot(p[0] - centre[0], p[2] - centre[2])); }

  const L = P.leaf, cells = [[0, 0], [1, 0], [0, 1], [1, 1]];
  const tint = () => {
    const warm = rand() < 0.05 && species !== "pine" ? 1 : 0; // the odd turning leaf
    const b = 0.84 + rand() * 0.3;
    return warm ? [b * 1.25, b * 1.02, b * 0.55] : [b * (0.96 + rand() * 0.08), b, b * (0.88 + rand() * 0.14)];
  };
  function quad(c, right, up, normal, cell, color, flip = false) {
    const u0 = cells[cell][0] * 0.5, v0 = 1 - (cells[cell][1] + 1) * 0.5, first = leaves.vertexCount;
    const corners = [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]];
    for (const [sx, sy, su, sv] of corners) {
      leaves.vertex(add(c, add(mul(right, sx), mul(up, sy))), normal, [u0 + su * 0.5, v0 + sv * 0.5], color);
    }
    if (flip) { leaves.tri(first, first + 2, first + 1); leaves.tri(first, first + 3, first + 2); }
    else { leaves.tri(first, first + 1, first + 2); leaves.tri(first, first + 2, first + 3); }
  }
  function card(c, size, axis, cluster) {
    const out = norm(add(norm(sub(c, centre)), [0, 0.22, 0]));
    const color = tint(), cell = Math.floor(rand() * 4);
    if (L.frond) { // needle frond: lies along the branch, drooping, wide across it
      const side = norm(cross(axis, [0, 1, 0]));
      const droop = rotate(axis, side, 0.35 + rand() * 0.3);
      const right = mul(side, size * 0.5), up = mul(droop, size * 0.5);
      const centreCard = add(c, mul(droop, size * 0.45));
      quad(centreCard, right, up, out, cell, color);
      if (!low) {
        quad(centreCard, right, up, out, cell, color, true);
        const tilt = rotate(side, droop, 1.1);
        quad(centreCard, mul(tilt, size * 0.5), up, out, (cell + 1) % 4, color);
        quad(centreCard, mul(tilt, size * 0.5), up, out, (cell + 1) % 4, color, true);
      }
      return;
    }
    // Foliage cluster: a card with a random facing; high detail adds the crossing card and both faces.
    const q = norm(rv()), right0 = perp(q), up0 = cross(q, right0);
    const spin = rand() * Math.PI, right = mul(rotate(right0, q, spin), size * 0.5), up = mul(rotate(up0, q, spin), size * 0.5);
    quad(c, right, up, out, cell, color);
    if (!low) {
      quad(c, right, up, out, cell, color, true);
      const right2 = mul(norm(cross(up, q)), size * 0.5);
      quad(c, right2, up, out, (cell + 2) % 4, color);
      quad(c, right2, up, out, (cell + 2) % 4, color, true);
    }
  }
  const cardBudget = low ? 1.7 : 1;
  const sizeBoost = low ? 1.3 : 1;
  for (const t of terminals) {
    const pts = t.points, count = Math.max(1, Math.round(L.cards * cardBudget));
    for (let i = 0; i < count; i++) {
      const f = L.start + (1 - L.start) * ((i + rand() * 0.6) / count), idx = Math.min(pts.length - 2, Math.floor(f * (pts.length - 1)));
      const axis = norm(sub(pts[idx + 1], pts[idx])), c = add(pts[idx], mul(add(rv(), [0, 0.1, 0]), (L.spread || 0.3) * 1.4));
      card(c, L.size * sizeBoost * (1 + (rand() - 0.5) * 2 * L.variance), axis, false);
    }
    if (L.tipCards) for (let i = 0; i < (low ? 1 : L.tipCards); i++) {
      const tip = pts[pts.length - 1], axis = norm(sub(tip, pts[pts.length - 2]));
      card(add(tip, mul(rv(), (L.spread || 0.3) * 1.6)), L.size * sizeBoost * (1.05 + rand() * 0.25), axis, true);
    }
  }
  return { species, seed, detail, height: top, crownRadius: radius, trunk: trunk.toArrays(), leaves: leaves.toArrays() };
}

export const triangleCount = arrays => arrays.indices.length / 3;
