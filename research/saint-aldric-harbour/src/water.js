// Water: camera-centred polar clipmap. Fourth round: spectral FFT cascades (ocean.js) displace the vertices and give the normals, Jacobian whitecaps and
// Beer-Lambert colour; the Gerstner path is kept behind ?gerstner=1. Depth absorption / shore foam from a baked
// terrain-height texture, premultiplied alpha so shallows show the sea bed while reflections stay intact. Lit by the same PBR/IBL/CSM path as everything else.
import * as THREE from "three";
import { patch, AU } from "./materials.js";
import { TNOISE_GLSL } from "./textures.js";
import { OCEAN_TIERS } from "./ocean.js";

export const HRECT = { x0: -520, z0: -520, size: 1040, res: 1041 };

export function bakeHeightTexture(W) {
  const n = HRECT.res, step = HRECT.size / (n - 1), data = new Uint16Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) data[j * n + i] = THREE.DataUtils.toHalfFloat(W.H(HRECT.x0 + i * step, HRECT.z0 + j * step));
  const t = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.HalfFloatType);
  t.minFilter = t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true; return t;
}

function polarGrid(rings = 150, seg = 240, r0 = 1.2, r1 = 15000) {
  const pos = [], idx = [], g = Math.pow(r1 / r0, 1 / (rings - 1));
  for (let i = 0; i < rings; i++) { const r = i === 0 ? 0 : r0 * Math.pow(g, i - 1); for (let j = 0; j < seg; j++) { const a = j / seg * Math.PI * 2; pos.push(Math.cos(a) * r, 0, Math.sin(a) * r); } }
  for (let i = 0; i < rings - 1; i++) for (let j = 0; j < seg; j++) { const a = i * seg + j, b = i * seg + (j + 1) % seg, c = (i + 1) * seg + j, d = (i + 1) * seg + (j + 1) % seg; idx.push(a, b, c, b, d, c); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5); return geo;
}

const WAVES_GLSL = /* glsl */`
uniform float uSea; uniform float uTime; uniform highp sampler2D uHeight; uniform vec3 uHRect;
float terrainH(vec2 p) { vec2 uv = (p - uHRect.xy) / uHRect.z; if (uv.x <= 0.0 || uv.y <= 0.0 || uv.x >= 1.0 || uv.y >= 1.0) return -30.0; return texture(uHeight, uv).r; }
const vec4 WV[5] = vec4[5](vec4(-0.62, -0.78, 62.0, 0.55), vec4(-0.90, -0.43, 31.0, 0.5), vec4(-0.25, -0.97, 17.0, 0.45), vec4(-0.75, -0.66, 8.3, 0.4), vec4(-0.45, -0.89, 3.6, 0.35));
float calmAt(vec2 p) { return mix(0.28, 1.0, smoothstep(55.0, 170.0, length(p - vec2(80.0, 125.0)))); }
void gerstner(vec2 p, float t, float damp, out vec3 disp, out vec2 slope) {
  disp = vec3(0.0); slope = vec2(0.0); damp *= calmAt(p);
  for (int i = 0; i < 5; i++) {
    vec2 d = normalize(WV[i].xy); float wl = WV[i].z, k = 6.2831853 / wl, c = sqrt(9.81 / k), a = WV[i].w / k * uSea * damp * (i < 2 ? 1.0 : 0.8);
    float ph = k * (dot(d, p) - c * t); float s = sin(ph), co = cos(ph);
    disp.xz += d * (a * co * 0.8); disp.y += a * s; slope += d * (a * k * co);
  }
}
`;

