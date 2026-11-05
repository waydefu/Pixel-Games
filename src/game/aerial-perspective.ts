import * as THREE from "three";
import { liveSky } from "./sky-live.js";

/**
 * Light-weight WebGL2 aerial perspective for the existing StandardMaterial
 * mountains. Adapted in spirit from geospatial sky-coloured height fog:
 * Beer-Lambert transmittance, near-ground humidity, and sunward airlight.
 *
 * Shader-side replacement of Three.js built-in fog_fragment is intentional:
 * applying the default fog first and this blend second would DOUBLE fog.
 * This adds zero render targets, geometry, or texture fetches. It is not
 * Bruneton multi-scattering or the GPU-heavy @takram/three-atmosphere effect.
 */
export function applyAerialPerspective(
  material:THREE.MeshStandardMaterial,
  options:{valleyBoost?:number;sunWarmth?:number}={}
){
  const uniforms={
    uAerialSun:{value:liveSky.sunDir},
    uAerialWarmColor:{value:new THREE.Vector3(.90,.73,.53)},
    uAerialValleyBoost:{value:options.valleyBoost??.54},
    uAerialSunWarmth:{value:options.sunWarmth??.23},
  };
  const prev=material.onBeforeCompile;
  material.onBeforeCompile=(shader,renderer)=>{
    prev(shader,renderer);
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader
      .replace("#include <common>","#include <common>\nvarying vec3 vAerialWorldPosition;")
      .replace("#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvAerialWorldPosition=(modelMatrix*vec4(transformed,1.0)).xyz;");
    shader.fragmentShader=shader.fragmentShader
      .replace("#include <common>",`#include <common>
varying vec3 vAerialWorldPosition;
uniform vec3 uAerialSun;
uniform vec3 uAerialWarmColor;
uniform float uAerialValleyBoost;
uniform float uAerialSunWarmth;`)
      .replace("#include <fog_fragment>",`
#ifdef USE_FOG
  // Keep the standard fog distance calculation as the one source of truth.
  #ifdef FOG_EXP2
    float aerialBase=fogDensity*fogDensity*vFogDepth*vFogDepth;
  #else
    float aerialBase=-log(max(0.0001,1.0-smoothstep(fogNear,fogFar,vFogDepth)));
  #endif
  // Humid valley bottoms have more atmospheric depth than upper rock faces.
  float valley=exp(-max(0.0,vAerialWorldPosition.y)*0.033);
  float aerialFog=clamp(1.0-exp(-aerialBase*(1.0+uAerialValleyBoost*valley)),0.0,1.0);
  vec3 viewRay=normalize(vAerialWorldPosition-cameraPosition);
  float towardSun=max(0.0,dot(viewRay,normalize(uAerialSun)));
  float phase=pow(towardSun,9.0);
  vec3 airlight=mix(fogColor,uAerialWarmColor,clamp(uAerialSunWarmth*phase,0.0,.45));
  gl_FragColor.rgb=mix(gl_FragColor.rgb,airlight,aerialFog);
#endif`);
  };
  const key=material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey=()=>key()+"|fjord-aerial-beer-v1";
  material.needsUpdate=true;
  return {uniforms};
}
