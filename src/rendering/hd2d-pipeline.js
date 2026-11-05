import * as THREE from "three";

/**
 * HD-2D frame pipeline. ONE linear-light path for every quality tier, so fog,
 * tone mapping and colour grading look the same on Basic, Balanced and High:
 *
 *   scene (linear HDR target, MSAA on Balanced/High, depth texture)
 *     -> bloom pyramid          (Balanced+, half-res dual-filter, soft threshold)
 *     -> depth-of-field gather  (High, half-res, circle-of-confusion from depth)
 *     -> composite              (exposure, filmic tone map, split-tone grade,
 *                                vignette, grain, sRGB encode) -> canvas
 *
 * Original implementation of well-known techniques (dual Kawase bloom, Vogel-disc
 * DoF gather, Narkowicz ACES fit). No third-party shader code is copied.
 */

export const TIER_FEATURES = Object.freeze({
  basic: Object.freeze({ msaa: 0, bloom: false, dof: false, bloomLevels: 0 }),
  balanced: Object.freeze({ msaa: 4, bloom: true, dof: false, bloomLevels: 4 }),
  high: Object.freeze({ msaa: 4, bloom: true, dof: true, bloomLevels: 5 }),
});

export function getTierFeatures(quality) {
  const features = Object.hasOwn(TIER_FEATURES, quality) ? TIER_FEATURES[quality] : null;
  if (!features) throw new RangeError("Unknown quality profile: " + String(quality));
  return features;
}

/** Linear view-space distance from a [0,1] depth-buffer value. */
export function linearDepth(depth, near, far, orthographic) {
  if (orthographic) return near + depth * (far - near);
  const ndc = depth * 2 - 1;
  return (2 * near * far) / (far + near - ndc * (far - near));
}

