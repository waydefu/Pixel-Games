import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/**
 * Merge only static objects sharing material/shadow state.
 * Draw calls drop without making assets look like a lower-detail demo.
 * Dynamic player, particles, water and instanced meshes stay independent.
 */
export function batchStaticScene(scene:THREE.Scene,scope:{
  track:<T extends{dispose:()=>void}>(item:T)=>T;
  release:(item:{dispose:()=>void})=>boolean;
}){
  scene.updateMatrixWorld(true);
  const groups=new Map<string,THREE.Mesh[]>();
  const usage=new Map<THREE.BufferGeometry,number>();
  scene.traverse(node=>{
    if(node instanceof THREE.Mesh && node.geometry){
      usage.set(node.geometry,(usage.get(node.geometry)??0)+1);
    }
  });
  for(const child of [...scene.children]){
    if(!(child instanceof THREE.Mesh) || child instanceof THREE.InstancedMesh)continue;
    if(child.userData.dynamic || !(child.material instanceof THREE.MeshStandardMaterial))continue;
    if(!child.geometry || !child.visible)continue;
    const key=child.material.uuid+":"+Number(child.castShadow)+":"+Number(child.receiveShadow)+":"+child.renderOrder;
    const group=groups.get(key)??[];
    group.push(child);groups.set(key,group);
  }
  let original=0,combined=0;
  for(const group of groups.values()){
    if(group.length<3)continue;
    // Attribute parity: all geometry is converted to triangle lists prior to merging.
    const copies:THREE.BufferGeometry[]=[];
    for(const old of group){
      const copy=old.geometry.index ? old.geometry.toNonIndexed():old.geometry.clone();
      copy.applyMatrix4(old.matrixWorld);copies.push(copy);
    }
    const merged=mergeGeometries(copies,false);
    copies.forEach(g=>g.dispose());
    if(!merged)continue; // Preserve input mesh if attributes are incompatible.
    const replacement=new THREE.Mesh(scope.track(merged),group[0].material);
    replacement.castShadow=group[0].castShadow;
    replacement.receiveShadow=group[0].receiveShadow;
    replacement.renderOrder=group[0].renderOrder;
    for(const old of group){
      scene.remove(old);
      const geometry=old.geometry;
      const remaining=(usage.get(geometry)??1)-1;
      usage.set(geometry,remaining);
      // Only drop a source when no other mesh (including nested boat groups) uses it.
      if(remaining===0)scope.release(geometry);
    }
    scene.add(replacement);
    original+=group.length;combined++;
  }
  return Object.freeze({mergedMeshes:original,batchMeshes:combined,reducedDrawCalls:original-combined});
}
