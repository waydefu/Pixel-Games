import * as THREE from "three";
import { coastalOutline } from "./coastal-outline.js";
import { beachSample } from "./beach-profile.js";
import { grassEdgeHeight } from "./grass-placement.js";
import type { StageKit } from "./kit.js";
import type { CloudField } from "./cloud-field.js";
import { createGrassStudy } from "./coastal-grass-study.js";

/** Curved shoreline and narrowing headlands, instead of a flat rectangular island. */
export function buildCoastalLand(k:StageKit,cloudField:CloudField){
  const countZ=100,countX=42;
  const strips=[
    {name:"grassy-headlands",material:k.pattern("grass",1,14,13),y:-.187,left:(o:ReturnType<typeof coastalOutline>)=>o.grassLeft,right:(o:ReturnType<typeof coastalOutline>)=>o.grassRight},
    {name:"shoreline-sand",material:k.pattern("sand",5,2,13),y:-.184,left:(o:ReturnType<typeof coastalOutline>)=>o.grassRight,right:(o:ReturnType<typeof coastalOutline>)=>o.coast},
  ];
  const study=createGrassStudy(k,cloudField);
  for(const s of strips){
    const sand=s.name==="shoreline-sand";
    // Sand is the only user of this pixel material seed. Keep world-space
    // pixel UV + normal map + cloud-shadow hooks while adding a dry/wet tint.
    if(sand){s.material.vertexColors=true;s.material.needsUpdate=true;}
    cloudField.applyToMaterial(s.material);
    study.apply(s.material);
    const positions:number[]=[],uv:number[]=[],colors:number[]=[],indices:number[]=[];
    for(let iz=0;iz<=countZ;iz++){
      const z=-47+94*iz/countZ;
      const bounds=coastalOutline(z);
      for(let ix=0;ix<=countX;ix++){
        const t=ix/countX;
        const x=bounds.grassLeft===bounds.grassRight&&s.name==="grassy-headlands"?
          bounds.grassLeft:THREE.MathUtils.lerp(s.left(bounds),s.right(bounds),t);
        const beach=sand?beachSample(t,z,bounds.ease):null;
        positions.push(x,beach?.y??grassEdgeHeight(t),z);
        uv.push(t,iz/countZ);
        if(beach)colors.push(...beach.color);
      }
    }
    for(let iz=0;iz<countZ;iz++)for(let ix=0;ix<countX;ix++){
      const a=iz*(countX+1)+ix,b=a+1,c=a+countX+1,d=c+1;
      indices.push(a,c,b,b,c,d);
    }
    const g=k.scope.track(new THREE.BufferGeometry());
    g.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
    g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2));
    if(sand)g.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
    g.setIndex(indices);g.computeVertexNormals();
    const mesh=new THREE.Mesh(g,s.material);
    mesh.name=s.name;mesh.castShadow=false;mesh.receiveShadow=true;
    k.scene.add(mesh);
  }
  return study;
}
