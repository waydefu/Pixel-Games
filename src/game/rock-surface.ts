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
// Pixel-art read: strata posterised into a few flat tones, a coarse world-space texel grain (about one texel per
// metre, faded out when a texel is smaller than a pixel) and a snowline with a jittered, blocky edge.
float rockStep=floor(rockVariation*5.0+.5)/5.0;
vec2 rockCell=floor(vec2(vRockWorldPosition.x+vRockWorldPosition.z,vRockWorldPosition.y*1.4)/1.1);
float rockGrain=fract(sin(dot(rockCell,vec2(127.1,311.7)))*43758.5453)-.5;
vec2 rockFw=fwidth(vec2(vRockWorldPosition.x+vRockWorldPosition.z,vRockWorldPosition.y*1.4)/1.1);
float rockDetail=1.0-smoothstep(.5,1.2,max(rockFw.x,rockFw.y));
diffuseColor.rgb*=mix(1.0,rockStep,rockExposure)*(1.0+rockGrain*.10*rockDetail);
float snowLine=76.0+rockGrain*10.0*rockDetail+rockSteepness*18.0;
float snowAmount=smoothstep(snowLine,snowLine+6.0,vRockWorldPosition.y)*(1.0-smoothstep(.34,.52,rockSteepness));
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.78,.84,.90)*(.94+rockGrain*.10),snowAmount);`)
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
normal=normalize(normal+(viewMatrix*vec4(rockWorldNormalOffset,0.0)).xyz*rockExposureN);`)
      .replace("#include <opaque_fragment>",`
  {
    // Cel-shaded light: the lit mountain is cut into a few flat tones with a 2x2 ordered dither on the edges, so
    // the far hills read as hand-shaded pixel art rather than smooth CG. Aerial haze is applied afterwards.
    float rockLevels=5.0;
    vec2 rockPx=floor(gl_FragCoord.xy);
    float rockBayer=(mod(rockPx.x,2.0)+2.0*mod(rockPx.y,2.0)+.5)/4.0-.5;
    vec3 rockBanded=(floor(outgoingLight*rockLevels+rockBayer*.55+.5)+.0)/rockLevels;
    outgoingLight=mix(outgoingLight,max(rockBanded,vec3(.02)),.62);
  }
  #include <opaque_fragment>`);
  };
  const key=material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey=()=>key()+"|fjord-erosion-strata-v3";
  material.needsUpdate=true;
  return material;
}
