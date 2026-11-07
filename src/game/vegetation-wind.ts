import * as THREE from "three";
import type { CloudField } from "./cloud-field.js";

/**
 * Reads the shared wind (wind.js): the drift that moves the clouds, and gust fronts travelling across the ground.
 * Vertex-only procedural sway: zero extra render targets and zero extra
 * per-fragment texture samples. Intended for unshadowed foliage instances.
 */
export function addVegetationWind(
  material:THREE.MeshStandardMaterial,
  clouds:CloudField,
  amplitude:number,
){
  if(!Number.isFinite(amplitude)||amplitude<0||amplitude>.35)
    throw new RangeError("invalid foliage wind amplitude");
  const previous=material.onBeforeCompile;
  const previousKey=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=(shader,renderer)=>{
    previous(shader,renderer);
    shader.uniforms.uCloudWind=clouds.uniforms.uCloudWind;
    shader.uniforms.uWindStrength=clouds.uniforms.uWindStrength;
    shader.uniforms.uPlayerPos=clouds.uniforms.uPlayerPos;
    shader.vertexShader=shader.vertexShader.replace("#include <common>",
      "#include <common>\nuniform vec2 uCloudWind;uniform float uWindStrength;uniform vec3 uPlayerPos;\nfloat wHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat wNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(wHash(i),wHash(i+vec2(1.0,0.0)),f.x),mix(wHash(i+vec2(0.0,1.0)),wHash(i+vec2(1.0,1.0)),f.x),f.y);}\n// gust fronts: patches of stronger wind carried downwind by the shared drift (same maths as wind.js gustAt)\nfloat windGustMask(vec2 p){return smoothstep(.35,.8,wNoise(p*.045-uCloudWind*1.6));}");
    shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>",
      `#include <begin_vertex>
      // Instance origins are stable in world space; foliage only bends at tips.
      vec2 windOrigin=vec2(0.0);
      #ifdef USE_INSTANCING
        windOrigin=instanceMatrix[3].xz;
      #endif
      float windPhase=windOrigin.x*.095+windOrigin.y*.077+
        uCloudWind.x*1.5+uCloudWind.y*.57;
      float windGust=(.68*sin(windPhase)+.32*sin(windPhase*1.91+1.7))*(.55+1.1*windGustMask(windOrigin))*uWindStrength;
      float windTip=smoothstep(-.20,.48,position.y);
      transformed.x+=windGust*${amplitude.toFixed(4)}*windTip;
      transformed.z+=cos(windPhase*.71)*${(amplitude*.55).toFixed(4)}*windTip;
      // the traveller pushes the blades aside and flattens them where they step
      vec2 pushDir=windOrigin-uPlayerPos.xz;
      float pushDist=length(pushDir);
      float push=smoothstep(1.5,.15,pushDist)*step(abs(uPlayerPos.y),50.0);
      transformed.xz+=(pushDist>.001?pushDir/pushDist:vec2(1.0,0.0))*push*.55*windTip;
      transformed.y*=1.0-.45*push*windTip;`);
  };
  material.customProgramCacheKey=()=>previousKey()+"|coastal-wind-v3-"+amplitude;
  material.needsUpdate=true;
}
