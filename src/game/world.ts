import * as THREE from "three";
import { createResourceScope } from "../rendering/resource-scope.js";
import { configurePixelTexture } from "../rendering/pixel-texture.js";
import { createStageKit } from "./kit.js";
import { buildVillage } from "./architecture.js";
import { buildEnvironment } from "./environment.js";
import { createTravellerAtlas } from "./art.js";
import { buildFjordLandscape } from "./fjord.js";
import { buildHarbourBeacon } from "./harbour-beacon.js";
import { batchStaticScene } from "./batch.js";
import { HORIZON_LINEAR, FOG_DENSITY } from "./environment-state.js";
import { groundHeight } from "./navigation.js";

/**
 * The game's one and only scene. Old test geometry and electric street lamps
 * have been removed; this world is composed from shared original art modules.
 */
export function createCoastalWorld(){
  const scope=createResourceScope();
  const scene=new THREE.Scene();
  const horizon=new THREE.Color().setRGB(HORIZON_LINEAR.r,HORIZON_LINEAR.g,HORIZON_LINEAR.b);
  scene.background=horizon.clone();
  scene.fog=new THREE.FogExp2(horizon.clone(),FOG_DENSITY);
  const kit=createStageKit(scene,scope);
  buildVillage(kit);
  buildHarbourBeacon(kit);
  const environment=buildEnvironment(kit);
  const fjord=buildFjordLandscape(kit);
  const travellerCanvas=createTravellerAtlas();
  const spriteTexture=scope.track(new THREE.CanvasTexture(travellerCanvas));
  configurePixelTexture(THREE,spriteTexture);
  spriteTexture.repeat.set(.25,.25);
  spriteTexture.offset.set(0,.75);
  spriteTexture.needsUpdate=true;
  const spriteMaterial=scope.track(new THREE.MeshStandardMaterial({
    map:spriteTexture,transparent:true,alphaTest:.4,side:THREE.DoubleSide,
    roughness:1,emissive:"#293a3e",emissiveIntensity:.15,
  }));
  const avatar=new THREE.Mesh(scope.track(new THREE.PlaneGeometry(1.62,2.17)),spriteMaterial);
  avatar.castShadow=false; // Billboard rectangle is not a physical silhouette.
  avatar.userData.dynamic=true;
  avatar.position.set(9,1.1,4.2);scene.add(avatar);
  const shadowCanvas=document.createElement("canvas");
  shadowCanvas.width=shadowCanvas.height=64;
  const ctx=shadowCanvas.getContext("2d");
  if(!ctx)throw new Error("Shadow Canvas unavailable");
  const gradient=ctx.createRadialGradient(32,32,3,32,32,31);
  gradient.addColorStop(0,"rgba(18,24,23,0.47)");
  gradient.addColorStop(.56,"rgba(25,29,26,0.25)");
  gradient.addColorStop(1,"rgba(25,29,26,0)");
  ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const shadowTexture=scope.track(new THREE.CanvasTexture(shadowCanvas));
  shadowTexture.colorSpace=THREE.SRGBColorSpace;
  const shadowMaterial=scope.track(new THREE.MeshBasicMaterial({
    map:shadowTexture,transparent:true,opacity:.7,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,
  }));
  const shadow=new THREE.Mesh(scope.track(new THREE.PlaneGeometry(1.8,1.15)),shadowMaterial);
  shadow.rotation.x=-Math.PI/2;shadow.position.set(9,-.034,4.2);
  shadow.userData.dynamic=true;
  scene.add(shadow);
  const player={x:9,z:4.2};
  let lastMovedAt=-10,lastX=9,lastZ=4.2,facing=0;
  const cameraPosition=new THREE.Vector3();
  function movePlayer(x:number,z:number,elapsed:number){
    const deltaX=x-lastX,deltaZ=z-lastZ;
    const moving=Math.hypot(deltaX,deltaZ)>.0001;
    if(moving){
      lastMovedAt=elapsed;
      if(Math.abs(deltaX)>Math.abs(deltaZ))facing=deltaX>0?1:3;
      else facing=deltaZ>0?0:2;
    }
    player.x=x;player.z=z;lastX=x;lastZ=z;
    avatar.position.x=x;avatar.position.z=z;
    shadow.position.x=x;shadow.position.z=z;
    shadow.position.y=groundHeight(x,z)-.034;
  }
  function faceCamera(camera:THREE.Camera){
    camera.getWorldPosition(cameraPosition);
    avatar.rotation.y=Math.atan2(cameraPosition.x-player.x,cameraPosition.z-player.z);
  }
  function update(time:number){
    environment.update(time,player);
    fjord.update(time);
    const walking=time-lastMovedAt<.12;
    const frame=walking?Math.floor(time*8)%4:0;
    spriteTexture.offset.set(frame*.25,(3-facing)*.25);
    avatar.position.y=1.10+groundHeight(player.x,player.z)+(walking?Math.sin(time*17)*.035:0);
    avatar.scale.x=1+Math.sin(time*1.2)*.002;
  }
  const batching=batchStaticScene(scene,scope);
  scene.userData.batching=batching;
  function setShadows(enabled:boolean){environment.sunlight.castShadow=enabled;}
  function dispose(){scope.dispose();}
  return Object.freeze({
    scene,colliders:kit.colliders,player,avatar,shadow,
    scenery:fjord.peaks.length,
    movePlayer,faceCamera,update,setShadows,dispose,
  });
}
