import * as THREE from "three";
import { createRowing, boardableBoat, findLanding, ROWING } from "./rowing.js";

/**
 * Boarding and rowing the moored boats. The physics lives in rowing.js; this file is the view: it seats the player,
 * moves the hull, animates two oars from the stroke phase, leaves a wake and drives the HUD.
 * Boats are only movable when they are the kit boats (the procedural fallback hulls are baked in world space).
 */
type Pose={x:number;z:number;heading:number;length:number};
type Blocker=[number,number,number];
const WATER_Y=-.38;
/** The model's bow points along +z in its own frame; flip this if a different asset faces the other way. */
const BOW_OFFSET=0;
const SEAT_LIFT=-.52;
/** Where the rower sits relative to the hull centre: a little aft and to one side, so the mast is not dead ahead. */
const SEAT_AFT=.12,SEAT_SIDE=.34;
const RINGS=10;

export function createBoating(opts:{
  scene:THREE.Scene;scope:{track:<T extends{dispose:()=>void}>(item:T)=>T};
  boats:THREE.Group[];movable:boolean;blockers:Blocker[];colliders:{x:number;z:number;halfX?:number;halfZ?:number}[];
  player:{x:number;z:number};audio?:()=>import("./soundscape.js").Soundscape|null;
  world:{movePlayer:(x:number,z:number,t:number)=>void;setSeat:(lift:number)=>void;setBoatFoam:(p:Pose[])=>void};
  rig:{turn:(d:number)=>void;setEyeLift:(v:number)=>void;faceHeading:(h:number)=>void};
  isBlocked?:()=>boolean;getMode:()=>string;setCameraMode:(m:"quarter"|"first"|"vista")=>void;
  ui:{hud:HTMLElement;status:HTMLElement;button:HTMLButtonElement};
}){
  const {scene,boats,player,world,rig,ui}=opts;
  const scope=opts.scope;
  const sims=boats.map(boat=>{
    const length=(boat.userData.length as number)||4.5,beam=(boat.userData.beam as number)||1.5;
    return createRowing({x:boat.position.x,z:boat.position.z,heading:Math.PI/2-(boat.rotation.y-BOW_OFFSET),length,beam});
  });
  const circlesOf=(i:number):Blocker[]=>{
    const out:Blocker[]=[...opts.blockers];
    sims.forEach((s,j)=>{
      if(j===i)return;
      const r=s.state.length*.17,reach=s.state.length*.26,cx=Math.cos(s.state.heading),cz=Math.sin(s.state.heading);
      out.push([s.state.x-cx*reach,s.state.z-cz*reach,r],[s.state.x+cx*reach,s.state.z+cz*reach,r],[s.state.x,s.state.z,r]);
    });
    return out;
  };
  let lastStrokeIndex=0;
  let aboard=-1,request=false,message="",messageUntil=0,landingHint:string|null=null,previousHeading=0,wakeClock=0,time=0;
  const say=(text:string,seconds=2.2)=>{message=text;messageUntil=time+seconds;};
  window.addEventListener("keydown",e=>{
    if(opts.isBlocked?.()||e.repeat||e.altKey||e.ctrlKey||e.metaKey)return;
    if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;
    if(e.key.toLowerCase()==="e")request=true;
  });
  ui.button.addEventListener("click",()=>{if(!opts.isBlocked?.())request=true;});

  // ---- two oars: wooden shaft, flat blade, leather collar ----
  const rig3=new THREE.Group();rig3.visible=false;rig3.userData.dynamic=true;scene.add(rig3);
  const wood=scope.track(new THREE.MeshStandardMaterial({color:"#b98a52",roughness:.7,emissive:"#3a2512",emissiveIntensity:.55}));
  const bladeWood=scope.track(new THREE.MeshStandardMaterial({color:"#d2a56a",roughness:.65,emissive:"#4a2f16",emissiveIntensity:.5}));
  const shaftGeo=scope.track(new THREE.CylinderGeometry(.028,.02,1,8));
  const bladeGeo=scope.track(new THREE.BoxGeometry(.62,.025,.2));
  const collarGeo=scope.track(new THREE.TorusGeometry(.04,.012,5,10));
  const OAR_OUT=2.05,OAR_IN=.55;
  // The rig shares the hull's frame: +z is the bow, +x the beam. Each oar lies along x, pivoting at its oarlock.
  const oars=[1,-1].map(side=>{
    const pivot=new THREE.Group();
    const swing=new THREE.Group();pivot.add(swing);
    const shaft=new THREE.Mesh(shaftGeo,wood);shaft.rotation.z=Math.PI/2;
    shaft.scale.set(1,OAR_OUT+OAR_IN,1);shaft.position.x=side*((OAR_OUT-OAR_IN)/2);
    const blade=new THREE.Mesh(bladeGeo,bladeWood);blade.position.x=side*(OAR_OUT-.28);
    const collar=new THREE.Mesh(collarGeo,wood);collar.position.x=side*.1;collar.rotation.y=Math.PI/2;
    for(const m of [shaft,blade,collar]){m.castShadow=false;m.userData.dynamic=true;swing.add(m);}
    rig3.add(pivot);
    return {pivot,swing,side};
  });

  // ---- wake: expanding rings behind the hull ----
  const ringGeo=scope.track(new THREE.RingGeometry(.35,.48,28));
  const rings=Array.from({length:RINGS},()=>{
    const m=new THREE.Mesh(ringGeo,scope.track(new THREE.MeshBasicMaterial({color:"#eaf6f2",transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide})));
    m.rotation.x=-Math.PI/2;m.visible=false;m.userData.dynamic=true;m.userData.age=9;scene.add(m);return m;
  });
  function emitWake(x:number,z:number,size:number){
    const ring=rings.reduce((a,b)=>(b.userData.age as number)>(a.userData.age as number)?b:a);
    ring.userData.age=0;ring.userData.size=size;ring.position.set(x,WATER_Y+.03,z);ring.visible=true;
  }
  function updateRings(dt:number){
    for(const ring of rings){
      if(!ring.visible)continue;
      const age=(ring.userData.age as number)+dt;ring.userData.age=age;
      const u=age/1.9;
      if(u>=1){ring.visible=false;continue;}
      const s=(ring.userData.size as number)*(1+u*3.2);
      ring.scale.set(s,s,s);
      (ring.material as THREE.MeshBasicMaterial).opacity=.5*(1-u)*(1-u);
    }
  }

  const poses=():Pose[]=>sims.map(s=>({x:s.state.x,z:s.state.z,heading:s.state.heading,length:s.state.length}));
  function applyPose(i:number){
    const s=sims[i].state,boat=boats[i];
    boat.position.x=s.x;boat.position.z=s.z;
    boat.rotation.y=Math.PI/2-s.heading+BOW_OFFSET;
  }
  /** The rower's seat: aft of centre and offset toward the starboard side of the hull. */
  function seatPosition(s:{x:number;z:number;heading:number;length:number}){
    const cx=Math.cos(s.heading),cz=Math.sin(s.heading);
    return {x:s.x-cx*s.length*SEAT_AFT+cz*SEAT_SIDE,z:s.z-cz*s.length*SEAT_AFT-cx*SEAT_SIDE};
  }
  function board(i:number){
    aboard=i;previousHeading=sims[i].state.heading;
    if(opts.getMode()==="vista")opts.setCameraMode("first");
    world.setSeat(SEAT_LIFT);rig.setEyeLift(SEAT_LIFT);
    if(opts.getMode()==="first")rig.faceHeading(sims[i].state.heading);
    rig3.visible=true;
    for(const o of (boats[i].userData.ownOars as THREE.Object3D[]|undefined)??[])o.visible=false;
    say("上船了：W 划槳、S 倒划、A／D 轉向，E 下船",3.2);
  }
  function leave(){
    const landing=findLanding(sims[aboard].state,opts.colliders);
    if(!landing){say("靠近碼頭或岸邊才能下船");return;}
    sims[aboard].state.speed=0;
    world.movePlayer(landing.x,landing.z,time);
    world.setSeat(0);rig.setEyeLift(0);rig3.visible=false;
    for(const o of (boats[aboard].userData.ownOars as THREE.Object3D[]|undefined)??[])o.visible=true;
    aboard=-1;
    say(landing.kind==="pier"?"回到碼頭上":"上岸了");
  }

  /** One frame. Returns true while the player is in a boat (the caller then skips ordinary walking). */
  function update(dt:number,input:{x:number;y:number},elapsed:number):boolean{
    time=elapsed;
    updateRings(dt);
    const showMessage=time<messageUntil;
    if(!opts.movable){ui.hud.hidden=true;return false;}
    if(aboard<0){
      const near=boardableBoat(player,sims.map(s=>({x:s.state.x,z:s.state.z,length:s.state.length})));
      if(near&&request)board(near.index);
      request=false;
      if(aboard<0){
        ui.hud.hidden=!near&&!showMessage;
        ui.button.hidden=!near;
        ui.button.textContent="上船 (E)";
        ui.status.textContent=showMessage?message:near?"走近的小船可以划":"";
        return false;
      }
    }
    // ---- aboard ----
    const i=aboard,sim=sims[i],s=sim.state;
    sim.setBlockers(circlesOf(i));
    sim.step(dt,{throttle:-input.y,steer:input.x});
    applyPose(i);
    const seat=seatPosition(s);
    world.movePlayer(seat.x,seat.z,elapsed);
    const turned=s.heading-previousHeading;previousHeading=s.heading;
    if(opts.getMode()==="first")rig.turn(-turned);
    world.setBoatFoam(poses());
    if(s.bumped>.35)say("撞到了");
    // oars follow the stroke phase: drive pulls the blade back through the water, recovery lifts it clear
    const boat=boats[i],cx=Math.cos(s.heading),cz=Math.sin(s.heading);
    rig3.position.set(s.x,boat.position.y+.62,s.z);
    rig3.rotation.set(boat.rotation.x,boat.rotation.y,boat.rotation.z,"YXZ");
    const p=s.stroking?s.stroke%1:0;
    if(s.stroking&&Math.floor(s.stroke)!==lastStrokeIndex){lastStrokeIndex=Math.floor(s.stroke);opts.audio?.()?.api.oar(Math.abs(s.speed),undefined);}
    const drive=p<.5,u=drive?p/.5:(p-.5)/.5;
    const sweep=drive?.6-1.2*u:-.6+1.2*(u*u*(3-2*u));            // blade forward at the catch, back at the finish
    const dip=drive?.34:.34-.42*Math.sin(Math.PI*u);             // in the water while pulling, lifted clear on recovery
    const half=s.beam/2*.92;
    for(const o of oars){
      o.pivot.position.set(o.side*half,0,.05);
      o.swing.rotation.set(0,-o.side*sweep,-o.side*dip*(s.stroking?1:.55));
    }
    // wake
    wakeClock+=dt;
    if(Math.abs(s.speed)>.6&&wakeClock>.24){wakeClock=0;emitWake(s.x-cx*s.length*.42,s.z-cz*s.length*.42,.5+Math.abs(s.speed)*.18);}
    // HUD
    const landing=findLanding(s,opts.colliders);
    if(request){request=false;leave();if(aboard<0){ui.hud.hidden=false;return false;}}
    // Few controls: the exit button appears only where you can actually step off; the hint only while drifting.
    const text=time<messageUntil?message:Math.abs(s.speed)<.3?"按住 W 划槳，A／D 轉向":"";
    ui.button.textContent="下船 (E)";ui.button.hidden=!landing;
    ui.status.textContent=text;
    ui.hud.hidden=!landing&&text==="";
    landingHint=landing?landing.kind:null;
    return true;
  }
  return {update,get aboard(){return aboard>=0;},get index(){return aboard;},get landingHint(){return landingHint;},sims,rowing:ROWING,board,leave,
    boat:(i:number)=>sims[i].state, resetRequest:()=>{request=false;}, restore:(poses:{x:number;z:number;heading:number}[],index:number)=>{
      if(aboard>=0){for(const o of (boats[aboard].userData.ownOars as THREE.Object3D[]|undefined)??[])o.visible=true;}
      aboard=-1;world.setSeat(0);rig.setEyeLift(0);rig3.visible=false;
      poses.forEach((p,i)=>{sims[i].place(p.x,p.z,p.heading);applyPose(i);});
      if(index>=0)board(index);
    }};
}
export type Boating=ReturnType<typeof createBoating>;
