import * as THREE from "three";
import type { CloudField } from "./cloud-field.js";

/**
 * Reuses the same moving wind vector as the sky/ground cloud field.
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
    shader.vertexShader=shader.vertexShader.replace("#include <common>",
      "#include <common>\nuniform vec2 uCloudWind;");
    shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>",
      `#include <begin_vertex>
      // Instance origins are stable in world space; foliage only bends at tips.
      vec2 windOrigin=vec2(0.0);
      #ifdef USE_INSTANCING
        windOrigin=instanceMatrix[3].xz;
      #endif
      float windPhase=windOrigin.x*.095+windOrigin.y*.077+
        uCloudWind.x*1.5+uCloudWind.y*.57;
      float windGust=.68*sin(windPhase)+.32*sin(windPhase*1.91+1.7);
      float windTip=smoothstep(-.20,.48,position.y);
      transformed.x+=windGust*${amplitude.toFixed(4)}*windTip;
      transformed.z+=cos(windPhase*.71)*${(amplitude*.55).toFixed(4)}*windTip;`);
  };
  material.customProgramCacheKey=()=>previousKey()+"|coastal-wind-v1-"+amplitude;
  material.needsUpdate=true;
}
