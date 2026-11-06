import * as THREE from "three";
import type { StageKit } from "./kit.js";
import type { NightLights } from "./night-lights.js";

/**
 * Medieval lighting fixtures: hanging iron lanterns on wall brackets and lantern posts, and open-flame torches
 * on wooden posts. No electric lamp posts. The flame/glass is an HDR emissive that the sky dims by day; each
 * fixture also registers a LightSpot so the lights pool can really light the ground and walls around it.
 */
export function createFixtures(k:StageKit,lights:NightLights){
  const iron=k.solid("#413f3b",.62);
  const wood=k.pattern("planks",14);
  const flameMaterial=k.solid("#ffdf9a",.56,"#e8a85d");
  flameMaterial.emissiveIntensity=3.2;
  const flames:{mesh:THREE.Mesh;baseY:number;phase:number}[]=[];

  /** A caged candle lantern whose centre is at (x,y,z). */
  function lantern(x:number,y:number,z:number){
    k.block(.30,.05,.30,iron,x,y-.25,z,false);
    k.block(.22,.30,.22,flameMaterial,x,y-.02,z,false);
    for(const sx of [-1,1])for(const sz of [-1,1])k.block(.035,.34,.035,iron,x+sx*.135,y-.02,z+sz*.135,false);
    k.block(.30,.04,.30,iron,x,y+.17,z,false);
    const cap=k.put(new THREE.ConeGeometry(.24,.16,4),iron,x,y+.27,z,false);
    cap.rotation.y=Math.PI/4;
    k.column(.025,.13,iron,x,y+.39,z,6);
  }

  /** Iron arm bolted to a wall at (x,y,z) that carries a hanging lantern `reach` out, `face` is +1/-1 along z. */
  function hangingLantern(x:number,y:number,z:number,face:1|-1,reach=.62){
    const outZ=z+face*reach;
    k.segment(new THREE.Vector3(x,y+.62,z),new THREE.Vector3(x,y+.62,outZ),.035,iron,6);
    k.segment(new THREE.Vector3(x,y+.20,z),new THREE.Vector3(x,y+.60,z+face*reach*.78),.026,iron,6);
    k.column(.016,.2,iron,x,y+.50,outZ,6);
    lantern(x,y+.1,outZ);
    lights.add({x,y:y+.1,z:outZ+face*.15,intensity:11,distance:12,color:"#ffbf70",flicker:.07});
  }

  /** A wooden post with an iron arm and a hanging lantern, for street edges. `dir` is the arm's z direction. */
  function lanternPost(x:number,z:number,dir:1|-1,height=3.1){
    k.column(.085,height,wood,x,height/2,z,8);
    k.block(.26,.2,.26,iron,x,.1,z,false);
    k.segment(new THREE.Vector3(x,height-.12,z),new THREE.Vector3(x,height-.12,z+dir*.7),.04,iron,6);
    k.segment(new THREE.Vector3(x,height-.75,z),new THREE.Vector3(x,height-.18,z+dir*.5),.03,iron,6);
    k.column(.016,.22,iron,x,height-.24,z+dir*.7,6);
    lantern(x,height-.5,z+dir*.7);
    lights.add({x,y:height-.45,z:z+dir*.7,intensity:12,distance:13,color:"#ffbf70",flicker:.07});
    k.collider(x,z,.2,.2);
  }

  /** A wooden torch post with an iron brazier cup and a living flame. */
  function torchPost(x:number,z:number,height=2.5){
    k.column(.07,height,wood,x,height/2,z,8);
    k.put(new THREE.CylinderGeometry(.2,.11,.24,8),iron,x,height+.04,z,false);
    for(let i=0;i<3;i++){
      const a=i*Math.PI*2/3;
      k.segment(new THREE.Vector3(x+Math.cos(a)*.09,height-.12,z+Math.sin(a)*.09),
        new THREE.Vector3(x+Math.cos(a)*.2,height+.14,z+Math.sin(a)*.2),.018,iron,5);
    }
    const flame=k.put(new THREE.ConeGeometry(.17,.55,6),flameMaterial,x,height+.43,z,false);
    flame.userData.dynamic=true;
    flames.push({mesh:flame,baseY:flame.position.y,phase:x*1.3+z*.7});
    lights.add({x,y:height+.4,z,intensity:12,distance:14,color:"#ffa64d",flicker:.3});
    k.collider(x,z,.2,.2);
  }

  /** Flames waver and only burn at dusk and night (`glow` is the sky's lamp factor, 0 by day). */
  function animate(time:number,glow:number){
    const burn=Math.min(1,Math.max(0,(glow-.05)*2.2));
    for(const f of flames){
      f.mesh.visible=burn>.01;
      if(!f.mesh.visible)continue;
      const s=(1+.16*Math.sin(time*11+f.phase)+.09*Math.sin(time*23+f.phase*2.3))*burn;
      const w=burn/Math.sqrt(Math.max(.2,s));
      f.mesh.scale.set(w,Math.max(.01,s),w);
      f.mesh.position.y=f.baseY+(s-1)*.275; // the flame grows from its base, not its middle
    }
  }
  return {lantern,hangingLantern,lanternPost,torchPost,animate};
}
export type Fixtures=ReturnType<typeof createFixtures>;
