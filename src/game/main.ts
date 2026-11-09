import * as THREE from "three";
import { createRendererPort } from "../rendering/renderer-port.js";
import { createHd2dPipeline } from "../rendering/hd2d-pipeline.js";
import { liveSky, setMoonPhase } from "./sky-live.js";
import { HOUR_START, wrapHour, describeHour } from "./time-of-day.js";
import { createFrameMetrics } from "../rendering/frame-metrics.js";
import { createGpuTimer } from "../rendering/gpu-timer.js";
import { createAdaptiveResolutionController } from "../rendering/quality.js";
import { createCoastalWorld } from "./world.js";
import { loadVillageKit } from "./village-kit.js";
import { createMovementInput, isEditingTarget, matchesActionKey } from "./input.js";
import { stepWalkingByElapsedTime, canOccupy, groundHeight } from "./navigation.js";
import { hullClear } from "./rowing.js";
import { ITEMS, PICKUPS, collect } from "./inventory.js";
import { readSave, writeSave, validateSave, commitImportedSave, SAVE_KEY } from "./save.js";
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
const performanceAudit=new URLSearchParams(location.search).get("perfAudit")==="1";
const startup={scriptStartMs:performanceAudit?performance.now():null as number|null,assetsReadyMs:null as number|null,worldReadyMs:null as number|null,inputReadyMs:null as number|null,rendererReadyMs:null as number|null,firstDrawMs:null as number|null,assetsLoaded:false};

