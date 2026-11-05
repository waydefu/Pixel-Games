import * as THREE from "three";
import { createArtLibrary } from "./art.js";

/** Shared original modelling primitives. Details and surfaces are authored in scene modules. */
export function createStageKit(scene:THREE.Scene,scope:{track:<T extends{dispose:()=>void}>(item:T)=>T}){
  const art=createArtLibrary(scope);
  const solidCache=new Map<string,THREE.MeshStandardMaterial>();
  /** Lit windows, lanterns and fires: world.ts dims them by day and lights them at dusk. */
  const emissives:THREE.MeshStandardMaterial[]=[];
  const patternCache=new Map<string,THREE.MeshStandardMaterial>();
  const colliders:{x:number;z:number;halfX:number;halfZ:number}[]=[];
  function solid(color:string,roughness=.92,emissive?:string){
    const key=color+"-"+roughness+"-"+(emissive??"");
    let m=solidCache.get(key);
    if(!m){
      m=new THREE.MeshStandardMaterial({color,roughness,metalness:0,
        emissive:emissive??"#000000",emissiveIntensity:emissive?0.55:0});
      scope.track(m);solidCache.set(key,m);
      if(emissive)emissives.push(m);
    }
    return m;
  }
  // rx/ry are accepted for call-site compatibility but ignored: texel density is fixed in world space.
  function pattern(kind:Parameters<typeof art.material>[0],seed=1,_rx=1,_ry=1){
    const key=kind+":"+seed;
    let material=patternCache.get(key);
    if(!material){
      material=art.material(kind,seed);
      material.side=THREE.DoubleSide;
      patternCache.set(key,material);
    }
    return material;
  }
  function put(g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number,shadow=true){
    const mesh=new THREE.Mesh(scope.track(g),m);
    mesh.position.set(x,y,z);
    mesh.castShadow=shadow;mesh.receiveShadow=true;scene.add(mesh);
    return mesh;
  }
  function block(w:number,h:number,d:number,material:THREE.Material,x:number,y:number,z:number,shadow=true){
    return put(new THREE.BoxGeometry(w,h,d),material,x,y,z,shadow);
  }
  function column(rad:number,height:number,material:THREE.Material,x:number,y:number,z:number,segments=8){
    return put(new THREE.CylinderGeometry(rad*.86,rad,height,segments),material,x,y,z);
  }
  function flat(w:number,d:number,material:THREE.Material,x:number,y:number,z:number){
    const plane=put(new THREE.PlaneGeometry(w,d),material,x,y,z,false);
    plane.rotation.x=-Math.PI/2;return plane;
  }
  function ellipse(rx:number,rz:number,material:THREE.Material,x:number,y:number,z:number){
    const o=put(new THREE.CircleGeometry(1,32),material,x,y,z,false);
    o.rotation.x=-Math.PI/2;o.scale.set(rx,rz,1);return o;
  }
  function quad(points:number[][],material:THREE.Material,shadow=true){
    const positions=new Float32Array([...points[0],...points[1],...points[2],
      ...points[0],...points[2],...points[3]]);
    const uv=new Float32Array([0,0,1,0,1,1,0,0,1,1,0,1]);
    const geom=new THREE.BufferGeometry();
    geom.setAttribute("position",new THREE.BufferAttribute(positions,3));
    geom.setAttribute("uv",new THREE.BufferAttribute(uv,2));
    geom.computeVertexNormals();
    return put(geom,material,0,0,0,shadow);
  }
  function segment(a:THREE.Vector3,b:THREE.Vector3,r:number,material:THREE.Material,edges=8){
    const d=new THREE.Vector3().subVectors(b,a);
    const o=put(new THREE.CylinderGeometry(r,r,d.length(),edges),material,0,0,0);
    o.position.copy(a).add(b).multiplyScalar(.5);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
    return o;
  }
  function collider(x:number,z:number,halfX:number,halfZ:number){
    colliders.push({x,z,halfX,halfZ});
  }
  return {scene,scope,art,colliders,emissives,solid,pattern,put,block,column,flat,ellipse,quad,segment,collider};
}
export type StageKit=ReturnType<typeof createStageKit>;
