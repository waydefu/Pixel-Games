import * as THREE from "three";
import { createRendererPort } from "../rendering/renderer-port.js";
import { createHd2dPipeline } from "../rendering/hd2d-pipeline.js";
import { liveSky, setMoonPhase } from "./sky-live.js";
import { HOUR_START, wrapHour, describeHour } from "./time-of-day.js";
import { createFrameMetrics } from "../rendering/frame-metrics.js";
import { createAdaptiveResolutionController } from "../rendering/quality.js";
import { createCoastalWorld } from "./world.js";
import { loadVillageKit } from "./village-kit.js";
import { createMovementInput } from "./input.js";
import { stepOnGround } from "./navigation.js";
import { createCameraRig, type CameraMode } from "./camera.js";
import { createFishingView } from "./fishing.js";
import { createBoating } from "./boating.js";
import { createSoundscape, DEFAULT_AUDIO, type Soundscape, type AudioSettings } from "./soundscape.js";
import { getVisualShot } from "./visual-audit.js";

type GameState = "starting" | "ready" | "unsupported" | "lost" | "failed";
const element=<T extends HTMLElement>(selector:string):T => {
  const found=document.querySelector<T>(selector);
  if(!found)throw new Error("Missing UI element: "+selector);
  return found;
};
const canvas=element<HTMLCanvasElement>("#stage");
const status=element<HTMLElement>("#game-status");
const fallback=element<HTMLElement>("#fallback");
const metrics=element<HTMLElement>("#metrics");
const settings=element<HTMLElement>("#settings");
const menuToggle=element<HTMLButtonElement>("#menu-toggle");
const menuClose=element<HTMLButtonElement>("#menu-close");
const fullButton=element<HTMLButtonElement>("#fullscreen");
const quality=element<HTMLSelectElement>("#quality");
const cameraPicker=element<HTMLSelectElement>("#camera-mode");
const projectionPicker=element<HTMLSelectElement>("#quarter-projection");
const timeHour=element<HTMLElement>("#time-hour");
const timeMinute=element<HTMLElement>("#time-minute");
const timeAuto=element<HTMLInputElement>("#time-auto");
const timeLabel=element<HTMLElement>("#time-label");
const viewToggle=element<HTMLButtonElement>("#view-toggle");
const joystick=element<HTMLElement>("#joystick");
const knob=element<HTMLElement>("#joystick-knob");
const hint=element<HTMLElement>("#hint");
const lookHint=element<HTMLElement>("#look-hint");

