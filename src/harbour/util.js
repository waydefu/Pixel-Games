// Small shared helpers: math, seeded RNG, seeded gradient noise. No dependencies, so it also runs in Node for layout previews.
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const saturate = x => clamp(x, 0, 1);
export const smoothstep = (a, b, x) => { const t = saturate((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const smootherstep = (a, b, x) => { const t = saturate((x - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
export const gauss = (d2, r) => Math.exp(-d2 / (r * r));
export const TAU = Math.PI * 2;

export function mulberry32(seed) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (a, b) => a + (b - a) * f();
  f.int = (a, b) => Math.floor(a + (b - a + 1) * f());
  f.pick = arr => arr[Math.floor(f() * arr.length)];
  f.chance = p => f() < p;
  f.normal = () => { const u = Math.max(1e-9, f()), v = f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
  f.fork = () => mulberry32(Math.floor(f() * 4294967296));
  return f;
}

// 2D gradient (Perlin) noise with a seeded permutation; output roughly in [-1, 1].
export function makeNoise(seed) {
  const rnd = mulberry32(seed ^ 0x9E3779B9);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grads = [[1, 0], [-1, 0], [0, 1], [0, -1], [.7071, .7071], [-.7071, .7071], [.7071, -.7071], [-.7071, -.7071]];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  function noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const g = (ix, iy, dx, dy) => { const gr = grads[perm[perm[ix] + iy] & 7]; return gr[0] * dx + gr[1] * dy; };
    const u = fade(xf), v = fade(yf);
    const a = g(X, Y, xf, yf), b = g(X + 1, Y, xf - 1, yf), c = g(X, Y + 1, xf, yf - 1), d = g(X + 1, Y + 1, xf - 1, yf - 1);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 1.41;
  }
  function fbm(x, y, oct = 5, lac = 2, gain = .5) {
    let amp = 1, sum = 0, norm = 0, f = 1;
    for (let i = 0; i < oct; i++) { sum += amp * noise2(x * f + i * 17.3, y * f - i * 9.1); norm += amp; amp *= gain; f *= lac; }
    return sum / norm;
  }
  function ridged(x, y, oct = 5, lac = 2, gain = .5) {
    let amp = 1, sum = 0, norm = 0, f = 1;
    for (let i = 0; i < oct; i++) { const n = 1 - Math.abs(noise2(x * f + i * 5.7, y * f + i * 3.1)); sum += amp * n * n; norm += amp; amp *= gain; f *= lac; }
    return sum / norm;
  }
  return { noise2, fbm, ridged };
}

export const dist2 = (ax, az, bx, bz) => (ax - bx) ** 2 + (az - bz) ** 2;
export function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1) : 0;
  const cx = ax + dx * t, cz = az + dz * t;
  return { d: Math.hypot(px - cx, pz - cz), t, x: cx, z: cz };
}
