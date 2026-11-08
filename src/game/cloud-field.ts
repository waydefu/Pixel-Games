import * as THREE from "three";
import { liveSky } from "./sky-live.js";

const SIZE=256;
const SPAN=230;
const CLOUD_HEIGHT=88;

function hash(x:number,y:number,seed=0){
  const n=Math.sin(x*127.1+y*311.7+seed*74.7)*43758.5453123;
  return n-Math.floor(n);
}
/** Value noise tiling every `freqX` x `freqY` cells; unequal frequencies give streaks. */
function tileNoise(u:number,v:number,freqX:number,freqY=freqX,seed=0){
  const x=u*freqX,y=v*freqY,ix=Math.floor(x),iy=Math.floor(y);
  const fx=x-ix,fy=y-iy;
  const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
  const h=(dx:number,dy:number)=>hash((ix+dx+freqX)%freqX,(iy+dy+freqY)%freqY,seed);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(h(0,0),h(1,0),sx),
    THREE.MathUtils.lerp(h(0,1),h(1,1),sx),sy);
}
/** Tileable cell noise: 1 at a cell's heart, 0 at its walls. Little rounded puffs (the cumulus and altocumulus look). */
function puffNoise(u:number,v:number,freq:number,seed:number){
  const x=u*freq,y=v*freq,ix=Math.floor(x),iy=Math.floor(y);
  let best=9;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const cx=ix+dx,cy=iy+dy,wx=((cx%freq)+freq)%freq,wy=((cy%freq)+freq)%freq;
    const px=cx+.15+.7*hash(wx,wy,seed),py=cy+.15+.7*hash(wx,wy,seed+3);
    const d=Math.hypot(x-px,y-py);
    if(d<best)best=d;
  }
  return Math.max(0,1-best*1.15);
}

/**
 * Shared cloud field. One precomputed 256px tiling map drives the sky clouds AND the projected ground/mountain cloud
 * shadows. Channels: R = coverage (the large shapes; what ground shadows and the sun-occlusion test read),
 * G = puffs (small rounded cells that break the edges into lobes), B = streaks (noise stretched along one axis: cirrus
 * bands and the long seams seen at sunset). No second shadow camera or reflection target.
 *
 * Derived from common value-noise / cellular-noise techniques, not copied game assets.
 */
export function createCloudField(scope:{track:<T extends{dispose:()=>void}>(item:T)=>T}){
  const pixels=new Uint8Array(SIZE*SIZE*4);
  const byte=(v:number)=>Math.round(Math.min(1,Math.max(0,v))*255);
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const u=x/SIZE,v=y/SIZE;
    // domain warp: the large shapes swirl and shear instead of sitting on the noise lattice
    const wu=u+.045*(tileNoise(u,v,4,4,11)-.5),wv=v+.045*(tileNoise(u,v,4,4,17)-.5);
    const cover=.52*tileNoise(wu,wv,5)+.26*tileNoise(wu,wv,11)+.14*tileNoise(wu,wv,23)+.08*tileNoise(wu,wv,47);
    const puffs=.55*puffNoise(u,v,14,1)+.30*puffNoise(u,v,29,7)+.15*puffNoise(u,v,58,13);
    const streak=.5*tileNoise(wu,wv,26,3,5)+.3*tileNoise(wu,wv,52,6,9)+.2*tileNoise(wu,wv,98,12,21);
    const i=(y*SIZE+x)*4;
    pixels[i]=byte(cover);pixels[i+1]=byte(puffs);pixels[i+2]=byte(streak);pixels[i+3]=255;
  }
  const texture=scope.track(new THREE.DataTexture(pixels,SIZE,SIZE,THREE.RGBAFormat));
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.magFilter=THREE.LinearFilter;
  texture.generateMipmaps=true;
  texture.anisotropy=4;
  texture.needsUpdate=true;
  const uniforms={
    uCloudMap:{value:texture},
    uCloudWind:{value:new THREE.Vector2()},
    uCloudSpan:{value:SPAN},
    uCloudHeight:{value:CLOUD_HEIGHT},
    uCloudSun:{value:liveSky.sunDir},
    uCloudStrength:{value:.30},
    uWindStrength:{value:1},
    uPlayerPos:{value:new THREE.Vector3(0,-99,0)},   // grass and shrubs bend away from the traveller
    uCloudBias:{value:0},          // weather: positive = more cloud (thresholds shift down)
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
        "#include <common>\nvarying vec3 vCloudWorld;\nuniform float uCloudBias;\nuniform sampler2D uCloudMap;\nuniform vec2 uCloudWind;\nuniform float uCloudSpan;\nuniform float uCloudHeight;\nuniform vec3 uCloudSun;\nuniform float uCloudStrength;");
      shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>",
        "#include <color_fragment>\nvec2 cloudGroundUV=(vCloudWorld.xz+uCloudSun.xz/max(.16,uCloudSun.y)*(uCloudHeight-vCloudWorld.y)+uCloudWind)/uCloudSpan;\nfloat cloudCover=texture2D(uCloudMap,cloudGroundUV).r;\nfloat cloudOcclusion=smoothstep(.39-uCloudBias,.57-uCloudBias,cloudCover);\ndiffuseColor.rgb*=1.0-uCloudStrength*cloudOcclusion;");
    };
    const previousKey=material.customProgramCacheKey.bind(material);
    material.customProgramCacheKey=()=>previousKey()+"|coastal-cloud-field-v2";
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
    const b=uniforms.uCloudBias.value;return THREE.MathUtils.smoothstep(cover,.39-b,.57-b);
  }
  function setBias(v:number){uniforms.uCloudBias.value=v;}
  function setStrength(value:number){
    uniforms.uCloudStrength.value=THREE.MathUtils.clamp(value,0,.5);
  }
  return {texture,uniforms,applyToMaterial,setWind,setStrength,setBias,sunOcclusion};
}
export type CloudField=ReturnType<typeof createCloudField>;
