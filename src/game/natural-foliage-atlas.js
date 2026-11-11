// Deterministic, source-generated foliage atlas for the near-field town trees.
// No runtime image downloads, canvas dependency or third-party texture license.
export const NATURAL_FOLIAGE_SIZE = 256;
const CELL = NATURAL_FOLIAGE_SIZE / 2;
const SPECIES = Object.freeze(["oak", "birch", "pine"]);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const rng = seed => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Four independently arranged foliage cards. A card is a small, airy cluster
 * of individual curved leaves, NOT a solid polygon painted green.
 * Edge coverage is antialiased for alpha-to-coverage + mipmap sampling.
 */
export function paintNaturalLeafSheet(species, seed = 1) {
  if (!SPECIES.includes(species)) throw new RangeError("Unknown foliage species: " + String(species));
  const pixels = new Uint8ClampedArray(NATURAL_FOLIAGE_SIZE ** 2 * 4);
  const palette = {
    oak: [62, 111, 53],
    birch: [75, 123, 59],
    pine: [50, 99, 65],
  }[species];

  for (let cell = 0; cell < 4; cell++) {
    const random = rng((seed * 2654435761 + cell * 1013904223 + species.length * 971) >>> 0);
    const ox = (cell & 1) * CELL, oy = (cell >> 1) * CELL;
    // Keep a generous transparent gutter to stop neighboring atlas cells bleeding at mip levels.
    const paint = (x, y, rgb, alpha) => {
      if (x < 5 || y < 5 || x >= CELL - 5 || y >= CELL - 5) return;
      const i = ((oy + y) * NATURAL_FOLIAGE_SIZE + ox + x) * 4;
      if (alpha <= pixels[i + 3]) return;
      pixels[i] = rgb[0]; pixels[i + 1] = rgb[1]; pixels[i + 2] = rgb[2];
      pixels[i + 3] = alpha;
    };

    // Draw actual tapering, twisted leaf silhouettes with midribs, diffuse
    // light gradients and per-leaf tints. Thin pine needles use the same
    // rasterizer at a much narrower aspect ratio.
    const leaf = (cx, cy, length, width, angle, variation, lobed = false) => {
      const cs = Math.cos(angle), sn = Math.sin(angle);
      const extent = Math.ceil(length + width + 2);
      for (let y = Math.floor(cy - extent); y <= cy + extent; y++) {
        for (let x = Math.floor(cx - extent); x <= cx + extent; x++) {
          const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
          const along = (dx * cs + dy * sn) / length;
          const across = (-dx * sn + dy * cs) / width;
          if (Math.abs(along) >= 1) continue;
          const taper = Math.pow(Math.max(0, 1 - along * along), lobed ? 0.58 : 0.73);
          const lobes = lobed ? 0.91 + 0.10 * Math.cos(along * Math.PI * 5) : 1;
          const edge = taper * lobes - Math.abs(across);
          const coverage = clamp(0.5 + edge * width * 1.35, 0, 1);
          if (coverage <= 0) continue;
          const rib = Math.exp(-Math.abs(across) * (species === "pine" ? 5 : 17));
          const sideLight = clamp(0.16 * (1 - across) + 0.09 * (1 - along), 0, 0.34);
          const shade = 0.63 + sideLight + variation * 0.22 + rib * 0.10;
          const shadeB = shade * (species === "pine" ? 0.96 : 0.91);
          paint(x, y, [
            Math.round(palette[0] * shade),
            Math.round(palette[1] * shade),
            Math.round(palette[2] * shadeB),
          ], Math.round(coverage * 255));
        }
      }
    };
    if (species === "pine") {
      // Feathery branchlets with paired narrow needles, rather than cones.
      for (let i = 0; i < 42; i++) {
        const theta = random() * Math.PI * 2, r = Math.sqrt(random()) * 40;
        const cx = 64 + Math.cos(theta) * r, cy = 64 + Math.sin(theta) * r;
        const direction = theta + (random() - 0.5) * 1.6;
        for (let n = 0; n < 7; n++) {
          const f = (n - 3) / 6, baseX = cx + Math.cos(direction) * f * 16, baseY = cy + Math.sin(direction) * f * 16;
          for (const side of [-1, 1]) {
            leaf(baseX + side * Math.cos(direction + Math.PI / 2) * 3,
              baseY + side * Math.sin(direction + Math.PI / 2) * 3,
              6 + random() * 5, 1.05 + random() * 0.5,
              direction + side * (0.52 + random() * 0.32),
              random() - 0.5);
          }
        }
      }
    } else {
      const total = species === "oak" ? 96 : 116;
      for (let i = 0; i < total; i++) {
        const theta = random() * Math.PI * 2, r = Math.sqrt(random()) * 45;
        const cx = 64 + Math.cos(theta) * r, cy = 64 + Math.sin(theta) * r * 0.91;
        const angle = theta + (random() - 0.5) * 2.6;
        leaf(cx, cy, (species === "oak" ? 6.5 : 7.0) + random() * 4.6,
          (species === "oak" ? 3.5 : 2.4) + random() * 2,
          angle, random() - 0.5, species === "oak");
      }
    }
  }
  return { species, size: NATURAL_FOLIAGE_SIZE, color: pixels };
}
