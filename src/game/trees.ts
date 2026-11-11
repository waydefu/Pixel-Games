import * as THREE from "three";
import { generateTree, TREE_SPECIES } from "./pixel/tree-gen.js";
import { paintNaturalLeafSheet, NATURAL_FOLIAGE_SIZE } from "./natural-foliage-atlas.js";
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

  /** Instance one variant at many places. Returns the two meshes (bark, foliage). */
  function plant(species:TreeSpecies,seed:number,detail:"high"|"low",items:TreeItem[],opts:{shadows?:boolean;capacity?:number}={}){
    const {trunk,leaves,height,crownRadius}=variant(species,seed,detail);
    const capacity=Math.max(1,opts.capacity??items.length);
    const bark=k.pattern(species==="birch"?"birch-bark":species==="pine"?"pine-bark":"bark",species==="oak"?3:1);
    const trunkMesh=k.scope.track(new THREE.InstancedMesh(trunk,bark,capacity));
    const leafMesh=k.scope.track(new THREE.InstancedMesh(leaves,leafMaterial(species),capacity));
    const dummy=new THREE.Object3D(),white=new THREE.Color(1,1,1);
    items.forEach((item,i)=>{
      dummy.position.set(item.x,item.y??0,item.z);
      dummy.rotation.set(0,item.rotation,0);
      dummy.scale.setScalar(item.scale);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i,dummy.matrix);leafMesh.setMatrixAt(i,dummy.matrix);
      leafMesh.setColorAt(i,item.tint??white);
    });
    trunkMesh.count=leafMesh.count=items.length;
    trunkMesh.instanceMatrix.needsUpdate=leafMesh.instanceMatrix.needsUpdate=true;
    if(leafMesh.instanceColor)leafMesh.instanceColor.needsUpdate=true;
    for(const mesh of [trunkMesh,leafMesh]){
      mesh.castShadow=!!opts.shadows;mesh.receiveShadow=!!opts.shadows;
      mesh.userData.dynamic=true;mesh.frustumCulled=false; // instance bounds are not tracked; sets are small
      k.scene.add(mesh);
    }
    trunkMesh.name="tree-trunks-"+species;leafMesh.name="tree-leaves-natural-v3-"+species;
    return {trunk:trunkMesh,leaves:leafMesh,height,crownRadius};
  }
  return {plant,variant,species:TREE_SPECIES};
}
