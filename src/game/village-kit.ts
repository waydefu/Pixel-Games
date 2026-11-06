import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { StageKit } from "./kit.js";
import { liveSky } from "./sky-live.js";
import { markGlass } from "./kit-glass.js";

/**
 * Medieval Village Kit by Polyfork (https://polyfork.dev), CC BY 4.0. Free low-poly meshes: one
 * material, vertex colours, no textures, 150-3.6k triangles each. Credits: docs/ASSET-CREDITS.md.
 * Only the GLB mesh files are stored here; Polyfork's ES modules (Polyfork licence) are not.
 *
 * Models are re-skinned to match the pixel world: a shared material adds world-space texel grain at
 * the world density (16 texels/unit) and light banding, and every instance is baked into root-level
 * geometry so the static batcher can merge the whole village into a handful of draw calls.
 */
const urls=import.meta.glob("../../assets/models/polyfork/*.glb",{query:"?url",import:"default",eager:true}) as Record<string,string>;

export type KitName=string;
export type Placement={x:number;z:number;y?:number;rotY?:number;scale?:number;fit?:{w:number;d:number};name?:string};
export type PlacedInfo={width:number;depth:number;height:number};

function normalizeGeometry(source:THREE.BufferGeometry){
  // Common attribute set (position, normal, colour as vec3) so every instance can be merged.
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",source.getAttribute("position").clone());
  if(source.getAttribute("normal"))g.setAttribute("normal",source.getAttribute("normal").clone());
  const color=source.getAttribute("color");
  const out=new Float32Array(source.getAttribute("position").count*3);
  for(let i=0;i<source.getAttribute("position").count;i++){
    out[i*3]=color?color.getX(i):.8;out[i*3+1]=color?color.getY(i):.8;out[i*3+2]=color?color.getZ(i):.8;
  }
  g.setAttribute("color",new THREE.BufferAttribute(out,3));
  g.setAttribute("glow",new THREE.BufferAttribute(new Float32Array(source.getAttribute("position").count),1));
  if(source.index)g.setIndex(source.index.clone());
  if(!g.getAttribute("normal"))g.computeVertexNormals();
  return g;
}

/** Models whose small, near-black panes are real windows. Boats, barrels and carts also use near-black paint. */
const GLAZED=new Set(["village-tavern","two-story-house","thatched-cottage","fisherman-shack","stone-chapel","timber-barn","stilted-granary"]);

