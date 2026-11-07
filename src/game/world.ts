import * as THREE from "three";
import { createResourceScope } from "../rendering/resource-scope.js";
import { configurePixelTexture } from "../rendering/pixel-texture.js";
import { createStageKit } from "./kit.js";
import { buildVillage } from "./architecture.js";
import { createVillageMaterial, type VillageKit } from "./village-kit.js";
import { buildEnvironment } from "./environment.js";
import { createTravellerAtlas } from "./art.js";
import { buildFjordLandscape } from "./fjord.js";
import { buildHarbourBeacon, BEACON_SITE } from "./harbour-beacon.js";
import { createNightLights } from "./night-lights.js";
import { createFixtures } from "./torches.js";
import { createLife } from "./life.js";
import { batchStaticScene } from "./batch.js";
import { FOG_DENSITY } from "./environment-state.js";
import { liveSky, applyHour } from "./sky-live.js";
import { createWind, gustAt } from "./wind.js";
import { createWeather } from "./weather.js";
import { createWeatherView } from "./weather-view.js";
import { groundHeight } from "./navigation.js";
import { createCloudField } from "./cloud-field.js";

/**
 * The game's one and only scene. Old test geometry and electric street lamps
 * have been removed; this world is composed from shared original art modules.
 */
export function createCoastalWorld(villageKit:VillageKit|null=null){
  const scope=createResourceScope();
  const scene=new THREE.Scene();
  scene.background=liveSky.fog.clone();
  scene.fog=new THREE.FogExp2(liveSky.fog.clone(),FOG_DENSITY);
  const kit=createStageKit(scene,scope);
  const cloudField=createCloudField(scope);
  const villageAssets=villageKit?{kit:villageKit,material:createVillageMaterial(kit)}:null;
  const lights=createNightLights(scene);
  const fixtures=createFixtures(kit,lights);
  const village=buildVillage(kit,villageAssets,{lights,fixtures});
  const life=createLife(kit,village.chimneys);
  buildHarbourBeacon(kit);
  fixtures.bigFlame(BEACON_SITE.x,14.3,BEACON_SITE.z,2.5,3.9);
  // The beacon fire is the strongest light on the coast: it reaches far across the harbour.
  lights.add({x:BEACON_SITE.x,y:15,z:BEACON_SITE.z,intensity:110,distance:48,color:"#ffcf8a",flicker:.1});
  const environment=buildEnvironment(kit,cloudField,villageAssets,fixtures);
  const fjord=buildFjordLandscape(kit,cloudField);
  // Lit windows, lanterns and the beacon fire: remember their daytime-authored strength, dim them by day.
  const emissiveBase=kit.emissives.map(m=>m.emissiveIntensity);
  let cloudStrength=.24;
  const travellerCanvas=createTravellerAtlas();
  const spriteTexture=scope.track(new THREE.CanvasTexture(travellerCanvas));
  configurePixelTexture(THREE,spriteTexture);
  spriteTexture.repeat.set(.25,.25);
  spriteTexture.offset.set(0,.75);
  spriteTexture.needsUpdate=true;
  const spriteMaterial=scope.track(new THREE.MeshStandardMaterial({
    map:spriteTexture,transparent:true,alphaTest:.4,side:THREE.DoubleSide,
    roughness:1,
    // The sun is usually behind the player; a texture-driven glow keeps the hero readable in shade
    // without flattening the sprite into an unlit cut-out.
    emissive:"#ffffff",emissiveMap:spriteTexture,emissiveIntensity:.62,
  }));
  const avatar=new THREE.Mesh(scope.track(new THREE.PlaneGeometry(2.3,2.3)),spriteMaterial);
  avatar.castShadow=false; // Billboard rectangle is not a physical silhouette.
  avatar.userData.dynamic=true;
  avatar.position.set(9,1.15,4.2);scene.add(avatar);
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
  // Sitting in a boat: the sprite and the eye sit lower than when standing.
  let seatLift=0,seated=false;
  function setSeat(lift:number){seatLift=lift;seated=lift!==0;}
  let lastMovedAt=-10,lastX=9,lastZ=4.2,facing=0;
  const cameraPosition=new THREE.Vector3();
  // Screen-space basis of the active camera: the sprite faces where the player moves ON SCREEN.
  const screenRight=new THREE.Vector3(1,0,0),screenUp=new THREE.Vector3(0,0,-1),viewDir=new THREE.Vector3();
  function movePlayer(x:number,z:number,elapsed:number){
    const deltaX=x-lastX,deltaZ=z-lastZ;
    const moving=Math.hypot(deltaX,deltaZ)>.0001;
    if(moving){
      lastMovedAt=elapsed;
      const across=deltaX*screenRight.x+deltaZ*screenRight.z,along=deltaX*screenUp.x+deltaZ*screenUp.z;
      if(Math.abs(across)>Math.abs(along))facing=across>0?1:3; // right / left on screen
      else facing=along>0?2:0;                                  // away from / toward the camera
    }
    player.x=x;player.z=z;lastX=x;lastZ=z;
    avatar.position.x=x;avatar.position.z=z;
    shadow.position.x=x;shadow.position.z=z;
    shadow.position.y=groundHeight(x,z)-.034;
  }
  function faceCamera(camera:THREE.Camera){
    life.face(camera);
    camera.getWorldPosition(cameraPosition);lastCamera.copy(cameraPosition);
    camera.getWorldDirection(viewDir);
    screenUp.set(viewDir.x,0,viewDir.z);
    if(screenUp.lengthSq()>1e-6){screenUp.normalize();screenRight.set(-screenUp.z,0,screenUp.x);}
    avatar.rotation.y=Math.atan2(cameraPosition.x-player.x,cameraPosition.z-player.z);
  }
  /** Move the whole world to an hour of the day (sun, moon, haze, lights, lit windows). */
  function setHour(hour:number){
    applyHour(hour);
    const dim=1-.5*weather.state.dark,flashFog=weather.state.flash*.5;
    (scene.fog as THREE.FogExp2).color.copy(liveSky.fog).multiplyScalar(dim).addScalar(flashFog*.3);
    (scene.background as THREE.Color).copy(liveSky.fog).multiplyScalar(dim);
    const lamp=.12+.88*liveSky.lampGlow;
    kit.emissives.forEach((m,i)=>{m.emissiveIntensity=emissiveBase[i]*lamp;});
    spriteMaterial.emissiveIntensity=.30+.32*liveSky.dayLight.value;
    cloudField.setStrength(cloudStrength*liveSky.dayLight.value);
    environment.applySky({x:player.x,z:player.z});
  }
  const wind=createWind();
  // Weather: a state machine (or ?weather=storm to fix it) that the sky, light, sea, wind, rain and sound all follow.
  const weatherParam=new URLSearchParams(window.location.search).get("weather");
  const weather=createWeather({lock:weatherParam&&weatherParam!=="auto"?weatherParam:null});
  const weatherView=createWeatherView(scene,scope);
  let lastCamera=new THREE.Vector3(0,2,0);
  let transmit=1;
  function update(time:number){
    weather.update(time);
    const W=weather.state;
    liveSky.weatherDark.value=W.dark;liveSky.weatherFlash.value=W.flash;liveSky.weatherFog.value=W.fog;liveSky.weatherRain.value=W.rain;
    wind.setClimate(W.wind);
    cloudField.setBias((W.cover-.8)*.30);fjord.setCloudAmount(.55+.75*W.cover);
    (scene.fog as THREE.FogExp2).density=FOG_DENSITY*(1+W.fog*3.2+W.rain*.8);
    environment.hemiScale(1-.3*W.dark+W.flash*2.2);
    environment.setSeaWeather(1+.9*W.storm+.35*W.rain,W.dark*(.6+.4*W.storm));
    wind.update(time);
    // sky drift moves faster than the ground drift (see wind.js): the clouds use the aloft drift, the grass and trees the same wind's gust fronts
    liveSky.windDir.value.set(wind.state.dx,wind.state.dz);liveSky.windStrength.value=wind.state.strength;
    cloudField.setWind(wind.state.aloftDriftX,wind.state.aloftDriftZ,wind.state.strength);
    // A cloud between the sun and the traveller takes most of the direct light (and the shadows soften with it).
    const occ=cloudField.sunOcclusion(player.x,player.z,liveSky.sunDir)*liveSky.dayLight.value;
    transmit+=((1-.78*occ)*(1-.85*W.dark)-transmit)*.04;
    environment.setSunTransmit(transmit);
    weatherView.update({dt:.016,time,cam:lastCamera,wind:{x:wind.state.dx,z:wind.state.dz},windStrength:wind.state.strength,rain:W.rain,flash:W.flash,dark:W.dark,bolt:weather.bolt,light:liveSky.dayLight.value});
    lights.update(player,liveSky.lampGlow,time);
    life.update(time);
    fixtures.animate(time,liveSky.lampGlow);
    environment.update(time,player);
    fjord.update(time);
    const walking=time-lastMovedAt<.12;
    const frame=walking?Math.floor(time*8)%4:0;
    spriteTexture.offset.set(frame*.25,(3-facing)*.25);
    avatar.position.y=1.15+groundHeight(player.x,player.z)+seatLift+(walking&&!seated?Math.sin(time*17)*.035:0);
    avatar.scale.x=1+Math.sin(time*1.2)*.002;
  }
  const batching=batchStaticScene(scene,scope);
  scene.userData.batching=batching;
  function setShadows(enabled:boolean,quality:"basic"|"balanced"|"high"="balanced",softwareGpu=false){
    environment.sunlight.castShadow=enabled;
    cloudField.setStrength((quality==="basic"?.2:quality==="high"?.42:.34)*liveSky.dayLight.value);
    fjord.setSkyQuality(quality);
    weatherView.setQuality(quality);
    const density=quality==="basic"?.36:quality==="balanced"?.70:1;
    for(const forest of fjord.forests)forest.setDensity(density);
    environment.setFoliageDensity(density);
    environment.setSeaReflection(quality!=="basic"&&!softwareGpu);   // the mirror render is a second pass: not on the basic tier
    cloudStrength=quality==="basic"?.2:quality==="high"?.42:.34;
  }
  function dispose(){scope.dispose();}
  return Object.freeze({
    scene,scope,colliders:kit.colliders,player,avatar,shadow,
    scenery:fjord.peaks.length,
    movePlayer,faceCamera,update,setShadows,setHour,dispose,setSeat,
    weather,setWeather:(name:string|null)=>weather.setLock(name),takeThunder:(dt:number)=>weather.takeThunder(dt),
    gulls:()=>life.gullPositions(),gustAt:(x:number,z:number)=>gustAt(x,z,wind.state.aloftDriftX,wind.state.aloftDriftZ),
    boats:environment.boats,boatsMovable:environment.boatsMovable,seaBlockers:environment.seaBlockers,setBoatFoam:environment.setBoatFoam,
  });
}
