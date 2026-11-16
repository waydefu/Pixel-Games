// Weather state machine (clear / cloudy / rain / storm), GPU rain streaks around the camera, wetness, lightning, plus procedural WebAudio ambience.
import * as THREE from "three";
import { clamp, lerp } from "./util.js";

export const WX = {
  clear: { name: "晴", cover: 0.30, over: 0.0, rain: 0, wind: 0.25, sea: 0.45, haze: 0.2 },
  cloudy: { name: "多雲", cover: 0.70, over: 0.35, rain: 0, wind: 0.45, sea: 0.6, haze: 0.5 },
  rain: { name: "雨", cover: 0.92, over: 0.8, rain: 0.7, wind: 0.6, sea: 0.8, haze: 1.1 },
  storm: { name: "暴風雨", cover: 1.0, over: 1.0, rain: 1.0, wind: 1.0, sea: 1.2, haze: 4.8 },   // haze x3 (storm fog)
};
const ORDER = ["clear", "cloudy", "rain", "storm"];
// seasonal weather odds [clear, cloudy, rain, storm] for the Baltic coast (spring showers, mostly fair summers, wet and windy autumns, grey winters)
const SEASON_W = [[0.34, 0.36, 0.27, 0.03], [0.50, 0.30, 0.15, 0.05], [0.18, 0.36, 0.34, 0.12], [0.15, 0.55, 0.30, 0.0]];

export class Weather {
  constructor(scene, dirLights) {
    this.key = "clear"; this.auto = true; this.autoT = 90; this.target = WX.clear; this.s = { ...WX.clear }; this.wet = 0; this.flash = 0; this.nextFlash = 8; this.dirLights = dirLights;
    this.season = 1; this.snowCover = 0; this.snowP = 0;   // winter precipitation falls as snow; snowCover is the ground cover shown to the shaders (AU.uSnow)
    const N = 16000, pos = new Float32Array(N * 6), seed = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const x = Math.random() * 2 - 1, z = Math.random() * 2 - 1, y = Math.random(), sp = 0.8 + Math.random() * 0.4;
      for (let k = 0; k < 2; k++) { pos.set([x, y, z], i * 6 + k * 3); seed.set([k, sp], i * 2 * 1 + 0); }
    }
    const seeds = new Float32Array(N * 2 * 2); for (let i = 0; i < N; i++) { const sp = 0.8 + Math.random() * 0.4; seeds.set([0, sp, 1, sp], i * 4); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 2));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.u = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uRain: { value: 0 }, uSnowP: { value: 0 }, uLum: { value: 1 }, uWindDir: { value: new THREE.Vector2(0.6, 0.3) }, uBox: { value: new THREE.Vector3(26, 20, 26) } };
    const m = new THREE.ShaderMaterial({ uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.NormalBlending,
      vertexShader: `uniform float uTime, uRain, uSnowP; uniform vec3 uCam, uBox; uniform vec2 uWindDir; attribute vec2 aSeed; varying float vA;
        void main(){ float id = position.x * 12.9898 + position.z * 78.233; float h = fract(sin(id) * 43758.5453);
          vec3 p = position; p.xz *= uBox.xz; p.y = fract(p.y - uTime * (0.8 * aSeed.y) * 1.2 * mix(1.0, 0.14, uSnowP) + h) ; 
          vec3 w = vec3(p.x, p.y * uBox.y, p.z) + vec3(uCam.x, uCam.y - uBox.y * 0.5, uCam.z);
          vec2 wind = uWindDir * (1.0 - p.y) * uBox.y * 0.18; w.xz += wind;
          w.xz = uCam.xz + mod(w.xz - uCam.xz + uBox.xz, 2.0 * uBox.xz) - uBox.xz;
          w.x += uSnowP * sin(uTime * 1.6 + h * 40.0) * 0.45; w.z += uSnowP * cos(uTime * 1.1 + h * 23.0) * 0.45;   // snowflakes drift and sway
          vec3 tail = vec3(-uWindDir.x * 0.04, 0.4, -uWindDir.y * 0.04) * mix(1.0, 0.12, uSnowP); if (aSeed.x > 0.5) w += tail;
          float keep = step(h, uRain); vA = (aSeed.x > 0.5 ? 0.0 : 1.0) * 0.6 * keep * smoothstep(0.0, 0.1, p.y) * smoothstep(1.0, 0.8, p.y);
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`,
      fragmentShader: `uniform float uLum, uSnowP; varying float vA; void main(){ gl_FragColor = vec4(mix(vec3(0.62, 0.68, 0.78), vec3(0.97, 0.98, 1.0), uSnowP) * uLum, vA * 0.4); }` });
    this.rain = new THREE.LineSegments(g, m); this.rain.frustumCulled = false; this.rain.renderOrder = 20; scene.add(this.rain);
    this.flashLight = new THREE.DirectionalLight(0xcfd8ff, 0); this.flashLight.position.set(0.2, 1, 0.1); scene.add(this.flashLight);
  }
  set(key) { this.key = key; this.target = WX[key]; }
  setSeason(season) { this.season = season; }   // called every frame from main.js with game.calendar().season
  manual(key) { this.set(key); this.autoT = 420; }
  tickAuto(dt, season) {
    if (!this.auto) return; this.autoT = (this.autoT ?? 90) - dt; if (this.autoT > 0) return; this.autoT = 150 + Math.random() * 270;
    const w = SEASON_W[season] || SEASON_W[1]; let r = Math.random(); for (let i = 0; i < 4; i++) { r -= w[i]; if (r <= 0) { this.set(ORDER[i]); return; } }
  }
  next() { this.manual(ORDER[(ORDER.indexOf(this.key) + 1) % ORDER.length]); return this.target.name; }
  update(dt, cam, time, dayLum) {
    const t = this.target, s = this.s, k = 1 - Math.exp(-dt / 6);
    for (const key of ["cover", "over", "rain", "wind", "sea", "haze"]) s[key] = lerp(s[key], t[key], k);
    this.wet = clamp(this.wet + (s.rain > 0.1 ? dt * 0.08 * s.rain : -dt * 0.004), 0, 1);
    // winter: rain becomes snow; the ground whitens over minutes and thaws slowly afterwards
    const winter = this.season === 3, snowing = winter && (this.key === "rain" || this.key === "storm");
    this.snowP = lerp(this.snowP, snowing ? 1 : 0, 1 - Math.exp(-dt / 2));
    const coverWant = winter ? (this.key === "clear" ? 0.45 : this.key === "cloudy" ? 0.7 : 0.95) : 0;
    this.snowCover = lerp(this.snowCover, coverWant, 1 - Math.exp(-dt / (coverWant > this.snowCover ? 25 : 90)));
    this.u.uTime.value = time; this.u.uCam.value.copy(cam.position); this.u.uRain.value = s.rain; this.u.uSnowP.value = this.snowP; this.u.uLum.value = 0.25 + 3.0 * dayLum; this.u.uWindDir.value.set(0.5 * s.wind + 0.1, 0.2 * s.wind);
    this.rain.visible = s.rain > 0.02;
    // lightning
    this.nextFlash -= dt;
    if (this.key === "storm" && !snowing && this.nextFlash < 0) { this.flash = 1; this.nextFlash = 5 + Math.random() * 11; this.thunderIn = 0.4 + Math.random() * 3; }
    this.flash = Math.max(0, this.flash - dt * (this.flash > 0.6 ? 6 : 2.6));
    const f = this.flash * (0.6 + 0.4 * Math.sin(time * 90));
    this.flashLight.intensity = f * 14; return { ...s, wet: this.wet, flash: f, snowCover: this.snowCover, snowP: this.snowP };
  }
}