// Polyfork Medieval Village Kit (CC BY 4.0). If it cannot load, the procedural village is used instead.
const villageKit=await loadVillageKit().catch(error=>{console.warn("Village kit unavailable; using procedural village",error);return null;});
const world=createCoastalWorld(villageKit);
const rig=createCameraRig(world.player,world.avatar,world.shadow);
type VisualShot={id:string;mode:CameraMode;x:number;z:number;yaw:number;pitch:number;time:number;hour:number;viewport:string};
const visualShot=getVisualShot(new URLSearchParams(window.location.search).get("visualShot")) as VisualShot|null;
// Time of day: ?hour=19.5 fixes it; visual-audit shots carry their own hour; otherwise the day flows.
const hourParam=Number.parseFloat(new URLSearchParams(window.location.search).get("hour")??"");
// An explicit ?hour= also overrides a visual-audit shot, so one camera can be compared at any time of day.
let hour=Number.isFinite(hourParam)?wrapHour(hourParam):visualShot?visualShot.hour:HOUR_START;
// The moon waxes and wanes over eight in-game days (?phase=0..1 fixes it: 0 new, .5 full).
const phaseParam=Number.parseFloat(new URLSearchParams(window.location.search).get("phase")??"");
let moonPhase=Number.isFinite(phaseParam)?phaseParam:.62;setMoonPhase(moonPhase);
const HOURS_PER_SECOND=1/40; // a full day lasts 16 real minutes
function showHour(){
  const d=describeHour(hour);
  timeLabel.textContent=d.text+" "+d.phase;
  const [hh,mm]=d.text.split(":");
  for(const [control,value] of [[timeHour,hh],[timeMinute,mm]] as const){
    control.textContent=value;
    control.setAttribute("aria-valuenow",String(Number(value)));
    control.setAttribute("aria-valuetext",value);
  }
}
timeAuto.checked=!visualShot&&!Number.isFinite(hourParam);
function adjustTime(minutes:number){
  const [hh,mm]=describeHour(hour).text.split(":").map(Number);
  const total=((hh*60+mm+minutes)%1440+1440)%1440;
  hour=wrapHour(total/60+1e-9); // avoid floating-point underflow when formatting exact minutes
  timeAuto.checked=false;
  world.setHour(hour);
  showHour();
}
for(const [control,step] of [[timeHour,60],[timeMinute,1]] as const){
  control.addEventListener("keydown",e=>{
    if(e.key!=="ArrowUp"&&e.key!=="ArrowDown")return;
    e.preventDefault();
    adjustTime(e.key==="ArrowUp"?step:-step);
  });
  control.addEventListener("wheel",e=>{
    if(!e.deltaY)return;
    e.preventDefault();
    adjustTime(e.deltaY<0?step:-step);
  },{passive:false});
  let pointer:number|null=null,lastY=0;
  control.addEventListener("pointerdown",e=>{
    if(e.pointerType!=="touch"&&e.pointerType!=="pen")return;
    pointer=e.pointerId;lastY=e.clientY;
    control.setPointerCapture(e.pointerId);
  });
  control.addEventListener("pointermove",e=>{
    if(e.pointerId!==pointer)return;
    const steps=Math.trunc((lastY-e.clientY)/24);
    if(steps){adjustTime(steps*step);lastY-=steps*24;}
  });
  const endPointer=(e:PointerEvent)=>{if(e.pointerId===pointer)pointer=null;};
  control.addEventListener("pointerup",endPointer);
  control.addEventListener("pointercancel",endPointer);
  control.addEventListener("lostpointercapture",endPointer);
}
for(const button of document.querySelectorAll<HTMLButtonElement>("[data-time-step]")){
  button.addEventListener("click",()=>adjustTime(Number(button.dataset.timeStep)*(button.dataset.timeUnit==="hour"?60:1)));
}
world.setHour(hour);showHour();
if(visualShot){
  const poseQuery=new URLSearchParams(window.location.search);
  const poseX=Number.parseFloat(poseQuery.get("x")??""),poseZ=Number.parseFloat(poseQuery.get("z")??"");
  world.movePlayer(Number.isFinite(poseX)?poseX:visualShot.x,Number.isFinite(poseZ)?poseZ:visualShot.z,0); // ?x=&z= override the pose
  rig.setMode(visualShot.mode);
  // Optional ?yaw=&pitch= (radians) override the shot's angles, so one pose can be swept around the horizon.
  const query=new URLSearchParams(window.location.search);
  const yawParam=Number.parseFloat(query.get("yaw")??""),pitchParam=Number.parseFloat(query.get("pitch")??"");
  rig.setAuditAngles(Number.isFinite(yawParam)?yawParam:visualShot.yaw,Number.isFinite(pitchParam)?pitchParam:visualShot.pitch);
  rig.tick(12); // Snap the otherwise smoothed Quarter View to its canonical target.
}
const modeNames:Record<CameraMode,string>={quarter:"斜角",first:"第一人稱",vista:"風景"};
function setCameraMode(mode:CameraMode){
  rig.setMode(mode);
  cameraPicker.value=mode;
  viewToggle.textContent=modeNames[mode];
  viewToggle.setAttribute("aria-label","切換視角，目前："+modeNames[mode]);
  joystick.hidden=mode==="vista";
  lookHint.hidden=mode==="quarter";
  // Drag-look never holds a global pointer lock; HUD remains interactive.
  hint.textContent=mode==="quarter"?"WASD／方向鍵移動 · C 切換視角":
    mode==="first"?"WASD 移動 · 滑鼠／右側拖曳環視 · C 切換":
    "風景觀賞 · 拖曳調整視線 · C 切換";
  if(host)host.setCamera(rig.camera);
  resize();
}
const weatherPicker=element<HTMLSelectElement>("#weather");
{const initial=new URLSearchParams(window.location.search).get("weather");if(initial&&[...weatherPicker.options].some(o=>o.value===initial))weatherPicker.value=initial;}
weatherPicker.addEventListener("change",()=>world.setWeather(weatherPicker.value==="auto"?null:weatherPicker.value));
const input=createMovementInput(joystick,knob);
const frameMetrics=createFrameMetrics();
const adaptive=createAdaptiveResolutionController({targetMs:16.67,windowSize:120,cooldownWindows:3});
const diagnostics={
  status:"starting" as GameState,
  frames:0,drawCalls:0,bufferWidth:0,bufferHeight:0,p95Ms:null as number|null,
  camera:"quarter" as CameraMode,projection:"orthographic",yaw:0,pitch:0,scenery:world.scenery,
  visualShot:visualShot?.id??null,hour:0,phase:"",sunElevation:0,
};
Object.defineProperty(window,"__pixelGame",{value:{read:()=>({...diagnostics,boat:boating.aboard?{...boating.boat(boating.index)}:null,player:{...world.player},audio:soundCtx?soundCtx.state:"off",menuOpen:!settings.hidden,frame:frameMetrics.summary(),renderStats:host?.stats()??null,renderScale:host?.scale??1,pipeline:host?.effects??"off",hdr:pipelineInfo.hdr,weather:world.weather.state.preset,grade:pipelineInfo.quality})},configurable:false});
let host:ReturnType<typeof createRendererPort>|null=null;
const pipelineInfo={hdr:false,quality:"balanced"};
let focusPipeline:(distance:number,active:boolean)=>void=()=>{};
let lastSoundX=0,lastSoundZ=0;
let animation=0,previous=0,elapsed=0,uiTime=0,closed=false,observer:ResizeObserver|null=null;
function mark(state:GameState,message:string){
  diagnostics.status=state;
  status.textContent=message;
  status.toggleAttribute("hidden",state==="ready");
  if(state==="unsupported"||state==="failed")fallback.hidden=false;
  else fallback.hidden=true;
}
function setMenu(open:boolean){
  settings.hidden=!open;
  menuToggle.setAttribute("aria-expanded",String(open));
  if(open)menuClose.focus();
  else if(document.activeElement===menuClose)menuToggle.focus();
}
menuToggle.addEventListener("click",()=>setMenu(settings.hasAttribute("hidden")));
menuClose.addEventListener("click",()=>setMenu(false));
window.addEventListener("keydown",(e)=>{
  if(e.key==="Escape"&&!settings.hidden){setMenu(false);e.preventDefault();}
  if(e.repeat||e.altKey||e.ctrlKey||e.metaKey||!settings.hidden)return;
  if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;
  const map:Record<string,CameraMode>={"1":"quarter","2":"first","3":"vista"};
  if(e.key.toLowerCase()==="c")setCameraMode(rig.cycle());
  else if(map[e.key])setCameraMode(map[e.key]);
});
cameraPicker.addEventListener("change",()=>setCameraMode(cameraPicker.value as CameraMode));
projectionPicker.addEventListener("change",()=>{
  rig.setQuarterProjection(projectionPicker.value as "perspective"|"orthographic");
  rig.tick(12); // snap: do not lerp the lens position across projections
  if(host)host.setCamera(rig.camera);
  resize();
});
viewToggle.addEventListener("click",()=>setCameraMode(rig.cycle()));
// ---- sound: synthesised coast soundscape, started by the first click / key / touch (browsers forbid sound before) ----
let sound:Soundscape|null=null,soundCtx:AudioContext|null=null;
const AUDIO_KEY="pixel-games.audio.v1";
const audioSettings:AudioSettings={...DEFAULT_AUDIO};
try{Object.assign(audioSettings,JSON.parse(window.localStorage.getItem(AUDIO_KEY)??"{}"));}catch{/* storage may be unavailable */}
const volMaster=element<HTMLInputElement>("#vol-master"),volAmbient=element<HTMLInputElement>("#vol-ambient"),volSfx=element<HTMLInputElement>("#vol-sfx"),muteBox=element<HTMLInputElement>("#audio-mute");
volMaster.value=String(audioSettings.master);volAmbient.value=String(audioSettings.ambient);volSfx.value=String(audioSettings.sfx);muteBox.checked=audioSettings.muted;
function saveAudio(){
  audioSettings.master=Number(volMaster.value);audioSettings.ambient=Number(volAmbient.value);audioSettings.sfx=Number(volSfx.value);audioSettings.muted=muteBox.checked;
  sound?.setSettings(audioSettings);
  try{window.localStorage.setItem(AUDIO_KEY,JSON.stringify(audioSettings));}catch{/* ignore */}
}
for(const el of [volMaster,volAmbient,volSfx,muteBox])el.addEventListener("input",saveAudio);
function startAudio(){
  if(sound)return;
  try{
    const Ctor=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
    if(!Ctor)return;
    lastSoundX=world.player.x;lastSoundZ=world.player.z;
    soundCtx=new Ctor({latencyHint:"interactive"});
    sound=createSoundscape(soundCtx,{quality:quality.value as "basic"|"balanced"|"high",settings:audioSettings});
    void soundCtx.resume();
  }catch(error){console.warn("Audio could not start",error);}
}
for(const type of ["pointerdown","keydown","touchstart"])window.addEventListener(type,()=>{startAudio();if(soundCtx&&soundCtx.state==="suspended")void soundCtx.resume();},{passive:true});
document.addEventListener("visibilitychange",()=>{if(!soundCtx)return;if(document.visibilityState==="hidden")void soundCtx.suspend();else void soundCtx.resume();});
const fishing=createFishingView({
  scene:world.scene,scope:world.scope,player:world.player,isAboard:()=>boating.aboard,audio:()=>sound,
  getCamera:()=>rig.camera,getMode:()=>rig.mode,setCameraMode,
  ui:{lure:element<HTMLButtonElement>("#fish-lure"),hud:element<HTMLElement>("#fish-hud"),status:element<HTMLElement>("#fish-status"),button:element<HTMLButtonElement>("#fish-button"),count:element<HTMLElement>("#fish-count"),meter:element<HTMLElement>("#fish-meter"),power:element<HTMLElement>("#fish-power"),tension:element<HTMLElement>("#fish-tension"),distance:element<HTMLElement>("#fish-distance")},
});
const boating=createBoating({
  scene:world.scene,scope:world.scope,boats:world.boats,movable:world.boatsMovable,blockers:world.seaBlockers,colliders:world.colliders,
  player:world.player,audio:()=>sound,world,rig,getMode:()=>rig.mode,setCameraMode,
  ui:{hud:element<HTMLElement>("#boat-hud"),status:element<HTMLElement>("#boat-status"),button:element<HTMLButtonElement>("#boat-button")},
});
// Audit only (?visualShot=...&boat=1&bx=&bz=&bh=&row=1): start aboard a boat at a given place, optionally rowing.
let boatDrive:{x:number;y:number;sprint:boolean}|null=null;
if(visualShot){
  const q=new URLSearchParams(window.location.search),num=(k:string)=>Number.parseFloat(q.get(k)??"");
  if(q.get("boat")!==null){
    const index=Math.max(0,Math.min(boating.sims.length-1,Number.parseInt(q.get("boat")||"0",10)||0));
    const sim=boating.sims[index];
    if(Number.isFinite(num("bx"))&&Number.isFinite(num("bz")))sim.place(num("bx"),num("bz"),Number.isFinite(num("bh"))?num("bh"):sim.state.heading);
    world.movePlayer(sim.state.x,sim.state.z,0);
    boating.board(index);
    if(q.get("row")==="1")boatDrive={x:Number.isFinite(num("steer"))?num("steer"):0,y:-1,sprint:false};
  }
}
let lookPointer:number|null=null,lastLookX=0,lastLookY=0;
canvas.addEventListener("pointerdown",e=>{
  if(!settings.hidden||rig.mode==="quarter"||lookPointer!==null)return;
  // Touch users use the LEFT joystick and drag on the RIGHT of the canvas.
  if(e.pointerType==="touch"&&e.clientX<canvas.clientWidth*.36)return;
  lookPointer=e.pointerId;lastLookX=e.clientX;lastLookY=e.clientY;
  if(e.pointerType!=="mouse")canvas.setPointerCapture(e.pointerId);
  // Deliberately use drag-look rather than automatic Pointer Lock:
  // locking sends clicks to the canvas and blocks HUD mode buttons.
  e.preventDefault();
});
window.addEventListener("pointermove",e=>{
  if(rig.mode==="quarter"||!settings.hidden)return;
  if(e.pointerId!==lookPointer)return;
  rig.look(e.clientX-lastLookX,e.clientY-lastLookY);
  lastLookX=e.clientX;lastLookY=e.clientY;
});
const endLook=(e:PointerEvent)=>{if(e.pointerId===lookPointer)lookPointer=null;};
canvas.addEventListener("pointerup",endLook);canvas.addEventListener("pointercancel",endLook);
window.addEventListener("blur",()=>{lookPointer=null;});

