// Procedural world textures, painted texel by texel from the shared palette.
// Every texture is tileable, seeded, and carries a matching normal map derived from
// the same height field that drives its bevel shading, so light and paint agree.
// Density contract: 16 texels per world unit (a 32px tile spans 2 units, a 64px tile 4).
import { PALETTE } from "./palette.js";
import {
  makeRng, hash2, wrap, clamp01, smoothstep, tileNoise, voronoi, bevelLight, normalFromHeight, renderRamp,
} from "./painter.js";

export const TEXELS_PER_UNIT = 16;

function fields(size) {
  return { tone: new Float32Array(size * size), height: new Float32Array(size * size), override: new Map() };
}

/** Courses of blocks with mortar: stone walls, bricks, masonry. */
function coursedBlocks(size, seed, { rowH, wMin, wMax, base, spread, chips }) {
  const f = fields(size), rand = makeRng(seed * 977 + 13), noise = tileNoise(size, 4, seed, 2);
  for (let r = 0; r < size / rowH; r++) {
    const widths = [];
    for (let sum = 0; sum < size;) {
      let w = wMin + Math.floor(rand() * (wMax - wMin + 1));
      if (size - sum - w < wMin) w = size - sum;
      widths.push(w); sum += w;
    }
    let x0 = Math.floor(rand() * size);
    for (const w of widths) {
      const blockTone = (rand() - 0.5) * spread;
      for (let yy = 0; yy < rowH; yy++) {
        for (let xx = 0; xx < w; xx++) {
          const x = wrap(x0 + xx, size), y = r * rowH + yy, i = y * size + x;
          const mortar = xx === w - 1 || yy === rowH - 1;
          const edge = Math.min(xx, w - 1 - xx, yy, rowH - 1 - yy);
          f.height[i] = mortar ? 0 : 0.35 + 0.65 * smoothstep(0, 2.6, edge) + (noise[i] - 0.5) * 0.2;
          f.tone[i] = mortar ? 0.16 : base + blockTone + (noise[i] - 0.5) * 0.3 + (rand() < chips ? (rand() - 0.5) * 0.3 : 0);
        }
      }
      x0 += w;
    }
  }
  return { ...f, dither: 0.4, bevel: 0.95 };
}

function cobbles(size, seed) {
  const f = fields(size), v = voronoi(size, 8, seed, 0.78), noise = tileNoise(size, 8, seed + 3, 2);
  for (let i = 0; i < size * size; i++) {
    const edge = v.d2[i] - v.d1[i];
    const mortar = edge < 1.15;
    const dome = 1 - clamp01(v.d1[i] / 6.5);
    f.height[i] = mortar ? 0 : 0.3 + 0.7 * smoothstep(0, 2.4, edge) * (0.55 + 0.45 * dome);
    f.tone[i] = mortar ? 0.2 : 0.58 + (hash2(v.id[i], 3, seed) - 0.5) * 0.15 + (noise[i] - 0.5) * 0.1;
  }
  return { ...f, dither: 0.4, bevel: 1.0 };
}

function planks(size, seed, { widths, base, spread, grainAmount }) {
  const f = fields(size), rand = makeRng(seed * 311 + 5), noise = tileNoise(size, 4, seed, 2);
  let x0 = 0;
  for (const w of widths) {
    const plank = (rand() - 0.5) * spread, phase = rand() * 20, joint = Math.floor(rand() * size);
    for (let xx = 0; xx < w; xx++) {
      for (let y = 0; y < size; y++) {
        const i = y * size + wrap(x0 + xx, size);
        const gap = xx === w - 1;
        const seam = y === joint;
        const grain = Math.sin(y * 0.33 + phase + noise[i] * 3.2) * 0.5 + 0.5;
        const crown = Math.sin(Math.PI * (xx + 0.5) / (w - 1));
        f.height[i] = gap || seam ? 0 : 0.5 + 0.2 * crown + (grain - 0.5) * 0.06;
        f.tone[i] = gap || seam ? 0.14 : base + plank + (grain - 0.5) * grainAmount + (noise[i] - 0.5) * 0.12;
        if (!gap && !seam && Math.abs(y - joint) === 2 && (xx === 1 || xx === w - 3)) f.override.set(i, [34, 28, 38]);
      }
    }
    x0 += w;
  }
  return { ...f, dither: 0.25, bevel: 0.6 };
}

