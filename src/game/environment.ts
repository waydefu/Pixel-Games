import * as THREE from "three";
import type { StageKit } from "./kit.js";
import { buildFishingBoats } from "./boats.js";
import { createCoastalWater } from "./ocean.js";
import { buildCoastalLand } from "./coastline.js";
import { intersectsBoatFootprint } from "./placements.js";
import { SUN_DIRECTION } from "./environment-state.js";
import type { CloudField } from "./cloud-field.js";
import { addVegetationWind } from "./vegetation-wind.js";

function noise(seed:number){const value=Math.sin(seed*182.739+22.13)*43758.5453;return value-Math.floor(value);}
export function buildEnvironment(k:StageKit,cloudField:CloudField){
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
  const ocean=createCoastalWater(k);
  // Curved surf edge: tiny sunlit stones and tidal foam ribbons.
  for(let i=0;i<85;i++){
    const z=-33+i*.79;
    const x=13.42+Math.sin(z*.21)*.43+Math.sin(z*.77)*.11;
    const r=.08+noise(i)*.16;
    k.ellipse(r*2,r*.45,foam,x,-.082,z);
    if(i%3===0)k.put(new THREE.IcosahedronGeometry(.13+noise(i*2)*.18,0),
      k.pattern("cliff",2),11.2+noise(i)*1.5,.06,z,false);
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
  const boats=buildFishingBoats(k);

  // Natural stone banks and no harsh rectangular cliff wall.
  const stones=[k.pattern("cliff",2),k.pattern("cliff",3),k.solid("#8c9788")];
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
  }

  function tree(x:number,z:number,scale:number,seed:number){
    const trunk=k.put(new THREE.CylinderGeometry(.22*scale,.34*scale,3.15*scale,9),
      k.pattern("timber",4),x,1.55*scale,z);
    trunk.castShadow=true;
    const crowns=[[-.83,3.25,.18],[.82,3.12,.02],[0,3.74,0],[0,2.98,-.84],
      [-.2,3.12,.87],[.46,4.15,.25],[-.57,3.84,-.4]];
    for(let i=0;i<crowns.length;i++){
      const [ox,oy,oz]=crowns[i],radius=(.94+.18*noise(seed+i))*scale;
      const bulb=k.put(new THREE.IcosahedronGeometry(radius,1),leaves[(seed+i)%leaves.length],
        x+ox*scale,oy*scale,z+oz*scale);
      bulb.scale.set(1.12,.9,1.15);bulb.rotation.set(i*.15,i*.47,i*.1);
    }
    // Lower inner canopy, kept darker to mimic clustered self-occlusion at
    // mobile distances. The seven outer lobes keep their original silhouette.
    const underside=k.put(new THREE.IcosahedronGeometry(1.06*scale,0),
      k.solid("#345a49"),x,3.12*scale,z,false);
    underside.scale.set(1.55,.75,1.50);
    // Three readable fork limbs connect the trunk to foliage, preventing the
    // 'lollipop tree' silhouette seen in the original distant shot.
    const branchMaterial=k.pattern("timber",4);
    for(let arm=0;arm<3;arm++){
      const angle=arm*Math.PI*2/3+seed*.31;
      k.segment(new THREE.Vector3(x,2.12*scale,z),
        new THREE.Vector3(x+Math.cos(angle)*1.02*scale,3.36*scale,
          z+Math.sin(angle)*1.02*scale),.105*scale,branchMaterial,6);
    }
    k.collider(x,z,.52*scale,.52*scale);
  }
  const treeLocations=[
    [-4,-8],[8,-9],[-8,12],[-22,6],[-30,20],[6,22],[-12,22],[-31,-4],
    [-20,-19],[-34,-24],[-35,0],[-37,13],[-9,-23],[7,-23],[-15,29],[-25,29]
  ];
  for(let i=0;i<treeLocations.length;i++){
    const [x,z]=treeLocations[i];
    tree(x,z,.70+noise(i+31)*.60,i+3);
  }
  // Instanced grasses and flowers; no runtime geometry per blade.
  // Shrubs are the missing mid-scale silhouette between flower and tree.
  // Instancing costs one main draw call, never hundreds of individual spheres.
  const shrubGeo=k.scope.track(new THREE.IcosahedronGeometry(.53,0));
  const shrubMat=k.solid("#86ac82");
  addVegetationWind(shrubMat,cloudField,.075);
  const shrubs=k.scope.track(new THREE.InstancedMesh(shrubGeo,shrubMat,280));
  const shrubColors=[new THREE.Color("#446a4e"),new THREE.Color("#537d59"),
    new THREE.Color("#738963"),new THREE.Color("#567b67")];
  let shrubCount=0;
  for(let i=0;i<1150&&shrubCount<280;i++){
    const x=-39+noise(i*6.3+14)*47,z=-35+noise(i*3.9+21)*70;
    if(x>9.5||Math.abs(z)<4.2&&x>-33)continue;
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
    if(Math.abs(z)<4.1&&x>-32)continue;
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
      if(x>8||Math.abs(z)<4.5)continue;
      if(k.colliders.some(c=>Math.abs(x-c.x)<c.halfX+.6&&Math.abs(z-c.z)<c.halfZ+.6))continue;
      dummy.position.set(x,.21,z);dummy.scale.set(1,1,1);dummy.rotation.set(0,0,0);dummy.updateMatrix();
      inst.setMatrixAt(j++,dummy.matrix);
    }
    inst.count=j;inst.instanceMatrix.needsUpdate=true;k.scene.add(inst);
  }

  // Lighting: soft upper atmosphere and low sun, physically motivated windows.
  const sky=new THREE.HemisphereLight("#c8dbd6","#675a48",1.17);k.scene.add(sky);
  const sunlight=new THREE.DirectionalLight("#ffd09a",3.1);
  sunlight.position.set(SUN_DIRECTION.x*34,SUN_DIRECTION.y*34,SUN_DIRECTION.z*34);sunlight.castShadow=true;
  sunlight.shadow.mapSize.set(1024,1024);
  sunlight.shadow.camera.left=-26;sunlight.shadow.camera.right=26;
  sunlight.shadow.camera.top=27;sunlight.shadow.camera.bottom=-27;
  sunlight.shadow.camera.near=1;sunlight.shadow.camera.far=75;
  sunlight.shadow.normalBias=.036;sunlight.shadow.bias=-.00015;
  k.scene.add(sunlight);
  const target=new THREE.Object3D();k.scene.add(target);
  sunlight.target=target;
  function update(time:number,player?:{x:number;z:number}){
    ocean.update(time);
    boats.update(time);
    // The sun keeps a fixed direction but its shadow camera follows players.
    if(player){
      target.position.set(player.x,0,player.z);
      sunlight.position.set(player.x+SUN_DIRECTION.x*34,SUN_DIRECTION.y*34,player.z+SUN_DIRECTION.z*34);
      target.updateMatrixWorld();
    }
  }
  function setFoliageDensity(factor:number){
    const amount=THREE.MathUtils.clamp(factor,0,1);
    shrubs.count=Math.round(shrubCount*amount);
    grass.count=Math.round(count*amount);
    shrubs.visible=shrubs.count>0;
    grass.visible=grass.count>0;
  }
  return {sunlight,update,setFoliageDensity,sea:ocean.material};
}
