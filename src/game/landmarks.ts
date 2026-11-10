import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { StageKit } from "./kit.js";
import type { VillageAssets } from "./architecture.js";
import { mulberry32 } from "./wander.js";
import type { Fixtures } from "./torches.js";
import { FARM_BOUNDS } from "./navigation.js";

/**
 * Two things the village was missing: a church closing the western end of the promenade, and a working farm in the
 * north-west with fenced fields of wheat, cabbages, pumpkins and leeks, haystacks, a cart and a granary.
 * The kit models (CC BY 4.0, see docs/ASSET-CREDITS.md) supply the church, fences, haystacks, cart and granary.
 */
export const CHURCH={x:-39,z:0,scale:1.25};
/** Land reserved by these landmarks: trees, shrubs, grass and flowers must stay out of it. */
export const RESERVED=Object.freeze([
  Object.freeze({x0:-50,x1:-26,z0:-34,z1:-17}),   // farm
  Object.freeze({x0:-46,x1:-28,z0:-6,z1:6}),      // churchyard and its path
]);
export const isReserved=(x:number,z:number)=>RESERVED.some(r=>x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1);

const FARM=FARM_BOUNDS;
type Crop="wheat"|"cabbage"|"pumpkin"|"leek";
const FIELDS:{x:number;z:number;w:number;d:number;crop:Crop}[]=[
  {x:-43.2,z:-29.2,w:9,d:5.4,crop:"wheat"},{x:-33.6,z:-29.2,w:8.6,d:5.4,crop:"cabbage"},
  {x:-43.2,z:-22.2,w:9,d:5.4,crop:"pumpkin"},{x:-33.6,z:-22.2,w:8.6,d:5.4,crop:"leek"},
];

function tinted(geometry:THREE.BufferGeometry,color:(y:number)=>THREE.Color){
  const g=geometry.index?geometry.toNonIndexed():geometry;
  const position=g.getAttribute("position"),colors=new Float32Array(position.count*3);
  for(let i=0;i<position.count;i++){const c=color(position.getY(i));colors.set([c.r,c.g,c.b],i*3);}
  g.setAttribute("color",new THREE.BufferAttribute(colors,3));
  g.deleteAttribute("uv");
  return g;
}
function lean(geometry:THREE.BufferGeometry,x:number,z:number,rx:number,rz:number){
  geometry.rotateX(rx);geometry.rotateZ(rz);geometry.translate(x,0,z);return geometry;
}

/** Small merged plant models (one geometry per crop, instanced per plant). */
function cropGeometry(crop:Crop){
  const parts:THREE.BufferGeometry[]=[];
  if(crop==="wheat"){
    const stalk=(x:number,z:number,rx:number,rz:number)=>{
      const g=new THREE.BoxGeometry(.05,.78,.05);g.translate(0,.39,0);
      parts.push(tinted(lean(g,x,z,rx,rz),y=>y>.58?new THREE.Color("#e8cf68"):new THREE.Color("#b99a3a")));
    };
    stalk(0,0,.05,-.06);stalk(.09,.04,-.08,.1);stalk(-.08,.05,.1,.04);stalk(.03,-.09,-.12,-.03);
  }else if(crop==="cabbage"){
    const g=new THREE.IcosahedronGeometry(.27,0);g.scale(1,.78,1);g.translate(0,.2,0);
    parts.push(tinted(g,y=>y>.25?new THREE.Color("#8fc06a"):new THREE.Color("#4f8a46")));
    const leaf=new THREE.IcosahedronGeometry(.34,0);leaf.scale(1,.28,1);leaf.translate(0,.1,0);
    parts.push(tinted(leaf,()=>new THREE.Color("#3f7a3d")));
  }else if(crop==="pumpkin"){
    const g=new THREE.IcosahedronGeometry(.3,1);g.scale(1.1,.8,1.1);g.translate(0,.22,0);
    parts.push(tinted(g,y=>y>.38?new THREE.Color("#f2a04a"):new THREE.Color("#d9702a")));
    const stem=new THREE.BoxGeometry(.06,.1,.06);stem.translate(0,.45,0);
    parts.push(tinted(stem,()=>new THREE.Color("#5c7a35")));
  }else{
    for(let i=0;i<3;i++){
      const g=new THREE.BoxGeometry(.05,.62,.07);g.translate(0,.31,0);
      parts.push(tinted(lean(g,(i-1)*.08,(i%2)*.04,(i-1)*.12,(1-i)*.1),y=>y>.38?new THREE.Color("#7fbf6b"):new THREE.Color("#d8e6c4")));
    }
  }
  return mergeGeometries(parts,false) as THREE.BufferGeometry;
}