function plaster(size, seed) {
  const f = fields(size), coarse = tileNoise(size, 3, seed, 2), fine = tileNoise(size, 16, seed + 9, 2), rand = makeRng(seed * 53 + 1);
  for (let i = 0; i < size * size; i++) {
    f.tone[i] = 0.62 + (coarse[i] - 0.5) * 0.26 + (fine[i] - 0.5) * 0.14;
    f.height[i] = fine[i] * 0.55 + coarse[i] * 0.15;
  }
  for (let c = 0; c < 2; c++) { // hairline cracks
    let x = Math.floor(rand() * size), y = Math.floor(rand() * size);
    for (let s = 0; s < 9; s++) {
      const i = wrap(y, size) * size + wrap(x, size);
      f.tone[i] = 0.24; f.height[i] = 0;
      x += rand() < 0.5 ? 1 : 0; y += 1; if (rand() < 0.25) x -= 1;
    }
  }
  return { ...f, dither: 0.7, bevel: 1.1 };
}

function roofTiles(size, seed, { base, spread }) {
  const f = fields(size), rand = makeRng(seed * 421 + 7), noise = tileNoise(size, 4, seed, 2);
  const T = 8;
  for (let r = 0; r < size / T; r++) {
    const offset = (r % 2) * (T / 2);
    for (let c = 0; c < size / T; c++) {
      const tileTone = (rand() - 0.5) * spread;
      for (let yy = 0; yy < T; yy++) {
        for (let xx = 0; xx < T; xx++) {
          const x = wrap(c * T + xx + offset, size), y = r * T + yy, i = y * size + x;
          const edge = Math.abs(xx - 3.5) / 3.5;
          const bottom = T - 1 - Math.round(2 * edge * edge);
          if (yy > bottom || xx === T - 1) { f.height[i] = 0; f.tone[i] = 0.08; continue; }
          f.height[i] = 0.25 + 0.75 * (yy / bottom) * (0.78 + 0.22 * Math.sin(Math.PI * (xx + 0.5) / T));
          f.tone[i] = base + tileTone + (noise[i] - 0.5) * 0.18 + (yy === 0 ? 0.04 : 0);
        }
      }
    }
  }
  return { ...f, dither: 0.4, bevel: 1.7 };
}

function thatch(size, seed) {
  const f = fields(size), noise = tileNoise(size, 6, seed, 2);
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / 4), yy = y % 4;
    for (let x = 0; x < size; x++) {
      const i = y * size + x, strand = hash2(wrap(x + row * 3, size), row, seed);
      f.height[i] = yy === 3 ? 0.15 : 0.55 + (strand - 0.5) * 0.3;
      f.tone[i] = 0.5 + (strand - 0.5) * 0.34 + (noise[i] - 0.5) * 0.2 + (yy === 3 ? -0.2 : yy === 0 ? 0.08 : 0);
    }
  }
  return { ...f, dither: 0.35, bevel: 1.2 };
}

