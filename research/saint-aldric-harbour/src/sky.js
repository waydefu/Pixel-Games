// Sky: physically based single-scattering atmosphere baked into two small LUTs (transmittance + sky-view), a sky dome with sun,
// moon, stars and 2.5D clouds, an environment capture for image-based lighting, and the numbers the rest of the scene needs
// (sun/moon colour and direction, fog LUT). One LUT feeds the sky, the aerial perspective on every material, and the ambient light.
import * as THREE from "three";
import { clamp, smoothstep, lerp } from "./util.js";

export const ATM = { Rg: 6360, Rt: 6460, hObs: 0.002 };
const E_SUN = 22;                               // top-of-atmosphere sun irradiance (scene units, tuned with the exposure curve)

const ATM_GLSL = /* glsl */`
const float Rg = 6360.0, Rt = 6460.0;
const vec3 betaR = vec3(5.802e-3, 13.558e-3, 33.1e-3);
const float betaMs = 3.996e-3, betaMe = 4.44e-3;
const vec3 betaO = vec3(0.650e-3, 1.881e-3, 0.085e-3);
const float PI_ = 3.14159265359;
vec3 sigmaT(float h) {
  float dR = exp(-h / 8.0), dM = exp(-h / 1.2), dO = max(0.0, 1.0 - abs(h - 25.0) / 15.0);
  return betaR * dR + vec3(betaMe) * dM + betaO * dO;
}
float raySphere(vec3 o, vec3 d, float R) {
  float b = dot(o, d), c = dot(o, o) - R * R, disc = b * b - c;
  if (disc < 0.0) return -1.0;
  float s = sqrt(disc), t0 = -b - s, t1 = -b + s;
  if (t0 > 0.0) return t0; if (t1 > 0.0) return t1; return -1.0;
}
vec2 transUV(float r, float mu) {
  float H = sqrt(Rt * Rt - Rg * Rg), rho = sqrt(max(0.0, r * r - Rg * Rg));
  float disc = r * r * (mu * mu - 1.0) + Rt * Rt;
  float d = max(0.0, -r * mu + sqrt(max(0.0, disc)));
  float dmin = Rt - r, dmax = rho + H;
  return vec2((d - dmin) / (dmax - dmin), rho / H);
}
void transFromUV(vec2 uv, out float r, out float mu) {
  float H = sqrt(Rt * Rt - Rg * Rg), rho = uv.y * H;
  r = sqrt(rho * rho + Rg * Rg);
  float dmin = Rt - r, dmax = rho + H, d = dmin + uv.x * (dmax - dmin);
  mu = d < 1e-4 ? 1.0 : clamp((H * H - rho * rho - d * d) / (2.0 * r * d), -1.0, 1.0);
}
float phaseR(float c) { return 3.0 / (16.0 * PI_) * (1.0 + c * c); }
float phaseHG(float c, float g) { float g2 = g * g; return (1.0 - g2) / (4.0 * PI_ * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }
vec2 skyUV(vec3 d, vec3 sunD) {
  vec2 sa = normalize(sunD.xz + vec2(1e-6, 0.0));
  float az = acos(clamp(dot(normalize(d.xz + vec2(1e-6, 0.0)), sa), -1.0, 1.0));
  float el = asin(clamp(d.y, -1.0, 1.0));
  float v = 0.5 + 0.5 * sign(el) * sqrt(abs(el) / 1.5707963);
  return vec2(az / PI_, v);
}
`;

