import * as THREE from "three";
import { paintTexture, PIXEL_KIND_NAMES } from "./textures.js";

export type PixelKind=string;
type Tracker={track:<T extends{dispose:()=>void}>(item:T)=>T};

/**
 * Pixel materials with ONE texel density everywhere: UVs come from WORLD position and the
 * surface orientation, never from the geometry's own UVs. A roof, a wall, a cliff and the
 * ground therefore share the same 16 texels per world unit, regardless of how a mesh was
 * built, merged or scaled. Magnification is always NEAREST (crisp texels); minification
 * uses mipmaps so distance does not shimmer.
 *
 *  - ground (up-facing): projected on X/Z
 *  - walls: X or Z, oriented so up stays up and text never mirrors
 *  - roof-like kinds (`slope`): projected along the slope so tile rows follow the ridge
 */
export function createPixelMaterialFactory(scope:Tracker){
  const textures=new Map<string,{color:THREE.DataTexture;normal:THREE.DataTexture;units:number;slope:boolean}>();
  const materials=new Map<string,THREE.MeshStandardMaterial>();

  function flipRows(data:Uint8ClampedArray,size:number){
    const out=new Uint8ClampedArray(data.length),row=size*4;
    for(let y=0;y<size;y++)out.set(data.subarray(y*row,(y+1)*row),(size-1-y)*row);
    return out;
  }
  function makeTexture(data:Uint8ClampedArray,size:number,color:boolean){
    const t=new THREE.DataTexture(flipRows(data,size),size,size,THREE.RGBAFormat);
    t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;
    t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.magFilter=THREE.NearestFilter;
    t.minFilter=THREE.LinearMipmapLinearFilter;
    t.generateMipmaps=true;
    t.anisotropy=4;
    t.needsUpdate=true;
    return scope.track(t);
  }
  function entry(kind:PixelKind,seed:number){
    const key=kind+":"+seed;
    let found=textures.get(key);
    if(!found){
      const painted=paintTexture(kind,seed);
      found={color:makeTexture(painted.color,painted.size,true),normal:makeTexture(painted.normal,painted.size,false),
        units:painted.units,slope:painted.slope};
      textures.set(key,found);
    }
    return found;
  }

  function material(kind:PixelKind,seed=1){
    const key=kind+":"+seed;
    const cached=materials.get(key);
    if(cached)return cached;
    const tex=entry(kind,seed);
    const mat=new THREE.MeshStandardMaterial({
      map:tex.color,normalMap:tex.normal,normalScale:new THREE.Vector2(1,1),
      roughness:.95,metalness:0,side:THREE.FrontSide,
    });
    const prior=mat.onBeforeCompile;
    mat.onBeforeCompile=(shader,renderer)=>{
      prior(shader,renderer);
      shader.uniforms.uPxUnits={value:tex.units};
      shader.uniforms.uPxSlope={value:tex.slope?1:0};
      shader.vertexShader=shader.vertexShader
        .replace("#include <common>","#include <common>\nvarying vec3 vPxWorld;\nvarying vec3 vPxNormal;")
        .replace("#include <begin_vertex>",`#include <begin_vertex>
  vec4 pxWorld4=vec4(transformed,1.0);
  vec3 pxN=objectNormal;
  #ifdef USE_INSTANCING
    pxWorld4=instanceMatrix*pxWorld4;
    pxN=mat3(instanceMatrix)*pxN;
  #endif
  pxWorld4=modelMatrix*pxWorld4;
  vPxWorld=pxWorld4.xyz;
  vPxNormal=normalize(mat3(modelMatrix)*pxN);`);
      shader.fragmentShader=shader.fragmentShader
        .replace("#include <common>",`#include <common>
varying vec3 vPxWorld;
varying vec3 vPxNormal;
uniform float uPxUnits;
uniform float uPxSlope;
vec2 pxUv;\nvec4 pxPackedSurfaceNormal;
vec2 pixelWorldUv(){
  vec3 n=normalize(vPxNormal);
  vec3 a=abs(n);
  vec3 p=vPxWorld;
  vec2 uv;
  if(uPxSlope>.5&&a.y>.25&&a.y<.97){
    vec2 h=normalize(n.xz+vec2(1e-5));
    uv=vec2(dot(p.xz,vec2(-h.y,h.x)),-dot(p.xz,h)/max(a.y,.2));
  }else if(a.y>=a.x&&a.y>=a.z){
    uv=p.xz;
  }else if(a.x>=a.z){
    uv=vec2(-p.z*(n.x<0.?-1.:1.),p.y);
  }else{
    uv=vec2(p.x*(n.z<0.?-1.:1.),p.y);
  }
  return uv/uPxUnits;
}`)
        .replace("#include <clipping_planes_fragment>","#include <clipping_planes_fragment>\n  pxUv=pixelWorldUv();")
        .replace("#include <map_fragment>",`#ifdef USE_MAP
  diffuseColor*=texture2D(map,pxUv);
#endif`)
        // Roughness is packed in normal alpha; reuse the *same* normal texture sample.
        .replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
#ifdef USE_NORMALMAP_TANGENTSPACE
  pxPackedSurfaceNormal=texture2D(normalMap,pxUv);
  roughnessFactor*=pxPackedSurfaceNormal.a;
#endif`)
        .replace("#include <normal_fragment_maps>",`#ifdef USE_NORMALMAP_TANGENTSPACE
  vec3 pxMapN=pxPackedSurfaceNormal.xyz*2.0-1.0;
  pxMapN.xy*=normalScale;
  mat3 pxTbn=getTangentFrame(-vViewPosition,normal,pxUv);
  normal=normalize(pxTbn*pxMapN);
#endif`);
    };
    const key0=mat.customProgramCacheKey.bind(mat);
    mat.customProgramCacheKey=()=>key0()+"|pixel-world-uv-packed-roughness-v2";
    scope.track(mat);
    materials.set(key,mat);
    return mat;
  }
  return {material,kinds:PIXEL_KIND_NAMES};
}
export type PixelMaterialFactory=ReturnType<typeof createPixelMaterialFactory>;
