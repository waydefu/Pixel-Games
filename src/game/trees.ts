import * as THREE from "three";
import { generateTree, TREE_SPECIES } from "./pixel/tree-gen.js";
import { paintNaturalLeafSheet, NATURAL_FOLIAGE_SIZE } from "./natural-foliage-atlas.js";
import { loadRealisticTreeAssets, type RealTreeAsset } from "./realistic-tree-assets.js";
import { useNearTree, treeModelVariant } from "./tree-lod.js";
import type { StageKit } from "./kit.js";
import type { CloudField } from "./cloud-field.js";

export type TreeSpecies="oak"|"birch"|"pine";
export type TreeItem={x:number;y?:number;z:number;scale:number;rotation:number;tint?:THREE.Color};

/**
 * Procedural trees: tapered branches carry clustered leaf cards with antialiased, naturally
 * shaded leaflets (see pixel/tree-gen.js and natural-foliage-atlas.js). Foliage is lit as a soft volume (normals point
 * away from the crown centre), leaves are cutout with alpha-to-coverage (the pipeline renders with MSAA),
 * and the whole crown sways with the same wind as the clouds. Instanced: a handful of draw calls per set.
 */
const kits=new WeakMap<StageKit,ReturnType<typeof build>>();
export function getTreeKit(k:StageKit,clouds:CloudField){
  let kit=kits.get(k);
  if(!kit){kit=build(k,clouds);kits.set(k,kit);}
  return kit;
}

function flipRows(data:Uint8ClampedArray,size:number){
  const out=new Uint8ClampedArray(data.length),row=size*4;
  for(let y=0;y<size;y++)out.set(data.subarray(y*row,(y+1)*row),(size-1-y)*row);
  return out;
}

