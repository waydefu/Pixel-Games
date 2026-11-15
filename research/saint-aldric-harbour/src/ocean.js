// Spectral ocean (fourth round): cascaded FFT wave fields computed on the CPU every frame (or every other frame on low), following the
// NeuralSpecOcean SpectralWaves approach: Pierson-Moskowitz / Mitsuyasu directional spectrum, Hermitian packing so one complex IFFT gives
// both horizontal displacement axes, and one IFFT for height. Output per cascade: RGBA float texture (R height, G/B horizontal displacement,
// A crest convergence used for whitecaps). Rewritten from the reference's algorithm, not copied.
import * as THREE from "three";

const G = 9.81;
// cascade tables per quality tier: n = texels per side, L = patch length (m), band: 'full' | 'long' | 'short' | 'chop', rms = target height RMS (m, sea state 1)
export const OCEAN_TIERS = {
  low: [{ n: 64, L: 120, band: "full", rms: 0.32, every: 2 }],
  // long patches update every other frame (slow motion); short and chop bands every frame (chop every other frame on high/ultra for CPU time)
  med: [{ n: 128, L: 240, band: "long", rms: 0.3, every: 2 }, { n: 64, L: 28, band: "short", rms: 0.09 }],
  high: [{ n: 128, L: 240, band: "long", rms: 0.3, every: 2 }, { n: 64, L: 28, band: "short", rms: 0.09 }],   // 2 cascades; the chop band is ultra only
  ultra: [{ n: 128, L: 240, band: "long", rms: 0.3, every: 2 }, { n: 128, L: 28, band: "short", rms: 0.09 }, { n: 64, L: 11.3, band: "chop", rms: 0.025, every: 2 }],
};

function lcg(seed) { let s = seed >>> 0; const rand = () => ((s = (1664525 * s + 1013904223) >>> 0) + 1) / 4294967297; return { rand, gauss: () => Math.sqrt(-2 * Math.log(rand())) * Math.cos(2 * Math.PI * rand()) }; }

