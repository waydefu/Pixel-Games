// Terrain surface: layer weights from slope / height / road masks, height-blended PBR layers sampled from the baked arrays.
import * as THREE from "three";
import { patch, AU, SEASON_GLSL } from "./materials.js";
import { SURF_GLSL, surfUniforms, L } from "./textures.js";
import { MASK } from "./terrain.js";

export function makeTerrainMaterial(tex, maskTex, forestTex = null, forestRect = null) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  const edit = function terrainEdit(sh) {
    Object.assign(sh.uniforms, surfUniforms(tex), { uMask: { value: maskTex }, uMaskRect: { value: new THREE.Vector3(MASK.x0, MASK.z0, MASK.size) },
      uForest: { value: forestTex }, uForestRect: { value: forestRect ? new THREE.Vector3(forestRect.x0, forestRect.z0, forestRect.size) : new THREE.Vector3(0, 0, 1) } });
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWN;").replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\nvWN = normal;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
varying vec3 vWN; uniform sampler2D uMask; uniform vec3 uMaskRect; uniform float uWet; uniform float uTime; uniform sampler2D uForest; uniform vec3 uForestRect;
${SEASON_GLSL}
${SURF_GLSL}
// Triplanar blend for steep faces: the horizontal projection (xz) is replaced by yz / xy projections weighted by the face normal, so ditch walls
// and hillsides are not smeared vertically. Flat ground (slope below ~0.12) keeps the plain xz sample.
Surf triSurf(float id, vec2 uvH, vec3 wn, float steep, vec3 p) {
  Surf a = sampleSurf(id, uvH);
  float k = smoothstep(0.12, 0.35, steep);
  if (k < 0.01) return a;
  Surf bx = sampleSurf(id, vec2(p.z, p.y)), bz = sampleSurf(id, vec2(p.x, p.y));
  vec3 w = pow(abs(wn), vec3(4.0)); w /= max(w.x + w.y + w.z, 1e-4);
  Surf t; t.h = a.h * w.y + bx.h * w.x + bz.h * w.z; t.alb = a.alb * w.y + bx.alb * w.x + bz.alb * w.z;
  t.n = a.n * w.y + bx.n * w.x + bz.n * w.z; t.rough = a.rough * w.y + bx.rough * w.x + bz.rough * w.z; t.ao = a.ao * w.y + bx.ao * w.x + bz.ao * w.z;
  Surf o; o.h = mix(a.h, t.h, k); o.alb = mix(a.alb, t.alb, k); o.n = mix(a.n, t.n, k); o.rough = mix(a.rough, t.rough, k); o.ao = mix(a.ao, t.ao, k);
  return o;
}
`)
      .replace("#include <map_fragment>", `
      vec3 wn_ = normalize(vWN); vec2 xz_ = vWPos.xz;
      vec2 muv_ = (xz_ - uMaskRect.xy) / uMaskRect.z; vec4 mk_ = (muv_.x > 0.0 && muv_.x < 1.0 && muv_.y > 0.0 && muv_.y < 1.0) ? texture(uMask, muv_) : vec4(0.0, 0.0, 0.0, 1.0);
      float rdist_ = mk_.a * 24.0 - 4.0;
      float nA_ = tNoise(xz_ * 0.31), nB_ = tNoise(xz_ * 2.7 + 5.0), nC_ = tNoise(xz_ * 0.045);
      // steepness from the per-pixel surface (screen derivatives), not the smoothed vertex normal: steep ditch and cliff faces become rock
      vec3 fn_ = normalize(cross(dFdx(vWPos), dFdy(vWPos)));
      float slope_ = max(1.0 - wn_.y, 1.0 - abs(fn_.y));
      float cob_ = smoothstep(0.42, 0.58, max(mk_.r, mk_.g) + (nB_ - 0.5) * 0.4);
      float yard_ = smoothstep(0.08, 0.5, mk_.b + (nB_ - 0.5) * 0.3) * (1.0 - cob_);
      float verge_ = (1.0 - smoothstep(0.1, 2.2, rdist_ + (nA_ - 0.5) * 1.4)) * (1.0 - cob_) * 0.85;
      float rockW_ = smoothstep(0.20 + (nA_ - 0.5) * 0.08, 0.40, slope_);
      float sandW_ = smoothstep(1.7 + (nA_ - 0.5) * 0.9, 0.7, vWPos.y) * (1.0 - cob_) * (1.0 - rockW_);
      float gravW_ = smoothstep(0.55, 0.8, nC_) * smoothstep(0.1, 0.4, slope_) * (1.0 - rockW_);
      float W_[6]; W_[0] = max(0.0, 1.0 - rockW_ - sandW_ - yard_ - verge_ - cob_); W_[1] = clamp(yard_ + verge_, 0.0, 1.0); W_[2] = rockW_; W_[3] = cob_; W_[4] = gravW_ * 0.8; W_[5] = sandW_;
      float ID_[6]; ID_[0] = ${L.grass}.0; ID_[1] = ${L.dirt}.0; ID_[2] = ${L.rock}.0; ID_[3] = ${L.cobble}.0; ID_[4] = ${L.gravel}.0; ID_[5] = ${L.sand}.0;
      // rock is projected along the dominant horizontal axis so cliffs do not smear
      vec2 ruv_ = abs(wn_.x) > abs(wn_.z) ? vec2(vWPos.z * sign(wn_.x), vWPos.y) : vec2(-vWPos.x * sign(wn_.z), vWPos.y);
      Surf S_[6]; float tot_ = 0.0, hmax_ = -1.0;
      for (int i = 0; i < 6; i++) {
        S_[i].h = 0.0; S_[i].alb = vec3(0.0); S_[i].n = vec3(0, 0, 1); S_[i].rough = 1.0; S_[i].ao = 1.0;
        if (W_[i] > 0.015) { S_[i] = triSurf(ID_[i], i == 2 ? ruv_ : xz_, wn_, slope_, vWPos); hmax_ = max(hmax_, S_[i].h * 0.9 + W_[i]); }
      }
      float tw_ = 0.0; vec3 alb_ = vec3(0.0), nTS_ = vec3(0.0), nTR_ = vec3(0.0); float rough_ = 0.0, ao_ = 0.0, wr_ = 0.0;
      for (int i = 0; i < 6; i++) if (W_[i] > 0.015) {
        float w = max(S_[i].h * 0.9 + W_[i] - hmax_ + 0.22, 0.0) * (W_[i] + 0.02); tw_ += w;
        alb_ += S_[i].alb * w; rough_ += S_[i].rough * w; ao_ += S_[i].ao * w;
        if (i == 2) { nTR_ += S_[i].n * w; wr_ += w; } else nTS_ += S_[i].n * w;
      }
      tw_ = max(tw_, 1e-4); alb_ /= tw_; rough_ /= tw_; ao_ /= tw_;
      // macro variation: large patches of lighter / drier ground
      alb_ *= 0.82 + 0.36 * nC_ + 0.12 * (nA_ - 0.5);
      float wet_ = clamp(uWet + smoothstep(0.6, 0.0, vWPos.y) * 0.8, 0.0, 1.0);
      alb_ *= 1.0 - 0.42 * wet_; rough_ = mix(rough_, 0.18, wet_ * 0.75);
      alb_ *= mix(vec3(1.0), vec3(1.25, 1.02, 0.7), seasonDry() * (1.0 - sandW_) * (0.5 + 0.5 * nC_));   // dry grass in autumn and winter
      vec2 fuv_ = (xz_ - uForestRect.xy) / uForestRect.z;
      float fo_ = (fuv_.x > 0.0 && fuv_.x < 1.0 && fuv_.y > 0.0 && fuv_.y < 1.0) ? texture(uForest, fuv_).r : 0.0;   // broadleaf cover
      alb_ = mix(alb_, vec3(0.13, 0.09, 0.05) * (0.8 + 0.4 * nB_), fo_ * 0.8 * (1.0 - rockW_) * (1.0 - cob_));          // beech leaf litter
      alb_ = mix(alb_, vec3(0.12, 0.2, 0.07), fo_ * smoothstep(0.5, 0.7, nA_) * 0.6);                                   // moss patches
      { // fallen leaves on the forest floor (more of them, and brighter, in autumn) and clover patches in open grass
        vec2 lq_ = xz_ * 11.0 + tNoise(xz_ * 3.1) * 2.5; float ls_ = smoothstep(0.74, 0.84, tNoise(lq_)); float lh_ = tNoise(floor(lq_) * 0.7 + 4.0);
        vec3 lc_ = mix(vec3(0.16, 0.09, 0.04), mix(vec3(0.34, 0.2, 0.05), vec3(0.4, 0.3, 0.07), lh_), step(1.5, uSeason) * step(uSeason, 2.5) * 0.8);
        alb_ = mix(alb_, lc_ * (0.7 + 0.6 * lh_), ls_ * fo_ * (0.55 + 0.35 * step(1.5, uSeason)) * (1.0 - rockW_) * (1.0 - cob_));
        float cl_ = smoothstep(0.62, 0.78, tNoise(xz_ * 0.35 + 30.0)) * (1.0 - fo_) * smoothstep(0.96, 0.99, wn_.y) * (1.0 - sandW_) * (1.0 - cob_) * step(0.5, 1.0 - step(2.5, uSeason));
        alb_ = mix(alb_, vec3(0.1, 0.22, 0.06) * (0.9 + 0.3 * tNoise(xz_ * 14.0)), cl_ * 0.5); }
      float marsh_ = smoothstep(2.2, 1.6, vWPos.y) * smoothstep(0.3, 0.6, vWPos.y) * smoothstep(0.985, 0.997, wn_.y) * (1.0 - sandW_) * (1.0 - cob_) * (1.0 - fo_) * step(4.0, rdist_);
      alb_ = mix(alb_, vec3(0.34, 0.4, 0.28), marsh_ * 0.7);                                                              // salt marsh: grey-green short turf
      diffuseColor.rgb = alb_ * mix(1.0, ao_, 0.55);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.70, 0.73, 0.78), uSnow * smoothstep(0.6, 0.85, wn_.y) * (0.75 + 0.25 * nB_));   // snow cover on upward faces
      `)
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = clamp(rough_, 0.04, 1.0);")
      .replace("#include <normal_fragment_maps>", `
      { mat3 tb_ = surfTBN(normal, -vViewPosition, xz_); vec3 nt_ = nTS_ / max(tw_ - wr_, 1e-4);
        vec3 nA = normalize(tb_ * normalize(nt_ + vec3(0.0, 0.0, 1e-3)));
        mat3 tr_ = surfTBN(normal, -vViewPosition, ruv_); vec3 nR = normalize(tr_ * normalize(nTR_ + vec3(0.0, 0.0, 1e-3)));
        float fr_ = wr_ / tw_; normal = normalize(mix(nA, nR, fr_)); }
      `)
      .replace("#include <aomap_fragment>", `
      { float ambientOcclusion = ao_; reflectedLight.indirectDiffuse *= ambientOcclusion;
        #if defined( USE_CLEARCOAT ) 
        #endif
        float dotNV = saturate(dot(geometryNormal, geometryViewDir)); reflectedLight.indirectSpecular *= computeSpecularOcclusion(dotNV, ambientOcclusion, material.roughness); }
      `);
  };
  return patch(mat, edit, "terrain");
}
