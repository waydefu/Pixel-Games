// One shared material for every built thing: layer index + metric UV + tint/AO come from vertex attributes.
import * as THREE from "three";
import { patch, SEASON_GLSL } from "./materials.js";
import { SURF_GLSL, surfUniforms } from "./textures.js";

export function makeTownMaterial(tex) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, vertexColors: true });
  const edit = function townEdit(sh) {
    Object.assign(sh.uniforms, surfUniforms(tex));
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 aUv; attribute float aMat; varying vec2 vUvm; flat varying float vMat;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvUvm = aUv; vMat = aMat;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
varying vec2 vUvm; flat varying float vMat; uniform float uWet;
${SEASON_GLSL}
${SURF_GLSL}
`)
      .replace("#include <map_fragment>", `
      Surf S_ = sampleSurf(vMat, vUvm);
      float macro_ = tNoise(vWPos.xz * 0.45 + vWPos.y * 0.31);
      vec3 alb_ = S_.alb * vColor.rgb * (0.86 + 0.28 * macro_);
      float wet_ = uWet * (1.0 - step(7.5, vMat) * step(vMat, 10.5) * 0.4);
      alb_ *= 1.0 - 0.3 * wet_;
      float ao_ = S_.ao * vColor.a;
      diffuseColor.rgb = alb_ * mix(1.0, ao_, 0.5);
      `)
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = clamp(mix(S_.rough, 0.22, wet_ * 0.7), 0.04, 1.0);")
      .replace("#include <normal_fragment_maps>", `normal = normalize(surfTBN(normal, -vViewPosition, vUvm) * normalize(S_.n + vec3(0.0, 0.0, 1e-3)));
      { float up_ = dot(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.70, 0.73, 0.78), uSnow * smoothstep(0.6, 0.85, up_) * (vMat > 7.5 && vMat < 10.5 ? 0.5 : 1.0)); }`)
      .replace("#include <aomap_fragment>", `
      { float ambientOcclusion = ao_; reflectedLight.indirectDiffuse *= ambientOcclusion;
        float dotNV = saturate(dot(geometryNormal, geometryViewDir)); reflectedLight.indirectSpecular *= computeSpecularOcclusion(dotNV, ambientOcclusion, material.roughness); }
      `);
  };
  return patch(mat, edit, "town");
}

export function makeGlassMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.06, metalness: 0.0, vertexColors: true });
  const edit = function glassEdit(sh) {
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uNight;")
      .replace("#include <map_fragment>", "diffuseColor.rgb = vec3(0.012, 0.018, 0.022);")
      .replace("#include <emissivemap_fragment>", "totalEmissiveRadiance = vec3(1.0, 0.5, 0.16) * 4.5 * vColor.a * uNight * (0.8 + 0.4 * fract(vColor.a * 17.0));");
  };
  return patch(mat, edit, "glass");
}