export async function loadVillageKit(){
  const loader=new GLTFLoader();
  const templates=new Map<string,{meshes:{geometry:THREE.BufferGeometry;matrix:THREE.Matrix4}[];box:THREE.Box3}>();
  const entries=Object.entries(urls);
  if(!entries.length)return null;
  await Promise.all(entries.map(async([path,url])=>{
    const name=path.split("/").pop()!.replace(/\.glb$/,"");
    const gltf=await loader.loadAsync(url);
    gltf.scene.updateMatrixWorld(true);
    const meshes:{geometry:THREE.BufferGeometry;matrix:THREE.Matrix4}[]=[];
    const box=new THREE.Box3();
    gltf.scene.traverse(node=>{
      const mesh=node as THREE.Mesh;
      if(!mesh.isMesh)return;
      const geometry=normalizeGeometry(mesh.geometry);
      geometry.applyMatrix4(mesh.matrixWorld);   // bake node transforms once
      geometry.computeBoundingBox();
      box.union(geometry.boundingBox!);
      meshes.push({geometry,matrix:new THREE.Matrix4()});
    });
    // Origin at the centre of the footprint, resting on y = 0.
    const centre=box.getCenter(new THREE.Vector3());
    const shift=new THREE.Matrix4().makeTranslation(-centre.x,-box.min.y,-centre.z);
    for(const m of meshes){m.geometry.applyMatrix4(shift);if(GLAZED.has(name))markGlass(m.geometry);}
    const fitted=new THREE.Box3();
    for(const m of meshes){m.geometry.computeBoundingBox();fitted.union(m.geometry.boundingBox!);}
    templates.set(name,{meshes,box:fitted});
  }));
  return {
    has:(name:KitName)=>templates.has(name),
    size:(name:KitName)=>{const t=templates.get(name);if(!t)throw new RangeError("unknown kit model "+name);return t.box.getSize(new THREE.Vector3());},
    names:()=>[...templates.keys()],
    /** Same model as one animatable Group (boats): meshes stay children, so the static batcher leaves them alone. */
    instantiateGroup(k:StageKit,material:THREE.Material,name:KitName,placement:Placement):{group:THREE.Group;info:PlacedInfo}{
      const t=templates.get(name);
      if(!t)throw new RangeError("unknown kit model "+name);
      const size=t.box.getSize(new THREE.Vector3());
      const scale=placement.scale??1;
      const group=new THREE.Group();
      group.position.set(placement.x,placement.y??0,placement.z);
      group.rotation.y=placement.rotY??0;
      group.scale.setScalar(scale);
      group.userData.dynamic=true;
      if(placement.name)group.name=placement.name;
      for(const part of t.meshes){
        const mesh=new THREE.Mesh(k.scope.track(part.geometry.clone()),material);
        mesh.castShadow=true;mesh.receiveShadow=true;
        group.add(mesh);
      }
      k.scene.add(group);
      return {group,info:{width:size.x*scale,depth:size.z*scale,height:size.y*scale}};
    },
    instantiate(k:StageKit,material:THREE.Material,name:KitName,placement:Placement):PlacedInfo{
      const t=templates.get(name);
      if(!t)throw new RangeError("unknown kit model "+name);
      const size=t.box.getSize(new THREE.Vector3());
      let scale=placement.scale??1;
      if(placement.fit)scale=THREE.MathUtils.clamp(Math.min(placement.fit.w/size.x,placement.fit.d/size.z)*1.1,.35,2.6);
      const m=new THREE.Matrix4().compose(
        new THREE.Vector3(placement.x,placement.y??0,placement.z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),placement.rotY??0),
        new THREE.Vector3(scale,scale,scale));
      for(const part of t.meshes){
        const geometry=part.geometry.clone().applyMatrix4(m);
        const mesh=new THREE.Mesh(k.scope.track(geometry),material);
        mesh.castShadow=true;mesh.receiveShadow=true;
        if(placement.name)mesh.name=placement.name;
        k.scene.add(mesh);
      }
      const rotated=(placement.rotY??0)%Math.PI!==0;
      return {width:(rotated?size.z:size.x)*scale,depth:(rotated?size.x:size.z)*scale,height:size.y*scale};
    },
  };
}
export type VillageKit=NonNullable<Awaited<ReturnType<typeof loadVillageKit>>>;

