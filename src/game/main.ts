import * as THREE from "three";
import { createRendererPort } from "../rendering/renderer-port.js";
import { createFrameMetrics } from "../rendering/frame-metrics.js";
import { createAdaptiveResolutionController } from "../rendering/quality.js";
import { createCoastalWorld } from "./world.js";
import { createMovementInput } from "./input.js";
import { stepOnGround } from "./navigation.js";

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
const joystick=element<HTMLElement>("#joystick");
const knob=element<HTMLElement>("#joystick-knob");

const world=createCoastalWorld();
const camera=new THREE.OrthographicCamera(-12,12,8,-8,.1,160);
// Three-quarter fixed camera: ~45° azimuth and elevated view of world surfaces.
const offset=new THREE.Vector3(14,19,15);
const cameraTarget=new THREE.Vector3(world.player.x,1.3,world.player.z);
camera.position.copy(cameraTarget).add(offset);
camera.lookAt(cameraTarget);
const right=new THREE.Vector3(offset.z,0,-offset.x).normalize();
const away=new THREE.Vector3(-offset.x,0,-offset.z).normalize();
const input=createMovementInput(joystick,knob);
const frameMetrics=createFrameMetrics();
const adaptive=createAdaptiveResolutionController({targetMs:16.67,windowSize:120,cooldownWindows:3});
const diagnostics={
  status:"starting" as GameState,
  frames:0,drawCalls:0,bufferWidth:0,bufferHeight:0,p95Ms:null as number|null,
  camera:"quarter-view",projection:"orthographic",
};
Object.defineProperty(window,"__pixelGame",{value:{read:()=>({...diagnostics,player:{...world.player},menuOpen:!settings.hidden})},configurable:false});
let host:ReturnType<typeof createRendererPort>|null=null;
let animation=0,previous=0,elapsed=0,uiTime=0,closed=false,observer:ResizeObserver|null=null;
function mark(state:GameState,message:string){
  diagnostics.status=state;
  status.textContent=message;
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
});
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
  const aspect=width/height;
  const span=aspect<.76?19.5:aspect<1.1?17.6:14.2;
  camera.left=-span*aspect*.5;camera.right=span*aspect*.5;
  camera.top=span*.5;camera.bottom=-span*.5;
  camera.updateProjectionMatrix();
  const buffer=host.resize(width,height,window.devicePixelRatio||1);
  diagnostics.bufferWidth=buffer.width;diagnostics.bufferHeight=buffer.height;
}
function update(dt:number){
  if(!settings.hidden)return;
  const values=input.read();
  if(Math.abs(values.x)+Math.abs(values.y)<.02)return;
  const speed=values.sprint?7.1:4.35;
  const dx=(right.x*values.x-away.x*values.y)*speed*dt;
  const dz=(right.z*values.x-away.z*values.y)*speed*dt;
  const point=stepOnGround(world.player,{x:dx,z:dz},world.colliders);
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
      renderer,canvas,scene:world.scene,camera,quality:quality.value,
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
      const nextTarget=new THREE.Vector3(world.player.x,1.3,world.player.z);
      cameraTarget.lerp(nextTarget,1-Math.exp(-dt*6.5));
      camera.position.copy(cameraTarget).add(offset);
      camera.lookAt(cameraTarget);
      world.faceCamera(camera);
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
