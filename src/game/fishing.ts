import * as THREE from "three";
import { createFishing, isOpenWater, SPECIES } from "./fishing-logic.js";
import { mulberry32 } from "./wander.js";
import type { CameraMode } from "./camera.js";

/**
 * First-person fishing. Stand on the beach or the pier, look at the sea and press F (or the button): the bobber
 * flies out, you wait, the bobber dips, you reel in inside the window. Casting switches to the first-person view and
 * walking away reels the line in. Catches are counted and the best one is remembered in this browser.
 */
const WATER_Y=-.38;
type Ui={hud:HTMLElement;status:HTMLElement;button:HTMLButtonElement;count:HTMLElement};
type Camera={position:THREE.Vector3;getWorldDirection:(v:THREE.Vector3)=>THREE.Vector3;quaternion:THREE.Quaternion};

export function createFishingView(opts:{
  scene:THREE.Scene;scope:{track:<T extends{dispose:()=>void}>(item:T)=>T};
  player:{x:number;z:number};getCamera:()=>Camera;getMode:()=>CameraMode;setCameraMode:(mode:CameraMode)=>void;ui:Ui;
}){
  const {scene,scope,player,ui}=opts;
  // ?fishSeed= makes the bites reproducible (used by the e2e test and for audits).
  const fishSeed=Number.parseInt(new URLSearchParams(window.location.search).get("fishSeed")??"",10);
  const logic=createFishing({rng:mulberry32(Number.isFinite(fishSeed)?fishSeed:Date.now()&0xffff)});
  const dir=new THREE.Vector3(),eye=new THREE.Vector3(),tip=new THREE.Vector3(),target=new THREE.Vector3(),origin={x:0,z:0};
  const right=new THREE.Vector3(),up=new THREE.Vector3(),forward=new THREE.Vector3();

  // ---- the rod, the bobber, the line, a splash ring and the fish that flies up ----
  const rod=new THREE.Group();
  const wood=scope.track(new THREE.MeshStandardMaterial({color:"#8a5d33",roughness:.9,emissive:"#4a2f16",emissiveIntensity:.8}));
  const grip=scope.track(new THREE.MeshStandardMaterial({color:"#3b3431",roughness:.8,emissive:"#1d1816",emissiveIntensity:.8}));
  const shaft=new THREE.Mesh(scope.track(new THREE.CylinderGeometry(.006,.017,1.9,6)),wood);shaft.position.y=.95;
  const handle=new THREE.Mesh(scope.track(new THREE.CylinderGeometry(.022,.022,.34,8)),grip);handle.position.y=.1;
  const reel=new THREE.Mesh(scope.track(new THREE.CylinderGeometry(.045,.045,.05,10)),grip);reel.position.set(.06,.22,0);reel.rotation.z=Math.PI/2;
  rod.add(shaft,handle,reel);rod.visible=false;rod.userData.dynamic=true;
  for(const m of rod.children)(m as THREE.Mesh).castShadow=false;
  scene.add(rod);

  const bobberGeometry=scope.track(new THREE.SphereGeometry(.12,12,9));
  const colors=new Float32Array(bobberGeometry.getAttribute("position").count*3);
  for(let i=0;i<colors.length/3;i++){const top=bobberGeometry.getAttribute("position").getY(i)>0;colors.set(top?[.86,.16,.12]:[.95,.95,.92],i*3);}
  bobberGeometry.setAttribute("color",new THREE.BufferAttribute(colors,3));
  const bobber=new THREE.Mesh(bobberGeometry,scope.track(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.6})));
  bobber.visible=false;bobber.userData.dynamic=true;scene.add(bobber);

  const LINE_POINTS=14;
  const lineGeometry=scope.track(new THREE.BufferGeometry());
  lineGeometry.setAttribute("position",new THREE.BufferAttribute(new Float32Array(LINE_POINTS*3),3));
  const line=new THREE.Line(lineGeometry,scope.track(new THREE.LineBasicMaterial({color:"#efe9d2"})));
  line.frustumCulled=false;line.visible=false;line.userData.dynamic=true;scene.add(line);

  const splash=new THREE.Mesh(scope.track(new THREE.RingGeometry(.2,.32,20)),
    scope.track(new THREE.MeshBasicMaterial({color:"#e8f4ef",transparent:true,opacity:.8,depthWrite:false,side:THREE.DoubleSide})));
  splash.rotation.x=-Math.PI/2;splash.visible=false;splash.userData.dynamic=true;scene.add(splash);

  const fishMaterial=scope.track(new THREE.MeshStandardMaterial({color:"#9fb3bd",roughness:.5,metalness:.1}));
  const fish=new THREE.Mesh(scope.track(new THREE.IcosahedronGeometry(1,0)),fishMaterial);
  fish.scale.set(.2,.07,.05);fish.visible=false;fish.userData.dynamic=true;scene.add(fish);

  // ---- persistent tally ----
  const STORE="pixel-games.fishing.v1";
  let tally={count:0,best:null as null|{name:string;length:number}};
  try{const saved=JSON.parse(window.localStorage.getItem(STORE)??"null");if(saved&&Number.isFinite(saved.count))tally={count:saved.count,best:saved.best??null};}catch{/* storage may be unavailable */}
  const save=()=>{try{window.localStorage.setItem(STORE,JSON.stringify(tally));}catch{/* ignore */}};
  const showCount=()=>{ui.count.textContent="漁獲 "+tally.count+(tally.best?"　最大 "+tally.best.name+" "+tally.best.length+"cm":"");};
  showCount();

  let message="",messageUntil=0,landedAt=-10,finishedAt=0,previousPhase="idle";
  const say=(text:string,now:number,seconds=3)=>{message=text;messageUntil=now+seconds;};

  /** Where the cast would land: the ray from the eye meets the water plane; looking at the horizon casts far. */
  function aim(camera:Camera){
    camera.getWorldDirection(dir);
    eye.copy(camera.position);
    let distance=11;
    if(dir.y<-.04)distance=Math.min(14,Math.max(4,(eye.y-WATER_Y)/-dir.y*Math.hypot(dir.x,dir.z)));
    const flat=Math.hypot(dir.x,dir.z)||1;
    target.set(eye.x+dir.x/flat*distance,WATER_Y,eye.z+dir.z/flat*distance);
    return isOpenWater(target.x,target.z);
  }
  const nearWater=()=>player.x>=10;

  function press(now:number){
    if(logic.state.phase==="idle"){
      if(!nearWater()){say("走到海邊或碼頭再釣魚",now);return;}
      if(opts.getMode()!=="first")opts.setCameraMode("first");
      const camera=opts.getCamera();
      if(!aim(camera)){say("對準海面再拋竿（視線往下一點）",now);return;}
      origin.x=player.x;origin.z=player.z;
      logic.press(now);
      return;
    }
    const before=logic.state.phase;
    logic.press(now);
    if(before==="waiting")say("收太早了，魚還沒上鉤",now);
    if(logic.state.phase==="landed")landedAt=now;
  }

  window.addEventListener("keydown",event=>{
    if(event.target instanceof HTMLInputElement||event.target instanceof HTMLSelectElement)return;
    if(event.key.toLowerCase()==="f"&&!event.repeat){event.preventDefault();press(performance.now()/1000);}
  });
  ui.button.addEventListener("click",()=>press(performance.now()/1000));

  function label(){
    switch(logic.state.phase){
      case "idle":return nearWater()?"拋竿 (F)":"";
      case "casting":return "";
      case "waiting":return "收竿 (F)";
      case "bite":return "收線！(F)";
      default:return "繼續 (F)";
    }
  }

  /** Call every frame. The fishing clock is performance time in seconds (the same one press() uses). */
  function update(){
    const now=performance.now()/1000;
    const camera=opts.getCamera();
    const mode=opts.getMode();
    const active=logic.isActive();
    // Leaving the first-person view or walking away from the fishing spot reels the line in.
    if(active&&(mode!=="first"||Math.hypot(player.x-origin.x,player.z-origin.z)>.8)){
      if(logic.state.phase!=="landed")say("收起釣線",now,1.5);
      logic.cancel();
    }
    const t=now;
    logic.update(t);
    const phase=logic.state.phase;
    if(phase!==previousPhase){
      if(phase==="bite")say("有魚上鉤！快收線！",now,1.6);
      if(phase==="escaped")say("魚跑掉了…",now);
      if(phase==="landed"&&logic.state.result){
        const r=logic.state.result;
        if(r.junk)say("釣到"+r.name+"…",now,3.5);
        else{
          say("釣到 "+r.name+" "+r.length+"cm！",now,3.5);
          tally.count++;if(!tally.best||(r.length??0)>tally.best.length)tally.best={name:r.name,length:r.length??0};
          save();showCount();
        }
        fishMaterial.color.set(r.color);
      }
      if(logic.isFinished())finishedAt=now;
      previousPhase=phase;
    }
    // A finished attempt (landed, escaped, too early) is acknowledged automatically once its message has been read.
    if(logic.isFinished()&&now-finishedAt>3.6)logic.press(now);
    // HUD
    const text=label();
    ui.hud.hidden=!(nearWater()||active||tally.count>0)&&!message;
    ui.button.hidden=text==="";
    ui.button.textContent=text;
    ui.button.classList.toggle("urgent",phase==="bite");
    ui.status.textContent=now<messageUntil?message:(phase==="waiting"?"等待魚上鉤…":phase==="casting"?"":nearWater()&&mode==="first"?"面向海面，按 F 拋竿":"");
    // Rod: held at the lower right, tilted forward and up.
    const showRod=mode==="first"&&(active||nearWater());
    rod.visible=showRod;
    camera.getWorldDirection(forward);
    right.set(-forward.z,0,forward.x).normalize();   // forward x up: to the angler's right
    up.set(0,1,0);
    const bob=active?Math.sin(t*1.7)*.01:0;
    rod.position.set(camera.position.x+right.x*.32+forward.x*.55,camera.position.y-.34+bob,camera.position.z+right.z*.32+forward.z*.55);
    rod.quaternion.copy(camera.quaternion);
    rod.rotateX(Math.PI/2+.55);       // the shaft points forward and up
    rod.rotateZ(-.12);
    tip.set(0,1.9,0);rod.localToWorld(tip);
    // Bobber and line
    const inWater=active&&phase!=="idle";
    bobber.visible=inWater;line.visible=inWater;splash.visible=false;fish.visible=false;
    if(inWater){
      const since=t-logic.state.t0;
      const u=Math.min(1,since/.75);
      if(phase==="casting"){
        bobber.position.lerpVectors(tip,target,u);bobber.position.y+=Math.sin(u*Math.PI)*2.2;
      }else{
        bobber.position.copy(target);
        const dip=phase==="bite"?-.1-Math.abs(Math.sin(t*14))*.06:0;
        bobber.position.y=WATER_Y+.03+Math.sin(t*2.6)*.012+dip;
      }
      const slack=phase==="casting"?.1:.35;
      const arr=lineGeometry.getAttribute("position") as THREE.BufferAttribute;
      for(let i=0;i<LINE_POINTS;i++){
        const f=i/(LINE_POINTS-1);
        arr.setXYZ(i,tip.x+(bobber.position.x-tip.x)*f,tip.y+(bobber.position.y-tip.y)*f-Math.sin(f*Math.PI)*slack,tip.z+(bobber.position.z-tip.z)*f);
      }
      arr.needsUpdate=true;
      // splash ring when the bobber lands and while a fish is biting
      const landing=phase!=="casting"&&since>.75&&since<1.5;
      if(landing||phase==="bite"){
        const k=phase==="bite"?(t*3)%1:(since-.75)/.75;
        splash.visible=true;splash.position.set(target.x,WATER_Y+.02,target.z);
        splash.scale.setScalar(.6+k*2.6);(splash.material as THREE.MeshBasicMaterial).opacity=.85*(1-k);
      }
    }
    // The catch flies from the water to the angler.
    if(phase==="landed"){
      const f=Math.min(1,(now-landedAt)/.9);
      fish.visible=f<1;
      fish.position.lerpVectors(target,tip.clone().add(new THREE.Vector3(0,-.25,0)).add(forward.clone().multiplyScalar(.3)),f);
      fish.position.y+=Math.sin(f*Math.PI)*1.4;fish.rotation.z=f*6;
    }
  }
  return {update,press,logic,tally:()=>tally,species:SPECIES.length};
}
export type FishingView=ReturnType<typeof createFishingView>;
