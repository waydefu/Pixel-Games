import * as THREE from "three";
import { createFishing, isOpenWater, SPECIES, CAST_RANGE, MAX_LINE, SWEET_ZONE } from "./fishing-logic.js";
import { createRope } from "./rope.js";
import { buildCatchModel } from "./fish-model.js";
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
type Ui={hud:HTMLElement;status:HTMLElement;button:HTMLButtonElement;count:HTMLElement;meter:HTMLElement;power:HTMLElement;tension:HTMLElement;distance:HTMLElement};
type Camera={position:THREE.Vector3;getWorldDirection:(v:THREE.Vector3)=>THREE.Vector3;quaternion:THREE.Quaternion};
const smooth=(a:number,b:number,v:number)=>{const t=Math.min(1,Math.max(0,(v-a)/(b-a)));return t*t*(3-2*t);};

export function createFishingView(opts:{
  scene:THREE.Scene;scope:{track:<T extends{dispose:()=>void}>(item:T)=>T};
  player:{x:number;z:number};getCamera:()=>Camera;getMode:()=>CameraMode;setCameraMode:(mode:CameraMode)=>void;ui:Ui;
}){
  const {scene,scope,player,ui}=opts;
  // ?fishSeed= makes the bites reproducible (used by the e2e test and for audits).
  const fishSeed=Number.parseInt(new URLSearchParams(window.location.search).get("fishSeed")??"",10);
  const logic=createFishing({rng:mulberry32(Number.isFinite(fishSeed)?fishSeed:Date.now()&0xffff)});
  const effects=mulberry32(99);
  const dir=new THREE.Vector3(),eye=new THREE.Vector3(),target=new THREE.Vector3(),origin={x:0,z:0};
  const right=new THREE.Vector3(),forward=new THREE.Vector3(),tip=new THREE.Vector3(),zAxis=new THREE.Vector3();
  const tmp=new THREE.Vector3(),tmp2=new THREE.Vector3(),matrix=new THREE.Matrix4(),quat=new THREE.Quaternion(),scaleV=new THREE.Vector3();

  // ============ the rod: a tapered cane built from 9 instanced segments that bend, with guides, cork grip and reel ============
  const SEGMENTS=9,ROD_LENGTH=2.15,segLength=ROD_LENGTH/SEGMENTS;
  const rod=new THREE.Group();rod.visible=false;rod.userData.dynamic=true;scene.add(rod);
  const caneMaterial=scope.track(new THREE.MeshStandardMaterial({roughness:.55,emissive:"#2a1a0c",emissiveIntensity:.55}));
  const segmentGeometry=scope.track(new THREE.CylinderGeometry(.5,.5,1,8));
  const segments=new THREE.InstancedMesh(segmentGeometry,caneMaterial,SEGMENTS);
  const caneColor=[new THREE.Color("#6e4526"),new THREE.Color("#5f3b20"),new THREE.Color("#6e4526")];
  for(let i=0;i<SEGMENTS;i++)segments.setColorAt(i,i===2||i===5?new THREE.Color("#5a2f22"):caneColor[i%3]);  // thread wraps
  segments.frustumCulled=false;rod.add(segments);
  const metal=scope.track(new THREE.MeshStandardMaterial({color:"#cfd3d6",roughness:.35,metalness:.8,emissive:"#222629",emissiveIntensity:.5}));
  const guideGeometry=scope.track(new THREE.TorusGeometry(.022,.0035,6,12));
  const GUIDE_AT=[1,2,3,4,6,8];
  const guides=new THREE.InstancedMesh(guideGeometry,metal,GUIDE_AT.length);guides.frustumCulled=false;rod.add(guides);
  const cork=scope.track(new THREE.MeshStandardMaterial({color:"#c89a62",roughness:.9,emissive:"#5a3d1c",emissiveIntensity:.6}));
  const dark=scope.track(new THREE.MeshStandardMaterial({color:"#2a2624",roughness:.7,emissive:"#161312",emissiveIntensity:.6}));
  const grip=new THREE.Mesh(scope.track(new THREE.CylinderGeometry(.023,.021,.3,10)),cork);grip.position.y=-.1;
  const butt=new THREE.Mesh(scope.track(new THREE.CylinderGeometry(.022,.026,.04,10)),dark);butt.position.y=-.27;
  const reelSeat=new THREE.Mesh(scope.track(new THREE.BoxGeometry(.03,.07,.04)),metal);reelSeat.position.set(0,.03,-.045);
  const spool=new THREE.Mesh(scope.track(new THREE.CylinderGeometry(.03,.03,.034,14)),dark);spool.rotation.z=Math.PI/2;spool.position.set(0,.03,-.075);
  const crank=new THREE.Group();
  const arm=new THREE.Mesh(scope.track(new THREE.BoxGeometry(.006,.006,.07)),metal);arm.position.z=.035;
  const knob=new THREE.Mesh(scope.track(new THREE.SphereGeometry(.012,8,6)),cork);knob.position.z=.07;
  crank.add(arm,knob);crank.position.set(.024,.03,-.075);
  rod.add(grip,butt,reelSeat,spool,crank);
  for(const m of [grip,butt,reelSeat,spool,arm,knob]){m.castShadow=false;m.receiveShadow=false;}

  // chain state of the last frame: tip position in rod space
  const rodTipLocal=new THREE.Vector3(),chain=new THREE.Matrix4(),link=new THREE.Matrix4(),bendRot=new THREE.Matrix4();
  function buildRod(bend:number,bendSign:number){
    chain.identity();
    let guide=0;
    for(let i=0;i<SEGMENTS;i++){
      const radius=.0135*(1-i/SEGMENTS)+.0035;
      link.makeTranslation(0,segLength/2,0);
      matrix.multiplyMatrices(chain,link);
      matrix.decompose(tmp,quat,scaleV);
      scaleV.set(radius*2,segLength*1.02,radius*2);
      matrix.compose(tmp,quat,scaleV);
      segments.setMatrixAt(i,matrix);
      // the bend grows toward the tip: a cane is stiff at the butt
      const step=bend*bendSign*(.35+1.3*(i/(SEGMENTS-1)))/SEGMENTS;
      link.makeTranslation(0,segLength/2,0);chain.multiply(link);
      if(GUIDE_AT.includes(i)){
        matrix.copy(chain);
        matrix.decompose(tmp,quat,scaleV);
        // a ring hanging under the shaft, plane across it
        tmp2.set(0,0,-.03*bendSign).applyQuaternion(quat);
        tmp.add(tmp2);
        quat.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2));
        matrix.compose(tmp,quat,new THREE.Vector3(1,1,1));
        guides.setMatrixAt(guide++,matrix);
      }
      bendRot.makeRotationX(step);chain.multiply(bendRot);
    }
    rodTipLocal.setFromMatrixPosition(chain);
    segments.instanceMatrix.needsUpdate=true;guides.instanceMatrix.needsUpdate=true;
    if(segments.instanceColor)segments.instanceColor.needsUpdate=true;
  }

  // ============ the bobber, the line, splash ring, droplets ============
  // The lure: a painted minnow plug with a diving lip and treble hooks, drawn about twice life size so it reads.
  const lureModel=buildCatchModel("lure");
  const lureGeometry=scope.track(new THREE.BufferGeometry());
  lureGeometry.setAttribute("position",new THREE.BufferAttribute(lureModel.positions.slice(),3));
  lureGeometry.setAttribute("color",new THREE.BufferAttribute(lureModel.colors,3));
  lureGeometry.computeVertexNormals();
  const lureBody=new THREE.Mesh(lureGeometry,scope.track(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.3,metalness:.45,side:THREE.DoubleSide,emissive:"#ffffff",emissiveIntensity:.22})));
  lureBody.scale.setScalar(2.4);lureBody.position.set(-lureModel.length*1.2,0,0);   // eye of the lure at the group origin
  const bobber=new THREE.Group();bobber.visible=false;bobber.userData.dynamic=true;
  bobber.add(lureBody);scene.add(bobber);

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

  let message="",messageUntil=0,landedAt=-10,previousPhase="idle";
  const say=(text:string,now:number,seconds=3)=>{message=text;messageUntil=now+seconds;};
  const nearWater=()=>player.x>=10;

  // ---- input: one button, and HOLDING it matters ----
  // A tap shorter than one frame (slow devices) must still count: it is remembered until the next update has seen it.
  let held=false,tap=false,pressedNotice=false;
  const setHeld=(value:boolean)=>{if(value&&!held)tap=true;held=value;};
  window.addEventListener("keydown",event=>{
    if(event.target instanceof HTMLInputElement||event.target instanceof HTMLSelectElement)return;
    if(event.key.toLowerCase()==="f"){event.preventDefault();if(!event.repeat)setHeld(true);}
  });
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
  type Body="hidden"|"held"|"flying"|"water"|"reeling";
  let body:Body="hidden";
  const lurePos=new THREE.Vector3(),lureVel=new THREE.Vector3(),castDir=new THREE.Vector3(),landing=new THREE.Vector3();
  let paidOut=1.5,ropeReady=false,castStart=0,last=performance.now()/1000,released=false,strikeSplashAt=0,leapAt=0,leapStart=-10,wakeAt=0;
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
    logic.update(dt,hold);
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
      if(phase==="strike"){say("有魚上鉤！快提竿！",now,1.7);strikeSplashAt=now;}
      if(phase==="fighting"){say("中魚了！張力保持在綠色區",now,2.4);splash(lurePos.x,lurePos.z,1,now);leapAt=now+1.5+effects()*2;}
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
    ui.hud.hidden=!(nearWater()||active||tally.count>0)&&!message;
    ui.button.hidden=text==="";
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
      :phase==="fighting"?"魚在 "+st.fishDistance.toFixed(1)+" 公尺・體力 "+Math.round(st.stamina*100)+"%":"";
    const idleHint=nearWater()&&mode==="first"?"面向海面，按住 F 蓄力拋竿":"";
    ui.status.textContent=now<messageUntil?message:(
      phase==="lure"?"按住收線，慢慢把路亞拉回來":phase==="charging"?"放開就拋出去":phase==="strike"?"快提竿！":
      phase==="fighting"?"張力保持在綠色區：太緊放線、太鬆收線":phase==="casting"||phase==="landed"||phase==="lost"?"":idleHint);

    // ---------- the rod ----------
    const showRod=mode==="first"&&(active||nearWater()||body!=="hidden");
    rod.visible=showRod;
    const since=now-castStart;
    // pitch of the rod about the angler's right axis: rests raised, cocks back while charging, whips forward, settles
    let pitch=.5,flick=0;
    if(phase==="charging")pitch=.5+st.power*.8;
    else if(phase==="casting"){
      const u=since/CAST;
      pitch=u<.2?1.3-smooth(0,.2,u)*1.25:.05+smooth(.2,1,u)*.45;     // whip forward from the cocked position
      flick=Math.sin(Math.min(1,Math.max(0,(u-.05)/.35))*Math.PI);
    }else if(phase==="strike")pitch=.9+Math.sin(now*20)*.03;
    else if(phase==="fighting")pitch=.72+Math.sin(now*2.2)*.03+st.tension*.25;
    else if(phase==="landed")pitch=.95-smooth(0,1.2,now-landedAt)*.35;
    else if(active)pitch=.55+Math.sin(now*1.3)*.012;
    const bobbing=active?Math.sin(now*1.7)*.008:Math.sin(now*.8)*.004;
    rod.position.set(camera.position.x+right.x*.34+forward.x*.5,camera.position.y-.36+bobbing,camera.position.z+right.z*.34+forward.z*.5);
    rod.quaternion.copy(camera.quaternion);
    rod.rotateX(Math.PI/2+pitch-.1);
    rod.rotateZ(-.1);
    rod.updateMatrixWorld(true);
    zAxis.set(0,0,1).transformDirection(rod.matrixWorld);
    const bendSign=zAxis.y<0?1:-1;
    const bend=.14+flick*.55+(phase==="strike"?.45:0)+(phase==="fighting"?Math.min(1.4,st.tension*1.35+st.burst*.35):0)+(phase==="landed"?.4*(1-smooth(0,1.5,now-landedAt)):0)+(phase==="charging"?st.power*.25:0);
    buildRod(bend,bendSign);
    tip.copy(rodTipLocal);rod.localToWorld(tip);
    spoolSpin(phase,held);

    // ---------- lure / hooked fish ----------
    const wantBody=body!=="hidden";
    bobber.visible=wantBody;lineMesh.visible=wantBody&&showRod;
    let end=lurePos;
    if(wantBody){
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
        if(phase==="strike"){height-=.1+Math.abs(Math.sin(now*15))*.08;sway+=Math.sin(now*23)*.18;
          if(now-strikeSplashAt>.4){splash(lurePos.x,lurePos.z,.5,now);strikeSplashAt=now;}}
        if(phase==="fighting"){
          // the fish zigzags across the water and surges; tired fish roll on the surface, strong ones leap
          sway=Math.sin(now*1.7+st.strength*3)*(.8+(1-st.stamina)*.6)+Math.sin(now*4.3)*.35*(st.burst+.2);
          height=WATER_Y-.25+Math.max(0,(1-st.stamina)-.35)*.35;
        }
        lurePos.set(origin.x+ux*along-uz*sway,height,origin.z+uz*along+ux*sway);
        if(phase==="lure"&&held&&now-wakeAt>.28){splash(lurePos.x,lurePos.z,.18,now);wakeAt=now;}   // a lure being reeled ripples the surface
        const d=tip.distanceTo(lurePos);
        paidOut=phase==="fighting"?d*(1+.01-st.tension*.012)+(held?0:.6):phase==="strike"?d*.99:d*1.05+.5;
      }
      if(body==="reeling"){
        tmp.copy(tip).sub(lurePos);const d=tmp.length();
        const speed=Math.max(7,d*3.2);
        if(d<.4){body="hidden";ropeReady=false;}
        else{lurePos.addScaledVector(tmp.normalize(),Math.min(d,speed*dt));lurePos.y=Math.max(lurePos.y,WATER_Y+.05)+Math.min(1.4,d*.04);}
        paidOut=Math.max(.6,d*1.02);
      }
      bobber.position.copy(lurePos);
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
    crank.rotation.x=(crank.rotation.x+turning)%(Math.PI*2);
  }
  return {update,logic,tally:()=>tally,species:SPECIES.length,maxLine:MAX_LINE};
}
export type FishingView=ReturnType<typeof createFishingView>;
