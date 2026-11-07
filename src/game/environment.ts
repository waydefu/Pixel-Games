import * as THREE from "three";
import type { StageKit } from "./kit.js";
import { buildFishingBoats } from "./boats.js";
import { createCoastalWater } from "./ocean.js";
import { FJORD_LAYOUTS } from "./fjord.js";
import { buildLandmarks, isReserved } from "./landmarks.js";
import type { Fixtures } from "./torches.js";
import { fjordSurfaceHeight } from "./terrain-profile.js";
import { buildCoastalLand } from "./coastline.js";
import { intersectsBoatFootprint } from "./placements.js";
import { liveSky } from "./sky-live.js";
import { getTreeKit, type TreeItem, type TreeSpecies } from "./trees.js";
import { groundHeight } from "./navigation.js";
import type { VillageAssets } from "./architecture.js";
import type { CloudField } from "./cloud-field.js";
import { addVegetationWind } from "./vegetation-wind.js";

function noise(seed:number){const value=Math.sin(seed*182.739+22.13)*43758.5453;return value-Math.floor(value);}
export function buildEnvironment(k:StageKit,cloudField:CloudField,assets?:VillageAssets|null,fixtures?:Fixtures){
  const stone=k.pattern("cobble",2,17,6);
  const dirt=k.solid("#957b5b"),oak=k.pattern("planks",9),posts=k.solid("#715742");
  const dark=k.solid("#434944"),foam=k.solid("#dae3c6",.8);
  const cliff=k.pattern("cliff",9),leaves=[k.pattern("foliage",1,2,2),k.pattern("foliage",3,2,2),k.pattern("foliage",5,2,2),k.pattern("foliage",7,2,2)];
  // The curved mesh closes toward both headlands; no rectangular lawn edge.
  buildCoastalLand(k,cloudField);
  cloudField.applyToMaterial(stone);
  // Cobblestone promenade & irregular town square, not a grid of raised box tiles.
  k.flat(42,6.3,stone,-8.0,-.062,0);
  const pierRoad=k.pattern("cobble",4,3,9);
  const townSquare=k.pattern("cobble",6,4,4);
  cloudField.applyToMaterial(pierRoad);
  cloudField.applyToMaterial(townSquare);
  k.flat(3.2,13,pierRoad,9,-.059,5.2);
  k.ellipse(6.0,5.0,townSquare,-5.0,-.057,6.1);
  for(let i=0;i<40;i++){
    const x=-26+i*.98;
    for(const s of [-1,1]){
      const zz=s*(3.25+noise(i*.78)*.36);
      k.block(.26,.035,.30,i%3?dirt:k.pattern("stone",3),x,-.040,zz,false);
    }
  }
  // Terrain height anywhere on the four fjord meshes: the sea bakes its mountain reflection from this.
  const landHeight=(x:number,z:number)=>{
    let m=0;
    for(const [region,e] of Object.entries(FJORD_LAYOUTS))
      if(x>=e.x0&&x<=e.x1&&z>=e.z0&&z<=e.z1)m=Math.max(m,fjordSurfaceHeight(x,z,region as keyof typeof FJORD_LAYOUTS));
    return m;
  };
  const ocean=createCoastalWater(k,landHeight);
  const foamSpots:[number,number,number][]=[];
  // Curved surf edge: tiny sunlit stones and tidal foam ribbons.
  for(let i=0;i<85;i++){
    const z=-33+i*.79;
    const x=13.42+Math.sin(z*.21)*.43+Math.sin(z*.77)*.11;
    const r=.08+noise(i)*.16;
    k.ellipse(r*2,r*.45,foam,x,-.082,z);
    if(i%3===0)k.put(new THREE.IcosahedronGeometry(.13+noise(i*2)*.18,0),
      k.pattern("rock",2),11.2+noise(i)*1.5,.06,z,false);
  }
  // Water-facing low masonry seawall, interrupted naturally for the fishing pier.
  const seawall=k.pattern("stone",13,2,1);
  for(let z=-29;z<30;z+=3.3){
    if(z>5.3&&z<11.2)continue;
    k.block(.55,.44,3.0,seawall,12.4,.13,z,false);
    k.block(.83,.14,3.06,k.pattern("stone",14,2,1),12.4,.40,z,false);
  }

  // Functional, approachable wood wharf with piers, decks, mooring ropes.
  const pierX=20,pierZ=8.0;
  k.block(18.5,.48,4.75,oak,pierX,-.003,pierZ);
  const plankMaterial=k.pattern("planks",17);
  const plankGeometry=k.scope.track(new THREE.BoxGeometry(.10,.035,4.73));
  const planks=k.scope.track(new THREE.InstancedMesh(plankGeometry,plankMaterial,98));
  const dummy=new THREE.Object3D();
  for(let i=0;i<98;i++){
    dummy.position.set(11+i*.187,.275,pierZ);
    dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);
    dummy.updateMatrix();planks.setMatrixAt(i,dummy.matrix);
  }
  planks.instanceMatrix.needsUpdate=true;planks.castShadow=false;planks.receiveShadow=true;k.scene.add(planks);
  for(let x=12.1;x<29.2;x+=4.0){
    for(const z of [5.65,10.35]){
      k.column(.29,2.2,posts,x,-.86,z,9);
      foamSpots.push([x,z,.34]);
      k.column(.36,.17,k.solid("#af9774"),x,.35,z,9);
    }
  }
  for(let i=0;i<3;i++){
    const x=13+i*6.1;
    for(const z of [5.6,10.4]){
      k.column(.17,.78,posts,x,.62,z,7);
      // Coiled rope from three short loops.
      const ring=k.put(new THREE.TorusGeometry(.23,.045,5,12),k.solid("#bcad88"),x,.49,z,false);
      ring.rotation.x=Math.PI/2;
    }
  }
  // Original wooden fishing boats; grouped hull, canvas and mooring gear.
  const boats=buildFishingBoats(k,assets);

  // Natural stone banks and no harsh rectangular cliff wall.
  const stones=[k.pattern("rock",2),k.pattern("rock",3),k.solid("#8c9788")];
  for(let i=0;i<42;i++){
    const x=9.8+(noise(i*3)*2.7),z=-31+i*1.5;
    if(z>2.2&&z<12.3)continue;
    const scale=.30+noise(i*8)*.78;
    const rock=k.put(new THREE.IcosahedronGeometry(scale,0),stones[i%3],x,scale*.22,z);
    rock.scale.set(1.33,.69,1.07);rock.rotation.set(.15,noise(i)*6,.2);
  }
  // Small distant rocks and headlands balance the shore while framing the view.
  for(let i=0;i<18;i++){
    const x=18+noise(i*5)*12,z=-31+noise(i*9)*55;
    // Oversized shoreline rocks must not obscure the wooden pier.
    if(x>=10&&x<=31&&z>=3.0&&z<=12.8)continue;
    const r=.22+noise(i+33)*.92;
    if(intersectsBoatFootprint(x,z,r))continue;
    const rock=k.put(new THREE.IcosahedronGeometry(r,1),stones[i%3],x,-.1,z);
    rock.scale.set(1.2,.5,1.8);rock.rotation.y=i*.67;
    foamSpots.push([x,z,r*1.45]);
  }

  ocean.setSpots(foamSpots);

  // Town trees are procedural pixel trees (see trees.ts); only the trunk blocks the player.
  function treeCollider(x:number,z:number,scale:number){k.collider(x,z,.52*scale,.52*scale);}
  const treeLocations=[
    [-4,-8],[8,-9],[-8,12],[-22,6],[-30,20],[6,22],[-12,22],[-31,-4],
    [-20,-19],[-34,-24],[-35,0],[-37,13],[-9,-23],[7,-23],[-15,29],[-25,29],
    // The village's western and outer edges: trees thicken toward the mountains, the sea side stays open.
    [-39,-14],[-40,-28],[-41,4],[-39,23],[-29,-31],[-15,-32],[-3,-31],[9,-31],[-18,32],[-3,31],[10,31],[-24,-5],[-27,3],[-31,-17]
  ];
  const townTrees=new Map<string,{seed:number;items:TreeItem[]}>();
  for(let i=0;i<treeLocations.length;i++){
    const [x,z]=treeLocations[i];
    if(isReserved(x,z))continue;   // the farm and the churchyard are clear of trees
    const scale=.82+noise(i+31)*.42,roll=noise(i*7.13+2);
    // A mixed coastal wood: mostly oak, some birch, a few pines.
    const species:TreeSpecies=roll<.55?"oak":roll<.8?"birch":"pine";
    const seed=1+(i%3);
    const bucket=townTrees.get(species+seed)??{seed,items:[]};
    bucket.items.push({x,y:groundHeight(x,z),z,scale,rotation:noise(i*3.7)*Math.PI*2,
      tint:new THREE.Color().setRGB(.9+noise(i*1.9)*.16,.92+noise(i*2.3)*.12,.84+noise(i*4.1)*.2)});
    townTrees.set(species+seed,bucket);
    treeCollider(x,z,scale);
  }
  const treeKit=getTreeKit(k,cloudField);
  for(const [key,bucket] of townTrees){
    treeKit.plant(key.replace(/\d+$/,"") as TreeSpecies,bucket.seed,"high",bucket.items,{shadows:true});
  }
  // The church and the farm claim their land before anything is scattered over it.
  buildLandmarks(k,assets,fixtures);

  // Instanced grasses and flowers; no runtime geometry per blade.
  // Shrubs are the missing mid-scale silhouette between flower and tree.
  // Instancing costs one main draw call, never hundreds of individual spheres.
  const shrubGeo=k.scope.track(new THREE.IcosahedronGeometry(.53,0));
  const shrubMat=k.pattern("foliage",11);
  addVegetationWind(shrubMat,cloudField,.075);
  const shrubs=k.scope.track(new THREE.InstancedMesh(shrubGeo,shrubMat,280));
  // Tints multiply the (already green) pixel foliage, so they stay near-white or shrubs go black.
  const shrubColors=[new THREE.Color("#e2efd2"),new THREE.Color("#d2e8c4"),
    new THREE.Color("#ecf3cf"),new THREE.Color("#cde3c2")];
  let shrubCount=0;
  for(let i=0;i<1150&&shrubCount<280;i++){
    const x=-39+noise(i*6.3+14)*47,z=-35+noise(i*3.9+21)*70;
    if(x>9.5||Math.abs(z)<4.2&&x>-33||isReserved(x,z))continue;
    if(k.colliders.some(c=>Math.abs(x-c.x)<c.halfX+.65&&Math.abs(z-c.z)<c.halfZ+.65))continue;
    const scale=.45+noise(i*9.1+2)*.87;
    dummy.position.set(x,.37*scale,z);
    dummy.scale.set(scale*1.2,scale*.68,scale);
    dummy.rotation.set(0,noise(i*4.1)*Math.PI,0);
    dummy.updateMatrix();
    shrubs.setMatrixAt(shrubCount,dummy.matrix);
    shrubs.setColorAt(shrubCount,shrubColors[i%shrubColors.length]);
    shrubCount++;
  }
  shrubs.count=shrubCount;
  shrubs.instanceMatrix.needsUpdate=true;
  if(shrubs.instanceColor)shrubs.instanceColor.needsUpdate=true;
  shrubs.castShadow=false;shrubs.receiveShadow=true;
  shrubs.name="coastal-understory-shrubs";
  shrubs.computeBoundingSphere();
  if(shrubs.boundingSphere)shrubs.boundingSphere.radius+=.36;
  k.scene.add(shrubs);

  const grassMaterial=k.solid("#8ba777");
  addVegetationWind(grassMaterial,cloudField,.13);
  const grassGeom=k.scope.track(new THREE.ConeGeometry(.075,.38,3));
  const grass=k.scope.track(new THREE.InstancedMesh(grassGeom,grassMaterial,1600));
  let count=0;
  for(let i=0;i<3100&&count<1600;i++){
    const x=-38+noise(i*3.03)*48,z=-34+noise(i*4.19)*68;
    if(Math.abs(z)<4.1&&x>-32||isReserved(x,z))continue;
    if(k.colliders.some(c=>Math.abs(x-c.x)<c.halfX+.6&&Math.abs(z-c.z)<c.halfZ+.6))continue;
    if(x>10)continue;
    const s=.38+noise(i*8.2)*1.7;
    dummy.position.set(x,-.04,z);dummy.scale.set(s,s,s);dummy.rotation.set(0,i*.28,0);dummy.updateMatrix();
    grass.setMatrixAt(count++,dummy.matrix);
  }
  grass.count=count;grass.instanceMatrix.needsUpdate=true;grass.castShadow=false;
  grass.computeBoundingSphere();
  if(grass.boundingSphere)grass.boundingSphere.radius+=.36;
  k.scene.add(grass);
  const flowerColors=["#e7be8b","#edd7bc","#c997ae","#d8bf6b"];
  for(let color=0;color<flowerColors.length;color++){
    const geo=k.scope.track(new THREE.IcosahedronGeometry(.115,0));
    const inst=k.scope.track(new THREE.InstancedMesh(geo,k.solid(flowerColors[color]),95));
    let j=0;
    for(let i=0;i<330&&j<95;i++){
      const x=-37+noise(i*2.3+color*.6)*46,z=-30+noise(i*8.9+color*.7)*64;
      if(x>8||Math.abs(z)<4.5||isReserved(x,z))continue;
      if(k.colliders.some(c=>Math.abs(x-c.x)<c.halfX+.6&&Math.abs(z-c.z)<c.halfZ+.6))continue;
      dummy.position.set(x,.21,z);dummy.scale.set(1,1,1);dummy.rotation.set(0,0,0);dummy.updateMatrix();
      inst.setMatrixAt(j++,dummy.matrix);
    }
    inst.count=j;inst.instanceMatrix.needsUpdate=true;k.scene.add(inst);
  }

  // Lighting: soft upper atmosphere and low sun, physically motivated windows.
  const sky=new THREE.HemisphereLight("#bdd0e0","#5f5444",1.05);k.scene.add(sky);
  const sunlight=new THREE.DirectionalLight("#ffc78a",3.5);
  const moonlight=new THREE.DirectionalLight("#8ea8ff",0);k.scene.add(moonlight);moonlight.target=sunlight.target;
  sunlight.position.set(liveSky.sunDir.x*34,Math.max(.2,liveSky.sunDir.y)*34,liveSky.sunDir.z*34);sunlight.castShadow=true;
  sunlight.shadow.mapSize.set(1024,1024);
  sunlight.shadow.camera.left=-34;sunlight.shadow.camera.right=34;
  sunlight.shadow.camera.top=35;sunlight.shadow.camera.bottom=-35;
  sunlight.shadow.camera.near=1;sunlight.shadow.camera.far=95;
  sunlight.shadow.normalBias=.036;sunlight.shadow.bias=-.00015;
  k.scene.add(sunlight);
  const target=new THREE.Object3D();k.scene.add(target);
  sunlight.target=target;
  function update(time:number,player?:{x:number;z:number}){
    ocean.update(time);
    boats.update(time);
    if(player){
      target.position.set(player.x,0,player.z);
      target.updateMatrixWorld();
    }
    applySky(player);
  }
  /** Sun, moon and sky light from the live sky; the shadow camera follows the player. */
  function applySky(player?:{x:number;z:number}){
    const px=player?.x??0,pz=player?.z??0;
    // Keep a minimum elevation for the shadow camera so dawn/dusk shadows stay stable instead of infinite.
    const lift=Math.max(.16,liveSky.sunDir.y);
    sunlight.position.set(px+liveSky.sunDir.x*34,lift*34,pz+liveSky.sunDir.z*34);
    sunlight.color.copy(liveSky.sunColor);
    sunlight.intensity=liveSky.sunIntensity;
    sunlight.visible=liveSky.sunIntensity>.01;
    sky.color.copy(liveSky.hemiSky);sky.groundColor.copy(liveSky.hemiGround);sky.intensity=liveSky.hemiIntensity;
    moonlight.position.set(px+liveSky.moonDir.x*34,Math.max(.25,liveSky.moonDir.y)*34,pz+liveSky.moonDir.z*34);
    moonlight.color.copy(liveSky.moonColor);moonlight.intensity=liveSky.moonIntensity;
    moonlight.visible=liveSky.moonIntensity>.01;
  }
  function setFoliageDensity(factor:number){
    const amount=THREE.MathUtils.clamp(factor,0,1);
    shrubs.count=Math.round(shrubCount*amount);
    grass.count=Math.round(count*amount);
    shrubs.visible=shrubs.count>0;
    grass.visible=grass.count>0;
  }
  return {sunlight,moonlight,update,applySky,setFoliageDensity,setSeaReflection:ocean.setReflection,sea:ocean.material,
    boats:boats.boats,boatsMovable:boats.movable,seaBlockers:foamSpots,setBoatFoam:ocean.setBoats};
}
