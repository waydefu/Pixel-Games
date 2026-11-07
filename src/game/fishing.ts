import * as THREE from "three";
import { createFishing, isOpenWater, SPECIES, CAST_RANGE, MAX_LINE, SWEET_ZONE } from "./fishing-logic.js";
import { createRope } from "./rope.js";
import { buildCatchModel, buildLureKind, LURES } from "./fish-model.js";
import { createRodModel } from "./rod-model.js";
import { mulberry32 } from "./wander.js";
import type { CameraMode } from "./camera.js";

/**
 * First-person lure fishing with a spinning rod. HOLD the button (F) to charge the cast and release to throw; the lure
 * flies a ballistic arc and the line (a Verlet rope) pays out and lies on the water. HOLD to reel the lure in; when a
 * fish strikes, TAP to set the hook. Then the fight: hold to reel, release to let the fish run, and keep the tension
 * gauge in the green: too slack and it takes line, too tight and the line snaps. The rod bows with the tension.
 * Rules live in fishing-logic.js, line physics in rope.js, fish and lure models in fish-model.js.
 */
const WATER_Y=-.38;
const GRAVITY=-9.8;
type Ui={lure:HTMLButtonElement;hud:HTMLElement;status:HTMLElement;button:HTMLButtonElement;count:HTMLElement;meter:HTMLElement;power:HTMLElement;tension:HTMLElement;distance:HTMLElement};
type Camera={position:THREE.Vector3;getWorldDirection:(v:THREE.Vector3)=>THREE.Vector3;quaternion:THREE.Quaternion};
const smooth=(a:number,b:number,v:number)=>{const t=Math.min(1,Math.max(0,(v-a)/(b-a)));return t*t*(3-2*t);};