/** Circle of confusion in [0,1]: 0 inside the focus band, 1 at full blur. */
export function circleOfConfusion(distance, focus, range, span) {
  const outside = Math.abs(distance - focus) - range;
  return Math.min(1, Math.max(0, outside / Math.max(1e-4, span)));
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const DEPTH_GLSL = /* glsl */ `
uniform sampler2D tDepth;
uniform vec3 uCamera; // near, far, orthographic(1/0)
float viewDistance(vec2 uv){
  float d = texture2D(tDepth, uv).x;
  if (uCamera.z > 0.5) return uCamera.x + d * (uCamera.y - uCamera.x);
  float ndc = d * 2.0 - 1.0;
  return 2.0 * uCamera.x * uCamera.y / (uCamera.y + uCamera.x - ndc * (uCamera.y - uCamera.x));
}`;

const PREFILTER_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tScene;
uniform vec2 uTexel;
uniform vec2 uThreshold; // threshold, knee
vec3 fetch(vec2 uv){ return texture2D(tScene, uv).rgb; }
void main(){
  vec3 c = 0.25 * (fetch(vUv + uTexel * vec2(-1.0,-1.0)) + fetch(vUv + uTexel * vec2(1.0,-1.0)) +
                   fetch(vUv + uTexel * vec2(-1.0, 1.0)) + fetch(vUv + uTexel * vec2(1.0, 1.0)));
  float peak = max(c.r, max(c.g, c.b));
  float soft = clamp(peak - uThreshold.x + uThreshold.y, 0.0, 2.0 * uThreshold.y);
  soft = soft * soft / (4.0 * uThreshold.y + 1e-4);
  float contribution = max(soft, peak - uThreshold.x) / max(peak, 1e-4);
  gl_FragColor = vec4(c * contribution, 1.0);
}`;

const DOWN_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tSource;
uniform vec2 uTexel;
void main(){
  vec3 c = texture2D(tSource, vUv).rgb * 4.0;
  c += texture2D(tSource, vUv + uTexel * vec2(-1.0,-1.0)).rgb;
  c += texture2D(tSource, vUv + uTexel * vec2( 1.0,-1.0)).rgb;
  c += texture2D(tSource, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
  c += texture2D(tSource, vUv + uTexel * vec2( 1.0, 1.0)).rgb;
  gl_FragColor = vec4(c / 8.0, 1.0);
}`;

const UP_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tSource;  // smaller level (already accumulated)
uniform sampler2D tCurrent; // same-size down level
uniform vec2 uTexel;        // texel of the smaller level
uniform float uScatter;
void main(){
  vec3 c = vec3(0.0);
  c += texture2D(tSource, vUv + uTexel * vec2(-1.0, 0.0)).rgb * 2.0;
  c += texture2D(tSource, vUv + uTexel * vec2( 1.0, 0.0)).rgb * 2.0;
  c += texture2D(tSource, vUv + uTexel * vec2( 0.0,-1.0)).rgb * 2.0;
  c += texture2D(tSource, vUv + uTexel * vec2( 0.0, 1.0)).rgb * 2.0;
  c += texture2D(tSource, vUv + uTexel * vec2(-1.0,-1.0)).rgb;
  c += texture2D(tSource, vUv + uTexel * vec2( 1.0,-1.0)).rgb;
  c += texture2D(tSource, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
  c += texture2D(tSource, vUv + uTexel * vec2( 1.0, 1.0)).rgb;
  c /= 12.0;
  gl_FragColor = vec4(texture2D(tCurrent, vUv).rgb + c * uScatter, 1.0);
}`;

const DOF_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tScene;
uniform vec2 uTexel;       // full-res texel
uniform vec4 uFocus;       // focus distance, in-focus half range, blur span, max radius (px)
${DEPTH_GLSL}
float cocAt(vec2 uv){
  float z = viewDistance(uv);
  return clamp((abs(z - uFocus.x) - uFocus.y) / uFocus.z, 0.0, 1.0);
}
void main(){
  float coc = cocAt(vUv);
  vec3 sum = texture2D(tScene, vUv).rgb;
  float weight = 1.0;
  float radius = coc * uFocus.w;
  if (radius > 0.35) {
    const int TAPS = 20;
    for (int i = 0; i < TAPS; i++) {
      float fi = float(i) + 0.5;
      float r = sqrt(fi / float(TAPS));
      float a = fi * 2.39996323;
      vec2 offset = vec2(cos(a), sin(a)) * r * radius * uTexel;
      vec2 uv = vUv + offset;
      float cs = cocAt(uv);
      // Samples that are sharper than the centre must not smear into it.
      float w = smoothstep(0.0, 1.0, cs / max(coc, 1e-3));
      sum += texture2D(tScene, uv).rgb * w;
      weight += w;
    }
  }
  gl_FragColor = vec4(sum / weight, coc);
}`;

const COMPOSITE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform sampler2D tDof;
uniform float uUseBloom;
uniform float uUseDof;
uniform float uBloomStrength;
uniform float uExposure;
uniform float uSaturation;
uniform float uContrast;
uniform float uVignette;
uniform float uGrain;
uniform float uTime;
uniform vec3 uShadowTint;
uniform vec3 uHighlightTint;
vec3 acesFit(vec3 x){
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec3 srgbEncode(vec3 c){
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}
float hash12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main(){
  vec3 col = texture2D(tScene, vUv).rgb;
  if (uUseDof > 0.5) {
    vec4 d = texture2D(tDof, vUv);
    col = mix(col, d.rgb, smoothstep(0.04, 0.55, d.a));
  }
  if (uUseBloom > 0.5) col += texture2D(tBloom, vUv).rgb * uBloomStrength;
  col *= uExposure;
  vec3 mapped = acesFit(col);
  // Split toning in display space: cool shadows, warm highlights (pixel-art style).
  float luma = dot(mapped, vec3(0.2126, 0.7152, 0.0722));
  vec3 tint = mix(uShadowTint, uHighlightTint, smoothstep(0.12, 0.85, luma));
  mapped *= tint;
  luma = dot(mapped, vec3(0.2126, 0.7152, 0.0722));
  mapped = mix(vec3(luma), mapped, uSaturation);
  mapped = clamp((mapped - 0.5) * uContrast + 0.5, 0.0, 1.0);
  vec2 q = vUv - 0.5;
  float vig = 1.0 - uVignette * smoothstep(0.25, 0.85, dot(q, q) * 2.0);
  mapped *= vig;
  vec3 outColor = srgbEncode(mapped);
  float n = hash12(gl_FragCoord.xy + fract(uTime) * 71.0) - 0.5;
  outColor += n * uGrain;
  gl_FragColor = vec4(clamp(outColor, 0.0, 1.0), 1.0);
}`;

function fullscreenMaterial(fragmentShader, uniforms) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader, uniforms,
    depthTest: false, depthWrite: false, toneMapped: false, fog: false,
  });
}

/**
 * @param {{renderer:any, scene:any, camera:any, quality?:string}} options
 */
export function createHd2dPipeline({ renderer, scene, camera, quality = "balanced" }) {
  if (!renderer || !scene || !camera) throw new TypeError("renderer, scene and camera are required");
  const extensions = renderer.extensions;
  const hdr = !!(extensions?.has("EXT_color_buffer_float") || extensions?.has("EXT_color_buffer_half_float"));
  const targetType = hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;

  const quadGeometry = new THREE.BufferGeometry();
  quadGeometry.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  quadGeometry.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const quad = new THREE.Mesh(quadGeometry, undefined);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const cameraUniform = { value: new THREE.Vector3(0.1, 1000, 0) };
  const depthUniform = { value: null };
  const materials = {
    prefilter: fullscreenMaterial(PREFILTER_FRAG, {
      tScene: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: new THREE.Vector2(1.05, 0.55) },
    }),
    down: fullscreenMaterial(DOWN_FRAG, { tSource: { value: null }, uTexel: { value: new THREE.Vector2() } }),
    up: fullscreenMaterial(UP_FRAG, {
      tSource: { value: null }, tCurrent: { value: null }, uTexel: { value: new THREE.Vector2() }, uScatter: { value: 0.72 },
    }),
    dof: fullscreenMaterial(DOF_FRAG, {
      tScene: { value: null }, uTexel: { value: new THREE.Vector2() },
      uFocus: { value: new THREE.Vector4(30, 6, 26, 10) }, tDepth: depthUniform, uCamera: cameraUniform,
    }),
    composite: fullscreenMaterial(COMPOSITE_FRAG, {
      tScene: { value: null }, tBloom: { value: null }, tDof: { value: null },
      uUseBloom: { value: 0 }, uUseDof: { value: 0 }, uBloomStrength: { value: 0.55 },
      uExposure: { value: 1.18 }, uSaturation: { value: 1.12 }, uContrast: { value: 1.06 },
      uVignette: { value: 0.30 }, uGrain: { value: 0.022 }, uTime: { value: 0 },
      uShadowTint: { value: new THREE.Vector3(0.93, 0.98, 1.07) },
      uHighlightTint: { value: new THREE.Vector3(1.07, 1.01, 0.91) },
    }),
  };

  let activeCamera = camera;
  let currentQuality = quality;
  let features = getTierFeatures(quality);
  let size = { width: 2, height: 2 };
  let disposed = false;
  let sceneTarget = null, dofTarget = null, down = [], up = [];
  const focus = { distance: 30, range: 5, span: 28, strength: 1 };
  const grade = materials.composite.uniforms;

  function makeTarget(width, height, withDepth, samples) {
    const target = new THREE.WebGLRenderTarget(Math.max(1, width), Math.max(1, height), {
      type: targetType, format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: false,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, samples,
    });
    if (withDepth) {
      target.depthTexture = new THREE.DepthTexture(Math.max(1, width), Math.max(1, height));
      target.depthTexture.type = THREE.UnsignedIntType;
    }
    return target;
  }
  function makeFlat(width, height) {
    const target = makeTarget(width, height, false, 0);
    target.depthBuffer = false;
    return target;
  }
  function disposeTargets() {
    sceneTarget?.depthTexture?.dispose();
    sceneTarget?.dispose(); dofTarget?.dispose();
    for (const t of down) t.dispose();
    for (const t of up) t.dispose();
    sceneTarget = dofTarget = null; down = []; up = [];
  }
  function allocate() {
    disposeTargets();
    const { width, height } = size;
    sceneTarget = makeTarget(width, height, true, features.msaa);
    depthUniform.value = sceneTarget.depthTexture;
    if (features.bloom) {
      for (let i = 0; i < features.bloomLevels; i++) {
        const w = Math.max(1, width >> (i + 1)), h = Math.max(1, height >> (i + 1));
        down.push(makeFlat(w, h));
        if (i < features.bloomLevels - 1) up.push(makeFlat(w, h));
      }
    }
    if (features.dof) dofTarget = makeFlat(width >> 1, height >> 1);
  }

  function pass(material, target) {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(quadScene, quadCamera);
  }

  function setSize(width, height) {
    if (disposed) return;
    if (![width, height].every(v => Number.isFinite(v) && v > 0)) throw new RangeError("invalid post target dimensions");
    size = { width: Math.floor(width), height: Math.floor(height) };
    allocate();
  }
  function setQuality(value) {
    if (disposed) return;
    const next = getTierFeatures(value);
    const rebuild = next.msaa !== features.msaa || next.bloomLevels !== features.bloomLevels || next.dof !== features.dof;
    currentQuality = value; features = next;
    if (rebuild && sceneTarget) allocate();
  }
  function setCamera(value) { if (!disposed) activeCamera = value; }
  /** distance along the view axis that is razor sharp; strength 0 disables DoF. */
  function setFocus({ distance, range = focus.range, span = focus.span, strength = 1 }) {
    focus.distance = distance; focus.range = range; focus.span = span; focus.strength = strength;
  }
  function setGrade(values) {
    for (const [key, value] of Object.entries(values)) {
      const uniform = grade[key];
      if (!uniform) throw new RangeError("unknown grade uniform " + key);
      if (uniform.value?.isVector3 && Array.isArray(value)) uniform.value.set(...value);
      else uniform.value = value;
    }
  }

  function render(time = 0) {
    if (disposed || !sceneTarget) return false;
    const info = renderer.info;
    const previousAutoReset = info?.autoReset;
    if (info) { info.autoReset = false; info.reset(); }
    const previousTarget = renderer.getRenderTarget();
    try {
      cameraUniform.value.set(activeCamera.near, activeCamera.far, activeCamera.isOrthographicCamera ? 1 : 0);
      renderer.setRenderTarget(sceneTarget);
      renderer.clear();
      renderer.render(scene, activeCamera);

      let bloomTexture = null;
      if (features.bloom && down.length) {
        const m = materials;
        m.prefilter.uniforms.tScene.value = sceneTarget.texture;
        m.prefilter.uniforms.uTexel.value.set(1 / size.width, 1 / size.height);
        pass(m.prefilter, down[0]);
        for (let i = 1; i < down.length; i++) {
          m.down.uniforms.tSource.value = down[i - 1].texture;
          m.down.uniforms.uTexel.value.set(1 / down[i - 1].width, 1 / down[i - 1].height);
          pass(m.down, down[i]);
        }
        let smaller = down[down.length - 1];
        for (let i = down.length - 2; i >= 0; i--) {
          m.up.uniforms.tSource.value = smaller.texture;
          m.up.uniforms.tCurrent.value = down[i].texture;
          m.up.uniforms.uTexel.value.set(1 / smaller.width, 1 / smaller.height);
          pass(m.up, up[i]);
          smaller = up[i];
        }
        bloomTexture = smaller.texture;
      }

      const useDof = features.dof && dofTarget && focus.strength > 0;
      if (useDof) {
        const m = materials.dof;
        m.uniforms.tScene.value = sceneTarget.texture;
        m.uniforms.uTexel.value.set(1 / size.width, 1 / size.height);
        m.uniforms.uFocus.value.set(focus.distance, focus.range, focus.span, size.height * 0.0105 * focus.strength);
        pass(m, dofTarget);
      }

      const c = materials.composite.uniforms;
      c.tScene.value = sceneTarget.texture;
      c.tBloom.value = bloomTexture;
      c.tDof.value = useDof ? dofTarget.texture : null;
      c.uUseBloom.value = bloomTexture ? 1 : 0;
      c.uUseDof.value = useDof ? 1 : 0;
      c.uTime.value = time;
      pass(materials.composite, null);
    } finally {
      renderer.setRenderTarget(previousTarget);
      if (info) info.autoReset = previousAutoReset;
    }
    return true;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    disposeTargets();
    for (const m of Object.values(materials)) m.dispose();
    quadGeometry.dispose();
  }

  return Object.freeze({
    setSize, setQuality, setCamera, setFocus, setGrade, render, dispose,
    get hdr() { return hdr; },
    get quality() { return currentQuality; },
    get features() { return features; },
    get size() { return { ...size }; },
    get grade() { return grade; },
  });
}
