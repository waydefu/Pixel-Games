import * as THREE from "three";
import { createRendererPort } from "../src/rendering/renderer-port.js";
import { configurePixelTexture } from "../src/rendering/pixel-texture.js";
import { createResourceScope } from "../src/rendering/resource-scope.js";
import { createFrameMetrics } from "../src/rendering/frame-metrics.js";
import { createAdaptiveResolutionController } from "../src/rendering/quality.js";

type LabState = "starting" | "ready" | "unsupported" | "lost" | "failed";
const canvas = document.querySelector<HTMLCanvasElement>("#stage")!;
const wrapper = document.querySelector<HTMLElement>(".stage-shell")!;
const status = document.querySelector<HTMLElement>("#render-status")!;
const fallback = document.querySelector<HTMLElement>("#fallback")!;
const metrics = document.querySelector<HTMLElement>("#metrics")!;
const quality = document.querySelector<HTMLSelectElement>("#quality")!;
const diagnostics = { status: "starting" as LabState, frames: 0, drawCalls: 0, bufferWidth: 0, bufferHeight: 0, p95: null as number | null };
Object.defineProperty(window, "__pixelLab", { value: { read: () => ({ ...diagnostics }) }, configurable: false });

const scene = new THREE.Scene();
scene.background = new THREE.Color("#182f42");
scene.fog = new THREE.Fog("#182f42", 20, 46);
const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);
camera.position.set(13, 9, 15);
camera.lookAt(0, 1.2, 0);
const owned = createResourceScope();
function material(color: string, roughness = 0.92) {
  return owned.track(new THREE.MeshStandardMaterial({ color, roughness }));
}
function box(width: number, height: number, depth: number, color: string, x: number, y: number, z: number) {
  const geo = owned.track(new THREE.BoxGeometry(width, height, depth));
  const mesh = new THREE.Mesh(geo, material(color));
  mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true; scene.add(mesh);
  return mesh;
}
const floor = new THREE.Mesh(
  owned.track(new THREE.PlaneGeometry(38, 38)),
  material("#67766d")
);
floor.rotation.x = -Math.PI / 2; floor.receiveShadow=true; scene.add(floor);
const platform = box(12, 0.7, 10, "#a78e70", 0, 0.35, 0);
box(4, 2.8, 3.2, "#e4b890", -2.4, 2.1, -1.6);
const roof=box(4.9, 0.65, 3.8, "#795a60",-2.4,3.85,-1.6);
roof.rotation.z=-0.045;
box(0.5,3.4,0.5,"#3c5057",4.6,2.25,-2.4);
const cap=box(1.5,0.5,1.5,"#d7bd87",4.6,4.2,-2.4);
box(1.1, 1.9, 0.9, "#516f75",2.9,1.25,2.9);
const beacon = new THREE.Mesh(owned.track(new THREE.SphereGeometry(0.44,12,8)),
  owned.track(new THREE.MeshStandardMaterial({color:"#ffe6a4",emissive:"#f7a65b",emissiveIntensity:1.4,roughness:0.4})));
beacon.position.set(4.6,4.7,-2.4);scene.add(beacon);
const sun = new THREE.DirectionalLight("#ffddab",3);
sun.position.set(8,13,4);sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-16;sun.shadow.camera.right=16;
sun.shadow.camera.top=16;sun.shadow.camera.bottom=-16;
scene.add(sun);
scene.add(new THREE.AmbientLight("#afc8dc",0.9));
const spriteCanvas=document.createElement("canvas");
spriteCanvas.width=16;spriteCanvas.height=24;
const ctx=spriteCanvas.getContext("2d")!;
ctx.clearRect(0,0,16,24); ctx.fillStyle="#3c5366";ctx.fillRect(5,4,6,12);
ctx.fillStyle="#e6c59b";ctx.fillRect(6,1,4,5);
ctx.fillStyle="#e5ab72";ctx.fillRect(4,8,8,4);
ctx.fillStyle="#203a4e";ctx.fillRect(5,15,3,7);ctx.fillRect(9,15,3,7);
ctx.fillStyle="#ffdfa4";ctx.fillRect(2,10,2,5);
const spriteTexture=owned.track(new THREE.CanvasTexture(spriteCanvas));
configurePixelTexture(THREE,spriteTexture);
const spriteMat=owned.track(new THREE.MeshStandardMaterial({
  map:spriteTexture,transparent:true,alphaTest:0.5,side:THREE.DoubleSide,roughness:1,
}));
const sprite=new THREE.Mesh(owned.track(new THREE.PlaneGeometry(1.8,2.7)),spriteMat);
sprite.position.set(1.3,2.08,0.7);sprite.castShadow=true;scene.add(sprite);

