import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { StageKit } from "./kit.js";
import type { CloudField } from "./cloud-field.js";
import { addVegetationWind } from "./vegetation-wind.js";

/** Quaternius CC0 glTF assets. URL imports become local, hashed Vite build files. */
const URLS=[
  new URL("../../assets/models/quaternius/tree-01.glb",import.meta.url).href,
  new URL("../../assets/models/quaternius/tree-02.glb",import.meta.url).href,
  new URL("../../assets/models/quaternius/tree-03.glb",import.meta.url).href,
] as const;

export type RealTreePart={
  geometry:THREE.BufferGeometry;
  material:THREE.MeshStandardMaterial;
  leaf:boolean;
};
export type RealTreeAsset={parts:RealTreePart[];height:number;radius:number};

/** Dispose intermediate loader geometry/materials, not their textures (which cloned materials share). */
function disposeLoaderScene(scene:THREE.Object3D){
  scene.traverse(node=>{
    const mesh=node as THREE.Mesh;
    if(!mesh.isMesh)return;
    mesh.geometry.dispose();
    for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])mat.dispose();
  });
}

async function loadOne(k:StageKit,clouds:CloudField,loader:GLTFLoader,url:string):Promise<RealTreeAsset|null>{
  const gltf=await loader.loadAsync(url);
  const root=gltf.scene;
  if((k.scope as typeof k.scope&{disposed?:boolean}).disposed){
    disposeLoaderScene(root);return null;
  }
  root.updateMatrixWorld(true);
  const raw:{geometry:THREE.BufferGeometry;source:THREE.MeshStandardMaterial;leaf:boolean}[]=[];
  const box=new THREE.Box3();
  root.traverse(node=>{
    const mesh=node as THREE.Mesh;
    if(!mesh.isMesh)return;
    if(Array.isArray(mesh.material)||!(mesh.material instanceof THREE.MeshStandardMaterial))
      throw new Error("Unexpected GLB tree material layout");
    const geometry=mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    geometry.computeBoundingBox();
    if(!geometry.boundingBox)throw new Error("Unbounded GLB tree geometry");
    box.union(geometry.boundingBox);
    const leaf=/lea|foli|crown/i.test(mesh.material.name+" "+mesh.name);
    raw.push({geometry,source:mesh.material,leaf});
  });
  if(!raw.length||box.isEmpty())throw new Error("Empty Quaternius tree model");
  // The source pack uses authored metres; normalize to a 5.8 m town-tree height,
  // centred at the base rather than putting original buried roots below terrain.
  const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  if(!Number.isFinite(size.y)||size.y<=.1)throw new Error("Invalid tree height");
  const s=5.8/size.y;
  const transform=new THREE.Matrix4().makeScale(s,s,s)
    .multiply(new THREE.Matrix4().makeTranslation(-center.x,-box.min.y,-center.z));
  const textures=new Set<THREE.Texture>();
  const parts:RealTreePart[]=[];
  for(const rawPart of raw){
    rawPart.geometry.applyMatrix4(transform);
    rawPart.geometry.computeBoundingSphere();
    const geometry=k.scope.track(rawPart.geometry);
    const material=k.scope.track(rawPart.source.clone());
    material.side=rawPart.leaf?THREE.DoubleSide:THREE.FrontSide;
    material.alphaTest=rawPart.leaf?Math.max(.42,material.alphaTest):material.alphaTest;
    material.alphaToCoverage=rawPart.leaf;
    material.transparent=false;
    material.depthWrite=true;
    material.roughness=Math.max(.76,material.roughness);
    material.vertexColors=!!geometry.getAttribute("color")&&material.vertexColors;
    for(const name of ["map","normalMap","roughnessMap","metalnessMap","aoMap","emissiveMap","alphaMap"] as const){
      const texture=material[name];
      if(texture instanceof THREE.Texture&&!textures.has(texture)){
        k.scope.track(texture);textures.add(texture);
      }
    }
    // These GLBs arrive asynchronously, AFTER world.ts calls applyToScene(scene).
    // Apply the same world-space cloud-shadow map to their materials explicitly.
    // Wind must be installed first so both onBeforeCompile hooks survive chaining.
    if(rawPart.leaf)addVegetationWind(material,clouds,.055);
    clouds.applyToMaterial(material);
    parts.push({geometry,material,leaf:rawPart.leaf});
  }
  disposeLoaderScene(root);
  return {parts,height:5.8,radius:Math.max(size.x,size.z)*s*.5};
}

/** Load individually: a broken or unsupported WebP model never blocks the game. */
export async function loadRealisticTreeAssets(k:StageKit,clouds:CloudField):Promise<(RealTreeAsset|null)[]>{
  const loader=new GLTFLoader();
  const results=await Promise.allSettled(URLS.map(url=>loadOne(k,clouds,loader,url)));
  return results.map((result,i)=>{
    if(result.status==="fulfilled")return result.value;
    console.warn("Town tree GLB unavailable; using procedural fallback",i,result.reason);
    return null;
  });
}
