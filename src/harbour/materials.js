// Shared material plumbing: aerial perspective injected into every lit material, world-position varying, instancing aware.
import * as THREE from "three";
import { AERIAL_GLSL } from "./sky.js";

export const AU = {
  uSkyLUT: { value: null }, uSunDirW: { value: new THREE.Vector3(0, 1, 0) }, uHaze: { value: 0 }, uCamW: { value: new THREE.Vector3() },
  uWet: { value: 0 }, uNight: { value: 0 }, uTime: { value: 0 },
  uSeason: { value: 1 },    // 0 spring, 1 summer, 2 autumn, 3 winter (game.calendar())
  uSeasonT: { value: 0.5 }, // progress through the season 0..1
  uSnow: { value: 0 },      // snow cover on the ground 0..1 (weather.js)
};
// Season helpers shared by foliage, grass and terrain shaders. Declare in every fragment/vertex shader that calls them.
export const SEASON_GLSL = `uniform float uSeason; uniform float uSeasonT; uniform float uSnow;
float seasonDry() { return uSeason > 2.5 ? 0.55 : (uSeason > 1.5 ? 0.3 * uSeasonT : 0.0); }`;

/** Adds world position varying + aerial perspective. `edit(shader)` may further patch the shader afterwards. */
export function patch(mat, edit, key = "n") {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, AU);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;")
      .replace("#include <project_vertex>", `#include <project_vertex>
        { vec4 wp4_ = vec4(transformed, 1.0);
        #ifdef USE_BATCHING
        wp4_ = batchingMatrix * wp4_;
        #endif
        #ifdef USE_INSTANCING
        wp4_ = instanceMatrix * wp4_;
        #endif
        vWPos = (modelMatrix * wp4_).xyz; }`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;\n" + AERIAL_GLSL)
      .replace("#include <fog_fragment>", "gl_FragColor.rgb = applyAerial(gl_FragColor.rgb, vWPos);\n#include <fog_fragment>");
    if (edit) edit(sh);
  };
  mat.customProgramCacheKey = () => key + (mat.userData.key || "");
  return mat;
}

/** Hook a material into cascaded shadow maps without losing our shader patch (CSM replaces onBeforeCompile). */
export function csmify(csm, mat) {
  const mine = mat.onBeforeCompile; csm.setupMaterial(mat); const theirs = mat.onBeforeCompile;
  mat.onBeforeCompile = function (sh, r) { theirs.call(this, sh, r); mine.call(this, sh, r); };
  return mat;
}