function build(k:StageKit,clouds:CloudField){
  const leafMaterials=new Map<TreeSpecies,THREE.MeshStandardMaterial>();
  const geometries=new Map<string,{trunk:THREE.BufferGeometry;leaves:THREE.BufferGeometry;height:number;crownRadius:number}>();

  function leafMaterial(species:TreeSpecies){
    let material=leafMaterials.get(species);
    if(material)return material;
    const sheet=paintNaturalLeafSheet(species,1);
    const texture=k.scope.track(new THREE.DataTexture(flipRows(sheet.color,NATURAL_FOLIAGE_SIZE),NATURAL_FOLIAGE_SIZE,NATURAL_FOLIAGE_SIZE,THREE.RGBAFormat));
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;
    material=k.scope.track(new THREE.MeshStandardMaterial({
      map:texture,vertexColors:true,alphaTest:.42,alphaToCoverage:true,roughness:1,metalness:0,side:THREE.FrontSide,
    }));
    const amplitude=species==="pine"?.07:.11;
    material.onBeforeCompile=shader=>{
      shader.uniforms.uCloudWind=clouds.uniforms.uCloudWind;
      shader.uniforms.uWindStrength=clouds.uniforms.uWindStrength;
      shader.vertexShader=shader.vertexShader
        .replace("#include <common>","#include <common>\nuniform vec2 uCloudWind;uniform float uWindStrength;\nfloat wHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat wNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(wHash(i),wHash(i+vec2(1.0,0.0)),f.x),mix(wHash(i+vec2(0.0,1.0)),wHash(i+vec2(1.0,1.0)),f.x),f.y);}\n// gust fronts: patches of stronger wind carried downwind by the shared drift (same maths as wind.js gustAt)\nfloat windGustMask(vec2 p){return smoothstep(.35,.8,wNoise(p*.045-uCloudWind*1.6));}")
        .replace("#include <begin_vertex>",`#include <begin_vertex>
  // Sway grows with height; each tree is phased by its own world position. Leaves also flutter.
  vec2 windOrigin=modelMatrix[3].xz;
  #ifdef USE_INSTANCING
    windOrigin=(modelMatrix*vec4(instanceMatrix[3].xyz,1.0)).xz;
  #endif
  float windPhase=windOrigin.x*.095+windOrigin.y*.077+uCloudWind.x*1.5+uCloudWind.y*.57;
  float windGust=(.68*sin(windPhase)+.32*sin(windPhase*1.91+1.7))*(.55+1.1*windGustMask(windOrigin))*uWindStrength;
  float windTip=smoothstep(.4,5.5,position.y);
  transformed.x+=windGust*${amplitude.toFixed(3)}*windTip;
  transformed.z+=cos(windPhase*.71)*${(amplitude*.55).toFixed(3)}*windTip;
  float flutter=sin(uCloudWind.x*9.0+position.x*7.0+position.z*5.0+position.y*3.0);
  transformed+=vec3(flutter,flutter*.6,-flutter)*.022*windTip;`);
    };
    material.customProgramCacheKey=()=>"tree-leaves-natural-v3-"+species;
    leafMaterials.set(species,material);
    return material;
  }

  function variant(species:TreeSpecies,seed:number,detail:"high"|"low"){
    const key=species+":"+seed+":"+detail;
    let found=geometries.get(key);
    if(found)return found;
    const tree=generateTree(species,seed,detail);
    const toGeometry=(part:typeof tree.trunk,withColor:boolean)=>{
      const g=new THREE.BufferGeometry();
      g.setAttribute("position",new THREE.BufferAttribute(part.positions,3));
      g.setAttribute("normal",new THREE.BufferAttribute(part.normals,3));
      g.setAttribute("uv",new THREE.BufferAttribute(part.uvs,2));
      if(withColor)g.setAttribute("color",new THREE.BufferAttribute(part.colors,3));
      g.setIndex(new THREE.BufferAttribute(part.indices,1));
      return k.scope.track(g);
    };
    found={trunk:toGeometry(tree.trunk,false),leaves:toGeometry(tree.leaves,true),height:tree.height,crownRadius:tree.crownRadius};
    geometries.set(key,found);
    return found;
  }


  type TreeGroup={
    species:TreeSpecies;
    seed:number;
    items:TreeItem[];
    shadows:boolean;
    high:[THREE.InstancedMesh,THREE.InstancedMesh];
    low:[THREE.InstancedMesh,THREE.InstancedMesh];
    imported:THREE.InstancedMesh[];
    near:boolean[];
    signature:string;
  };
  const groups:TreeGroup[]=[];
  let models:(RealTreeAsset|null)[]|null=null;
  let quality:"basic"|"balanced"|"high"="high";
  let lastPlayer:{x:number;z:number}|null=null;
  const matrixDummy=new THREE.Object3D();
  const white=new THREE.Color(1,1,1);

  function place(meshes:readonly THREE.InstancedMesh[],items:TreeItem[]){
    for(const mesh of meshes){
      items.forEach((item,i)=>{
        matrixDummy.position.set(item.x,item.y??0,item.z);
        matrixDummy.rotation.set(0,item.rotation,0);
        matrixDummy.scale.setScalar(item.scale);
        matrixDummy.updateMatrix();
        mesh.setMatrixAt(i,matrixDummy.matrix);
        if(mesh.userData.treeLeaf===true)mesh.setColorAt(i,item.tint??white);
      });
      mesh.count=items.length;
      mesh.instanceMatrix.needsUpdate=true;
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
      mesh.visible=mesh.count>0;
    }
  }

  /** A group uses two draw calls for a near model (or procedural fallback) and two for a far LOD. */
  function addPair(trunk:THREE.BufferGeometry,leaves:THREE.BufferGeometry,bark:THREE.Material,
    leaf:THREE.Material,capacity:number,shadows:boolean,tag:string):
    [THREE.InstancedMesh,THREE.InstancedMesh]{
    const trunkMesh=k.scope.track(new THREE.InstancedMesh(trunk,bark,capacity));
    const leafMesh=k.scope.track(new THREE.InstancedMesh(leaves,leaf,capacity));
    leafMesh.userData.treeLeaf=true;
    for(const mesh of [trunkMesh,leafMesh]){
      mesh.castShadow=shadows;mesh.receiveShadow=shadows;
      mesh.userData.dynamic=true;
      // Small bounded village instance groups share the same drawing contract as before.
      mesh.frustumCulled=false;
      mesh.name=tag+(mesh===leafMesh?"-leaves":"-trunk");
      mesh.count=0;
      mesh.visible=false;
      k.scene.add(mesh);
    }
    return [trunkMesh,leafMesh];
  }

  function attachImported(group:TreeGroup){
    if(group.species!=="oak"||!models)return;
    const asset=models[treeModelVariant(group.seed,models.length)];
    if(!asset||group.imported.length)return;
    const capacity=Math.max(1,group.items.length);
    for(const part of asset.parts){
      const mesh=k.scope.track(new THREE.InstancedMesh(part.geometry,part.material,capacity));
      mesh.name="coastal-cc0-oak-lod0-"+group.seed+(part.leaf?"-foliage":"-bark");
      mesh.userData.dynamic=true;
      mesh.userData.treeLeaf=part.leaf;
      mesh.castShadow=group.shadows;
      mesh.receiveShadow=group.shadows;
      mesh.frustumCulled=false;
      mesh.count=0;mesh.visible=false;
      k.scene.add(mesh);
      group.imported.push(mesh);
    }
    group.signature="";
  }

  function setQuality(next:"basic"|"balanced"|"high"){
    quality=next;
    for(const group of groups)group.signature="";
    if(lastPlayer)update(lastPlayer);
  }

  /** Re-partition only on threshold crossing; stable camera motion makes no GPU buffer upload. */
  function update(player:{x:number;z:number}){
    lastPlayer={x:player.x,z:player.z};
    for(const group of groups){
      const next=group.items.map((item,i)=>useNearTree(
        Math.hypot(item.x-player.x,item.z-player.z),group.near[i],quality));
      const usingGLB=group.imported.length>0;
      const signature=(usingGLB?"glb":"procedural")+":"+quality+":"+next.map(v=>v?"1":"0").join("");
      if(signature===group.signature)continue;
      group.signature=signature;group.near=next;
      const near:TreeItem[]=[],far:TreeItem[]=[];
      group.items.forEach((item,i)=>(next[i]?near:far).push(item));
      place(group.high,usingGLB?[]:near);
      place(group.low,far);
      if(usingGLB)place(group.imported,near);
    }
  }

  /** Instance one species/seed at multiple positions; authored GLB oak is optional and reversible. */
  function plant(species:TreeSpecies,seed:number,detail:"high"|"low",items:TreeItem[],
    opts:{shadows?:boolean;capacity?:number}={}){
    const capacity=Math.max(1,opts.capacity??items.length);
    const bark=k.pattern(species==="birch"?"birch-bark":species==="pine"?"pine-bark":"bark",species==="oak"?3:1);
    const hi=variant(species,seed,detail);
    const lo=variant(species,seed,"low");
    const high=addPair(hi.trunk,hi.leaves,bark,leafMaterial(species),capacity,!!opts.shadows,"town-"+species+"-high");
    const low=addPair(lo.trunk,lo.leaves,bark,leafMaterial(species),capacity,false,"town-"+species+"-low");
    const group:TreeGroup={species,seed,items,shadows:!!opts.shadows,
      high,low,imported:[],near:items.map(()=>true),signature:""};
    groups.push(group);
    // Old procedural tree is visible while external models finish loading.
    place(high,items);
    attachImported(group);
    return {trunk:high[0],leaves:high[1],height:hi.height,crownRadius:hi.crownRadius};
  }

  // This import never blocks startup. A missing/unsupported GLB stays on procedural foliage.
  void loadRealisticTreeAssets(k,clouds).then(assets=>{
    if((k.scope as typeof k.scope&{disposed?:boolean}).disposed)return;
    models=assets;
    for(const group of groups)attachImported(group);
    if(lastPlayer)update(lastPlayer);
  }).catch(error=>console.warn("Town tree asset import failed; keeping procedural fallback",error));
  return {plant,variant,update,setQuality,species:TREE_SPECIES};
}