export function buildLandmarks(k:StageKit,assets?:VillageAssets|null,fixtures?:Fixtures){
  const rng=mulberry32(2026);
  const cobble=k.pattern("cobble",4,3,9);
  const kit=assets?.kit,material=assets?.material;

  // ---- the church: closes the promenade's western end, door toward the sea (+x) ----
  if(kit&&material&&kit.has("stone-chapel")){
    const info=kit.instantiate(k,material,"stone-chapel",{x:CHURCH.x,z:CHURCH.z,scale:CHURCH.scale,rotY:Math.PI/2,name:"kit-stone-chapel-church"});
    k.collider(CHURCH.x,CHURCH.z,info.width/2+.3,info.depth/2+.3);
    const doorX=CHURCH.x+info.width/2;
    // An iron lantern either side of the door (the wall runs along z, so the arms reach out along +x).
    fixtures?.hangingLantern(doorX,2.7,CHURCH.z-1.7,1,.62,"x");
    fixtures?.hangingLantern(doorX,2.7,CHURCH.z+1.7,1,.62,"x");
    k.flat(Math.abs(-29-doorX)+1,3.4,cobble,(doorX-29)/2,-.058,CHURCH.z);   // path from the door to the promenade
    // Headstones in the churchyard, either side of the path.
    const stone=k.solid("#9aa09a",.95),dark=k.solid("#6e746e",.95);
    for(let i=0;i<9;i++){
      const side=i%2?1:-1;
      const x=CHURCH.x-3+rng()*8-(i>5?2:0),z=side*(4.2+Math.floor(i/2)*.9+rng()*.4);
      if(Math.abs(x-CHURCH.x)<info.width/2+.4&&Math.abs(z-CHURCH.z)<info.depth/2+.4)continue;
      const stele=k.block(.46,.85,.14,stone,x,.42,z,true);
      stele.rotation.y=(rng()-.5)*.25;
      k.block(.58,.12,.28,dark,x,.06,z,false);
      k.collider(x,z,.3,.18);
    }
  }

  // ---- the farm ----
  const soil=k.solid("#5b4433",1),soilDark=k.solid("#493625",1);
  const cropMaterial=k.scope.track(new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));
  const dummy=new THREE.Object3D();
  for(const f of FIELDS){
    k.flat(f.w,f.d,soilDark,f.x,-.15,f.z);
    const rows=Math.floor(f.d/.62),cols=Math.floor((f.w-.5)/.5);
    // Tilled ridges, then plants along them.
    const ridge=k.scope.track(new THREE.InstancedMesh(k.scope.track(new THREE.BoxGeometry(f.w-.5,.13,.3)),soil,rows));
    const plants=k.scope.track(new THREE.InstancedMesh(k.scope.track(cropGeometry(f.crop)),cropMaterial,rows*cols));
    let n=0;
    for(let r=0;r<rows;r++){
      const z=f.z-f.d/2+.45+r*.62;
      dummy.position.set(f.x,-.08,z);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();ridge.setMatrixAt(r,dummy.matrix);
      for(let c=0;c<cols;c++){
        const s=f.crop==="wheat"?.9+rng()*.4:.85+rng()*.35;
        dummy.position.set(f.x-(f.w-.5)/2+.25+c*.5+(rng()-.5)*.1,-.02,z+(rng()-.5)*.08);
        dummy.rotation.set(0,rng()*6.28,0);dummy.scale.set(s,f.crop==="wheat"?s*(.85+rng()*.4):s,s);dummy.updateMatrix();
        plants.setMatrixAt(n,dummy.matrix);
        plants.setColorAt(n,new THREE.Color().setRGB(.92+rng()*.14,.92+rng()*.14,.9+rng()*.12));
        n++;
      }
    }
    plants.count=n;plants.instanceMatrix.needsUpdate=true;if(plants.instanceColor)plants.instanceColor.needsUpdate=true;
    for(const m of [ridge,plants]){m.castShadow=false;m.receiveShadow=true;m.computeBoundingSphere();k.scene.add(m);}
    plants.castShadow=false;
  }
  if(kit&&material){
    // Fence around the farm with a gate on the east side (toward the village).
    const place=(name:string,x:number,z:number,rotY:number,scale=1)=>{if(kit.has(name))kit.instantiate(k,material,name,{x,z,rotY,scale,name:"kit-"+name});};
    const gate={z0:-25,z1:-22.6};
    for(let x=FARM.x0+1;x<FARM.x1;x+=2){place("wooden-fence",x,FARM.z0,0);place("wooden-fence",x,FARM.z1,0);}
    for(let z=FARM.z0+2;z<FARM.z1;z+=2){
      place("wooden-fence",FARM.x0,z,Math.PI/2);
      if(z<gate.z0||z>gate.z1)place("wooden-fence",FARM.x1,z,Math.PI/2);
    }
    k.collider((FARM.x0+FARM.x1)/2,FARM.z0,(FARM.x1-FARM.x0)/2,.2);
    k.collider((FARM.x0+FARM.x1)/2,FARM.z1,(FARM.x1-FARM.x0)/2,.2);
    k.collider(FARM.x0,(FARM.z0+FARM.z1)/2,.2,(FARM.z1-FARM.z0)/2);
    k.collider(FARM.x1,(FARM.z0+gate.z0)/2,.2,(gate.z0-FARM.z0)/2);
    k.collider(FARM.x1,(gate.z1+FARM.z1)/2,.2,(FARM.z1-gate.z1)/2);
    // Farm buildings and props outside the fence on the north and west sides, so the fields stay walkable.
    if(kit.has("stilted-granary")){const g=kit.instantiate(k,material,"stilted-granary",{x:-46,z:-36.5,rotY:0,scale:1.5,name:"kit-granary"});k.collider(-46,-36.5,g.width/2+.2,g.depth/2+.2);}
    for(const [x,z,r] of [[-38,-36,.3],[-41.5,-36.2,2.1],[-33,-35.8,4.2]] as const)
      if(kit.has("haystack")){const h=kit.instantiate(k,material,"haystack",{x,z,rotY:r,scale:1.15,name:"kit-haystack"});k.collider(x,z,h.width/2,h.depth/2);}
    if(kit.has("wooden-cart")){const c=kit.instantiate(k,material,"wooden-cart",{x:-27.5,z:-28.5,rotY:Math.PI/2+.2,scale:1.1,name:"kit-cart"});k.collider(-27.5,-28.5,c.width/2,c.depth/2);}
    if(kit.has("signpost"))kit.instantiate(k,material,"signpost",{x:-27.4,z:-21,rotY:-Math.PI/2,scale:1,name:"kit-signpost"});
  }
  // A scarecrow in the wheat: post, arms, burlap head and a straw hat.
  const wood=k.pattern("planks",14),sack=k.solid("#c8b184",1),straw=k.solid("#d9bf6a",1),cloth=k.solid("#8a4b3a",1);
  const sx=-43.2,sz=-29.2;
  k.column(.05,1.9,wood,sx,.95,sz,6);
  k.block(1.5,.07,.07,wood,sx,1.4,sz,false);
  k.block(.5,.6,.2,cloth,sx,1.18,sz,false);
  k.put(new THREE.IcosahedronGeometry(.2,0),sack,sx,1.78,sz,false);
  k.put(new THREE.ConeGeometry(.32,.22,6),straw,sx,2.02,sz,false);
  k.put(new THREE.CylinderGeometry(.34,.34,.04,8),straw,sx,1.93,sz,false);
  return {fields:FIELDS.length,church:CHURCH,farm:FARM};
}
