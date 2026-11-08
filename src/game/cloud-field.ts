import * as THREE from "three";

/** Ground covered by the cloud-shadow map (world units, centred on the player). */
export const SHADOW_EXTENT=900;

/**
 * Shared cloud state for everything the sky's clouds touch: the wind that bends grass and leaves, and the shadow the
 * clouds throw on the ground. The shadow is a small map rendered by the cloud shader from the sun's side (see
 * fjord.ts and cloud-shader.ts), so a shadow on the grass is the real shadow of the cloud you can see overhead; ground
 * materials read it through `applyToMaterial`. `sunOcclusion` is how much of the sun the cloud above the player hides.
 */
export function createCloudField(scope:{track:<T extends{dispose:()=>void}>(item:T)=>T}){
  void scope;
  const uniforms={
    uCloudShadowMap:{value:null as THREE.Texture|null},
    uShadowCenter:{value:new THREE.Vector2()},
    uShadowSize:{value:SHADOW_EXTENT},
    uCloudWind:{value:new THREE.Vector2()},
    uCloudStrength:{value:.30},
    uWindStrength:{value:1},
    uPlayerPos:{value:new THREE.Vector3(0,-99,0)},   // grass and shrubs bend away from the traveller
  };
  let sunOcc=0;

  function applyToMaterial(material:THREE.MeshStandardMaterial){
    // One texture fetch: the cloud-shadow map, in world space. A material takes it once however often it is offered.
    if(material.userData.cloudShadow)return material;
    material.userData.cloudShadow=true;
    const prior=material.onBeforeCompile;
    material.onBeforeCompile=(shader,renderer)=>{
      prior(shader,renderer);
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader=shader.vertexShader.replace("#include <common>",
        "#include <common>\nvarying vec3 vCloudWorld;");
      shader.vertexShader=shader.vertexShader.replace("#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvec4 cloudWorld4=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\ncloudWorld4=instanceMatrix*cloudWorld4;\n#endif\nvCloudWorld=(modelMatrix*cloudWorld4).xyz;");
      shader.fragmentShader=shader.fragmentShader.replace("#include <common>",
        "#include <common>\nvarying vec3 vCloudWorld;\nuniform sampler2D uCloudShadowMap;\nuniform vec2 uShadowCenter;\nuniform float uShadowSize;\nuniform float uCloudStrength;");
      shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>",
        "#include <color_fragment>\nvec2 cloudShadowUV=(vCloudWorld.xz-uShadowCenter)/uShadowSize+0.5;\nfloat cloudShadowEdge=1.0-smoothstep(0.38,0.5,max(abs(cloudShadowUV.x-0.5),abs(cloudShadowUV.y-0.5)));\nfloat cloudOcclusion=texture2D(uCloudShadowMap,cloudShadowUV).r*cloudShadowEdge;\ndiffuseColor.rgb*=1.0-uCloudStrength*cloudOcclusion;");
    };
    const previousKey=material.customProgramCacheKey.bind(material);
    material.customProgramCacheKey=()=>previousKey()+"|coastal-cloud-shadow-v3";
    material.needsUpdate=true;
    return material;
  }
  /** Every ordinary lit, opaque material in the scene takes the cloud shadow (houses, trees, rocks, boats, the ground). */
  function applyToScene(root:THREE.Object3D){
    root.traverse(o=>{
      const mesh=o as THREE.Mesh;
      if(!mesh.isMesh||mesh.userData.noCloudShadow)return;
      for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
        const std=m as THREE.MeshStandardMaterial;
        if(std.isMeshStandardMaterial&&!std.transparent)applyToMaterial(std);
      }
    });
  }
  /** The shared wind drives the clouds: `drift` is the accumulated sky drift, `strength` the wind strength (1 = a light breeze). */
  function setWind(driftX:number,driftZ:number,strength:number){
    uniforms.uCloudWind.value.set(driftX,driftZ);
    uniforms.uWindStrength.value=strength;
  }
  function setStrength(value:number){
    uniforms.uCloudStrength.value=THREE.MathUtils.clamp(value,0,.65);
  }
  /** 0 (clear) .. 1 (solid cloud) between the player and the sun, measured from the shadow map. */
  const sunOcclusion=()=>sunOcc;
  const setSunOcclusion=(v:number)=>{sunOcc=THREE.MathUtils.clamp(v,0,1);};
  return {uniforms,applyToMaterial,applyToScene,setWind,setStrength,sunOcclusion,setSunOcclusion};
}
export type CloudField=ReturnType<typeof createCloudField>;