fullButton.addEventListener("click",async()=>{
  try{
    if(!document.fullscreenElement){
      if(typeof document.documentElement.requestFullscreen!=="function")throw new Error("Fullscreen API unavailable");
      await document.documentElement.requestFullscreen();
      fullButton.textContent="離開全螢幕";
    }else{
      await document.exitFullscreen();
      fullButton.textContent="進入全螢幕";
    }
  }catch{
    status.textContent="此瀏覽器未允許全螢幕，可用加到主畫面方式開啟";
  }
});
document.addEventListener("fullscreenchange",()=>{
  fullButton.textContent=document.fullscreenElement?"離開全螢幕":"進入全螢幕";
  resize();
});
function resize(){
  if(!host)return;
  const width=canvas.clientWidth,height=canvas.clientHeight;
  if(width<=0||height<=0)return;
  rig.resize(width,height);
  const buffer=host.resize(width,height,window.devicePixelRatio||1);
  diagnostics.bufferWidth=buffer.width;diagnostics.bufferHeight=buffer.height;
}
function update(dt:number){
  if(!settings.hidden)return;
  const values=input.read();
  if(boating.update(dt,boatDrive??values,elapsed))return;   // in a boat the oars move the player, not the walking rules
  if(Math.abs(values.x)+Math.abs(values.y)<.02)return;
  const delta=rig.movement(values,dt);
  const point=stepOnGround(world.player,delta,world.colliders);
  world.movePlayer(point.x,point.z,elapsed);
}
async function start(){
  try{
    const context=canvas.getContext("webgl2",{antialias:false,alpha:false});
    if(!context){mark("unsupported","WebGL2 不可用");return;}
    const renderer=new THREE.WebGLRenderer({canvas,context,antialias:false,alpha:false,powerPreference:"high-performance"});
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    // Tone mapping, grading and sRGB encoding happen once, in the HD-2D composite pass.
    renderer.toneMapping=THREE.NoToneMapping;
    renderer.toneMappingExposure=1;
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFShadowMap; // r187 removed PCFSoftShadowMap
    const pipeline=createHd2dPipeline({renderer,scene:world.scene,camera:rig.camera,quality:quality.value});
    pipelineInfo.hdr=pipeline.hdr;pipelineInfo.quality=quality.value;
    if(new URLSearchParams(window.location.search).get("tone")==="aces")pipeline.setGrade({uAgx:0}); // audit: compare with the old tone mapper
    focusPipeline=(distance:number,active:boolean)=>pipeline.setFocus({distance,range:2.2,span:10,strength:active?1:0});
    const effects={
      setSize:(w:number,h:number)=>pipeline.setSize(w,h),
      setQuality:(q:string)=>{pipeline.setQuality(q);pipelineInfo.quality=q;},
      setCamera:(c:THREE.Camera)=>pipeline.setCamera(c),
      setSun:(d:THREE.Vector3)=>pipeline.setSun(d),
      setRayScale:(v:number)=>pipeline.setRayScale(v),
      setGrade:(v:Record<string,number|number[]>)=>pipeline.setGrade(v),
      render:(t:number)=>pipeline.render(t),
      dispose:()=>pipeline.dispose(),
      onFailure:()=>{renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;},
    };
    host=createRendererPort({
      renderer,canvas,scene:world.scene,camera:rig.camera,quality:quality.value,effects,
      onStatus:(state:string)=>{
        if(state==="ready")mark("ready","自由探索中");
        if(state==="lost")mark("lost","圖形連線中斷，等待恢復");
        if(state==="failed")mark("failed","圖形恢復失敗");
      },
      restoreResources:async()=>{},
    });
    await host.initialize();
    // A software rasteriser (SwiftShader, llvmpipe) cannot afford the sea's second scene pass: it keeps the analytic
    // sky reflection. `?mirror=1` forces the real reflection back on, for screenshots taken on such a machine.
    const gpuInfo=context.getExtension("WEBGL_debug_renderer_info");
    const gpuName=gpuInfo?String(context.getParameter(gpuInfo.UNMASKED_RENDERER_WEBGL)):"";
    const softwareGpu=/swiftshader|llvmpipe|software/i.test(gpuName)&&new URLSearchParams(location.search).get("mirror")!=="1";
    const applyQuality=()=>world.setShadows(quality.value!=="basic",quality.value as "basic"|"balanced"|"high",softwareGpu);
    applyQuality();
    // A software rasteriser needs seconds per frame, so the adaptive controller (120-frame windows) never reacts in time:
    // render it at a fixed reduced scale. Audit shots and `?mirror=1` keep full resolution.
    const lowPower=softwareGpu&&!visualShot;
    if(lowPower)host.setRenderScale(.55);
    if(visualShot)setCameraMode(visualShot.mode);
    resize();
    observer=new ResizeObserver(resize);observer.observe(canvas);
    quality.addEventListener("change",()=>{
      if(!host)return;
      host.setQuality(quality.value);
      applyQuality();
      resize();
    });
    document.addEventListener("visibilitychange",()=>{previous=0;frameMetrics.reset();});
    const reduceMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    async function frame(now:number){
      if(!host||closed)return;
      const wallDt=previous?Math.max(0,(now-previous)*.001):0;
      const dt=Math.min(.05,wallDt); // movement stays bounded; the in-game clock must not slow with FPS
      if(previous && document.visibilityState==="visible"){
        const frameMs=now-previous;
        if(frameMs>0){
          frameMetrics.record(frameMs);
          if(!visualShot&&!lowPower){
            const next=adaptive.observe(frameMs);
            if(Math.abs(host.scale-next)>.001){host.setRenderScale(next);resize();}
          }
        }
      }
      previous=now;
      elapsed+=dt;
      update(dt);
      const camera=rig.tick(dt);
      host.setCamera(camera);
      world.faceCamera(camera);
      fishing.update();
      if(sound){
        const cam=rig.camera,fwd=new THREE.Vector3();cam.getWorldDirection(fwd);
        const moved=Math.hypot(world.player.x-lastSoundX,world.player.z-lastSoundZ);lastSoundX=world.player.x;lastSoundZ=world.player.z;
        for(const clap of world.takeThunder(dt))sound.api.thunder(clap.loud);
        sound.update({rain:world.weather.state.rain,storm:world.weather.state.storm,time:elapsed,x:world.player.x,z:world.player.z,night:liveSky.night.value,windStrength:liveSky.windStrength.value,gust:world.gustAt(world.player.x,world.player.z),
          aboard:boating.aboard,speed:dt>0?moved/dt:0,sprint:input.read().sprint,gulls:world.gulls(),hour,
          listener:{x:cam.position.x,y:cam.position.y,z:cam.position.z,fx:fwd.x,fy:fwd.y,fz:fwd.z}});
      }
      diagnostics.camera=rig.mode;
      diagnostics.projection=rig.projection;
      diagnostics.yaw=rig.yaw;diagnostics.pitch=rig.pitch;
      if(timeAuto.checked&&!reduceMotion){const before=hour;hour=wrapHour(hour+wallDt*HOURS_PER_SECOND);if(hour<before&&!Number.isFinite(phaseParam)){moonPhase=(moonPhase+1/8)%1;setMoonPhase(moonPhase);}if(now-uiTime>1200||!uiTime)showHour();}
      world.setHour(hour);
      diagnostics.hour=hour;diagnostics.phase=describeHour(hour).phase;diagnostics.sunElevation=liveSky.elevation;
      host.setSun(liveSky.sunDir);host.setRayScale(liveSky.sunRays*(1+1.4*liveSky.twilight.value));host.setGrade({uExposure:liveSky.exposure});
      if(!reduceMotion || visualShot)world.update(visualShot?.time??elapsed);
      try{
        if(rig.mode==='quarter')focusPipeline(camera.position.distanceTo(rig.focusPoint),true);
        else focusPipeline(30,false);
        const drawn=await host.draw(elapsed);
        if(drawn){diagnostics.frames++;diagnostics.drawCalls=host.stats().calls??0;}
      }catch{
        mark("failed","3D 繪製失敗");
        return;
      }
      if(now-uiTime>1200){
        const m=frameMetrics.summary();diagnostics.p95Ms=m.p95Ms;
        metrics.textContent="p95 "+(m.p95Ms?.toFixed(1)??"—")+"ms · "+
          diagnostics.drawCalls+" draw calls · "+diagnostics.bufferWidth+"×"+diagnostics.bufferHeight;
        uiTime=now;
      }
      animation=requestAnimationFrame(frame);
    }
    animation=requestAnimationFrame(frame);
    window.addEventListener("pagehide",()=>{
      if(closed)return;
      closed=true;
      cancelAnimationFrame(animation);
      observer?.disconnect();
      input.destroy();
      void host?.dispose();
      world.dispose();
    },{once:true});
  }catch(error){
    console.warn("Pixel-Games world could not initialize",error);
    mark("failed","無法啟動海岸世界");
    try{await host?.dispose();}catch{}
    world.dispose();input.destroy();
  }
}
void start();