export function makeWaterGerstner(W, heightTex) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, transparent: true, depthWrite: false });
  if (new URLSearchParams(location.search).has("wdebug")) mat.defines = { WDEBUG: 1 };
  mat.blending = THREE.CustomBlending; mat.blendEquation = THREE.AddEquation; mat.blendSrc = THREE.OneFactor; mat.blendDst = THREE.OneMinusSrcAlphaFactor; mat.blendSrcAlpha = THREE.OneFactor; mat.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  const U = { uSea: { value: 0.5 }, uHeight: { value: heightTex }, uHRect: { value: new THREE.Vector3(HRECT.x0, HRECT.z0, HRECT.size) }, uFoamAmt: { value: 1 } };
  const edit = function waterEdit(sh) {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\n" + WAVES_GLSL + "\nvarying vec3 vWorld0;")
      .replace("#include <begin_vertex>", `
        vec3 transformed = position;
        vec3 wp0_ = (modelMatrix * vec4(position, 1.0)).xyz;
        float dh_ = -terrainH(wp0_.xz);
        float damp_ = smoothstep(0.1, 2.5, dh_) * (1.0 - 0.0);
        vec3 gd_; vec2 gs_; gerstner(wp0_.xz, uTime, damp_, gd_, gs_);
        transformed += gd_; vWorld0 = wp0_;
        `);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
${WAVES_GLSL}
${TNOISE_GLSL}
varying vec3 vWorld0;
uniform float uFoamAmt;
float fbm3(vec2 p) { return tNoise(p) * 0.5 + tNoise(p * 2.03 + 7.1) * 0.25 + tNoise(p * 4.1 + 3.7) * 0.125; }
`)
      .replace("#include <map_fragment>", `
        vec2 xz_ = vWPos.xz; float dist_ = length(vWPos - uCamW);
        float depth_ = max(-terrainH(xz_), 0.0); float dgrad_ = depth_;
        float damp_ = smoothstep(0.1, 2.5, depth_);
        vec3 gd_; vec2 gs_; gerstner(vWorld0.xz, uTime, damp_, gd_, gs_);
        // fine ripples
        vec2 q1 = xz_ * 0.9 + vec2(uTime * 0.35, uTime * 0.21), q2 = xz_ * 2.3 - vec2(uTime * 0.5, -uTime * 0.37);
        vec2 r1 = vec2(tNoise(q1 + vec2(0.07, 0.0)) - tNoise(q1 - vec2(0.07, 0.0)), tNoise(q1 + vec2(0.0, 0.07)) - tNoise(q1 - vec2(0.0, 0.07)));
        vec2 r2 = vec2(tNoise(q2 + vec2(0.05, 0.0)) - tNoise(q2 - vec2(0.05, 0.0)), tNoise(q2 + vec2(0.0, 0.05)) - tNoise(q2 - vec2(0.0, 0.05)));
        float fade_ = 1.0 / (1.0 + dist_ * dist_ / 9000.0);
        vec2 sl_ = gs_ + (r1 * 1.6 + r2 * 1.0) * (0.05 + 0.12 * uSea) * fade_ / 0.07 * 0.07 * 5.0;
        vec3 Nw_ = normalize(vec3(-sl_.x, 1.0, -sl_.y));
        { vec3 vdir_ = normalize(uCamW - vWPos); vec3 R_ = reflect(-vdir_, Nw_); if (R_.y < 0.04) Nw_ = normalize(Nw_ + vec3(0.0, 1.0, 0.0) * (0.04 - R_.y) * 1.2); }
        // colour of the water body: absorption with depth, a little turbidity near shore
        vec3 shallowC_ = vec3(0.10, 0.20, 0.16), deepC_ = vec3(0.004, 0.025, 0.04);
        float tdep_ = 1.0 - exp(-depth_ * 0.16);
        vec3 bodyC_ = mix(shallowC_, deepC_, tdep_);
        float alpha_ = clamp(1.0 - exp(-depth_ * 1.1), 0.0, 1.0);
        alpha_ = max(alpha_, 0.0);
        // shore foam bands + crest foam
        float nz_ = fbm3(xz_ * 0.8 + uTime * 0.05);
        float band_ = smoothstep(0.05, 0.9, 0.9 - depth_ * 0.9 + (sin(uTime * 0.7 - depth_ * 7.0) * 0.25 + nz_ * 0.6 - 0.3));
        float foam_ = clamp(band_ * smoothstep(1.4, 0.0, depth_) * smoothstep(0.0, 0.05, depth_ + 0.02), 0.0, 1.0);
        float crest_ = smoothstep(0.72, 1.1, gd_.y / max(0.001, 0.5 * uSea) * 0.5 + 0.5 + (nz_ - 0.5) * 0.3) * smoothstep(0.55, 1.0, uSea) * 0.5 * damp_;
        foam_ = clamp(foam_ + crest_, 0.0, 1.0) * uFoamAmt;
        diffuseColor.rgb = mix(bodyC_, vec3(0.78, 0.82, 0.84), foam_);
        alpha_ = max(alpha_, foam_);
        #ifdef WDEBUG
        diffuseColor.rgb = vec3(depth_ / 20.0, 0.0, 0.0); alpha_ = 1.0;
        #endif
        `)
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = mix(clamp(0.035 + 0.12 * uSea * (1.0 - fade_), 0.03, 0.6), 0.75, foam_);")
      .replace("#include <normal_fragment_maps>", "normal = normalize((viewMatrix * vec4(Nw_, 0.0)).xyz);")
      .replace("#include <opaque_fragment>", `
        { vec3 spec_ = reflectedLight.directSpecular + reflectedLight.indirectSpecular; vec3 dif_ = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
          gl_FragColor = vec4(dif_ * alpha_ + spec_ * (1.0 - foam_ * 0.7) , alpha_ + dot(spec_, vec3(0.3333)) * 0.0); }
        `);
  };
  patch(mat, edit, "water");
  const mesh = new THREE.Mesh(polarGrid(), mat); mesh.frustumCulled = false; mesh.renderOrder = 10; mesh.receiveShadow = false;
  return { mesh, mat, uniforms: U };
}

// ------------------------------------------------------------------------------------------------ spectral ocean (fourth round)
// Cascade c is a texture (R height, G/B horizontal displacement, A crest convergence); its distance fade keeps short waves from aliasing on the grid.
// The same damping (shallow water, harbour calm) and the same cascade sums as ocean.js heightAt(), so boats and bobbers ride the rendered waves.
const SPEC_HEAD = (nc) => `
uniform float uSea; uniform float uTime; uniform highp sampler2D uHeight; uniform vec3 uHRect;   // uCamW / uSunDirW come from the aerial chunk
uniform float uCL[${nc}]; uniform float uCN[${nc}]; uniform vec2 uCF[${nc}];
${Array.from({ length: nc }, (_, c) => `uniform highp sampler2D uCS${c};`).join("\n")}
float terrainH2(vec2 p) { vec2 uv = (p - uHRect.xy) / uHRect.z; if (uv.x <= 0.0 || uv.y <= 0.0 || uv.x >= 1.0 || uv.y >= 1.0) return -30.0; return texture(uHeight, uv).r; }
float calmAt2(vec2 p) { return mix(0.5, 1.0, smoothstep(55.0, 170.0, length(p - vec2(80.0, 125.0)))); }
float dampAt(vec2 p) { return smoothstep(0.1, 2.5, max(-terrainH2(p), 0.0)) * calmAt2(p); }
vec4 texBi(highp sampler2D s, vec2 p, float n) {   // manual bilinear with texelFetch (no float-filter extension needed); p in texel units
  vec2 f = p - 0.5, i0 = floor(f), w = f - i0;
  vec2 a = mod(i0, n), b = mod(i0 + 1.0, n);
  return mix(mix(texelFetch(s, ivec2(a), 0), texelFetch(s, ivec2(b.x, a.y), 0), w.x), mix(texelFetch(s, ivec2(a.x, b.y), 0), texelFetch(s, ivec2(b), 0), w.x), w.y);
}
vec4 oceanSample(vec2 p, float dist) {
  vec4 acc = vec4(0.0);
${Array.from({ length: nc }, (_, c) => `  { float w = 1.0 - smoothstep(uCF[${c}].x, uCF[${c}].y, dist); acc += texBi(uCS${c}, p / uCL[${c}] * uCN[${c}], uCN[${c}]) * w; }`).join("\n")}
  return acc;
}
`;
export function makeWater(W, heightTex, ocean = null) {
  if (new URLSearchParams(location.search).has("gerstner") || !ocean) return makeWaterGerstner(W, heightTex);
  const nc = ocean.cascades.length;
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, transparent: true, depthWrite: false });
  mat.blending = THREE.CustomBlending; mat.blendEquation = THREE.AddEquation; mat.blendSrc = THREE.OneFactor; mat.blendDst = THREE.OneMinusSrcAlphaFactor; mat.blendSrcAlpha = THREE.OneFactor; mat.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  const U = { uSea: { value: 1 }, uHeight: { value: heightTex }, uHRect: { value: new THREE.Vector3(HRECT.x0, HRECT.z0, HRECT.size) }, uFoamAmt: { value: 1 },
    uCL: { value: ocean.cascades.map(c => c.L) }, uCN: { value: ocean.cascades.map(c => c.n) },
    uCF: { value: ocean.cascades.map(c => new THREE.Vector2(...({ long: [235, 580], short: [150, 190], full: [235, 580], chop: [25, 80] }[c.band]))) } };   // chop band fades out by 80 m
  ocean.cascades.forEach((c, i) => { U["uCS" + i] = { value: c.tex }; });
  const edit = function spectralEdit(sh) {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\n" + SPEC_HEAD(nc) + "\nvarying vec3 vWorld0;")
      .replace("#include <begin_vertex>", `
        vec3 transformed = position;
        vec3 wp0_ = (modelMatrix * vec4(position, 1.0)).xyz;
        vec4 os_ = oceanSample(wp0_.xz, distance(wp0_, cameraPosition)) * dampAt(wp0_.xz) * uSea;
        transformed += vec3(os_.y * 0.5, os_.x, os_.z * 0.5);   // sample: x = height, y/z = horizontal displacement
        vWorld0 = wp0_;
        `);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
${SPEC_HEAD(nc)}
${TNOISE_GLSL}
varying vec3 vWorld0;
uniform float uFoamAmt;
float fbm4(vec2 p) { return tNoise(p) * 0.5 + tNoise(p * 2.03 + 7.1) * 0.25 + tNoise(p * 4.1 + 3.7) * 0.125; }
`)
      .replace("#include <map_fragment>", `
        vec2 xz_ = vWorld0.xz; float dist_ = length(vWPos - uCamW);
        float depth_ = max(-terrainH2(xz_), 0.0), damp_ = dampAt(xz_) * uSea;
        // finite differences of the cascade sums at the rest position: height gradient (normal), displacement gradient (Jacobian)
        const float e_ = 0.35;
        vec4 c0 = oceanSample(xz_, dist_), cx1 = oceanSample(xz_ + vec2(e_, 0.0), dist_), cx0 = oceanSample(xz_ - vec2(e_, 0.0), dist_);
        const float CH_ = 0.5;   // same choppiness as ocean.js CHOP
        vec4 cz1 = oceanSample(xz_ + vec2(0.0, e_), dist_), cz0 = oceanSample(xz_ - vec2(0.0, e_), dist_);
        vec2 gh_ = vec2(cx1.x - cx0.x, cz1.x - cz0.x) / (2.0 * e_) * damp_;
        float dxx_ = (cx1.y - cx0.y) / (2.0 * e_), dxz_ = (cz1.y - cz0.y) / (2.0 * e_), dzx_ = (cx1.z - cx0.z) / (2.0 * e_), dzz_ = (cz1.z - cz0.z) / (2.0 * e_);
        dxx_ *= damp_ * CH_; dxz_ *= damp_ * CH_; dzx_ *= damp_ * CH_; dzz_ *= damp_ * CH_;
        float J_ = (1.0 + dxx_) * (1.0 + dzz_) - dxz_ * dzx_;
        float crestA_ = clamp(c0.w * uSea, 0.0, 1.0);
        float hTot_ = c0.x * damp_;
        // wind ripples (capillary scale) and a slow cross-swell: the FFT is damped inside the harbour, so this keeps the calm water from reading as a mirror
        float rip_ = (1.0 - smoothstep(30.0, 140.0, dist_));
        vec2 rp_ = xz_ * 2.6 + vec2(uTime * 0.35, uTime * 0.21); float r0_ = tNoise(rp_), r1_ = tNoise(rp_ + vec2(0.31, 0.0)), r2_ = tNoise(rp_ + vec2(0.0, 0.31));
        vec2 rg_ = vec2(r1_ - r0_, r2_ - r0_) * 3.2 + (vec2(tNoise(xz_ * 7.0 - uTime * 0.4 + 5.0), tNoise(xz_ * 7.0 + uTime * 0.37 + 9.0)) - 0.5) * 0.12;
        float swell_ = sin(dot(xz_, vec2(0.21, 0.13)) - uTime * 0.9) * 0.012 + sin(dot(xz_, vec2(-0.09, 0.23)) - uTime * 0.7) * 0.01;
        gh_ += (rg_ * 0.11 + vec2(swell_, swell_ * 0.7)) * rip_ * (0.45 + 0.55 * (1.0 - damp_ / max(uSea, 0.05))) * smoothstep(0.05, 0.6, depth_);
        vec3 Nw_ = normalize(vec3(-gh_.x, 1.0, -gh_.y));
        { vec3 vdir_ = normalize(uCamW - vWPos); vec3 R_ = reflect(-vdir_, Nw_); if (R_.y < 0.04) Nw_ = normalize(Nw_ + vec3(0.0, 1.0, 0.0) * (0.04 - R_.y) * 1.2); }
        // Beer-Lambert body colour: shallow water is turbid, deep water absorbs towards waterDeep
        vec3 shallowC_ = vec3(0.22, 0.30, 0.26), deepC_ = vec3(0.0026, 0.036, 0.124) * 2.2;
        float tdep_ = 1.0 - exp(-depth_ * 0.16);
        vec3 bodyC_ = mix(shallowC_, deepC_, tdep_);
        // inside the harbour the water is grey-green and turbid (absorption about x3): the calm zone mixes in a murky body colour
        float harbF_ = 1.0 - smoothstep(0.45, 0.75, calmAt2(xz_));
        bodyC_ = mix(bodyC_, vec3(0.20, 0.28, 0.24), harbF_ * 0.7);
        { float algae_ = smoothstep(0.45, 0.75, fbm4(xz_ * 0.09 + 3.0)); bodyC_ = mix(bodyC_, vec3(0.14, 0.2, 0.08), harbF_ * algae_ * 0.55);   // algae and silt patches in the sheltered basin
          bodyC_ *= 1.0 - 0.18 * harbF_ * smoothstep(0.5, 0.8, fbm4(xz_ * 0.4 + 11.0)); }
        float alpha_ = clamp(1.0 - exp(-depth_ * 1.1), 0.0, 1.0);
        // shore foam bands (depth) and whitecaps (Jacobian fold + crest convergence), both scaled by the sea state
        float nz_ = fbm4(xz_ * 0.8 + uTime * 0.05);
        float band_ = smoothstep(0.05, 0.9, 0.9 - depth_ * 0.9 + (sin(uTime * 0.7 - depth_ * 7.0) * 0.25 + nz_ * 0.6 - 0.3));
        float shoreF_ = clamp(band_ * smoothstep(1.4, 0.0, depth_) * smoothstep(0.0, 0.05, depth_ + 0.02), 0.0, 1.0);
        float whiteF_ = max(1.0 - smoothstep(0.42, 0.7, J_), smoothstep(0.5, 0.9, crestA_)) * smoothstep(0.55, 1.0, uSea) * damp_ * smoothstep(2.5, 6.0, depth_) * (0.6 + 0.4 * smoothstep(0.0, 0.6, hTot_ / max(0.05, 0.5 * uSea)));   // whitecaps only on deep water: moats and shallows stay grey
        float foam_ = clamp(max(shoreF_, whiteF_), 0.0, 1.0) * uFoamAmt;
        // subsurface glow on steep crests seen with the sun behind them (wedge absorption x forward scatter, 95-340 m fade)
        float wedge_ = smoothstep(0.25, 0.9, hTot_ / max(0.05, 0.5 * uSea));
        float fwd_ = pow(clamp(dot(normalize(uCamW - vWPos), uSunDirW), 0.0, 1.0), 1.85);
        vec3 sss_ = vec3(0.68, 0.148, 0.068) * vec3(2.35, 0.92, 1.95) * wedge_ * fwd_ * 0.05 * (1.0 - smoothstep(95.0, 340.0, dist_)) * uSea;
        diffuseColor.rgb = mix(bodyC_ + sss_, vec3(0.78, 0.82, 0.84), foam_);
        alpha_ = max(alpha_, foam_);
        `)
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = mix(clamp(0.035 + 0.12 * uSea, 0.03, 0.6), 0.75, foam_);")
      .replace("#include <normal_fragment_maps>", "normal = normalize((viewMatrix * vec4(Nw_, 0.0)).xyz);")
      .replace("#include <opaque_fragment>", `
        { vec3 spec_ = reflectedLight.directSpecular + reflectedLight.indirectSpecular; vec3 dif_ = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
          gl_FragColor = vec4(dif_ * alpha_ + spec_ * (1.0 - foam_ * 0.7), alpha_); }
        `);
  };
  patch(mat, edit, "water-spectral-" + nc);
  const mesh = new THREE.Mesh(polarGrid(), mat); mesh.frustumCulled = false; mesh.renderOrder = 10; mesh.receiveShadow = false;
  return { mesh, mat, uniforms: U };
}