function grass(size, seed) {
  const f = fields(size), clump = tileNoise(size, 6, seed, 3), fine = tileNoise(size, 20, seed + 4, 2), rand = makeRng(seed * 59 + 3);
  for (let i = 0; i < size * size; i++) {
    f.tone[i] = 0.27 + clump[i] * 0.27 + (fine[i] - 0.5) * 0.10;
    f.height[i] = fine[i] * 0.4 + clump[i] * 0.3;
  }
  for (let t = 0; t < size * 1.4; t++) { // blade tufts: base dark, tip bright
    const x = Math.floor(rand() * size), y = Math.floor(rand() * size), lean = rand() < 0.5 ? 0 : 1;
    const stroke = [0.22, 0.52, 0.70];
    for (let k = 0; k < 3; k++) {
      const i = wrap(y - k, size) * size + wrap(x + (k === 2 ? lean : 0), size);
      f.tone[i] = stroke[k]; f.height[i] = 0.55 + k * 0.1;
    }
  }
  const flowers = [[246, 232, 190], [250, 205, 90], [226, 150, 176], [168, 190, 245]];
  for (let k = 0; k < 6; k++) {
    const x = Math.floor(rand() * size), y = Math.floor(rand() * size);
    f.override.set(wrap(y, size) * size + wrap(x, size), flowers[k % flowers.length]);
  }
  return { ...f, dither: 0.5, bevel: 1.0 };
}

function sand(size, seed) {
  const f = fields(size), n = tileNoise(size, 5, seed, 3), rand = makeRng(seed * 17 + 9);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const ripple = Math.sin((y + n[i] * 8) * 0.55 + x * 0.04) * 0.5 + 0.5;
      f.tone[i] = 0.56 + (ripple - 0.5) * 0.14 + (n[i] - 0.5) * 0.18 + (rand() < 0.012 ? (rand() - 0.5) * 0.4 : 0);
      f.height[i] = ripple * 0.5 + n[i] * 0.2;
    }
  }
  return { ...f, dither: 0.55, bevel: 1.3 };
}

function foliage(size, seed) {
  const f = fields(size), v = voronoi(size, 8, seed, 0.8), noise = tileNoise(size, 8, seed + 5, 2);
  for (let i = 0; i < size * size; i++) {
    const dome = clamp01(1 - v.d1[i] / 5.6), gap = v.d2[i] - v.d1[i] < 0.9;
    f.height[i] = gap ? 0 : 0.25 + 0.75 * dome;
    f.tone[i] = gap ? 0.1 : 0.42 + (hash2(v.id[i], 5, seed) - 0.5) * 0.24 + (noise[i] - 0.5) * 0.16;
  }
  return { ...f, dither: 0.5, bevel: 2.1 };
}

function cliff(size, seed) {
  const f = fields(size), v = voronoi(size, 12, seed, 0.9), n = tileNoise(size, 4, seed + 11, 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x, edge = v.d2[i] - v.d1[i];
      const strata = Math.sin((y + n[i] * 7) * 0.7) * 0.5 + 0.5;
      const crack = edge < 1.0;
      f.height[i] = crack ? 0 : 0.35 + 0.5 * smoothstep(0, 3.5, edge) + strata * 0.12;
      f.tone[i] = crack ? 0.12 : 0.58 + (hash2(v.id[i], 9, seed) - 0.5) * 0.18 + (strata - 0.5) * 0.1 + (n[i] - 0.5) * 0.08;
    }
  }
  return { ...f, dither: 0.2, bevel: 0.8 };
}

/** Smooth boulder: a few soft tones with large facets, so small rocks never read as noise. */
function boulder(size, seed) {
  const f = fields(size), v = voronoi(size, 16, seed, 0.8), n = tileNoise(size, 3, seed + 21, 3);
  for (let i = 0; i < size * size; i++) {
    const edge = v.d2[i] - v.d1[i];
    f.height[i] = 0.4 + 0.45 * smoothstep(0, 5, edge) + n[i] * 0.2;
    f.tone[i] = 0.55 + (hash2(v.id[i], 4, seed) - 0.5) * 0.2 + (n[i] - 0.5) * 0.12 - (edge < 0.9 ? 0.12 : 0);
  }
  return { ...f, dither: 0.12, bevel: 0.9 };
}

