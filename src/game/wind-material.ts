import * as THREE from "three";

// Preserves MeshStandardMaterial's lights, fog, instancing and atlas textures.
// One very small sine-based displacement per vertex; no CPU per-blade updates.
export function enableCoastalWind(
  material:THREE.MeshStandardMaterial,
  windTime:{value:number},
  mode:"grass"|"leaves",
){
  const signature="coastal-wind-"+mode+"-v1";
  material.onBeforeCompile=(shader)=>{
    shader.uniforms.uCoastalWindTime=windTime;
    shader.vertexShader="uniform float uCoastalWindTime;\n"+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vec3 windWorld;
      #ifdef USE_INSTANCING
        windWorld=(modelMatrix*instanceMatrix*vec4(position,1.0)).xyz;
      #else
        windWorld=(modelMatrix*vec4(position,1.0)).xyz;
      #endif
      float windPhase=uCoastalWindTime*1.07+windWorld.x*.26+windWorld.z*.23;
      float windFlex=${mode==="grass"?"clamp(position.y*2.5+.5,0.0,1.0)":"0.72"};
      transformed.x+=windFlex*.075*sin(windPhase);
      transformed.z+=windFlex*.034*cos(windPhase*.83);`
    );
  };
  material.customProgramCacheKey=()=>signature;
  material.needsUpdate=true;
  return material;
}