const frameStats=createFrameMetrics();
const adaptive=createAdaptiveResolutionController();
let host: ReturnType<typeof createRendererPort> | null = null;
let animation=0,previous=0,clock=0,lastUi=0;
function mark(state:LabState,msg:string) {
  diagnostics.status=state;status.textContent=msg;
  if(state==="unsupported"||state==="failed") fallback.hidden=false;
}
function resize() {
  if(!host)return;
  const bounds=wrapper.getBoundingClientRect();
  if(bounds.width<=0||bounds.height<=0)return;
  const next=host.resize(bounds.width,bounds.height,window.devicePixelRatio||1);
  diagnostics.bufferWidth=next.width;diagnostics.bufferHeight=next.height;
}
async function start() {
  try {
    const webgl2=canvas.getContext("webgl2",{antialias:false,alpha:false});
    if(!webgl2) {mark("unsupported","WebGL2 不可用");return;}
    const renderer=new THREE.WebGLRenderer({canvas,context:webgl2,antialias:false,alpha:false,powerPreference:"high-performance"});
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.15;
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    host=createRendererPort({
      renderer,canvas,scene,camera,quality:quality.value,
      resizeCamera:(w:number,h:number)=>{camera.aspect=w/h;camera.updateProjectionMatrix();},
      onStatus:(s:string)=>{
        if(s==="lost")mark("lost","圖形連線中斷，等待恢復");
        if(s==="failed")mark("failed","圖形還原失敗");
        if(s==="ready")mark("ready","WebGL2 已啟動");
      },
    });
    await host.initialize();
    resize();
    const observer=new ResizeObserver(resize);observer.observe(wrapper);
    quality.addEventListener("change",()=>{if(!host)return;host.setQuality(quality.value);resize();});
    document.addEventListener("visibilitychange",()=>{previous=0;frameStats.reset();});
    window.addEventListener("pagehide",()=>{cancelAnimationFrame(animation);observer.disconnect();void host?.dispose();owned.dispose();},{once:true});
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    async function step(now:number) {
      if(!host||host.state==="disposed")return;
      const elapsed=previous?Math.min((now-previous)/1000,0.05):0;
      if(previous&&document.visibilityState==="visible") {
        const interval=now-previous;frameStats.record(interval);
        const next=adaptive.observe(interval);
        if(Math.abs(host.scale-next)>0.001){host.setRenderScale(next);resize();}
      }
      previous=now;
      if(!reduced){clock+=elapsed;beacon.position.y=4.7+Math.sin(clock*1.5)*0.05;sprite.rotation.y=Math.sin(clock*0.4)*0.18;}
      await host.draw();
      diagnostics.frames++;
      const info=host.stats();diagnostics.drawCalls=info.calls??0;
      if(now-lastUi>1200) {
        const summary=frameStats.summary();diagnostics.p95=summary.p95Ms;
        metrics.textContent="Buffer "+diagnostics.bufferWidth+"×"+diagnostics.bufferHeight+
        " · "+diagnostics.drawCalls+" draw calls · p95 "+(summary.p95Ms?.toFixed(1)??"—")+" ms";
        lastUi=now;
      }
      animation=requestAnimationFrame(step);
    }
    animation=requestAnimationFrame(step);
  } catch(error) {
    console.warn("Three.js lab could not initialize:",error);
    mark("unsupported","無法啟動 3D 渲染器");
    try { await host?.dispose(); } catch {}
    owned.dispose();
  }
}
void start();