// Polyfork Medieval Village Kit (CC BY 4.0). If it cannot load, the procedural village is used instead.
const villageKit=await loadVillageKit().catch(error=>{console.warn("Village kit unavailable; using procedural village",error);return null;});
if(performanceAudit){startup.assetsReadyMs=performance.now();startup.assetsLoaded=!!villageKit;}
const world=createCoastalWorld(villageKit);
const rig=createCameraRig(world.player,world.avatar,world.shadow);
if(performanceAudit)startup.worldReadyMs=performance.now();
let lookPointer:number|null=null,lastLookX=0,lastLookY=0;
let lockFailed=false,lockPending=false;
function updateLookHint(){
  hint.textContent=rig.mode==="quarter"?"WASD／方向鍵移動 · C 切換視角":
    rig.mode==="vista"?"風景觀賞 · 拖曳調整視線 · C 切換":
    window.matchMedia("(pointer: coarse)").matches?"WASD 移動 · 右側拖曳環視 · C 切換":
    lockFailed?"滑鼠鎖定不可用 · 拖曳環視 · C 切換":
    document.pointerLockElement===canvas?"滑鼠環視 · Esc 顯示游標 · C 切換":
    "點擊畫面開始環視 · C 切換";
}
function releaseLook(){
  lookPointer=null;
  if(document.pointerLockElement===canvas)document.exitPointerLock();
}
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
  if(mode!=="first")releaseLook();
  if(mode!==rig.mode)lockFailed=false;
  rig.setMode(mode);
  cameraPicker.value=mode;
  viewToggle.textContent=modeNames[mode];
  viewToggle.setAttribute("aria-label","切換視角，目前："+modeNames[mode]);
  joystick.hidden=mode==="vista";
  lookHint.hidden=mode==="quarter";
  updateLookHint();
  if(host)host.setCamera(rig.camera);
  resize();
}
const weatherPicker=element<HTMLSelectElement>("#weather");
{const initial=new URLSearchParams(window.location.search).get("weather");if(initial&&[...weatherPicker.options].some(o=>o.value===initial))weatherPicker.value=initial;}
weatherPicker.addEventListener("change",()=>world.setWeather(weatherPicker.value==="auto"?null:weatherPicker.value));
const input=createMovementInput(joystick,knob);
const inventoryOverlay=element<HTMLElement>("#inventory-overlay");
const inventoryOpen=()=>!inventoryOverlay.hidden;
if(performanceAudit)startup.inputReadyMs=performance.now();
const frameMetrics=createFrameMetrics();
const adaptive=createAdaptiveResolutionController({targetMs:16.67,windowSize:120,cooldownWindows:3});
const diagnostics={
  status:"starting" as GameState,
  frames:0,drawCalls:0,bufferWidth:0,bufferHeight:0,p95Ms:null as number|null,
  camera:"quarter" as CameraMode,projection:"orthographic",yaw:0,pitch:0,scenery:world.scenery,
  visualShot:visualShot?.id??null,hour:0,phase:"",sunElevation:0,
};
// Opt-in benchmark samples the game's own RAF loop, not a separate observer loop.
let perfSamples:{atMs:number;frameMs:number}[]|null=null,perfStarted=0,perfHidden=false,perfInterrupted=false;
let perfCpu:{atMs:number;movementMs:number;cameraMs:number;worldMs:number;drawSubmitMs:number}[]=[];
let perfResources:{atMs:number;geometries:number|null;textures:number|null;programs:number|null}[]=[],lastResourceAt=0;
let gpuTimer:ReturnType<typeof createGpuTimer>|null=null;
let gpuDetailFrame=false,gpuFrameAt=0,gpuFrameIndex=0;
function profileGpu(name:string,run:()=>void){
  if(!perfSamples||!gpuDetailFrame){run();return;}
  gpuTimer?.begin(gpuFrameAt,name);
  try{run();}finally{gpuTimer?.end();}
}
if(performanceAudit){
  Object.defineProperty(window,"__pixelPerf",{value:{
    start:()=>{perfSamples=[];perfCpu=[];perfResources=[];lastResourceAt=-1000;gpuFrameIndex=0;perfStarted=performance.now();perfHidden=document.visibilityState!=="visible"||!document.hasFocus();perfInterrupted=false;gpuTimer?.start();},
    stop:()=>{gpuTimer?.stop();if(host&&perfSamples){const stats=host.stats();perfResources.push({atMs:performance.now()-perfStarted,geometries:stats.geometries,textures:stats.textures,programs:stats.programs});}const result={samples:perfSamples??[],cpu:perfCpu,resources:perfResources,hidden:perfHidden,interrupted:perfInterrupted,durationMs:performance.now()-perfStarted};perfSamples=null;return result;},
    startup:()=>({...startup}),
    gpu:()=>gpuTimer?.read()??{status:"UNAVAILABLE",samples:[],pending:0,dropped:0},
  }});
  document.addEventListener("visibilitychange",()=>{if(perfSamples&&document.visibilityState!=="visible")perfHidden=true;});
  window.addEventListener("blur",()=>{if(perfSamples)perfHidden=true;});
}
Object.defineProperty(window,"__pixelGame",{value:{read:()=>({...diagnostics,boat:boating.aboard?{...boating.boat(boating.index)}:null,player:{...world.player},audio:soundCtx?soundCtx.state:"off",menuOpen:!settings.hidden,frame:frameMetrics.summary(),renderStats:host?.stats()??null,renderScale:host?.scale??1,pipeline:host?.effects??"off",hdr:pipelineInfo.hdr,weather:world.weather.state.preset,grade:pipelineInfo.quality})},configurable:false});
let host:ReturnType<typeof createRendererPort>|null=null;
const pipelineInfo={hdr:false,quality:"balanced"};
let focusPipeline:(distance:number,active:boolean)=>void=()=>{};
let lastSoundX=0,lastSoundZ=0;
let animation=0,previous=0,elapsed=0,uiTime=0,closed=false,observer:ResizeObserver|null=null;
function mark(state:GameState,message:string){
  if(perfSamples&&state!=="ready")perfInterrupted=true;
  diagnostics.status=state;
  status.textContent=message;
  status.toggleAttribute("hidden",state==="ready");
  if(state==="unsupported"||state==="failed")fallback.hidden=false;
  else fallback.hidden=true;
}
function setMenu(open:boolean){
  if(open){releaseLook();input.reset();}
  settings.hidden=!open;
  menuToggle.setAttribute("aria-expanded",String(open));
  if(open)menuClose.focus();
  else if(document.activeElement===menuClose)menuToggle.focus();
}
menuToggle.addEventListener("click",()=>setMenu(settings.hasAttribute("hidden")));
menuClose.addEventListener("click",()=>setMenu(false));
window.addEventListener("keydown",(e)=>{
  if(inventoryOpen())return;
  if(e.key==="Escape"&&document.pointerLockElement===canvas){releaseLook();e.preventDefault();return;}
  if(e.key==="Escape"&&!settings.hidden){setMenu(false);e.preventDefault();}
  if(e.repeat||e.altKey||e.ctrlKey||e.metaKey||!settings.hidden)return;
  if(isEditingTarget(e.target))return;
  const map:Record<string,CameraMode>={"1":"quarter","2":"first","3":"vista"};
  if(matchesActionKey(e,"KeyC","c"))setCameraMode(rig.cycle());
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
  scene:world.scene,scope:world.scope,player:world.player,isBlocked:()=>inventoryOpen()||!settings.hidden,isAboard:()=>boating.aboard,audio:()=>sound,
  getCamera:()=>rig.camera,getMode:()=>rig.mode,setCameraMode,
  ui:{lure:element<HTMLButtonElement>("#fish-lure"),hud:element<HTMLElement>("#fish-hud"),status:element<HTMLElement>("#fish-status"),button:element<HTMLButtonElement>("#fish-button"),count:element<HTMLElement>("#fish-count"),meter:element<HTMLElement>("#fish-meter"),power:element<HTMLElement>("#fish-power"),tension:element<HTMLElement>("#fish-tension"),distance:element<HTMLElement>("#fish-distance")},
});
const boating=createBoating({
  scene:world.scene,scope:world.scope,boats:world.boats,movable:world.boatsMovable,blockers:world.seaBlockers,colliders:world.colliders,
  player:world.player,audio:()=>sound,world,rig,isBlocked:()=>inventoryOpen()||!settings.hidden,getMode:()=>rig.mode,setCameraMode,
  ui:{hud:element<HTMLElement>("#boat-hud"),status:element<HTMLElement>("#boat-status"),button:element<HTMLButtonElement>("#boat-button")},
});
// Pickups and saves are independent of the renderer and share stable identifiers.
const inventory:Record<string,number>={};
let collected:string[]=[];
const pickupButton=element<HTMLButtonElement>("#pickup-button"),inventoryToggle=element<HTMLButtonElement>("#inventory-toggle");
const inventoryClose=element<HTMLButtonElement>("#inventory-close"),inventoryList=element<HTMLElement>("#inventory-list"),saveMessage=element<HTMLElement>("#save-message");
const saveFile=element<HTMLInputElement>("#save-file");
const pickupMeshes=PICKUPS.map(p=>{
  const geometry=world.scope.track(new THREE.IcosahedronGeometry(p.item==="driftwood"?.28:.22,0));
  const material=world.scope.track(new THREE.MeshStandardMaterial({color:p.item==="shell"?0xe8cda6:p.item==="stone"?0x98aaa1:0x9a7048,roughness:.85}));
  const mesh=new THREE.Mesh(geometry,material);mesh.position.set(p.x,groundHeight(p.x,p.z)+.18,p.z);
  if(p.item==="driftwood")mesh.scale.set(2,.45,.5);if(p.item==="shell")mesh.scale.set(1,.45,.8);
  world.scene.add(mesh);return mesh;
});
function renderInventory(){
  inventoryList.replaceChildren();
  for(const [id,count] of Object.entries(inventory)){
    const item=ITEMS[id as keyof typeof ITEMS];if(!item)continue;
    const card=document.createElement("div");card.className="inventory-item";
    const icon=document.createElement("span");icon.className="inventory-icon icon-"+id;icon.setAttribute("aria-hidden","true");
    const name=document.createElement("strong");name.textContent=item.name;
    const amount=document.createElement("span");amount.textContent="數量 × "+count;
    card.append(icon,name,amount);inventoryList.append(card);
  }
  if(!inventoryList.childElementCount)inventoryList.textContent="行囊還是空的。到海邊走走吧。";
  pickupMeshes.forEach((mesh,i)=>{mesh.visible=!collected.includes(PICKUPS[i].id);});
}
function saveSnapshot(){return {version:1,player:{...world.player},hour,timeAuto:timeAuto.checked,inventory:{...inventory},collected:[...collected],fishing:fishing.tally(),boatsMovable:world.boatsMovable,boats:boating.sims.map(s=>({x:s.state.x,z:s.state.z,heading:s.state.heading})),aboard:boating.index};}
function checkWorldSave(value:ReturnType<typeof saveSnapshot>){
  validateSave(value);
  if(value.boats.length!==boating.sims.length || (value.aboard>=0&&(!world.boatsMovable||!value.boatsMovable)) || (value.aboard>=0&&Math.hypot(value.player.x-value.boats[value.aboard].x,value.player.z-value.boats[value.aboard].z)>5) || (value.aboard<0&&!canOccupy(value.player.x,value.player.z,world.colliders)))throw Error("存檔位置或船隻與目前世界不相容");
  if(value.boatsMovable&&world.boatsMovable){
    for(let i=0;i<value.boats.length;i++){
      const pose=value.boats[i],hull=boating.sims[i].state;
      if(!hullClear(pose.x,pose.z,pose.heading,hull.length,hull.beam,[]))throw Error("存檔船隻位於無法航行的水域或碼頭");
    }
  }
  return value;
}
function applySave(value:ReturnType<typeof saveSnapshot>){
  checkWorldSave(value);Object.keys(inventory).forEach(k=>delete inventory[k]);Object.assign(inventory,value.inventory);collected=[...value.collected];
  hour=value.hour;timeAuto.checked=value.timeAuto;showHour();world.setHour(hour);fishing.setTally(value.fishing);
  if(world.boatsMovable)boating.restore(value.boatsMovable?value.boats:boating.sims.map(s=>({x:s.state.x,z:s.state.z,heading:s.state.heading})),value.aboard);world.movePlayer(value.player.x,value.player.z,0);renderInventory();
}
let saveBlocked=false,rawBackupRequested=false;
const saveRecovery=element<HTMLElement>("#save-recovery"),saveReset=element<HTMLButtonElement>("#save-reset");
function downloadText(text:string,filename:string,mime:string){
  const url=URL.createObjectURL(new Blob([text],{type:mime}));
  try{const a=document.createElement("a");a.href=url;a.download=filename;a.click();}
  finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
function saveProgress(){
  if(visualShot||saveBlocked)return;
  try{writeSave(window.localStorage,checkWorldSave(saveSnapshot()));saveMessage.textContent="已保存到這個瀏覽器。";}
  catch{saveMessage.textContent="無法保存進度，請檢查瀏覽器儲存空間或權限。";}
}
if(!visualShot){try{const saved=readSave(window.localStorage);if(saved)applySave(checkWorldSave(saved));}catch{saveBlocked=true;saveRecovery.hidden=false;saveMessage.textContent="現有存檔無法讀取，原始資料已保留。可匯入有效備份，或先下載原始資料再重新開始。";}}
renderInventory();
function setInventory(open:boolean){
  if(open){setMenu(false);releaseLook();input.reset();fishing.release();boating.resetRequest();renderInventory();}
  inventoryOverlay.hidden=!open;inventoryToggle.setAttribute("aria-expanded",String(open));
  if(open)inventoryClose.focus();else inventoryToggle.focus();
}
inventoryToggle.addEventListener("click",()=>setInventory(!inventoryOpen()));inventoryClose.addEventListener("click",()=>setInventory(false));
window.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&inventoryOpen()){e.preventDefault();setInventory(false);return;}
  if(matchesActionKey(e,"KeyB","b")&&!e.repeat&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!isEditingTarget(e.target)){e.preventDefault();setInventory(!inventoryOpen());}
  if(inventoryOpen()&&e.key==="Tab"){
    const controls=[...inventoryOverlay.querySelectorAll<HTMLElement>('button:not([disabled])')];const i=controls.indexOf(document.activeElement as HTMLElement);
    if(controls.length&&(e.shiftKey&&i<=0||!e.shiftKey&&i===controls.length-1)){e.preventDefault();controls[e.shiftKey?controls.length-1:0].focus();}
  }
});
function nearPickup(){return !boating.aboard&&rig.mode!=="vista"?PICKUPS.find(p=>!collected.includes(p.id)&&Math.hypot(world.player.x-p.x,world.player.z-p.z)<2):undefined;}
function takePickup(){const p=nearPickup();if(!p||inventoryOpen()||!settings.hidden)return;if(collect(inventory,collected,p.id)){renderInventory();saveProgress();}}
window.addEventListener("keydown",e=>{if(matchesActionKey(e,"KeyG","g")&&!e.repeat&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!isEditingTarget(e.target))takePickup();});
pickupButton.addEventListener("click",takePickup);
element<HTMLButtonElement>("#save-export").addEventListener("click",()=>{try{downloadText(JSON.stringify(checkWorldSave(saveSnapshot()),null,2),"coastal-wander-save.json","application/json");}catch{saveMessage.textContent="無法匯出存檔。";}});
element<HTMLButtonElement>("#save-import").addEventListener("click",()=>saveFile.click());
saveFile.addEventListener("change",async()=>{
  try{
    const file=saveFile.files?.[0];if(!file)return;
    if(file.size>1000000)throw Error("檔案過大");
    const value=checkWorldSave(JSON.parse(await file.text()));
    const previous=checkWorldSave(saveSnapshot());
    commitImportedSave(window.localStorage,value,previous,applySave);
    saveBlocked=false;rawBackupRequested=false;saveRecovery.hidden=true;saveReset.disabled=true;
    saveMessage.textContent="存檔已匯入。";
  }catch(error){saveMessage.textContent="匯入失敗："+(error instanceof Error?error.message:"無法讀取檔案");}
  finally{saveFile.value="";}
});
element<HTMLButtonElement>("#save-backup-raw").addEventListener("click",()=>{
  if(!saveBlocked)return;
  try{
    const raw=window.localStorage.getItem(SAVE_KEY);
    if(raw===null)throw Error("找不到原始資料");
    downloadText(raw,"coastal-wander-unreadable-save.txt","text/plain");
    rawBackupRequested=true;saveReset.disabled=false;
    saveMessage.textContent="已要求下載原始資料。確認檔案已保存到裝置後，才可重新開始。";
  }catch(error){saveMessage.textContent="無法下載原始資料："+(error instanceof Error?error.message:"未知錯誤");}
});
saveReset.addEventListener("click",()=>{
  if(!saveBlocked||!rawBackupRequested||!window.confirm("確認已保存原始資料？重新開始會覆寫這個瀏覽器裡的損壞存檔。"))return;
  try{
    writeSave(window.localStorage,checkWorldSave(saveSnapshot()));
    saveBlocked=false;rawBackupRequested=false;saveReset.disabled=true;saveRecovery.hidden=true;
    saveMessage.textContent="已重新建立本機存檔。";
  }catch(error){saveMessage.textContent="重新開始失敗，原始資料未覆寫："+(error instanceof Error?error.message:"無法保存");}
});
window.addEventListener("pagehide",saveProgress);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")saveProgress();});
let lastSaveAt=0;
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
canvas.addEventListener("pointerdown",e=>{
  if(inventoryOpen()||!settings.hidden||rig.mode==="quarter"||lookPointer!==null)return;
  // Touch users use the LEFT joystick and drag on the RIGHT of the canvas.
  if(e.pointerType==="touch"&&e.clientX<canvas.clientWidth*.36)return;
  lookPointer=e.pointerId;lastLookX=e.clientX;lastLookY=e.clientY;
  if(e.pointerType!=="mouse")canvas.setPointerCapture(e.pointerId);
  if(e.pointerType==="mouse"&&e.button===0&&rig.mode==="first"&&!lockFailed&&document.pointerLockElement!==canvas&&!lockPending){
    if(typeof canvas.requestPointerLock!=="function"){
      lockFailed=true;updateLookHint();
    }else{
      lockPending=true;
      try{
        const request=canvas.requestPointerLock();
        if(request)void request.catch(()=>{lockPending=false;lockFailed=true;updateLookHint();});
      }catch{lockPending=false;lockFailed=true;updateLookHint();}
    }
  }
  e.preventDefault();
});
window.addEventListener("pointermove",e=>{
  if(inventoryOpen()||rig.mode==="quarter"||!settings.hidden)return;
  if(e.pointerType==="mouse"&&document.pointerLockElement===canvas){rig.look(e.movementX,e.movementY);return;}
  if(e.pointerType==="mouse"&&rig.mode==="first"&&!lockFailed)return;
  if(e.pointerId!==lookPointer)return;
  rig.look(e.clientX-lastLookX,e.clientY-lastLookY);
  lastLookX=e.clientX;lastLookY=e.clientY;
});
const endLook=(e:PointerEvent)=>{if(e.pointerId===lookPointer)lookPointer=null;};
canvas.addEventListener("pointerup",endLook);canvas.addEventListener("pointercancel",endLook);
document.addEventListener("pointerlockchange",()=>{
  lockPending=false;lookPointer=null;
  if(document.pointerLockElement===canvas&&(rig.mode!=="first"||inventoryOpen()||!settings.hidden||!document.hasFocus()))releaseLook();
  updateLookHint();
});
document.addEventListener("pointerlockerror",()=>{lockPending=false;lockFailed=true;updateLookHint();});
window.addEventListener("blur",releaseLook);

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
function update(dt:number,walkingElapsed=dt){
  if(!settings.hidden||inventoryOpen())return;
  const values=input.read();
  if(boating.update(dt,boatDrive??values,elapsed))return;   // boat physics retains its bounded timestep
  if(Math.abs(values.x)+Math.abs(values.y)<.02)return;
  // The render loop awaits GPU drawing, so a 50ms frame clamp alone slows walking
  // 10x at 2 FPS. Catch up from real elapsed time in collision-safe substeps.
  const point=stepWalkingByElapsedTime(world.player,seconds=>rig.movement(values,seconds),world.colliders,walkingElapsed);
  world.movePlayer(point.x,point.z,elapsed);
}
async function start(){
  try{
    const context=canvas.getContext("webgl2",{antialias:false,alpha:false});
    if(!context){mark("unsupported","WebGL2 不可用");return;}
    if(performanceAudit)gpuTimer=createGpuTimer(context);
    const renderer=new THREE.WebGLRenderer({canvas,context,antialias:false,alpha:false,powerPreference:"high-performance"});
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    // Audit switch for phone GPUs: `?rtt=0` makes three.js resolve multisampled targets with a blit instead of the
    // WEBGL_multisampled_render_to_texture extension, to tell whether that extension is behind blank frames.
    if(new URLSearchParams(location.search).get("rtt")==="0"){
      const has=renderer.extensions.has.bind(renderer.extensions);
      renderer.extensions.has=(name:string)=>name==="WEBGL_multisampled_render_to_texture"?false:has(name);
    }
    // Tone mapping, grading and sRGB encoding happen once, in the HD-2D composite pass.
    renderer.toneMapping=THREE.NoToneMapping;
    renderer.toneMappingExposure=1;
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFShadowMap; // r187 removed PCFSoftShadowMap
    const pipeline=createHd2dPipeline({renderer,scene:world.scene,camera:rig.camera,quality:quality.value,prePass:(r:THREE.WebGLRenderer,_s:THREE.Scene,c:THREE.Camera)=>world.prePass(r,c,performanceAudit?profileGpu:undefined),...(performanceAudit?{measure:profileGpu}:{})});
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
    if(performanceAudit)startup.rendererReadyMs=performance.now();
    // A software rasteriser (SwiftShader, llvmpipe) cannot afford the sea's second scene pass: it keeps the analytic
    // sky reflection. `?mirror=1` forces the real reflection back on, for screenshots taken on such a machine.
    const gpuInfo=context.getExtension("WEBGL_debug_renderer_info");
    const gpuName=gpuInfo?String(context.getParameter(gpuInfo.UNMASKED_RENDERER_WEBGL)):"";
    const softwareGpu=/swiftshader|llvmpipe|software/i.test(gpuName)&&new URLSearchParams(location.search).get("mirror")!=="1";
    const applyQuality=()=>world.setShadows(quality.value!=="basic",quality.value as "basic"|"balanced"|"high",softwareGpu);
    applyQuality();
    // A software rasteriser needs seconds per frame, so the adaptive controller (120-frame windows) never reacts in time:
    // render it at a fixed reduced scale (smaller still on High, whose bloom, depth of field and light shafts cost the most).
    // `?mirror=1` and `?fullres=1` keep full resolution (screenshot audits). This also applies to ?visualShot= pages: the
    // browser tests use them, and at full resolution a software rasteriser ran those at the edge of their time limit.
    const lowPower=softwareGpu&&new URLSearchParams(location.search).get("fullres")!=="1";
    const lowScale=()=>quality.value==="high"?.45:.55;
    if(lowPower)host.setRenderScale(lowScale());
    if(visualShot)setCameraMode(visualShot.mode);
    resize();
    observer=new ResizeObserver(resize);observer.observe(canvas);
    quality.addEventListener("change",()=>{
      if(!host)return;
      host.setQuality(quality.value);
      applyQuality();
      if(lowPower)host.setRenderScale(lowScale());
      resize();
    });
    document.addEventListener("visibilitychange",()=>{previous=0;frameMetrics.reset();});
    const reduceMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    async function frame(now:number){
      if(!host||closed)return;
      gpuTimer?.poll();
      const wallDt=previous?Math.max(0,(now-previous)*.001):0;
      const dt=Math.min(.05,wallDt); // movement stays bounded; the in-game clock must not slow with FPS
      if(previous && document.visibilityState==="visible"){
        const frameMs=now-previous;
        if(frameMs>0){
          if(perfSamples&&now>=perfStarted)perfSamples.push({atMs:now-perfStarted,frameMs});
          frameMetrics.record(frameMs);
          if(!visualShot&&!lowPower){
            const next=adaptive.observe(frameMs);
            if(Math.abs(host.scale-next)>.001){host.setRenderScale(next);resize();}
          }
        }
      }
      previous=now;
      elapsed+=dt;
      const measureCpu=!!perfSamples&&now>=perfStarted;
      if(measureCpu&&now-perfStarted-lastResourceAt>=1000){const stats=host.stats();lastResourceAt=now-perfStarted;perfResources.push({atMs:lastResourceAt,geometries:stats.geometries,textures:stats.textures,programs:stats.programs});}
      let cpuTime=measureCpu?performance.now():0;
      update(dt,document.visibilityState==='visible'?wallDt:0);
      const pickup=nearPickup();pickupButton.hidden=!pickup||inventoryOpen()||!settings.hidden;pickupButton.textContent=pickup?"拾取 "+ITEMS[pickup.item as keyof typeof ITEMS].name+" (G)":"";
      if(now-lastSaveAt>5000){lastSaveAt=now;saveProgress();}
      const movementMs=measureCpu?performance.now()-cpuTime:0;
      if(measureCpu)cpuTime=performance.now();
      const camera=rig.tick(dt);
      host.setCamera(camera);
      world.faceCamera(camera);
      const cameraMs=measureCpu?performance.now()-cpuTime:0;
      if(measureCpu)cpuTime=performance.now();
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
      host.setSun(liveSky.sunDir);host.setRayScale(Math.min(1,liveSky.sunRays*liveSky.twilight.value*1.6));   // light shafts only at sunrise and sunset: by day they smeared the bright clouds into radial smoke
      host.setGrade({uExposure:liveSky.exposure});
      if(!reduceMotion || visualShot)world.update(visualShot?.time??elapsed);
      const worldMs=measureCpu?performance.now()-cpuTime:0;
      try{
        if(rig.mode==='quarter')focusPipeline(camera.position.distanceTo(rig.focusPoint),true);
        else focusPipeline(30,false);
        gpuFrameAt=now-perfStarted;gpuDetailFrame=measureCpu&&(gpuFrameIndex++%3!==0);
        if(measureCpu&&!gpuDetailFrame)gpuTimer?.begin(gpuFrameAt);
        let drawing:ReturnType<typeof host.draw>;
        if(measureCpu)cpuTime=performance.now();
        try{drawing=host.draw(elapsed);}finally{if(!gpuDetailFrame)gpuTimer?.end();}
        const drawSubmitMs=measureCpu?performance.now()-cpuTime:0;
        if(measureCpu)perfCpu.push({atMs:gpuFrameAt,movementMs,cameraMs,worldMs,drawSubmitMs});
        const drawn=await drawing;
        if(drawn){diagnostics.frames++;diagnostics.drawCalls=host.stats().calls??0;if(performanceAudit&&startup.firstDrawMs===null)startup.firstDrawMs=performance.now();}
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
      gpuTimer?.dispose();
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