function canvasCloth(size, seed) {
  const f = fields(size), n = tileNoise(size, 6, seed, 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x, stripe = Math.floor(x / 6) % 2, weave = (x + y) & 1;
      f.height[i] = weave * 0.3 + n[i] * 0.1;
      f.tone[i] = (stripe ? 0.88 : 0.46) + (weave ? 0.035 : -0.035) + (n[i] - 0.5) * 0.08;
    }
  }
  return { ...f, dither: 0.2, bevel: 1.0 };
}

/** kind -> recipe. `slope` marks roof-like kinds that project along the slope. */
export const PIXEL_KINDS = Object.freeze({
  stone:       { size: 32, ramp: "stone",    normal: 1.5, slope: false, build: (s) => coursedBlocks(32, s, { rowH: 8, wMin: 9, wMax: 15, base: 0.56, spread: 0.18, chips: 0.03 }) },
  brick:       { size: 32, ramp: "brick",    normal: 2.2, slope: false, build: (s) => coursedBlocks(32, s, { rowH: 4, wMin: 8, wMax: 8, base: 0.54, spread: 0.2, chips: 0.05 }) },
  cobble:      { size: 64, ramp: "stone",    normal: 1.6, slope: false, build: (s) => cobbles(64, s) },
  planks:      { size: 32, ramp: "wood",     normal: 1.2, slope: false, build: (s) => planks(32, s, { widths: [6, 6, 6, 7, 7], base: 0.46, spread: 0.14, grainAmount: 0.14 }) },
  timber:      { size: 32, ramp: "timber",   normal: 1.2, slope: false, build: (s) => planks(32, s, { widths: [8, 8, 8, 8], base: 0.5, spread: 0.14, grainAmount: 0.16 }) },
  plaster:     { size: 32, ramp: "plaster",  normal: 1.4, slope: false, build: (s) => plaster(32, s) },
  "roof-red":  { size: 32, ramp: "roofRed",  normal: 2.4, slope: true,  build: (s) => roofTiles(32, s, { base: 0.55, spread: 0.2 }) },
  "roof-blue": { size: 32, ramp: "roofBlue", normal: 2.4, slope: true,  build: (s) => roofTiles(32, s, { base: 0.52, spread: 0.2 }) },
  thatch:      { size: 32, ramp: "thatch",   normal: 1.6, slope: true,  build: (s) => thatch(32, s) },
  grass:       { size: 64, ramp: "grass",    normal: 1.4, slope: false, build: (s) => grass(64, s) },
  sand:        { size: 64, ramp: "sand",     normal: 1.2, slope: false, build: (s) => sand(64, s) },
  foliage:     { size: 32, ramp: "foliage",  normal: 2.0, slope: false, build: (s) => foliage(32, s) },
  rock:        { size: 32, ramp: "rock",     normal: 1.1, slope: false, build: (s) => boulder(32, s) },
  cliff:       { size: 32, ramp: "cliff",    normal: 1.6, slope: false, build: (s) => cliff(32, s) },
  canvas:      { size: 32, ramp: "canvas",   normal: 1.0, slope: false, build: (s) => canvasCloth(32, s) },
});

export const PIXEL_KIND_NAMES = Object.freeze(Object.keys(PIXEL_KINDS));

/** Paint one texture. Returns RGBA colour + normal bytes and the world span of one tile. */
export function paintTexture(kind, seed = 1) {
  const recipe = PIXEL_KINDS[kind];
  if (!recipe) throw new RangeError("Unknown pixel texture kind: " + String(kind));
  const painted = recipe.build(seed);
  const size = recipe.size;
  const light = bevelLight(painted.height, size, 1);
  const color = renderRamp(size, painted.tone, light, PALETTE[recipe.ramp], {
    dither: painted.dither, bevel: painted.bevel, override: painted.override.size ? painted.override : null,
  });
  return {
    kind, seed, size, units: size / TEXELS_PER_UNIT, slope: recipe.slope,
    color, normal: normalFromHeight(painted.height, size, recipe.normal),
  };
}
