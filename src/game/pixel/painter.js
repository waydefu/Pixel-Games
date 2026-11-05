// Procedural pixel-art painting core. Pure functions and typed arrays only (no DOM),
// so every texture is deterministic, tileable, unit-testable and previewable in Node.
import { rampRgb } from "./palette.js";

export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export function hash2(x, y, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export const wrap = (v, n) => ((v % n) + n) % n;
export const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smoothstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
export const bayer = (x, y) => BAYER4[(y & 3) * 4 + (x & 3)];

/** Tileable value-noise fBm in [0,1]. `period` = lattice cells across the tile. */
export function tileNoise(size, period, seed = 0, octaves = 3) {
  const out = new Float32Array(size * size);
  let amplitude = 1, total = 0, p = period;
  for (let o = 0; o < octaves; o++) {
    const octaveSeed = seed * 131 + o * 977;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * p, fy = (y / size) * p;
        const ix = Math.floor(fx), iy = Math.floor(fy);
        const tx = fx - ix, ty = fy - iy;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const h = (dx, dy) => hash2(wrap(ix + dx, p), wrap(iy + dy, p), octaveSeed);
        const top = h(0, 0) + (h(1, 0) - h(0, 0)) * sx;
        const bottom = h(0, 1) + (h(1, 1) - h(0, 1)) * sx;
        out[y * size + x] += (top + (bottom - top) * sy) * amplitude;
      }
    }
    total += amplitude; amplitude *= 0.5; p *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/** Tileable jittered-grid cell structure: nearest / second-nearest distances and cell id. */
export function voronoi(size, cell, seed = 0, jitter = 0.7) {
  const n = Math.round(size / cell);
  const d1 = new Float32Array(size * size), d2 = new Float32Array(size * size);
  const id = new Int32Array(size * size);
  const cx = new Float32Array(size * size), cy = new Float32Array(size * size);
  const step = size / n;
  const point = (gx, gy) => [
    (gx + 0.5 + (hash2(wrap(gx, n), wrap(gy, n), seed) - 0.5) * jitter) * step,
    (gy + 0.5 + (hash2(wrap(gx, n), wrap(gy, n), seed + 7) - 0.5) * jitter) * step,
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = Math.floor(x / step), gy = Math.floor(y / step);
      let best = 1e9, second = 1e9, bi = 0, bx = 0, by = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const [px, py] = point(gx + ox, gy + oy);
          const d = Math.hypot(px - (x + 0.5), py - (y + 0.5));
          if (d < best) { second = best; best = d; bi = wrap(gx + ox, n) + wrap(gy + oy, n) * n; bx = px; by = py; }
          else if (d < second) second = d;
        }
      }
      const i = y * size + x;
      d1[i] = best; d2[i] = second; id[i] = bi; cx[i] = bx; cy[i] = by;
    }
  }
  return { d1, d2, id, cx, cy, n };
}

/** Light from the top-left (pixel-art convention): positive where height rises to the right/down. */
export function bevelLight(height, size, strength = 1) {
  const light = new Float32Array(size * size);
  const h = (x, y) => height[wrap(y, size) * size + wrap(x, size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      light[y * size + x] = ((h(x + 1, y) - h(x - 1, y)) + (h(x, y + 1) - h(x, y - 1))) * 0.5 * strength;
    }
  }
  return light;
}

/** Tangent-space normal map (OpenGL +Y up, so canvas-y is inverted). */
export function normalFromHeight(height, size, strength = 2.2) {
  const out = new Uint8ClampedArray(size * size * 4);
  const h = (x, y) => height[wrap(y, size) * size + wrap(x, size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * 0.5 * strength;
      const dy = (h(x, y + 1) - h(x, y - 1)) * 0.5 * strength;
      const nx = -dx, ny = dy, nz = 1;
      const length = Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      out[i] = Math.round((nx / length * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round((ny / length * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round((nz / length * 0.5 + 0.5) * 255);
      out[i + 3] = 255;
    }
  }
  return out;
}

/**
 * Quantise a lit tone field onto a ramp with ordered (Bayer) dithering.
 * `tone` in [0,1]; `light` adds bevel shading. Optional `override` (index -> [r,g,b])
 * paints accents (flowers, nail heads, mortar glints) outside the ramp.
 */
export function renderRamp(size, tone, light, ramp, { dither = 0.5, bevel = 1, override = null } = {}) {
  const rgb = rampRgb(ramp), last = rgb.length - 1;
  const out = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const lit = tone[i] + (light ? light[i] * bevel : 0);
      const index = Math.max(0, Math.min(last, Math.floor(lit * last + (bayer(x, y) - 0.5) * dither + 0.5)));
      const color = override?.get(i) ?? rgb[index];
      out[i * 4] = color[0]; out[i * 4 + 1] = color[1]; out[i * 4 + 2] = color[2]; out[i * 4 + 3] = 255;
    }
  }
  return out;
}

/** Number of distinct colours actually used (palette-discipline check). */
export function countColors(rgba) {
  const seen = new Set();
  for (let i = 0; i < rgba.length; i += 4) seen.add((rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]);
  return seen.size;
}
