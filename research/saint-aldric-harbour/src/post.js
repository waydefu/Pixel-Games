// HDR post chain: MSAA half-float scene target -> Jimenez-style bloom (13-tap down, tent up) -> GPU auto-exposure (no readback)
// -> AgX tone mapping with a light grade -> vignette, grain, dither -> screen. Dynamic resolution only changes the scene target size.
import * as THREE from "three";

const VS = /* glsl */`out vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const DOWN_FS = /* glsl */`
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform vec2 uTexel; uniform float uKaris;
vec3 s(vec2 uv) { return texture(uTex, uv).rgb; }
float karis(vec3 c) { return 1.0 / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722))); }
void main() {
  vec2 t = uTexel;
  vec3 a = s(vUv + t * vec2(-2, 2)), b = s(vUv + t * vec2(0, 2)), c = s(vUv + t * vec2(2, 2));
  vec3 d = s(vUv + t * vec2(-2, 0)), e = s(vUv), f = s(vUv + t * vec2(2, 0));
  vec3 g = s(vUv + t * vec2(-2, -2)), h = s(vUv + t * vec2(0, -2)), i = s(vUv + t * vec2(2, -2));
  vec3 j = s(vUv + t * vec2(-1, 1)), k = s(vUv + t * vec2(1, 1)), l = s(vUv + t * vec2(-1, -1)), m = s(vUv + t * vec2(1, -1));
  vec3 r;
  if (uKaris > 0.5) {
    vec3 g0 = (a + b + d + e) * 0.25, g1 = (b + c + e + f) * 0.25, g2 = (d + e + g + h) * 0.25, g3 = (e + f + h + i) * 0.25, g4 = (j + k + l + m) * 0.25;
    r = g0 * 0.125 * karis(g0) + g1 * 0.125 * karis(g1) + g2 * 0.125 * karis(g2) + g3 * 0.125 * karis(g3) + g4 * 0.5 * karis(g4);
    r /= max(0.125 * (karis(g0) + karis(g1) + karis(g2) + karis(g3)) + 0.5 * karis(g4), 1e-4);
  } else {
    r = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  }
  o = vec4(max(r, vec3(0.0)), 1.0);
}`;

const UP_FS = /* glsl */`
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform float uRadius;
void main() {
  vec2 r = vec2(uRadius);
  vec3 c = texture(uTex, vUv).rgb * 4.0;
  c += texture(uTex, vUv + vec2(-r.x, 0)).rgb * 2.0 + texture(uTex, vUv + vec2(r.x, 0)).rgb * 2.0 + texture(uTex, vUv + vec2(0, -r.y)).rgb * 2.0 + texture(uTex, vUv + vec2(0, r.y)).rgb * 2.0;
  c += texture(uTex, vUv + vec2(-r.x, -r.y)).rgb + texture(uTex, vUv + vec2(r.x, -r.y)).rgb + texture(uTex, vUv + vec2(-r.x, r.y)).rgb + texture(uTex, vUv + vec2(r.x, r.y)).rgb;
  o = vec4(c / 16.0, 1.0);
}`;

const EXPO_FS = /* glsl */`
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uSmall; uniform sampler2D uPrev; uniform float uDt; uniform float uBias; uniform vec2 uMinMax; uniform float uFirst;
void main() {
  float sum = 0.0;
  for (int y = 0; y < 5; y++) for (int x = 0; x < 5; x++) {
    vec3 c = texture(uSmall, (vec2(float(x), float(y)) + 0.5) / 5.0).rgb;
    sum += log(max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-4));
  }
  float avg = exp(sum / 25.0);
  // auto exposure; rises in 0.9 s, falls in 2.2 s
  float target = clamp(0.20 / avg * uBias, uMinMax.x, uMinMax.y);   // absolute range (0.02..5): the earlier +-0.7 EV clamp around 1.0 blew out bright noon scenes and left nights too dark
  float prev = texture(uPrev, vec2(0.5)).r;
  float k = 1.0 - exp(-uDt / (target > prev ? 0.9 : 2.2));
  float e = uFirst > 0.5 ? target : mix(prev, target, k);
  o = vec4(e, 0.0, 0.0, 1.0);
}`;

const COMPOSITE_FS = /* glsl */`
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uScene; uniform sampler2D uBloom; uniform sampler2D uExposure;
uniform float uBloomK; uniform float uTime; uniform float uVignette; uniform float uGrain; uniform vec3 uTint; uniform float uDark; uniform float uSat; uniform float uContrast; uniform vec2 uRes;
const mat3 R2020toSRGB = mat3(vec3(1.6605, -0.1246, -0.0182), vec3(-0.5876, 1.1329, -0.1006), vec3(-0.0728, -0.0083, 1.1187));
const mat3 SRGBtoR2020 = mat3(vec3(0.6274, 0.0691, 0.0164), vec3(0.3293, 0.9195, 0.0880), vec3(0.0433, 0.0113, 0.8956));
vec3 agxContrast(vec3 x) { vec3 x2 = x * x, x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; }
vec3 agx(vec3 c) {
  const mat3 inset = mat3(vec3(0.856627153315983, 0.137318972929847, 0.11189821299995), vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903), vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
  const mat3 outset = mat3(vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826), vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294), vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
  c = SRGBtoR2020 * c; c = inset * c; c = max(c, 1e-10); c = log2(c);
  c = (c - (-12.47393)) / (4.026069 - (-12.47393)); c = clamp(c, 0.0, 1.0);
  c = agxContrast(c); c = outset * c; c = pow(max(vec3(0.0), c), vec3(2.2)); c = R2020toSRGB * c; return clamp(c, 0.0, 1.0);
}
vec3 oetf(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main() {
  vec3 hdr = texture(uScene, vUv).rgb;
  vec3 bloom = texture(uBloom, vUv).rgb;
  float ex = texture(uExposure, vec2(0.5)).r;
  vec3 c = (hdr + bloom * uBloomK) * ex;
  c = agx(c);
  // light grade: a touch of contrast, warm highlights / cool shadows, saturation
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  c = (c - 0.5) * uContrast + 0.5;
  c *= mix(vec3(1.0), uTint, smoothstep(0.2, 0.9, l));
  // Purkinje shift: in low light reds fall away, blues/greens stay, saturation drops
  { float lu = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = mix(c, vec3(lu) * vec3(0.62, 0.82, 1.18), 0.55 * uDark); c.r *= 1.0 - 0.22 * uDark; }
  vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y;
  float vig = 1.0 - uVignette * smoothstep(0.35, 1.05, length(q) * 1.25);
  c *= vig;
  c = max(c, 0.0);
  c = oetf(c);
  float g = (hash(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5);
  c += g * uGrain * (0.4 + 0.6 * (1.0 - l));
  c += (hash(gl_FragCoord.xy * 1.37 + 7.0) + hash(gl_FragCoord.xy * 0.73 + 3.0) - 1.0) / 255.0;   // triangular dither
  o = vec4(c, 1.0);
}`;

export class Post {
  constructor(renderer, opts = {}) {
    this.r = renderer;
    this.q = { msaa: 4, bloom: true, ...opts };
    this.size = new THREE.Vector2(1, 1); this.scale = 1;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.mesh = new THREE.Mesh(this.geo, null); this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene(); this.scene.add(this.mesh);
    const mk = (fs, uniforms, extra = {}) => new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, ...extra });
    this.down = mk(DOWN_FS, { uTex: { value: null }, uTexel: { value: new THREE.Vector2() }, uKaris: { value: 0 } });
    this.up = mk(UP_FS, { uTex: { value: null }, uRadius: { value: 0.005 } }, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
    this.expo = mk(EXPO_FS, { uSmall: { value: null }, uPrev: { value: null }, uDt: { value: 0.016 }, uBias: { value: 1 }, uMinMax: { value: new THREE.Vector2(0.03, 60) }, uFirst: { value: 1 } });
    this.comp = mk(COMPOSITE_FS, { uScene: { value: null }, uBloom: { value: null }, uExposure: { value: null }, uBloomK: { value: 0.07 }, uTime: { value: 0 }, uVignette: { value: 0.28 }, uGrain: { value: 0.012 },
      uTint: { value: new THREE.Vector3(1.03, 1.0, 0.95) }, uDark: { value: 0 }, uSat: { value: 1.08 }, uContrast: { value: 1.06 }, uRes: { value: new THREE.Vector2(1, 1) } });
    const hf = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, generateMipmaps: false, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping };
    this.hf = hf;
    this.expRT = [new THREE.WebGLRenderTarget(1, 1, hf), new THREE.WebGLRenderTarget(1, 1, hf)]; this.expIdx = 0; this.first = true;
    this.sceneRT = null; this.bloomRT = [];
    this.exposureBias = 1;
  }
  setSize(w, h, scale = 1) {
    this.size.set(w, h); this.scale = scale;
    const sw = Math.max(64, Math.floor(w * scale)), sh = Math.max(64, Math.floor(h * scale));
    if (this.sceneRT) this.sceneRT.dispose();
    this.sceneRT = new THREE.WebGLRenderTarget(sw, sh, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, stencilBuffer: false, samples: this.q.msaa, generateMipmaps: false });
    for (const t of this.bloomRT) t.dispose();
    this.bloomRT = [];
    let bw = sw, bh = sh;
    for (let i = 0; i < 6; i++) { bw = Math.max(2, bw >> 1); bh = Math.max(2, bh >> 1); this.bloomRT.push(new THREE.WebGLRenderTarget(bw, bh, this.hf)); }
    this.comp.uniforms.uRes.value.set(w, h);
  }
  pass(mat, target) { this.mesh.material = mat; this.r.setRenderTarget(target); this.r.render(this.scene, this.cam); }
  /** call after the scene has been rendered into post.sceneRT */
  finish(dt, time) {
    const r = this.r;
    let src = this.sceneRT.texture, sw = this.sceneRT.width, sh = this.sceneRT.height;
    if (this.q.bloom) {
      for (let i = 0; i < this.bloomRT.length; i++) {
        const t = this.bloomRT[i];
        this.down.uniforms.uTex.value = src; this.down.uniforms.uTexel.value.set(1 / sw, 1 / sh); this.down.uniforms.uKaris.value = i === 0 ? 1 : 0;
        this.pass(this.down, t); src = t.texture; sw = t.width; sh = t.height;
      }
      for (let i = this.bloomRT.length - 1; i > 0; i--) { this.up.uniforms.uTex.value = this.bloomRT[i].texture; this.up.uniforms.uRadius.value = 0.0045 * (1 + (this.bloomRT.length - i) * 0.35); this.pass(this.up, this.bloomRT[i - 1]); }
    }
    const small = this.bloomRT[Math.min(4, this.bloomRT.length - 1)];
    const prev = this.expRT[this.expIdx], next = this.expRT[1 - this.expIdx];
    this.expo.uniforms.uSmall.value = (this.q.bloom ? small : this.sceneRT).texture; this.expo.uniforms.uPrev.value = prev.texture;
    this.expo.uniforms.uDt.value = dt; this.expo.uniforms.uBias.value = this.exposureBias; this.expo.uniforms.uFirst.value = this.first ? 1 : 0; this.first = false;
    this.pass(this.expo, next); this.expIdx = 1 - this.expIdx;
    const u = this.comp.uniforms;
    u.uScene.value = this.sceneRT.texture; u.uBloom.value = this.q.bloom ? this.bloomRT[0].texture : this.sceneRT.texture; u.uExposure.value = next.texture; u.uTime.value = time;
    u.uBloomK.value = this.q.bloom ? 0.075 : 0;
    this.pass(this.comp, null);
  }
}