class Cascade {
  constructor(cfg, seed) {
    const n = cfg.n, N = n * n, L = cfg.L, band = cfg.band; this.n = n; this.L = L; this.band = band; this.N = N; this.targetRms = cfg.rms; this.every = cfg.every || 1;
    const rng = lcg(seed), wind = Math.sqrt(9.0 * L / 1.0);   // only used for the calibration below; the shape comes from L
    this.kx = new Float32Array(N); this.kz = new Float32Array(N); this.om = new Float32Array(N); this.fx = new Float32Array(N); this.fz = new Float32Array(N);
    this.h0r = new Float32Array(N); this.h0i = new Float32Array(N); this.conj = new Int32Array(N);
    const isChop = band === "chop", kNyq = Math.PI * n / L;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x; this.conj[i] = ((n - y) % n) * n + ((n - x) % n);
      const kxx = ((x <= n / 2 ? x : x - n) * 2 * Math.PI) / L, kzz = ((y <= n / 2 ? y : y - n) * 2 * Math.PI) / L, k = Math.hypot(kxx, kzz);
      this.kx[i] = kxx; this.kz[i] = kzz;
      this.om[i] = Math.sqrt(G * k * (1 + (isChop ? k * k * 0.00075 : 0)));
      if (isChop) { this.fx[i] = k > 0 && x !== n / 2 ? kxx : 0; this.fz[i] = k > 0 && y !== n / 2 ? kzz : 0; }
      else { this.fx[i] = k > 0 && x !== n / 2 ? kxx / k : 0; this.fz[i] = k > 0 && y !== n / 2 ? kzz / k : 0; }
      if (k <= 0) continue;
      let ph;
      if (isChop) {
        const cMain = (0.33 * kxx + 0.944 * kzz) / k, cSkew = (-0.28 * kxx + 0.96 * kzz) / k, cBroad = (0.76 * kxx + 0.6499 * kzz) / k;
        const hm = 0.5 + 0.5 * cMain, broad = 0.26 + 0.48 * hm * hm + 0.2 * cMain * cMain + 0.14 * Math.max(0, cSkew) ** 2 + 0.12 * Math.max(0, cBroad) ** 2;
        const u = Math.max(0, Math.min(1, (kNyq * 0.92 - k) / (kNyq * 0.3))), taper = u * u * (3 - 2 * u);
        ph = Math.exp(-0.26 / (k * k)) * broad * taper * Math.exp(-k * k * 0.0011) / (k ** 4);
      } else {
        const cMain = (0.35 * kxx + 0.93675 * kzz) / k, cSub = (-0.31 * kxx + 0.95074 * kzz) / k, cObl = (0.82 * kxx + 0.5724 * kzz) / k;
        const dirSpread = band === "short" ? 0.24 + 0.72 * cMain * cMain + 0.26 * cSub * cSub + 0.18 * cObl * cObl : 0.11 + 1.06 * Math.abs(cMain) ** 4 + 0.38 * Math.abs(cSub) ** 4 + 0.18 * cObl * cObl;
        // Pierson-Moskowitz style spectrum with the wind length L_w = U^2/g; each cascade covers its own wavenumber band
        const Lw = L, bw = band === "short" ? (() => { const b = Math.max(0, Math.min(1, (k - 0.3) / 0.4)); return b * b * (3 - 2 * b); })() : band === "long" ? (() => { const b = Math.max(0, Math.min(1, (k - 0.3) / 0.4)); return 1 - b * b * (3 - 2 * b); })() : 1;
        ph = Math.exp(-1 / (k * k * Lw * Lw)) * dirSpread * Math.exp(-k * k * 0.08) / (k * k * k * k) * bw;
      }
      const a = Math.sqrt(ph * 0.5);
      this.h0r[i] = rng.gauss() * a; this.h0i[i] = rng.gauss() * a;
    }
    this.scale = 1;
    // radix-2 tables
    this.swapA = []; this.swapB = []; for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { this.swapA.push(i); this.swapB.push(j); } }
    this.swapA = Int32Array.from(this.swapA); this.swapB = Int32Array.from(this.swapB);
    this.stages = Math.round(Math.log2(n)); this.twR = new Float32Array(this.stages * (n >> 1)); this.twI = new Float32Array(this.stages * (n >> 1));
    for (let s = 0, len = 2; s < this.stages; s++, len <<= 1) for (let j = 0; j < len >> 1; j++) { this.twR[s * (n >> 1) + j] = Math.cos(2 * Math.PI / len * j); this.twI[s * (n >> 1) + j] = Math.sin(2 * Math.PI / len * j); }
    this.re = new Float32Array(N); this.im = new Float32Array(N); this.dxr = new Float32Array(N); this.dxi = new Float32Array(N);
    this.out = new Float32Array(N * 4);
    this.tex = new THREE.DataTexture(this.out, n, n, THREE.RGBAFormat, THREE.FloatType);
    this.tex.minFilter = this.tex.magFilter = THREE.NearestFilter; this.tex.wrapS = this.tex.wrapT = THREE.RepeatWrapping; this.tex.generateMipmaps = false; this.tex.needsUpdate = true;
    this.update(0, true);
    // calibrate the height RMS of the first frame to the tier's target (linear, so the scale holds for every t)
    let s2 = 0; for (let i = 0; i < N; i++) s2 += this.out[i * 4] * this.out[i * 4];
    const rms = Math.sqrt(s2 / N);
    if (rms > 1e-9 && !isChop) { const f = this.targetRms / rms; for (let i = 0; i < N; i++) { this.h0r[i] *= f; this.h0i[i] *= f; } }
    else if (isChop) { let sx = 0; for (let i = 0; i < N; i++) sx += this.out[i * 4 + 1] ** 2 + this.out[i * 4 + 2] ** 2; const r2 = Math.sqrt(sx / N / 2); if (r2 > 1e-9) { const f = this.targetRms / r2; for (let i = 0; i < N; i++) { this.h0r[i] *= f; this.h0i[i] *= f; } } }
    this.update(0, true);
  }
  ifft1(r, im, off, stride) {
    const n = this.n, sA = this.swapA, sB = this.swapB;
    for (let s = 0; s < sA.length; s++) { const a = off + sA[s] * stride, b = off + sB[s] * stride; let t = r[a]; r[a] = r[b]; r[b] = t; t = im[a]; im[a] = im[b]; im[b] = t; }
    for (let s = 0, len = 2; s < this.stages; s++, len <<= 1) {
      const half = len >> 1, hs = half * stride, tb = s * (n >> 1), sc = s === this.stages - 1 ? 1 / n : 1;
      for (let i = 0; i < n; i += len) { let a = off + i * stride, b = a + hs; for (let j = 0; j < half; j++) { const wr = this.twR[tb + j], wi = this.twI[tb + j], rb = r[b], ib = im[b], tr = wr * rb - wi * ib, ti = wr * ib + wi * rb, ra = r[a], ia = im[a]; r[b] = (ra - tr) * sc; im[b] = (ia - ti) * sc; r[a] = (ra + tr) * sc; im[a] = (ia + ti) * sc; a += stride; b += stride; } }
    }
  }
  // one frame: spectrum at time t, Hermitian-packed IFFT for the displacement (dx + i dz) and one for the height (not for the chop band)
  update(t, initial = false) {
    const n = this.n, N = this.N, chop = this.band === "chop", { re, im, dxr, dxi, out, h0r, h0i, conj, om, fx, fz } = this;
    dxr.fill(0); dxi.fill(0); if (!chop) { re.fill(0); im.fill(0); }
    for (let i = 0; i < N; i++) {
      const j = conj[i]; if (fx[i] === 0 && fz[i] === 0 && h0r[i] === 0 && h0i[i] === 0) continue;
      // H(k,t) = h0(k) e^{i w t} + conj(h0(-k)) e^{-i w t}
      const c = Math.cos(om[i] * t), s = Math.sin(om[i] * t);
      const ar = h0r[i], ai = h0i[i], br = h0r[j], bi = h0i[j];
      const r = (ar + br) * c - (ai - bi) * s, q = (ar - br) * s + (ai + bi) * c;
      if (!chop) { re[i] = r; im[i] = q; }
      dxr[i] = -q * fx[i] - r * fz[i]; dxi[i] = r * fx[i] - q * fz[i];
    }
    for (let y = 0; y < n; y++) this.ifft1(dxr, dxi, y * n, 1);
    for (let x = 0; x < n; x++) this.ifft1(dxr, dxi, x, n);
    if (!chop) { for (let y = 0; y < n; y++) this.ifft1(re, im, y * n, 1); for (let x = 0; x < n; x++) this.ifft1(re, im, x, n); }
    const mask = n - 1, inv = 1 / (this.L / n) / N * n;   // displacement / height in metres (texel scale)
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x, ix = y * n + ((x + 1) & mask), iz = ((y + 1) & mask) * n + x, o = i * 4;
      const dxv = dxr[i] * N, dzv = dxi[i] * N;
      const dxx = (dxr[ix] - dxr[i]) * N * n / this.L, dzz = (dxi[iz] - dxi[i]) * N * n / this.L;
      out[o] = chop ? 0 : re[i] * N; out[o + 1] = dxv; out[o + 2] = dzv;
      out[o + 3] = Math.max(0, Math.min(1, -(dxx + dzz) * 0.55));   // crest convergence (whitecap source)
    }
    void inv; void initial;
    this.tex.needsUpdate = true;
  }
  // bilinear, wrapped, on the CPU copy: channel 0 height, 1/2 horizontal displacement
  sample(x, z, ch) {
    const n = this.n, f = ((x / this.L) % 1 + 1) % 1 * n - 0.5, g = ((z / this.L) % 1 + 1) % 1 * n - 0.5;
    const i0 = Math.floor(f), j0 = Math.floor(g), u = f - i0, v = g - j0, m = n - 1;
    const a = (j0 & m) * n, b = ((j0 + 1) & m) * n, ca = i0 & m, cb = (i0 + 1) & m, O = this.out;
    return (O[(a + ca) * 4 + ch] * (1 - u) + O[(a + cb) * 4 + ch] * u) * (1 - v) + (O[(b + ca) * 4 + ch] * (1 - u) + O[(b + cb) * 4 + ch] * u) * v;
  }
}

