import * as THREE from "three";
import { createRendererPort } from "../rendering/renderer-port.js";
import { createFrameMetrics } from "../rendering/frame-metrics.js";
import { createAdaptiveResolutionController } from "../rendering/quality.js";
import { createCoastalWorld } from "./world.js";
import { createMovementInput } from "./input.js";
import { stepOnGround } from "./navigation.js";
import { createCameraRig, type CameraMode } from "./camera.js";

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
const viewToggle=element<HTMLButtonElement>("#view-toggle");
const joystick=element<HTMLElement>("#joystick");
const knob=element<HTMLElement>("#joystick-knob");
const hint=element<HTMLElement>("#hint");
const lookHint=element<HTMLElement>("#look-hint");

const world=createCoastalWorld();
const rig=createCameraRig(world.player,world.avatar,world.shadow);
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
const input=createMovementInput(joystick,knob);
const frameMetrics=createFrameMetrics();
const adaptive=createAdaptiveResolutionController({targetMs:16.67,windowSize:120,cooldownWindows:3});
const diagnostics={
  status:"starting" as GameState,
  frames:0,drawCalls:0,bufferWidth:0,bufferHeight:0,p95Ms:null as number|null,
  camera:"quarter" as CameraMode,projection:"orthographic",yaw:0,pitch:0,scenery:world.scenery,
};
Object.defineProperty(window,"__pixelGame",{value:{read:()=>({...diagnostics,player:{...world.player},menuOpen:!settings.hidden})},configurable:false});
let host:ReturnType<typeof createRendererPort>|null=null;
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
viewToggle.addEventListener("click",()=>setCameraMode(rig.cycle()));
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
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.15;
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    host=createRendererPort({
      renderer,canvas,scene:world.scene,camera:rig.camera,quality:quality.value,
      onStatus:(state:string)=>{
        if(state==="ready")mark("ready","自由探索中");
        if(state==="lost")mark("lost","圖形連線中斷，等待恢復");
        if(state==="failed")mark("failed","圖形恢復失敗");
      },
      restoreResources:async()=>{},
    });
    await host.initialize();
    resize();
    observer=new ResizeObserver(resize);observer.observe(canvas);
    quality.addEventListener("change",()=>{
      if(!host)return;
      host.setQuality(quality.value);
      world.setShadows(quality.value!=="basic");
      resize();
    });
    document.addEventListener("visibilitychange",()=>{previous=0;frameMetrics.reset();});
    const reduceMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    async function frame(now:number){
      if(!host||closed)return;
      const dt=previous?Math.min(.05,Math.max(0,(now-previous)*.001)):0;
      if(previous && document.visibilityState==="visible"){
        const frameMs=now-previous;
        if(frameMs>0){
          frameMetrics.record(frameMs);
          const next=adaptive.observe(frameMs);
          if(Math.abs(host.scale-next)>.001){host.setRenderScale(next);resize();}
        }
      }
      previous=now;
      elapsed+=dt;
      update(dt);
      const camera=rig.tick(dt);
      host.setCamera(camera);
      world.faceCamera(camera);
      diagnostics.camera=rig.mode;
      diagnostics.projection=rig.projection;
      diagnostics.yaw=rig.yaw;diagnostics.pitch=rig.pitch;
      if(!reduceMotion)world.update(elapsed);
      try{
        const drawn=await host.draw();
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