const FULLSCREEN_VS = /* glsl */`
out vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const TRANS_FS = /* glsl */`
precision highp float; in vec2 vUv; out vec4 o;
${ATM_GLSL}
void main() {
  float r, mu; transFromUV(vUv, r, mu);
  vec3 p0 = vec3(0.0, r, 0.0), d = vec3(sqrt(max(0.0, 1.0 - mu * mu)), mu, 0.0);
  float tt = raySphere(p0, d, Rt); if (tt < 0.0) tt = 0.0;
  vec3 od = vec3(0.0); const int N = 48;
  float dt = tt / float(N);
  for (int i = 0; i < N; i++) { vec3 p = p0 + d * (float(i) + 0.5) * dt; od += sigmaT(length(p) - Rg) * dt; }
  o = vec4(exp(-od), 1.0);
}`;

const SKYVIEW_FS = /* glsl */`
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uTrans; uniform float uSunElev; uniform float uSunE; uniform float uObsH;
${ATM_GLSL}
vec3 transAt(vec3 p, vec3 dir) {
  float r = length(p), mu = dot(p / r, dir);
  vec2 uv = transUV(r, mu);
  return texture(uTrans, uv).rgb;
}
void main() {
  float az = vUv.x * PI_;
  float el = sign(vUv.y - 0.5) * 1.5707963 * pow(abs(2.0 * vUv.y - 1.0), 2.0);
  vec3 dir = vec3(cos(el) * cos(az), sin(el), cos(el) * sin(az));
  vec3 sunD = vec3(cos(uSunElev), sin(uSunElev), 0.0);
  vec3 p0 = vec3(0.0, Rg + uObsH, 0.0);
  float tMax = raySphere(p0, dir, Rt);
  float tg = raySphere(p0, dir, Rg);
  bool hitG = tg > 0.0;
  if (hitG) tMax = min(tMax, tg);
  if (tMax < 0.0) tMax = 0.0;
  const int N = 40; float dt = tMax / float(N);
  vec3 L = vec3(0.0), T = vec3(1.0);
  float cosT = dot(dir, sunD);
  float pr = phaseR(cosT), pm = phaseHG(cosT, 0.8);
  for (int i = 0; i < N; i++) {
    float t = (float(i) + 0.3 + 0.4 * fract(sin(float(i) * 12.9898) * 43758.5453)) * dt;   // jitter hides banding
    vec3 p = p0 + dir * t; float h = length(p) - Rg;
    float dR = exp(-h / 8.0), dM = exp(-h / 1.2);
    vec3 sig = sigmaT(h);
    vec3 up = p / length(p);
    float muS = dot(up, sunD);
    vec3 Ts = vec3(0.0);
    if (!(muS < -sqrt(max(0.0, 1.0 - (Rg * Rg) / dot(p, p))))) Ts = transAt(p, sunD);
    vec3 scat = betaR * dR * pr + vec3(betaMs) * dM * pm;
    vec3 ms = (betaR * dR + vec3(betaMs) * dM) * (0.20 * sqrt(Ts));        // cheap multiple-scattering term
    vec3 S = uSunE * Ts * scat + uSunE * ms * (1.0 / (4.0 * PI_)) * 4.0;
    vec3 Tstep = exp(-sig * dt);
    L += T * (S - S * Tstep) / max(sig, vec3(1e-6));
    T *= Tstep;
  }
  if (hitG) {
    vec3 pg = p0 + dir * tg; vec3 up = pg / length(pg);
    float mu = dot(up, sunD);
    vec3 Tg = mu > 0.0 ? transAt(pg, sunD) : vec3(0.0);
    L += T * (0.18 / PI_) * uSunE * Tg * max(mu, 0.0);
  }
  o = vec4(L, 1.0);
}`;

const SKY_VS = /* glsl */`
out vec3 vDir;
void main() { vDir = normalize(position); vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0); gl_Position = p.xyww; }
`;
const SKY_FS = /* glsl */`
precision highp float; in vec3 vDir; layout(location = 0) out vec4 o;
uniform sampler2D uSkyLUT; uniform vec3 uSunDir; uniform vec3 uMoonDir; uniform vec3 uSunRad; uniform vec3 uMoonRad; uniform float uTime;
uniform float uCover; uniform float uStars; uniform vec3 uCam; uniform float uCapture; uniform float uOvercast; uniform float uMoonPhase;
${ATM_GLSL}
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p) { p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p, int oct) { float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++) { if (i >= oct) break; s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
vec3 skyAt(vec3 d) { return texture(uSkyLUT, skyUV(d, uSunDir)).rgb; }
float cloudDensity(vec2 p, float cover, int oct) {
  vec2 w = vec2(uTime * 6.0, uTime * 2.5);
  float base = fbm((p + w) * 0.00042, oct) ;
  float det = fbm((p + w * 1.3) * 0.0022 + 3.7, max(oct - 1, 1));
  float n = base * 0.78 + det * 0.34;
  float thr = mix(0.78, 0.36, cover);
  return smoothstep(thr, thr + 0.22, n);
}
void main() {
  vec3 d = normalize(vDir);
  vec3 col = skyAt(d);
  // below the horizon: darker ground haze so the dome never shows a hard edge
  float below = smoothstep(0.0, -0.08, d.y);
  col = mix(col, skyAt(normalize(vec3(d.x, 0.002, d.z))) * 0.55, below);
  float sunMu = dot(d, uSunDir), moonMu = dot(d, uMoonDir);
  if (uCapture < 0.5) {
    // sun disk with limb darkening + soft corona (the directional light is the sun in the environment capture)
    float ang = acos(clamp(sunMu, -1.0, 1.0));
    float disk = 1.0 - smoothstep(0.00425, 0.00475, ang);
    float limb = 0.55 + 0.45 * sqrt(max(0.0, 1.0 - pow(ang / 0.00475, 2.0)));
    col += uSunRad * (disk * limb * 3000.0 + exp(-ang * 55.0) * 0.12) * (d.y > -0.02 ? 1.0 : 0.0);
    // moon: lit disc with soft maria
    float am = acos(clamp(moonMu, -1.0, 1.0));
    float md = 1.0 - smoothstep(0.0087, 0.0095, am);
    vec3 up = abs(uMoonDir.y) > 0.99 ? vec3(1, 0, 0) : vec3(0, 1, 0);
    vec3 mx = normalize(cross(up, uMoonDir)), my = cross(uMoonDir, mx);
    vec2 mp = vec2(dot(d, mx), dot(d, my)) / 0.0092;
    float z = sqrt(max(0.0, 1.0 - dot(mp, mp)));
    vec3 n = vec3(mp, z);
    vec3 ld = normalize(vec3(cos(uMoonPhase), 0.15, sin(uMoonPhase)));
    float lit = smoothstep(-0.05, 0.25, dot(n, ld));
    float maria = 0.65 + 0.35 * fbm(mp * 3.5 + 11.0, 4);
    col += uMoonRad * md * lit * maria * 60.0;
    col += uMoonRad * exp(-am * 90.0) * 0.4;
    // stars (hashed on a sphere grid) + faint milky-way band
    if (uStars > 0.001 && d.y > -0.05) {
      vec3 sp = d * 220.0; vec3 cell = floor(sp), f = fract(sp) - 0.5;
      float h = hash13(cell);
      float mag = pow(h, 22.0);
      float tw = 0.75 + 0.25 * sin(uTime * (2.0 + h * 6.0) + h * 40.0);
      float star = smoothstep(0.42, 0.0, length(f + (vec3(hash13(cell + 1.7), hash13(cell + 5.3), hash13(cell + 9.1)) - 0.5) * 0.5)) * mag * tw;
      vec3 axis = normalize(vec3(0.35, 0.72, 0.6));
      float band = exp(-pow(dot(d, axis) * 3.2, 2.0));
      float mw = band * (0.5 + 0.9 * fbm(d.xz * 5.0 + d.y * 3.0, 5));
      vec3 tint = mix(vec3(1.0, 0.82, 0.65), vec3(0.65, 0.78, 1.0), hash13(cell + 3.3));
      col += uStars * (tint * star * 6.0 + vec3(0.8, 0.85, 1.0) * mw * 0.012);
    }
  }
  // clouds: one cumulus deck lit from the sun with silver lining + one thin cirrus veil
  if (d.y > 0.012) {
    float alt = 1700.0;
    float t = (alt - uCam.y) / d.y;
    vec2 p = uCam.xz + d.xz * t;
    int oct = uCapture > 0.5 ? 3 : 5;
    float cov = clamp(uCover, 0.0, 1.0);
    float dn = cloudDensity(p, cov, oct);
    if (dn > 0.003) {
      float ds = cloudDensity(p + uSunDir.xz * 260.0 / max(uSunDir.y, 0.12) * 0.35, cov, oct);
      float shade = exp(-max(0.0, ds - dn * 0.4) * 2.6);
      float phase = mix(phaseHG(sunMu, 0.62), phaseHG(sunMu, -0.2), 0.35) * 4.0 * PI_ * 0.18;
      vec3 sunL = uSunRad * (0.55 * shade + 0.5 * phase * shade) * 3.6;
      vec3 amb = skyAt(vec3(0.0, 1.0, 0.0)) * (0.55 + 0.25 * (1.0 - dn)) + skyAt(normalize(vec3(d.x, 0.25, d.z))) * 0.25;
      vec3 cc = sunL + amb * mix(1.0, 0.65, uOvercast);
      cc *= mix(1.0, 0.45, uOvercast * smoothstep(0.3, 1.0, dn));
      float fade = smoothstep(0.012, 0.16, d.y);                    // melt into the horizon haze
      vec3 horizon = skyAt(normalize(vec3(d.x, 0.01, d.z)));
      cc = mix(horizon, cc, fade);
      col = mix(col, cc, dn * mix(0.98, 1.0, uOvercast) * (0.25 + 0.75 * fade));
    }
    float cir = smoothstep(0.5, 0.9, fbm(vec2(p.x * 0.0003 + p.y * 0.00008, p.y * 0.0012) + uTime * 0.02, 4)) * 0.28 * (1.0 - cov * 0.5);
    col += (uSunRad * 0.35 + skyAt(d) * 0.4) * cir * smoothstep(0.02, 0.35, d.y);
  }
  if (uOvercast > 0.01) {   // a continuous grey deck of rain cloud, darker towards the horizon
    vec3 up = skyAt(vec3(0.0, 1.0, 0.0)); float lum = dot(up, vec3(0.3333));
    vec3 deck = vec3(lum) * vec3(0.66, 0.72, 0.82) * (0.55 + 0.6 * smoothstep(0.0, 0.5, uSunDir.y)) * (0.75 + 0.25 * smoothstep(0.0, 0.5, d.y));
    float amt = uOvercast * smoothstep(-0.02, 0.06, d.y) * 0.93; col = mix(col, deck, amt);
  }
  o = vec4(col, 1.0);
}`;

// --- CPU-side atmosphere helpers (same maths as the shader) so the directional lights get the right colour
function transmittanceToSun(sunElev) {
  const r0 = ATM.Rg + ATM.hObs, mu = Math.sin(sunElev);
  const dx = Math.sqrt(Math.max(0, 1 - mu * mu)), dy = mu;
  // planet shadow
  const b = r0 * dy, c = r0 * r0 - ATM.Rg * ATM.Rg, disc = b * b - c;
  if (disc >= 0 && -b - Math.sqrt(disc) > 0) return [0, 0, 0];
  const b2 = r0 * dy, c2 = r0 * r0 - ATM.Rt * ATM.Rt, d2 = b2 * b2 - c2, tt = -b2 + Math.sqrt(Math.max(0, d2));
  const N = 64, dt = tt / N; let od = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    const t = (i + .5) * dt, px = dx * t, py = r0 + dy * t, h = Math.hypot(px, py) - ATM.Rg;
    const dR = Math.exp(-h / 8), dM = Math.exp(-h / 1.2), dO = Math.max(0, 1 - Math.abs(h - 25) / 15);
    od[0] += (5.802e-3 * dR + 4.44e-3 * dM + 0.650e-3 * dO) * dt;
    od[1] += (13.558e-3 * dR + 4.44e-3 * dM + 1.881e-3 * dO) * dt;
    od[2] += (33.1e-3 * dR + 4.44e-3 * dM + 0.085e-3 * dO) * dt;
  }
  return od.map(v => Math.exp(-v));
}

export const LAT = 53.9;   // Wismar
export function sunPosition(hour, dayOfYear = 182, latDeg = LAT) {
  const lat = latDeg * Math.PI / 180, decl = 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + dayOfYear) / 365);
  const H = (hour - 12) * 15 * Math.PI / 180;
  const sinEl = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(H);
  const el = Math.asin(clamp(sinEl, -1, 1));
  const cosAz = (Math.sin(decl) - Math.sin(el) * Math.sin(lat)) / (Math.cos(el) * Math.cos(lat) + 1e-9);
  let az = Math.acos(clamp(cosAz, -1, 1)); if (H > 0) az = 2 * Math.PI - az;   // azimuth from north, clockwise
  // world: +x east, -z north
  return { el, az, dir: new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)) };
}

export class Sky {
  constructor(renderer) {
    this.r = renderer;
    const hf = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, depthBuffer: false, generateMipmaps: false };
    this.transRT = new THREE.WebGLRenderTarget(256, 64, hf);
    this.skyRT = new THREE.WebGLRenderTarget(192, 108, { ...hf, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping });
    this.quadGeo = new THREE.BufferGeometry();
    this.quadGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.transMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: FULLSCREEN_VS, fragmentShader: TRANS_FS, depthTest: false, depthWrite: false });
    this.skyViewMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: FULLSCREEN_VS, fragmentShader: SKYVIEW_FS, depthTest: false, depthWrite: false,
      uniforms: { uTrans: { value: this.transRT.texture }, uSunElev: { value: 0.5 }, uSunE: { value: E_SUN }, uObsH: { value: ATM.hObs } } });
    this.quadMesh = new THREE.Mesh(this.quadGeo, this.transMat); this.quadMesh.frustumCulled = false;
    this.quadScene = new THREE.Scene(); this.quadScene.add(this.quadMesh);
    this.renderQuad(this.transMat, this.transRT);

    this.uniforms = {
      uSkyLUT: { value: this.skyRT.texture }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
      uSunRad: { value: new THREE.Vector3(1, 1, 1) }, uMoonRad: { value: new THREE.Vector3(.1, .12, .2) }, uTime: { value: 0 },
      uCover: { value: 0.35 }, uStars: { value: 0 }, uCam: { value: new THREE.Vector3() }, uCapture: { value: 0 }, uOvercast: { value: 0 }, uMoonPhase: { value: 0.9 },
    };
    this.domeGeo = new THREE.SphereGeometry(1, 48, 32);
    this.domeMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, depthTest: true });
    this.dome = new THREE.Mesh(this.domeGeo, this.domeMat); this.dome.frustumCulled = false; this.dome.renderOrder = -1000; this.dome.scale.setScalar(1);
    // environment capture dome (no sun disc, cheaper clouds)
    this.capUniforms = { ...this.uniforms, uCapture: { value: 1 } };
    this.capMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: this.capUniforms, side: THREE.BackSide, depthWrite: false, depthTest: false });
    this.capScene = new THREE.Scene(); this.capDome = new THREE.Mesh(this.domeGeo, this.capMat); this.capDome.frustumCulled = false; this.capScene.add(this.capDome);
    this.cubeRT = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.LinearFilter });
    this.cubeCam = new THREE.CubeCamera(0.1, 10, this.cubeRT);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = null; this.envKey = "";
    this.state = { hour: 12, sunEl: 0.8, sunDir: new THREE.Vector3(0, 1, 0), moonDir: new THREE.Vector3(0, -1, 0), sunColor: new THREE.Color(1, 1, 1), sunIntensity: 10, moonIntensity: 0, nightness: 0, darkness: 0, dayOfYear: 182, ambientLum: 1 };
  }
  renderQuad(mat, rt) {
    this.quadMesh.material = mat; const prev = this.r.getRenderTarget();
    this.r.setRenderTarget(rt); this.r.render(this.quadScene, this.quadCam); this.r.setRenderTarget(prev);
  }
  /** hour 0-24, cover 0-1 cloud coverage, overcast 0-1 (grey rain sky), time in seconds for animation */
  update(hour, cover, overcast, time, cam, dayOfYear = 182) {
    const sp = sunPosition(hour, dayOfYear), S = this.state;
    S.hour = hour; S.sunEl = sp.el; S.sunDir.copy(sp.dir);
    // moon roughly opposite the sun, a little off the ecliptic
    const lunar = (dayOfYear % 29.53) / 29.53, mp = sunPosition(hour + 12 - lunar * 24, dayOfYear + 5, LAT);
    S.moonDir.copy(mp.dir);
    const T = transmittanceToSun(sp.el), E = E_SUN;
    const sunTint = new THREE.Color(T[0], T[1], T[2]);
    const dim = 1 - 0.78 * overcast;
    S.sunColor.copy(sunTint); S.sunIntensity = E * dim * (1 - 0.35 * cover);
    const night = smoothstep(0.02, -0.12, sp.el);              // lamps / lit windows (from about civil dusk)
    const dark = smoothstep(-0.10, -0.30, sp.el);             // true darkness: stars, moonlight (astronomical twilight ends at -18 deg)
    S.nightness = night; S.darkness = dark; S.dayOfYear = dayOfYear;
    const moonUp = smoothstep(-0.02, 0.12, S.moonDir.y);
    S.moonIntensity = 0.2 * moonUp * Math.max(dark, 0.25 * night) * dim;
    this.skyViewMat.uniforms.uSunElev.value = sp.el;
    this.renderQuad(this.skyViewMat, this.skyRT);
    const u = this.uniforms;
    u.uSunDir.value.copy(S.sunDir); u.uMoonDir.value.copy(S.moonDir);
    u.uSunRad.value.set(T[0] * E, T[1] * E, T[2] * E).multiplyScalar(dim * 0.06 / 0.06);
    u.uMoonRad.value.set(0.55, 0.62, 0.8).multiplyScalar(0.05 * moonUp);
    u.uTime.value = time; u.uCover.value = cover; u.uOvercast.value = overcast; u.uStars.value = dark * (1 - 0.8 * overcast) * (1 - cover * 0.6);
    u.uCam.value.copy(cam.position);
    this.dome.position.copy(cam.position); this.dome.scale.setScalar(900);
    return S;
  }
  /** (Re)captures the environment map used for image-based lighting. Cheap enough to run every few seconds. */
  captureEnv(position) {
    this.cubeCam.position.copy(position);
    this.capUniforms.uCam.value.copy(position);
    this.capDome.scale.setScalar(5);
    this.cubeCam.update(this.r, this.capScene);
    const old = this.envRT; this.envRT = this.pmrem.fromCubemap(this.cubeRT.texture); if (old) old.dispose();
    return this.envRT.texture;
  }
}

export const AERIAL_GLSL = /* glsl */`
// Aerial perspective: blend towards the sky-view LUT colour in the view direction, with Rayleigh/Mie-like per-channel extinction.
uniform sampler2D uSkyLUT; uniform vec3 uSunDirW; uniform float uHaze; uniform vec3 uCamW;
${ATM_GLSL}
vec3 skyFogColor(vec3 dir) { vec3 d = normalize(vec3(dir.x, max(dir.y, 0.0) * 0.55 + 0.004, dir.z)); return texture(uSkyLUT, skyUV(d, uSunDirW)).rgb; }
vec3 applyAerial(vec3 col, vec3 wpos) {
  vec3 v = wpos - uCamW; float dist = length(v); vec3 dir = v / max(dist, 1e-3);
  float hAvg = max(0.0, 0.5 * (wpos.y + uCamW.y));
  float dens = exp(-hAvg / 1600.0);
  vec3 ext = (betaR * 0.55 + vec3(betaMe * 0.9)) * 1.0e-3 * dens * (1.0 + uHaze * 9.0);
  vec3 T = exp(-ext * dist * 1.0);
  return col * T + skyFogColor(dir) * (1.0 - T);
}
`;
