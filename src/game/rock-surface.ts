import * as THREE from "three";

/**
 * World-space rock stratification with close-range micro-normal variation.
 *
 * Inspired by published triplanar cliff-material techniques, but intentionally
 * textureless: no new diffuse/normal map fetches and no additional passes.
 * Applied only to already-generated mountain meshes. The color bands follow
 * world elevation (not UV seams), while steeper faces reveal more grey stone.
 */
export function applyRockSurface(material:THREE.MeshStandardMaterial){
  const previous=material.onBeforeCompile;
  material.onBeforeCompile=(shader,renderer)=>{
    previous(shader,renderer);
    shader.vertexShader=shader.vertexShader
      .replace("#include <common>",`#include <common>
varying vec3 vRockWorldPosition;
varying vec3 vRockWorldNormal;`)
      .replace("#include <worldpos_vertex>",`#include <worldpos_vertex>
vRockWorldPosition=(modelMatrix*vec4(transformed,1.0)).xyz;
vRockWorldNormal=normalize(mat3(modelMatrix)*normal);`);
    shader.fragmentShader=shader.fragmentShader
      .replace("#include <common>",`#include <common>
varying vec3 vRockWorldPosition;
varying vec3 vRockWorldNormal;`)
      .replace("#include <color_fragment>",`#include <color_fragment>
// Fixed-scale mineral layers rather than UV-stretched square color blocks.
float rockSteepness=1.0-clamp(normalize(vRockWorldNormal).y,0.0,1.0);
float rockExposure=clamp(
  smoothstep(0.20,0.66,rockSteepness)*.81+
  smoothstep(35.0,78.0,vRockWorldPosition.y)*.50,0.0,1.0);
float rockLayer=sin(vRockWorldPosition.y*1.68+
  sin(vRockWorldPosition.x*.12+vRockWorldPosition.z*.18)*.85);
float rockJoints=sin(vRockWorldPosition.x*.82+vRockWorldPosition.z*.31)*
  sin(vRockWorldPosition.z*.93-vRockWorldPosition.x*.24);
float rockVariation=clamp(.91+.10*rockLayer+.13*rockJoints,.66,1.17);
diffuseColor.rgb*=mix(1.0,rockVariation,rockExposure);`)
      .replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
// Small view-space normal break-up, without a triplanar 3-texture normal pass.
// The mountain mesh retains the original vertex normals for far silhouettes.
float rockSteepnessN=1.0-clamp(normalize(vRockWorldNormal).y,0.0,1.0);
float rockExposureN=clamp(
  smoothstep(0.20,0.66,rockSteepnessN)*.8+
  smoothstep(35.0,78.0,vRockWorldPosition.y)*.35,0.0,1.0);
vec3 rockWorldNormalOffset=vec3(
  .055*cos(vRockWorldPosition.x*.82+vRockWorldPosition.z*.31),
  .018*sin(vRockWorldPosition.y*1.68),
  .065*cos(vRockWorldPosition.z*.93-vRockWorldPosition.x*.24));
normal=normalize(normal+(viewMatrix*vec4(rockWorldNormalOffset,0.0)).xyz*rockExposureN);`);
  };
  const key=material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey=()=>key()+"|fjord-erosion-strata-v1";
  material.needsUpdate=true;
  return material;
}