export const CHOP = 0.5;   // horizontal displacement scale (choppiness); keeps Jacobian folds for whitecaps from firing on every crest
export class SpectralOcean {
  // tier: 'low' | 'med' | 'high' | 'ultra'. damp(x,z) -> 0..1 (shallow water and harbour calm, same formula as the shader); fadeOf(c) -> [near, far] distances
  constructor(tier = "high", { damp = () => 1 } = {}) {
    this.tier = tier; this.cfg = OCEAN_TIERS[tier] || OCEAN_TIERS.high; this.damp = damp; this.cascades = this.cfg.map((c, i) => new Cascade(c, 1000 + i * 77));
    this.sea = 1; this.frame = 0; this.cpuMs = 0; this.cpuMsMax = 0; this.lastT = 0;
  }
  // called every frame; cascades with 'every' > 1 update on their own schedule (low tier: every other frame)
  update(t, sea = 1) {
    this.sea = sea; this.frame++; const t0 = performance.now();
    this.cascades.forEach((c, i) => { if (this.frame % c.every === 0 || this.frame < 2) c.update(t); });
    this.lastT = t; const ms = performance.now() - t0; this.cpuMs = this.cpuMs * 0.9 + ms * 0.1; this.cpuMsMax = Math.max(this.cpuMsMax, ms);
  }
  // sum of cascades at rest position (x,z): height and horizontal displacement, damped like the vertex shader
  rest(x, z) {
    let h = 0, dx = 0, dz = 0;
    for (const c of this.cascades) { h += c.sample(x, z, 0); dx += c.sample(x, z, 1); dz += c.sample(x, z, 2); }
    const d = this.damp(x, z) * this.sea;
    return [h * d, dx * d * CHOP, dz * d * CHOP];
  }
  // surface height at the displaced position of (x,z): invert X + D(X) = (x,z) with two fixed-point steps
  heightAt(x, z) {
    let X = x, Z = z;
    for (let it = 0; it < 2; it++) { const [, dx, dz] = this.rest(X, Z); X = x - dx; Z = z - dz; }
    return this.rest(X, Z)[0];
  }
  sampleSurface(x, z, out) {
    const h = this.heightAt(x, z), e = 0.5;
    out.y = h; out.sx = (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e); out.sz = (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e);
    return out;
  }
  dispose() { for (const c of this.cascades) c.tex.dispose(); }
}
