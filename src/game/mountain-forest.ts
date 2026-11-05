import * as THREE from "three";
import { fjordSurfaceHeight } from "./terrain-profile.js";
import type { StageKit } from "./kit.js";

type Region="mainland"|"east"|"north"|"south";
type Extent={x0:number;x1:number;z0:number;z1:number};
const BUDGET=370;

function hash(n:number){
  const k=Math.sin(n*127.1+21.7)*43758.5453;
  return k-Math.floor(k);
}
function slopeAt(x:number,z:number,region:Region){
  const d=3.0;
  const dx=(fjordSurfaceHeight(x+d,z,region)-fjordSurfaceHeight(x-d,z,region))/(2*d);
  const dz=(fjordSurfaceHeight(x,z+d,region)-fjordSurfaceHeight(x,z-d,region))/(2*d);
  return Math.hypot(dx,dz);
}

/**
 * Region-scoped forest inspired by THREE.InstancedMesh and common slope masks.
 * Mountain trees are NOT 150k unculled grass blades: four local region buckets
 * with bounded forest counts allow frustum culling and a mobile quality ladder.
 */
export function buildMountainForest(k:StageKit,region:Region,extent:Extent,regionIndex:number){
  const leafMat=k.scope.track(new THREE.MeshStandardMaterial({
    color:"#edf1e6",roughness:1,metalness:0,flatShading:true,
  }));
  const trunkMat=k.pattern("timber",26+regionIndex);
  const trunkGeo=k.scope.track(new THREE.CylinderGeometry(.17,.32,1,6));
  const conesGeo=k.scope.track(new THREE.ConeGeometry(1,1,6));
  const broadGeo=k.scope.track(new THREE.IcosahedronGeometry(1,0));
  const trunks=k.scope.track(new THREE.InstancedMesh(trunkGeo,trunkMat,BUDGET));
  const cones=k.scope.track(new THREE.InstancedMesh(conesGeo,leafMat,BUDGET*3));
  const broad=k.scope.track(new THREE.InstancedMesh(broadGeo,leafMat,BUDGET*3));
  for(const [name,obj] of [["trunks",trunks],["conifers",cones],["broadleaf",broad]] as const){
    obj.name="mountain-forest-"+region+"-"+name;
    // Distant vegetation is unshadowed by default. Cloud shadows on the
    // mountain surface remain via shared texture; nearby town trees cast shadows.
    obj.castShadow=false;obj.receiveShadow=false;
    obj.frustumCulled=true;obj.userData.dynamic=true;
    k.scene.add(obj);
  }
  const dummy=new THREE.Object3D();
  const green=[new THREE.Color("#375b50"),new THREE.Color("#446e5e"),
    new THREE.Color("#628076"),new THREE.Color("#526e58"),
    new THREE.Color("#76836a")];
  const treeLocations:{x:number;z:number;y:number;scale:number;rotation:number}[]=[];
  let t=0,c=0,br=0;
  for(let i=0;i<BUDGET*13&&t<BUDGET;i++){
    const h=i+regionIndex*6391;
    // Keep a margin away from triangle-strip boundaries to avoid terrain
    // interpolation seams and from the tidal coastline.
    const x=extent.x0+8+hash(h*17.31)*(extent.x1-extent.x0-16);
    const z=extent.z0+8+hash(h*23.79)*(extent.z1-extent.z0-16);
    const y=fjordSurfaceHeight(x,z,region);
    if(y<11||y>79)continue;
    const slope=slopeAt(x,z,region);
    if(slope>1.18)continue;
    // Forest clusters are denser on cool midslopes, sparse on rock and ridges.
    const density=.55+.35*Math.sin(x*.043+z*.037);
    if(hash(h*5.2)>density)continue;
    const scale=.68+hash(h*9.13)*.88;
    const rotation=hash(h*11.4)*Math.PI*2;
    const species=hash(h*3.15)>.27?"conifer":"broadleaf";
    treeLocations.push({x,z,y,scale,rotation});

    dummy.position.set(x,y+1.45*scale,z);
    dummy.rotation.set(0,rotation,0);
    dummy.scale.set(scale,3.15*scale,scale);
    dummy.updateMatrix();
    trunks.setMatrixAt(t++,dummy.matrix);

    const palette=green[Math.floor(hash(h*21.5)*green.length)];
    if(species==="conifer"){
      for(let layer=0;layer<3;layer++){
        const factor=1-layer*.26;
        dummy.position.set(x,y+(2.9+layer*.79)*scale,z);
        dummy.rotation.set(0,rotation+.15*layer,0);
        dummy.scale.set((1.40-layer*.31)*scale,2.65*factor*scale,(1.40-layer*.31)*scale);
        dummy.updateMatrix();
        cones.setMatrixAt(c,dummy.matrix);
        cones.setColorAt(c,palette);
        c++;
      }
    }else{
      for(let lobe=0;lobe<3;lobe++){
        const off=lobe-1;
        dummy.position.set(x+off*.67*scale,y+(3.45+.32*(lobe%2))*scale,
          z+Math.sin(rotation+lobe)*.40*scale);
        dummy.rotation.set(.08,rotation+lobe*.4,.10);
        dummy.scale.set(1.22*scale,1.05*scale,1.25*scale);
        dummy.updateMatrix();
        broad.setMatrixAt(br,dummy.matrix);
        broad.setColorAt(br,palette);
        br++;
      }
    }
  }
  trunks.count=t;cones.count=c;broad.count=br;
  for(const mesh of [trunks,cones,broad]){
    mesh.instanceMatrix.needsUpdate=true;
    if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    if(mesh.count)mesh.computeBoundingSphere();
    else mesh.visible=false;
  }
  const counts={trees:t,coniferLobes:c,broadleafLobes:br};
  return {region,counts,trees:treeLocations,meshes:[trunks,cones,broad]};
}