// ---------------------------------------------------------------------------------------------- procedural audio
export class Ambience {
  constructor() { this.ok = false; this.muted = false; }
  start() {
    if (this.ok) return; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; const c = this.c = new AC(); this.ok = true;
    const len = c.sampleRate * 3, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12; }   // pinkish
    this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(c.destination);
    const layer = (type, freq, q) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = Math.random() * 1.5; const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.master); s.start(); return { g, f }; };
    this.sea = layer("lowpass", 520, 0.6); this.wind = layer("bandpass", 420, 0.5); this.rainL = layer("highpass", 2200, 0.4); this.surf = layer("bandpass", 900, 0.8);
    this.lfo = 0;
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.9; }
  update(dt, st) {   // st: {sea, wind, rain, shore (0..1 closeness to water), indoor}
    if (!this.ok) return; const c = this.c, t = c.currentTime; this.lfo += dt;
    const swell = 0.5 + 0.5 * Math.sin(this.lfo * 0.55) * Math.sin(this.lfo * 0.23 + 1.0);
    this.sea.g.gain.setTargetAtTime((0.05 + 0.12 * st.sea) * (0.3 + 0.7 * st.shore) * (0.6 + 0.4 * swell), t, 0.3);
    this.surf.g.gain.setTargetAtTime(0.05 * st.shore * swell * (0.5 + st.sea), t, 0.4); this.surf.f.frequency.setTargetAtTime(500 + 1200 * swell, t, 0.3);
    this.wind.g.gain.setTargetAtTime(0.025 + 0.16 * st.wind * st.wind + 0.02 * Math.sin(this.lfo * 0.9) * st.wind, t, 0.4); this.wind.f.frequency.setTargetAtTime(260 + 500 * st.wind + 120 * Math.sin(this.lfo * 0.4), t, 0.5);
    this.rainL.g.gain.setTargetAtTime(0.14 * st.rain, t, 0.5);
  }
  tick(kind) {   // footstep / oar / splash one-shots
    if (!this.ok || this.muted) return; const c = this.c, t = c.currentTime, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    const len = c.sampleRate * 0.25, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * (kind === "splash" ? 0.07 : 0.025)));
    n.buffer = b; f.type = "bandpass"; f.frequency.value = kind === "cobble" ? 1500 : kind === "grass" ? 600 : kind === "wood" ? 400 : kind === "splash" ? 1800 : 900; f.Q.value = 0.8;
    g.gain.value = kind === "splash" ? 0.5 : 0.28; n.connect(f); f.connect(g); g.connect(this.master); n.start(t);
  }
  bell(count = 1) {
    if (!this.ok || this.muted) return; const c = this.c;
    for (let k = 0; k < count; k++) { const t0 = c.currentTime + k * 2.4; for (const [fr, a] of [[196, 0.22], [392, 0.1], [588, 0.07], [823, 0.04]]) { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = fr * (1 + 0.002 * Math.random()); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(a, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t0 + 4.5); o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + 5); } }
  }
  thunder() {
    if (!this.ok || this.muted) return; const c = this.c, t = c.currentTime, n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), len = c.sampleRate * 3, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.9)) * (0.6 + 0.4 * Math.sin(i / 3000));
    n.buffer = b; f.type = "lowpass"; f.frequency.value = 220; g.gain.value = 1.2; n.connect(f); f.connect(g); g.connect(this.master); n.start(t);
  }
}
