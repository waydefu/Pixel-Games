import * as THREE from "three";
import { coastalOutline } from "./coastal-outline.js";
import type { StageKit } from "./kit.js";
import type { CloudField } from "./cloud-field.js";

/** Curved shoreline and narrowing headlands, instead of a flat rectangular island. */
export function buildCoastalLand(k:StageKit,cloudField:CloudField){
  const countZ=100,countX=42;
  const strips=[
    {name:"grassy-headlands",material:k.pattern("grass",1,14,13),y:-.187,left:(o:ReturnType<typeof coastalOutline>)=>o.grassLeft,right:(o:ReturnType<typeof coastalOutline>)=>o.grassRight},
    {name:"shoreline-sand",material:k.pattern("sand",5,2,13),y:-.116,left:(o:ReturnType<typeof coastalOutline>)=>o.grassRight,right:(o:ReturnType<typeof coastalOutline>)=>o.coast},
  ];
  for(const s of strips){
    cloudField.applyToMaterial(s.material);
    const positions:number[]=[],uv:number[]=[],indices:number[]=[];
    for(let iz=0;iz<=countZ;iz++){
      const z=-47+94*iz/countZ;
      const bounds=coastalOutline(z);
      for(let ix=0;ix<=countX;ix++){
        const t=ix/countX;
        const x=bounds.grassLeft===bounds.grassRight&&s.name==="grassy-headlands"?
          bounds.grassLeft:THREE.MathUtils.lerp(s.left(bounds),s.right(bounds),t);
        positions.push(x,s.y,z);
        uv.push(t,iz/countZ);
      }
    }
    for(let iz=0;iz<countZ;iz++)for(let ix=0;ix<countX;ix++){
      const a=iz*(countX+1)+ix,b=a+1,c=a+countX+1,d=c+1;
      indices.push(a,c,b,b,c,d);
    }
    const g=k.scope.track(new THREE.BufferGeometry());
    g.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
    g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
    g.setIndex(indices);g.computeVertexNormals();
    const mesh=new THREE.Mesh(g,s.material);
    mesh.name=s.name;mesh.castShadow=false;mesh.receiveShadow=true;
    k.scene.add(mesh);
  }
}