/** One shared material for every kit model: vertex colour + pixel grain + light banding. */
export function createVillageMaterial(k:StageKit){
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,metalness:0});
  material.onBeforeCompile=shader=>{
    shader.uniforms.uWindowGlow=liveSky.lampGlowU;
    shader.vertexShader=shader.vertexShader
      .replace("#include <common>","#include <common>\nattribute float glow;\nvarying float vKitGlow;\nvarying vec3 vKitWorld;\nvarying vec3 vKitNormal;")
      .replace("#include <begin_vertex>",`#include <begin_vertex>
  vKitGlow=glow;
  vKitWorld=(modelMatrix*vec4(transformed,1.0)).xyz;
  vKitNormal=normalize(mat3(modelMatrix)*objectNormal);`);
    shader.fragmentShader=shader.fragmentShader
      .replace("#include <common>",`#include <common>
varying float vKitGlow;
varying vec3 vKitWorld;
varying vec3 vKitNormal;
uniform float uWindowGlow;
float kitHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
`)
      .replace("#include <color_fragment>",`#include <color_fragment>
  {
    // Material classes are read from the kit's flat vertex colours, then painted as pixel-art patterns in world
    // space at 16 texels per unit: red roof tiles, straw thatch, stucco, wood planks, stone courses.
    vec3 n=normalize(vKitNormal);
    vec3 an=abs(n);
    bool sloped=an.y>.25&&an.y<.97;
    vec2 uv;
    if(sloped){
      // Roofs: rows follow the ridge, like the world material's slope projection.
      vec2 h=normalize(n.xz+vec2(1e-5));
      uv=vec2(dot(vKitWorld.xz,vec2(-h.y,h.x)),-dot(vKitWorld.xz,h)/max(an.y,.2));
    }else if(an.y>=an.x&&an.y>=an.z){
      uv=vKitWorld.xz;
    }else if(an.x>=an.z){
      uv=vec2(-vKitWorld.z*(n.x<0.?-1.:1.),vKitWorld.y);
    }else{
      uv=vec2(vKitWorld.x*(n.z<0.?-1.:1.),vKitWorld.y);
    }
    vec2 q=uv*16.0;
    vec2 texel=floor(q);
    float grain=kitHash(texel)-.5;
    float clump=kitHash(floor(uv*8.0)+17.0)-.5;
    vec3 kc=vColor.rgb;
    float kmx=max(kc.r,max(kc.g,kc.b)),kmn=min(kc.r,min(kc.g,kc.b));
    float ksat=(kmx-kmn)/max(kmx,1e-3);
    bool isRoofRed=kc.r>.18&&kc.g<.12&&kc.b<.10;
    bool isCream=kc.r>.55&&kc.g>.45&&kc.b>.28&&ksat<.5;
    bool isWood=!isRoofRed&&!isCream&&kc.r>kc.g&&kc.g>=kc.b&&kmx>.05&&kmx<.65&&ksat>.35;
    bool isStone=ksat<.2&&kmx>.15&&kmx<.85;
    float pat=1.0;
    if(isRoofRed){
      float row=floor(q.y/3.0);
      float x=q.x+mod(row,2.0)*4.0;
      float fy=mod(q.y,3.0),fx=mod(x,8.0);
      pat=1.0+(kitHash(vec2(floor(x/8.0),row))-.5)*.16;
      if(fy<1.0)pat*=.80;else if(fy>=2.0)pat*=1.07;
      if(fx<1.0)pat*=.90;
    }else if(isCream&&sloped){
      float col=floor(q.x),layer=floor(q.y/5.0);
      pat=1.0+(kitHash(vec2(col,3.0))-.5)*.18+(kitHash(vec2(layer,col*.13))-.5)*.08;
      if(mod(q.y,5.0)<1.0)pat*=.84;
    }else if(isCream){
      float s=kitHash(texel);
      pat=s>.965?.88:(s<.03?1.05:1.0);
    }else if(isWood){
      float plank=floor(q.x/4.0);
      pat=1.0+(kitHash(vec2(plank,7.0))-.5)*.16;
      if(mod(q.x,4.0)<1.0)pat*=.84;
      pat*=1.0+(kitHash(vec2(floor(q.x),floor(q.y/(2.0+kitHash(vec2(plank,1.0))*5.0))))-.5)*.10;
    }else if(isStone){
      float row=floor(q.y/4.0);
      float x=q.x+mod(row,2.0)*4.0;
      pat=1.0+(kitHash(vec2(floor(x/8.0),row))-.5)*.20;
      if(mod(q.y,4.0)<1.0||mod(x,8.0)<1.0)pat*=.80;
    }
    // Far away a texel is smaller than a pixel: fade the pattern out instead of shimmering.
    vec2 dq=fwidth(q);
    pat=mix(1.0,pat,1.0-smoothstep(.55,1.25,max(dq.x,dq.y)));
    diffuseColor.rgb*=(1.0+grain*.04+clump*.03)*pat;
    // Pull the kit's saturated vertex colours toward the shared palette: calmer, slightly lifted.
    float kitLuma=dot(diffuseColor.rgb,vec3(.299,.587,.114));
    diffuseColor.rgb=mix(vec3(kitLuma),diffuseColor.rgb,.84);
    diffuseColor.rgb=pow(diffuseColor.rgb,vec3(.90));
  }`)
      .replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
  {
    // Only baked window panes (see markGlass) light up warm after dusk, with a candle-like flicker per pane.
    float flicker=.92+.08*sin(vKitWorld.x*3.1+vKitWorld.z*2.3+uWindowGlow*7.0);
    totalEmissiveRadiance+=vec3(1.0,.70,.36)*step(.5,vKitGlow)*uWindowGlow*1.0*flicker;
  }`)
      .replace("#include <opaque_fragment>",`
  {
    // Light banding with ordered dither: reads as hand-shaded pixel art instead of smooth CG.
    float levels=7.0;
    vec3 banded=(floor(outgoingLight*levels)+.5)/levels; // bin centres: shade never collapses to black
    outgoingLight=mix(outgoingLight,banded,.22);
  }
  #include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=>"village-kit-pixel-v3";
  k.scope.track(material);
  return material;
}
