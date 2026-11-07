import * as THREE from "three";
import { liveSky } from "./sky-live.js";

const SIZE=128;
const SPAN=230;
const CLOUD_HEIGHT=88;

function hash(x:number,y:number){
  const n=Math.sin(x*127.1+y*311.7)*43758.5453123;
  return n-Math.floor(n);
}
function tileNoise(u:number,v:number,freq:number){
  const x=u*freq,y=v*freq,ix=Math.floor(x),iy=Math.floor(y);
  const fx=x-ix,fy=y-iy;
  const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
  const h=(dx:number,dy:number)=>hash((ix+dx+freq)%freq,(iy+dy+freq)%freq);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(h(0,0),h(1,0),sx),
    THREE.MathUtils.lerp(h(0,1),h(1,1),sx),sy);
}

/**
 * Shared cheap cloud field. One precomputed 128px tiling noise map drives BOTH
 * sky coverage and projected ground/mountain cloud shadows. No volumetric ray
 * march, secondary shadow camera or sea reflection render target.
 *
 * Derived from common value-noise/FBM techniques, not copied game assets.
 */
export function createCloudField(scope:{track:<T extends{dispose:()=>void}>(item:T)=>T}){
  const pixels=new Uint8Array(SIZE*SIZE*4);
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const u=x/SIZE,v=y/SIZE;
    const value=.58*tileNoise(u,v,5)+.27*tileNoise(u,v,11)+.15*tileNoise(u,v,23);
    const c=Math.round(Math.min(1,Math.max(0,value))*255);
    const i=(y*SIZE+x)*4;
    pixels[i]=pixels[i+1]=pixels[i+2]=c;pixels[i+3]=255;
  }
  const texture=scope.track(new THREE.DataTexture(pixels,SIZE,SIZE,THREE.RGBAFormat));
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.magFilter=THREE.LinearFilter;
  texture.generateMipmaps=true;
  texture.needsUpdate=true;
  const uniforms={
    uCloudMap:{value:texture},
    uCloudWind:{value:new THREE.Vector2()},
    uCloudSpan:{value:SPAN},
    uCloudHeight:{value:CLOUD_HEIGHT},
    uCloudSun:{value:liveSky.sunDir},
    uCloudStrength:{value:.30},
    uWindStrength:{value:1},
  };

  function applyToMaterial(material:THREE.MeshStandardMaterial){
    // Keep ordinary lit materials/shadow maps. This is only one texture fetch.
    const prior=material.onBeforeCompile;
    material.onBeforeCompile=(shader,renderer)=>{
      prior(shader,renderer);
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader=shader.vertexShader.replace("#include <common>",
        "#include <common>\nvarying vec3 vCloudWorld;");
      shader.vertexShader=shader.vertexShader.replace("#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvCloudWorld=(modelMatrix*vec4(transformed,1.0)).xyz;");
      shader.fragmentShader=shader.fragmentShader.replace("#include <common>",
        "#include <common>\nvarying vec3 vCloudWorld;\nuniform sampler2D uCloudMap;\nuniform vec2 uCloudWind;\nuniform float uCloudSpan;\nuniform float uCloudHeight;\nuniform vec3 uCloudSun;\nuniform float uCloudStrength;");
      shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>",
        "#include <color_fragment>\nvec2 cloudGroundUV=(vCloudWorld.xz+uCloudSun.xz/max(.16,uCloudSun.y)*(uCloudHeight-vCloudWorld.y)+uCloudWind)/uCloudSpan;\nfloat cloudCover=texture2D(uCloudMap,cloudGroundUV).r;\nfloat cloudOcclusion=smoothstep(.39,.57,cloudCover);\ndiffuseColor.rgb*=1.0-uCloudStrength*cloudOcclusion;");
    };
    const previousKey=material.customProgramCacheKey.bind(material);
    material.customProgramCacheKey=()=>previousKey()+"|coastal-cloud-field-v1";
    material.needsUpdate=true;
    return material;
  }
  /** The shared wind drives the clouds: `drift` is the accumulated sky drift, `strength` the wind strength (1 = a light breeze). */
  function setWind(driftX:number,driftZ:number,strength:number){
    uniforms.uCloudWind.value.set(driftX,driftZ);
    uniforms.uWindStrength.value=strength;
  }
  const sample=(u:number,v:number)=>{
    // bilinear read of the same tiling map the shaders use
    const x=((u%1)+1)%1*SIZE,y=((v%1)+1)%1*SIZE,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
    const at=(a:number,b:number)=>pixels[(((b+SIZE)%SIZE)*SIZE+((a+SIZE)%SIZE))*4]/255;
    return (at(ix,iy)*(1-fx)+at(ix+1,iy)*fx)*(1-fy)+(at(ix,iy+1)*(1-fx)+at(ix+1,iy+1)*fx)*fy;
  };
  /** 0 (clear) .. 1 (solid cloud) between a ground point and the sun: the same projection the ground shadows use. */
  function sunOcclusion(x:number,z:number,sun:{x:number;y:number;z:number}){
    if(sun.y<=.02)return 0;
    const k=CLOUD_HEIGHT/Math.max(.16,sun.y),w=uniforms.uCloudWind.value;
    const cover=sample((x+sun.x*k+w.x)/SPAN,(z+sun.z*k+w.y)/SPAN);
    return THREE.MathUtils.smoothstep(cover,.39,.57);
  }
  function setStrength(value:number){
    uniforms.uCloudStrength.value=THREE.MathUtils.clamp(value,0,.5);
  }
  return {texture,uniforms,applyToMaterial,setWind,setStrength,sunOcclusion};
}
export type CloudField=ReturnType<typeof createCloudField>;
