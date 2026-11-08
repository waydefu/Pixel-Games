// Tileable 3D noise for the volumetric cumulus: a Perlin-Worley base shape and three Worley octaves for the billowy
// erosion, packed into one RGBA volume. Pure and deterministic, so it is testable in Node; the game uploads it once as a
// 3D texture (High quality only). The recipe is the usual one for real-time clouds (Perlin noise remapped by Worley
// cells for the cauliflower base shape, Worley FBM for erosion), written from the published description.
//
//   R: Perlin-Worley (the large lumpy shape)    G: Worley, 6 cells    B: Worley, 12 cells    A: Worley, 24 cells
//   Worley values are INVERTED (1 at a cell's centre, 0 at its walls) so they read as little puffs.

const hash3 = (x, y, z, seed) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.19) * 43758.5453123;
  return n - Math.floor(n);
};
const wrap = (v, p) => ((v % p) + p) % p;
const lerp = (a, b, t) => a + (b - a) * t;
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);

/** One random vector (x, y, z in 0..1) per lattice point of a `period`^3 tiling grid, built once. */
function randomTable(period, seed) {
  const table = new Float32Array(period * period * period * 3);
  let k = 0;
  for (let z = 0; z < period; z++) for (let y = 0; y < period; y++) for (let x = 0; x < period; x++) {
    table[k++] = hash3(x, y, z, seed); table[k++] = hash3(x, y, z, seed + 1); table[k++] = hash3(x, y, z, seed + 2);
  }
  return table;
}

/** Gradient (Perlin) noise that tiles every `period` lattice cells; returns 0..1. `table` = randomTable(period). */
function perlin(x, y, z, period, table) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const grad = (cx, cy, cz, dx, dy, dz) => {
    const o = ((wrap(cz, period) * period + wrap(cy, period)) * period + wrap(cx, period)) * 3;
    const gx = table[o] * 2 - 1, gy = table[o + 1] * 2 - 1, gz = table[o + 2] * 2 - 1;
    const len = Math.hypot(gx, gy, gz) || 1;
    return (gx * dx + gy * dy + gz * dz) / len;
  };
  const u = fade(fx), v = fade(fy), w = fade(fz);
  const n000 = grad(ix, iy, iz, fx, fy, fz), n100 = grad(ix + 1, iy, iz, fx - 1, fy, fz);
  const n010 = grad(ix, iy + 1, iz, fx, fy - 1, fz), n110 = grad(ix + 1, iy + 1, iz, fx - 1, fy - 1, fz);
  const n001 = grad(ix, iy, iz + 1, fx, fy, fz - 1), n101 = grad(ix + 1, iy, iz + 1, fx - 1, fy, fz - 1);
  const n011 = grad(ix, iy + 1, iz + 1, fx, fy - 1, fz - 1), n111 = grad(ix + 1, iy + 1, iz + 1, fx - 1, fy - 1, fz - 1);
  const value = lerp(lerp(lerp(n000, n100, u), lerp(n010, n110, u), v), lerp(lerp(n001, n101, u), lerp(n011, n111, u), v), w);
  return Math.min(1, Math.max(0, value * 0.9 + 0.5));
}

/** Inverted tileable Worley noise: 1 at the nearest feature point, falling toward 0 at the cell walls. */
function worley(x, y, z, period, table) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let best = 9;
  for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const cx = ix + dx, cy = iy + dy, cz = iz + dz;
    const o = ((wrap(cz, period) * period + wrap(cy, period)) * period + wrap(cx, period)) * 3;
    const ex = cx + table[o] - x, ey = cy + table[o + 1] - y, ez = cz + table[o + 2] - z;
    const d = ex * ex + ey * ey + ez * ez;
    if (d < best) best = d;
  }
  return Math.max(0, 1 - Math.sqrt(best));
}

export const CLOUD_NOISE_SIZE = 48;
const byte = v => Math.round(Math.min(1, Math.max(0, v)) * 255);

/**
 * Incremental build: `step(budgetMs)` fills as many z-slices as fit in the time budget and returns true once the whole
 * volume is done, so the game can spread the work over a few frames instead of freezing for a second.
 */
export function createCloudNoiseJob(size = CLOUD_NOISE_SIZE) {
  const data = new Uint8Array(size * size * size * 4);
  const tw6 = randomTable(6, 3), tw12 = randomTable(12, 11), tw24 = randomTable(24, 23);
  const tp4 = randomTable(4, 5), tp8 = randomTable(8, 9), tp16 = randomTable(16, 13);
  let z = 0;
  function slice(z) {
    let i = z * size * size * 4;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size, w = z / size;
      const w6 = worley(u * 6, v * 6, w * 6, 6, tw6), w12 = worley(u * 12, v * 12, w * 12, 12, tw12), w24 = worley(u * 24, v * 24, w * 24, 24, tw24);
      const worleyFbm = 0.625 * w6 + 0.25 * w12 + 0.125 * w24;
      const perlinFbm = 0.5 * perlin(u * 4, v * 4, w * 4, 4, tp4) + 0.3 * perlin(u * 8, v * 8, w * 8, 8, tp8) + 0.2 * perlin(u * 16, v * 16, w * 16, 16, tp16);
      // Perlin remapped by the Worley cells: lumpy like cauliflower, never a bare lattice of cells
      const shape = worleyFbm + perlinFbm * (1 - worleyFbm);
      data[i++] = byte(shape); data[i++] = byte(w6); data[i++] = byte(w12); data[i++] = byte(w24);
    }
  }
  return {
    data, size,
    get progress() { return z / size; },
    step(budgetMs = 4, minSlices = 2) {
      const t0 = performance.now();
      let done = 0;
      while (z < size) { slice(z++); done++; if (done >= minSlices && performance.now() - t0 >= budgetMs) break; }
      return z >= size;
    },
  };
}
/** The whole volume at once (tests, tools). */
export function buildCloudNoise3D(size = CLOUD_NOISE_SIZE) {
  const job = createCloudNoiseJob(size);
  job.step(Infinity);
  return job.data;
}