export function createFishingView(opts:{
  scene:THREE.Scene;scope:{track:<T extends{dispose:()=>void}>(item:T)=>T};
  player:{x:number;z:number};isAboard?:()=>boolean;getCamera:()=>Camera;getMode:()=>CameraMode;setCameraMode:(mode:CameraMode)=>void;ui:Ui;
}){
  const {scene,scope,player,ui}=opts;
  // ?fishSeed= makes the bites reproducible (used by the e2e test and for audits).
  const fishSeed=Number.parseInt(new URLSearchParams(window.location.search).get("fishSeed")??"",10);
  const logic=createFishing({rng:mulberry32(Number.isFinite(fishSeed)?fishSeed:Date.now()&0xffff)});
  const effects=mulberry32(99);
  // Audit only: ?rodView=1 lays the rod across the screen with the reel's handle side toward the camera.
  const rodViewParam=new URLSearchParams(window.location.search).get("rodView"),rodView=rodViewParam==="1"||rodViewParam==="2";
  const viewMap=new THREE.Matrix4().makeBasis(new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0));
  const dir=new THREE.Vector3(),eye=new THREE.Vector3(),target=new THREE.Vector3(),origin={x:0,z:0};
  const right=new THREE.Vector3(),forward=new THREE.Vector3(),tip=new THREE.Vector3(),zAxis=new THREE.Vector3();
  const tmp=new THREE.Vector3(),tmp2=new THREE.Vector3(),matrix=new THREE.Matrix4(),quat=new THREE.Quaternion(),scaleV=new THREE.Vector3();

  // ============ the rod: a spinning combo modelled in rod-model.ts (bending carbon blank, guides, EVA grip, reel) ============
  const rodModel=createRodModel(scope);
  const rod=rodModel.group;scene.add(rod);
  const ROD_LENGTH=rodModel.ROD_LENGTH;void ROD_LENGTH;
  const rodTipLocal=rodModel.tipLocal;
  const buildRod=rodModel.build;
  let crankAngle=0;

  // ============ the bobber, the line, splash ring, droplets ============
  // The lure: switchable from the tackle box (R). Drawn about twice life size so it reads from a few metres.
  const lureGeometry=scope.track(new THREE.BufferGeometry());
  let lureKind=0,lureModel=buildLureKind(LURES[0].id),lureBody:THREE.Mesh|null=null;
  function setLureGeometry(index:number){
    lureKind=((index%LURES.length)+LURES.length)%LURES.length;
    lureModel=buildLureKind(LURES[lureKind].id);
    lureGeometry.setAttribute("position",new THREE.BufferAttribute(lureModel.positions.slice(),3));
    lureGeometry.setAttribute("color",new THREE.BufferAttribute(lureModel.colors,3));
    lureGeometry.computeVertexNormals();
    lureGeometry.computeBoundingSphere();lureGeometry.computeBoundingBox();
    if(lureBody)lureBody.position.set(-lureModel.length*1.2,0,0);
  }
  setLureGeometry(0);
  lureBody=new THREE.Mesh(lureGeometry,scope.track(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.3,metalness:.45,side:THREE.DoubleSide,emissive:"#ffffff",emissiveIntensity:.45})));
  lureBody.scale.setScalar(2.8);lureBody.position.set(-lureModel.length*1.2,0,0);   // eye of the lure at the group origin
  const bobber=new THREE.Group();bobber.visible=false;bobber.userData.dynamic=true;
  bobber.add(lureBody);scene.add(bobber);

  // A marker on the water at the lure: the sea reflects so much sky that a small lure disappears, so a fluorescent ring
  // and dot (always drawn on top of the reflection, sized by distance) shows where it is.
  const markerGroup=new THREE.Group();markerGroup.visible=false;markerGroup.userData.dynamic=true;markerGroup.renderOrder=20;
  const markerRingMat=scope.track(new THREE.MeshBasicMaterial({color:"#ff7a2e",transparent:true,opacity:.95,depthWrite:false,side:THREE.DoubleSide}));
  const markerDotMat=scope.track(new THREE.MeshBasicMaterial({color:"#fff3c6",transparent:true,opacity:.95,depthWrite:false,side:THREE.DoubleSide}));
  const markerRing=new THREE.Mesh(scope.track(new THREE.RingGeometry(.5,1,24)),markerRingMat),markerDot=new THREE.Mesh(scope.track(new THREE.CircleGeometry(.3,16)),markerDotMat);
  for(const m of [markerRing,markerDot]){m.rotation.x=-Math.PI/2;m.renderOrder=20;m.userData.dynamic=true;markerGroup.add(m);}
  scene.add(markerGroup);

  const ROPE_POINTS=24;
  const rope=createRope({count:ROPE_POINTS});
  const lineGeometry=scope.track(new THREE.CylinderGeometry(1,1,1,4,1,true));
  const lineMaterial=scope.track(new THREE.MeshStandardMaterial({color:"#f4efdc",roughness:.5,emissive:"#8a8676",emissiveIntensity:.55}));
  const lineMesh=new THREE.InstancedMesh(lineGeometry,lineMaterial,ROPE_POINTS-1);
  lineMesh.frustumCulled=false;lineMesh.visible=false;lineMesh.userData.dynamic=true;lineMesh.castShadow=false;scene.add(lineMesh);

  const ringMaterial=scope.track(new THREE.MeshBasicMaterial({color:"#e8f4ef",transparent:true,opacity:.8,depthWrite:false,side:THREE.DoubleSide}));
  const rings=[0,1].map(()=>{const m=new THREE.Mesh(scope.track(new THREE.RingGeometry(.2,.3,24)),ringMaterial.clone());m.rotation.x=-Math.PI/2;m.visible=false;m.userData.dynamic=true;scene.add(m);return m;});
  const ringAge=[9,9];
  const DROPS=28;
  const dropGeometry=scope.track(new THREE.SphereGeometry(.022,6,5));
  const drops=new THREE.InstancedMesh(dropGeometry,scope.track(new THREE.MeshBasicMaterial({color:"#eaf6f4",transparent:true,opacity:.85})),DROPS);
  drops.frustumCulled=false;drops.visible=false;drops.userData.dynamic=true;scene.add(drops);
  const dropPos=new Float32Array(DROPS*3),dropVel=new Float32Array(DROPS*3),dropLife=new Float32Array(DROPS);
  function splash(x:number,z:number,strength:number,now:number){
    const ring=ringAge[0]>ringAge[1]?0:1;ringAge[ring]=0;
    rings[ring].position.set(x,WATER_Y+.03,z);
    let emitted=0;
    for(let i=0;i<DROPS&&emitted<Math.round(14*strength);i++){
      if(dropLife[i]>0)continue;
      const a=effects()*Math.PI*2,s=.8+effects()*1.6*strength;
      dropPos.set([x,WATER_Y+.05,z],i*3);dropVel.set([Math.cos(a)*s*.5,2.2+effects()*2.4*strength,Math.sin(a)*s*.5],i*3);dropLife[i]=.7+effects()*.4;emitted++;
    }
    void now;
  }

  // ============ the catch ============
  const catchCache=new Map<string,{mesh:THREE.Mesh;base:Float32Array;length:number}>();
  const catchGroup=new THREE.Group();catchGroup.visible=false;catchGroup.userData.dynamic=true;scene.add(catchGroup);
  const catchMaterial=scope.track(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.5,metalness:.12,side:THREE.DoubleSide,emissive:"#ffffff",emissiveIntensity:.12}));
  function catchModel(id:string){
    let entry=catchCache.get(id);
    if(!entry){
      const model=buildCatchModel(id);
      const g=scope.track(new THREE.BufferGeometry());
      g.setAttribute("position",new THREE.BufferAttribute(model.positions.slice(),3));
      g.setAttribute("color",new THREE.BufferAttribute(model.colors,3));
      g.computeVertexNormals();
      const mesh=new THREE.Mesh(g,catchMaterial);mesh.castShadow=false;mesh.frustumCulled=false;
      entry={mesh,base:model.positions.slice(),length:model.length};catchCache.set(id,entry);
    }
    return entry;
  }
  let shown:string|null=null,shownLengthCm=30;
  function showCatch(id:string|null,lengthCm:number|null){
    if(shown){const old=catchCache.get(shown);if(old)catchGroup.remove(old.mesh);}
    shown=id;
    if(id){
      const e=catchModel(id);catchGroup.add(e.mesh);
      shownLengthCm=lengthCm??25;
      const display=Math.min(.95,Math.max(.45,shownLengthCm/100*1.25));
      e.mesh.scale.setScalar(display/e.length);
      e.mesh.position.set(-e.length/2*display/e.length,0,0);
    }
  }
  /** Fish swim by waving their body: the tail swings most. Writes the bent copy into the live geometry. */
  function wiggle(id:string,time:number,amount:number){
    const e=catchCache.get(id);if(!e||id==="boot"||id==="crab")return;
    const live=e.mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    for(let i=0;i<live.count;i++){
      const x=e.base[i*3],y=e.base[i*3+1],z=e.base[i*3+2];
      const along=1-Math.min(1,Math.max(0,x/e.length));
      live.setXYZ(i,x,y,z+Math.sin(time*13-x*14)*amount*along*along*e.length*.35);
    }
    live.needsUpdate=true;
  }

  // ---- persistent tally ----
  const STORE="pixel-games.fishing.v1";
  let tally={count:0,best:null as null|{name:string;length:number}};
  try{const saved=JSON.parse(window.localStorage.getItem(STORE)??"null");if(saved&&Number.isFinite(saved.count))tally={count:saved.count,best:saved.best??null};}catch{/* storage may be unavailable */}
  const save=()=>{try{window.localStorage.setItem(STORE,JSON.stringify(tally));}catch{/* ignore */}};
  const showCount=()=>{ui.count.textContent="漁獲 "+tally.count+(tally.best?"　最大 "+tally.best.name+" "+tally.best.length+"cm":"");};
  showCount();

  let message="",messageUntil=0,messageFrames=0,landedAt=-10,previousPhase="idle";
  // A message lasts `seconds` of wall time but is always shown for at least two rendered frames (a slow device can
  // take longer than that per frame) and is written to the HUD at once, even when the update returns early.
  const say=(text:string,now:number,seconds=3)=>{message=text;messageUntil=now+seconds;messageFrames=2;ui.status.textContent=text;};
  // Fishing is offered on the beach and the pier, or from a boat: nowhere else.
  const nearWater=()=>(opts.isAboard?.()??false)||player.x>=11.8;

  // ---- input: one button, and HOLDING it matters ----
  // A tap shorter than one frame (slow devices) must still count: it is remembered until the next update has seen it.
  let held=false,tap=false,pressedNotice=false,lastHold=false;
  const setHeld=(value:boolean)=>{if(value&&!held)tap=true;held=value;};
  window.addEventListener("keydown",event=>{
    if(event.target instanceof HTMLInputElement||event.target instanceof HTMLSelectElement)return;
    if(event.key.toLowerCase()==="f"){event.preventDefault();if(!event.repeat)setHeld(true);}
    if(event.key.toLowerCase()==="r"&&!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey)cycleLure();
  });
  // the tackle box: only between casts
  function cycleLure(){
    if(logic.isActive())return;
    setLureGeometry(lureKind+1);
    ui.lure.textContent="餌："+LURES[lureKind].name+"（R 換餌）";
    say("換上 "+LURES[lureKind].name,performance.now()/1000,1.6);
  }
  ui.lure.textContent="餌："+LURES[lureKind].name+"（R 換餌）";
  ui.lure.addEventListener("click",cycleLure);
  window.addEventListener("keyup",event=>{if(event.key.toLowerCase()==="f")setHeld(false);});
  window.addEventListener("blur",()=>setHeld(false));
  ui.button.addEventListener("pointerdown",event=>{event.preventDefault();ui.button.setPointerCapture(event.pointerId);setHeld(true);});
  for(const type of ["pointerup","pointercancel","lostpointercapture"])ui.button.addEventListener(type,()=>setHeld(false));
  ui.button.addEventListener("contextmenu",event=>event.preventDefault());

  function label(phase:string){
    switch(phase){
      case "idle":return nearWater()?"按住蓄力 (F)":"";
      case "charging":return "放開拋竿！";
      case "casting":return "";
      case "lure":return "按住收線 (F)";
      case "strike":return "快提竿！(F)";
      case "fighting":return "按住收線・放開放線";
      default:return "繼續 (F)";
    }
  }

  // ---- the lure and the fish: where they are and what they do ----
  type Body="hidden"|"held"|"flying"|"water"|"reeling"|"hang";
  let body:Body="hidden";
  const lurePos=new THREE.Vector3(),lureVel=new THREE.Vector3(),castDir=new THREE.Vector3(),landing=new THREE.Vector3();
  let paidOut=1.5,ropeReady=false,castStart=0,last=performance.now()/1000,released=false,strikeSplashAt=0,leapAt=0,leapStart=-10,wakeAt=0,nibbleAt=0,strikeStart=0,strikeSide=1,fightSwing=.8;
  const RELEASE=.2,CAST=.8;

  function update(){
    const now=performance.now()/1000;
    const dt=Math.min(.1,Math.max(.001,now-last));last=now;
    const camera=opts.getCamera();
    const mode=opts.getMode();
    const logicBefore=logic.state.phase;
    const wantsStart=logicBefore==="idle"&&(held||tap);
    // Starting a cast needs the shore and the first-person view; otherwise say why and ignore the hold.
    let hold=held||tap;
    if(wantsStart||(logicBefore==="idle"&&tap)){
      if(!nearWater()){hold=false;if(!pressedNotice){say("走到海邊或碼頭再釣魚",now);pressedNotice=true;}}
      else{
        if(mode!=="first")opts.setCameraMode("first");
        pressedNotice=false;
      }
    }else if(!held)pressedNotice=false;
    // Leaving the first-person view or walking away from the fishing spot reels the line in.
    if(logic.isActive()&&(mode!=="first"||Math.hypot(player.x-origin.x,player.z-origin.z)>.8)&&logicBefore!=="idle"){
      if(!logic.isFinished())say("收起釣線",now,1.5);
      logic.cancel();
      if(body!=="hidden")body="reeling";
    }
    // A press and release squeezed between two frames (slow devices) must still read as release-then-press: show the
    // rules one frame of "released" before the press, or a quick tap while the reel was held would be missed.
    if(tap&&lastHold)logic.update(.001,false);
    logic.update(dt,hold);
    lastHold=hold;
    tap=false;
    const st=logic.state,phase=st.phase;
    camera.getWorldDirection(forward);
    right.set(-forward.z,0,forward.x).normalize();   // forward x up: to the angler's right
    if(phase!==previousPhase){
      if(phase==="charging"){origin.x=player.x;origin.z=player.z;}
      if(phase==="casting"){
        // the throw: aim along the view, as far as the charge says, shortened until it lands on open water
        let distance=st.castDistance;const flat=Math.hypot(forward.x,forward.z)||1;
        castDir.set(forward.x/flat,0,forward.z/flat);
        eye.copy(camera.position);
        while(distance>CAST_RANGE.min&&!isOpenWater(eye.x+castDir.x*distance,eye.z+castDir.z*distance))distance-=.5;
        if(!isOpenWater(eye.x+castDir.x*distance,eye.z+castDir.z*distance)){say("對準海面再拋竿（視線往海的方向）",now);logic.cancel();previousPhase="idle";return;}
        st.castDistance=distance;
        landing.set(eye.x+castDir.x*distance,WATER_Y,eye.z+castDir.z*distance);
        origin.x=eye.x;origin.z=eye.z;
        castStart=now;body="held";released=false;ropeReady=false;
      }
      if(phase==="lure")splash(landing.x,landing.z,1,now);
      if(phase==="strike"){say("有魚上鉤！快提竿！",now,1.7);strikeSplashAt=now;strikeStart=now;strikeSide=effects()<.5?-1:1;}
      if(phase==="fighting"){say("中魚了！魚衝刺時放線，喘氣時收線",now,2.4);splash(lurePos.x,lurePos.z,1,now);leapAt=now+1.5+effects()*2;}
      if(phase==="lost"){say(st.reason,now,3.2);if(body!=="hidden")body="reeling";showCatch(null,null);}
      if(phase==="landed"&&st.result){
        const r=st.result;
        if(r.junk)say("釣到"+r.name+"…",now,3.5);
        else{
          say("釣到 "+r.name+" "+r.length+"cm！",now,3.5);
          tally.count++;if(!tally.best||(r.length??0)>tally.best.length)tally.best={name:r.name,length:r.length??0};
          save();showCount();
        }
        showCatch(r.id,r.length);landedAt=now;body="reeling";
      }
      if(phase==="idle"&&(previousPhase==="landed"||previousPhase==="lost")){/* acknowledged */}
      previousPhase=phase;
    }

    // ---------- HUD ----------
    const text=label(phase);
    const active=logic.isActive();
    // Few controls: nothing at all away from the water; the lure switch only while no line is out.
    ui.hud.hidden=!(nearWater()||active)&&!message;
    ui.lure.hidden=!(phase==="idle"&&nearWater());
    ui.count.hidden=!(tally.count>0&&(nearWater()||active));
    ui.button.hidden=text===""||!(nearWater()||active);
    ui.button.textContent=text;
    ui.button.classList.toggle("urgent",phase==="strike");
    ui.button.classList.toggle("held",held&&phase!=="idle");
    ui.meter.hidden=!(phase==="charging"||phase==="lure"||phase==="fighting"||phase==="strike");
    ui.meter.dataset.mode=phase==="charging"?"power":phase==="fighting"?"fight":"lure";
    ui.power.style.width=Math.round(st.power*100)+"%";
    ui.tension.style.width=Math.round(Math.min(1,st.tension/1.0)*100)+"%";
    ui.tension.dataset.zone=st.tension>.9?"danger":st.tension>=SWEET_ZONE.low&&st.tension<=SWEET_ZONE.high?"good":"slack";
    ui.distance.textContent=phase==="charging"?"距離約 "+Math.round(CAST_RANGE.min+st.power*(CAST_RANGE.max-CAST_RANGE.min))+" 公尺"
      :phase==="lure"||phase==="strike"?"路亞距離 "+st.lureDistance.toFixed(1)+" 公尺"
      :phase==="fighting"?"魚在 "+st.fishDistance.toFixed(1)+" 公尺・體力 "+Math.round(st.stamina*100)+"%・第 "+Math.max(1,st.round)+"／"+st.rounds+" 回合":"";
    const showMessage=now<messageUntil||messageFrames>0;
    if(messageFrames>0)messageFrames--;
    ui.status.textContent=showMessage?message:(
      phase==="lure"?(st.nibble>.4?"魚在試探…":"按住收線，慢慢把路亞拉回來"):phase==="charging"?"放開就拋出去":phase==="strike"?"快提竿！":
      phase==="fighting"?(st.fightMode==="run"?"魚在衝！放開放線":st.fightMode==="spent"?"魚沒力了，快收線！":"魚在喘氣，按住收線"):"");

    // ---------- the rod ----------
    const showRod=mode==="first"&&(rodView||active||nearWater()||body!=="hidden");
    rod.visible=showRod;
    const since=now-castStart;
    // pitch of the rod about the angler's right axis: rests raised, cocks back while charging, whips forward, settles
    let pitch=.34,flick=0;
    if(phase==="charging")pitch=.34+st.power*.8;
    else if(phase==="casting"){
      const u=since/CAST;
      pitch=u<.2?1.3-smooth(0,.2,u)*1.25:.05+smooth(.2,1,u)*.45;     // whip forward from the cocked position
      flick=Math.sin(Math.min(1,Math.max(0,(u-.05)/.35))*Math.PI);
    }else if(phase==="strike")pitch=.6+Math.sin(now*20)*.03;
    else if(phase==="fighting")pitch=.55+Math.sin(now*2.2)*.03+st.tension*.2;
    else if(phase==="landed")pitch=.95-smooth(0,1.2,now-landedAt)*.35;
    else if(active)pitch=.36+Math.sin(now*1.3)*.012;
    const bobbing=active?Math.sin(now*1.7)*.008:Math.sin(now*.8)*.004;
    rod.position.set(camera.position.x+right.x*.27+forward.x*.52,camera.position.y-.27+bobbing,camera.position.z+right.z*.27+forward.z*.52);
    rod.quaternion.copy(camera.quaternion);
    rod.rotateX(-Math.PI/2+pitch);   // the shaft points forward, `pitch` radians above the horizon
    rod.rotateZ(-.3);
    if(rodView){
      rod.position.set(camera.position.x+forward.x*(rodViewParam==="2"?.34:.62)-right.x*(rodViewParam==="2"?.02:.18),camera.position.y-.03,camera.position.z+forward.z*(rodViewParam==="2"?.34:.62)-right.z*(rodViewParam==="2"?.02:.18));
      rod.quaternion.copy(camera.quaternion).multiply(new THREE.Quaternion().setFromRotationMatrix(viewMap));
    }
    rod.updateMatrixWorld(true);
    zAxis.set(0,0,1).transformDirection(rod.matrixWorld);
    const bendSign=zAxis.y<0?1:-1;
    const bend=.14+flick*.55+(phase==="strike"?.45:0)+(phase==="fighting"?Math.min(1.4,st.tension*1.35+st.burst*.35):0)+(phase==="landed"?.4*(1-smooth(0,1.5,now-landedAt)):0)+(phase==="charging"?st.power*.25:0);
    buildRod(bend,bendSign);
    tip.copy(rodTipLocal);rod.localToWorld(tip);
    spoolSpin(phase,held);

    // ---------- lure / hooked fish ----------
    // With the rod out and nothing cast, the lure hangs a hand's length below the tip like on a real rod.
    if(body==="hidden"&&showRod&&phase==="idle")body="hang";
    if(body==="hang"&&(!showRod||phase!=="idle"))body=phase==="idle"?"hidden":body;
    const wantBody=body!=="hidden";
    bobber.visible=wantBody&&(showRod||body!=="hang");lineMesh.visible=wantBody&&showRod;
    let end=lurePos;
    if(wantBody){
      if(body==="hang"){
        // lure dangling from the tip, swinging a little with the rod
        lurePos.copy(tip).add(tmp.set(Math.sin(now*1.6)*.02,-.42+Math.sin(now*2.3)*.01,Math.cos(now*1.3)*.02));lureVel.set(0,0,0);
        paidOut=.5;
        if(ropeReady===false)rope.reset([tip.x,tip.y,tip.z],[lurePos.x,lurePos.y,lurePos.z]);
        ropeReady=true;
      }
      if(body==="held"){
        lurePos.copy(tip).add(tmp.set(0,-.35,0));lureVel.set(0,0,0);
        if(since>=RELEASE&&!released){
          released=true;body="flying";
          const T=CAST-RELEASE;
          // v = (target - p0)/T - g T / 2  lands exactly on the target after T seconds
          lureVel.copy(landing).sub(lurePos).multiplyScalar(1/T);lureVel.y-=.5*GRAVITY*T;
          rope.reset([tip.x,tip.y,tip.z],[lurePos.x,lurePos.y,lurePos.z]);ropeReady=true;paidOut=1.2;
        }
      }
      if(body==="flying"){
        lureVel.y+=GRAVITY*dt;lurePos.addScaledVector(lureVel,dt);
        paidOut=Math.max(paidOut,tip.distanceTo(lurePos)*1.04+.5);
        if(lurePos.y<=WATER_Y+.03||since>=CAST+.05){
          lurePos.set(lurePos.y<=WATER_Y+.2?lurePos.x:landing.x,WATER_Y+.03,lurePos.y<=WATER_Y+.2?lurePos.z:landing.z);
          body="water";
        }
      }
      if(body==="water"){
        // the lure sits on the line from the angler to the landing point, `lureDistance` away from the angler
        const flatLen=Math.hypot(landing.x-origin.x,landing.z-origin.z)||1;
        const ux=(landing.x-origin.x)/flatLen,uz=(landing.z-origin.z)/flatLen;
        let along=phase==="fighting"?st.fishDistance:st.lureDistance,sway=Math.sin(now*2.2+along)*.25;
        let height=WATER_Y+.03+Math.sin(now*3.1)*.01;
        if(phase==="lure"&&st.nibble>.05){
          // a fish is sniffing at it: short, jerky tugs that grow until the strike
          const jerk=Math.pow(Math.max(0,Math.sin(now*(9+st.nibble*8))),3);
          height-=jerk*.07*st.nibble;sway+=Math.sin(now*13)*.22*st.nibble;
          if(jerk>.9&&now-nibbleAt>.45){splash(lurePos.x,lurePos.z,.22+.25*st.nibble,now);nibbleAt=now;}
        }
        if(phase==="strike"){
          // the strike: the lure is yanked under and darts to one side, throwing a splash
          const u=Math.min(1,(now-strikeStart)/.45);
          height-=.12+.18*Math.sin(Math.min(1,u*1.4)*Math.PI);sway+=strikeSide*(.3+1.9*(1-Math.pow(1-u,2)));
          if(now-strikeSplashAt>.35){splash(lurePos.x,lurePos.z,.55,now);strikeSplashAt=now;}}
        if(phase==="fighting"){
          // The fish runs: the lure is dragged across the surface in long sweeps, leaving a wake. It rests, then is pulled in.
          const run=st.fightMode==="run",spent=st.fightMode==="spent";
          const swing=run?1.9:spent?.35:.8;
          fightSwing+=((swing)-fightSwing)*Math.min(1,dt*2.5);
          sway=Math.sin(now*(run?2.3:1.2)+st.strength*3)*fightSwing+Math.sin(now*5.1)*.3*st.burst;
          height=WATER_Y+(run?-.03:spent?.0:-.07)+Math.sin(now*6)*.015*(run?1:.3);
          if(now-wakeAt>(run?.2:.5)){splash(lurePos.x,lurePos.z,run?.4:.15,now);wakeAt=now;}
        }
        lurePos.set(origin.x+ux*along-uz*sway,height,origin.z+uz*along+ux*sway);
        if(phase==="lure"&&held&&now-wakeAt>.28){splash(lurePos.x,lurePos.z,.18,now);wakeAt=now;}   // a lure being reeled ripples the surface
        const d=tip.distanceTo(lurePos);
        paidOut=phase==="fighting"?d*(1+.01-st.tension*.012)+(held?0:.6):phase==="strike"?d*.99:d*1.05+.5;
      }
      if(body==="reeling"){
        tmp.copy(tip).sub(lurePos);const d=tmp.length();
        const speed=Math.max(7,d*3.2);
        if(d<.55){body="hang";ropeReady=false;}
        else{
          // fly back to the rod tip along an arc: the height eases toward (tip + a hump that shrinks with the distance)
          lurePos.addScaledVector(tmp.normalize(),Math.min(d,speed*dt));
          const hump=Math.min(1.2,d*.05),goal=Math.max(WATER_Y+.1,tip.y-.4+hump);
          lurePos.y+=(goal-lurePos.y)*Math.min(1,dt*7);
        }
        paidOut=Math.max(.6,d*1.02);
      }
      bobber.position.copy(lurePos);
      // the bright surface marker under the lure while it is in the water
      const showMarker=body==="water"&&(phase==="lure"||phase==="strike"||phase==="fighting");
      markerGroup.visible=showMarker;
      if(showMarker){
        markerGroup.position.set(lurePos.x,WATER_Y+.045,lurePos.z);
        const d=camera.position.distanceTo(lurePos);
        markerGroup.scale.setScalar(Math.min(1.4,Math.max(.25,d*.07))*(1+.1*Math.sin(now*5)));
        markerRingMat.opacity=phase==="strike"?.4+.6*Math.abs(Math.sin(now*14)):.9;
        markerRingMat.color.set(phase==="strike"?"#ff3d2e":phase==="fighting"?"#ffb02e":"#ff7a2e");
      }
      // the lure points toward the angler (its nose first when it is reeled in) and wobbles
      tmp.set(origin.x-lurePos.x,0,origin.z-lurePos.z);
      const yaw=body==="held"||body==="flying"?Math.atan2(forward.x,forward.z)-Math.PI/2:Math.atan2(-tmp.z,tmp.x)+Math.PI;
      bobber.rotation.set(0,yaw,Math.sin(now*(held?22:3))*.09+(phase==="strike"?Math.sin(now*30)*.4:0));
      // ---------- line physics ----------
      if(!ropeReady){rope.reset([tip.x,tip.y,tip.z],[lurePos.x,lurePos.y+.02,lurePos.z]);ropeReady=true;}
      const floor=body==="water"&&phase!=="fighting"||body==="flying"?WATER_Y+.03:null;
      rope.step(dt,[tip.x,tip.y,tip.z],[lurePos.x,lurePos.y+.02,lurePos.z],paidOut,floor);
      for(let i=0;i<ROPE_POINTS-1;i++){
        rope.point(i,rp0);rope.point(i+1,rp1);
        tmp.set(rp0[0],rp0[1],rp0[2]);tmp2.set(rp1[0],rp1[1],rp1[2]);
        const len=tmp.distanceTo(tmp2)||1e-4;
        quat.setFromUnitVectors(yUp,dirTmp.copy(tmp2).sub(tmp).normalize());
        matrix.compose(tmp.clone().add(tmp2).multiplyScalar(.5),quat,scaleV.set(.0042,len,.0042));
        lineMesh.setMatrixAt(i,matrix);
      }
      lineMesh.instanceMatrix.needsUpdate=true;
    }
    // ---------- splash rings and droplets ----------
    for(let r=0;r<2;r++){
      ringAge[r]+=dt;
      const age=ringAge[r],ring=rings[r];
      ring.visible=age<1.1;
      if(ring.visible){ring.scale.setScalar(.5+age*3.2);(ring.material as THREE.MeshBasicMaterial).opacity=.8*(1-age/1.1);}
    }
    let live=0;
    for(let i=0;i<DROPS;i++){
      if(dropLife[i]>0){
        dropLife[i]-=dt;dropVel[i*3+1]+=GRAVITY*dt;
        for(let c=0;c<3;c++)dropPos[i*3+c]+=dropVel[i*3+c]*dt;
        if(dropPos[i*3+1]<WATER_Y)dropLife[i]=0;
      }
      const alive=dropLife[i]>0;if(alive)live++;
      matrix.compose(tmp.set(dropPos[i*3],dropPos[i*3+1],dropPos[i*3+2]),quat.identity(),scaleV.setScalar(alive?1:0));
      drops.setMatrixAt(i,matrix);
    }
    drops.visible=live>0;drops.instanceMatrix.needsUpdate=true;

    // ---------- the hooked fish shows itself: surfacing and leaping during the fight, then flying into view ----------
    void end;
    if(phase==="fighting"&&body==="water"&&st.hooked){
      const h=st.hooked;
      if(shown!==h.id)showCatch(h.id,h.length);
      // The fish leaps now and then, rolls on the surface once it tires, and otherwise stays under the water.
      if(now>=leapAt){leapStart=now;leapAt=now+2.2+effects()*(2.4+st.stamina*2);splash(lurePos.x,lurePos.z,.9,now);}
      const p=(now-leapStart)/.8;
      const tired=st.stamina<.5&&st.fishDistance<12;
      if(p>=0&&p<=1||tired){
        catchGroup.visible=true;
        const flatLen=Math.hypot(landing.x-origin.x,landing.z-origin.z)||1,ux=(landing.x-origin.x)/flatLen,uz=(landing.z-origin.z)/flatLen;
        const lift=p>=0&&p<=1?Math.sin(p*Math.PI)*(.55+.35*st.strength):0;
        catchGroup.position.set(lurePos.x,WATER_Y+.03+lift,lurePos.z);
        catchGroup.rotation.set(0,Math.atan2(-uz,ux),(p>=0&&p<=1?(p-.5)*1.6:Math.sin(now*3)*.5));
        wiggle(h.id,now,p>=0&&p<=1?1.3:.8);
      }else catchGroup.visible=false;
    }else if(phase==="fighting"||phase==="strike"){catchGroup.visible=false;}
    if(phase==="landed"&&shown){
      const f=Math.min(1,(now-landedAt)/.9);
      catchGroup.visible=true;
      tmp.copy(camera.position).addScaledVector(forward,.8).addScaledVector(right,.05);tmp.y-=.06;
      catchGroup.position.lerpVectors(lurePos.y>WATER_Y?lurePos:landing,tmp,f);catchGroup.position.y+=Math.sin(f*Math.PI)*1.5;
      const yaw=Math.atan2(forward.x,forward.z);
      catchGroup.rotation.set(0,yaw+Math.PI/2,0);
      catchGroup.rotation.z=f<1?Math.sin(f*Math.PI*3)*.5:Math.sin(now*3)*.04;
      wiggle(shown,now,f<1?1.2:.55);
    }else if(catchGroup.visible){catchGroup.visible=false;showCatch(null,null);}
  }
  const rp0=[0,0,0],rp1=[0,0,0],yUp=new THREE.Vector3(0,1,0),dirTmp=new THREE.Vector3();
  function spoolSpin(phase:string,holding:boolean){
    // the reel's crank turns while the line comes in (hold) and spins free as the line goes out
    const turning=(holding&&(phase==="lure"||phase==="fighting"))?.5:(phase==="fighting"?-.25:phase==="casting"?.6:0);
    crankAngle=(crankAngle+turning)%(Math.PI*2);
    rodModel.spin(crankAngle);
  }
  return {update,logic,tally:()=>tally,species:SPECIES.length,maxLine:MAX_LINE};
}
export type FishingView=ReturnType<typeof createFishingView>;
