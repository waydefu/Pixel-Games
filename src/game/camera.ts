import * as THREE from "three";
import { groundHeight } from "./navigation.js";
import { planarMove } from "./planar-move.js";

export type CameraMode="quarter"|"first"|"vista";
const modes:CameraMode[]=["quarter","first","vista"];
export type QuarterProjection="perspective"|"orthographic";
// Horizontal bearing shared by both quarter projections, so movement mapping never changes.
const quarterOffset=new THREE.Vector3(14,19,15); // classic orthographic offset
const quarterRight=new THREE.Vector3(quarterOffset.z,0,-quarterOffset.x).normalize();
const quarterForward=new THREE.Vector3(-quarterOffset.x,0,-quarterOffset.z).normalize();
// Diorama lens: a narrow field of view from far away flattens perspective but keeps real depth,
// which is what makes depth of field read as a miniature model.
export const DIORAMA={fov:28,distance:32,elevationDeg:40};
const dioramaOffset=(()=>{
  const e=DIORAMA.elevationDeg*Math.PI/180,flat=Math.cos(e)*DIORAMA.distance,h=new THREE.Vector3(quarterOffset.x,0,quarterOffset.z).normalize();
  return new THREE.Vector3(h.x*flat,Math.sin(e)*DIORAMA.distance,h.z*flat);
})();
const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

/** Scene-independent cameras. The eye is collision-bound to the player; panoramic mode is spectator-only. */
export function createCameraRig(player:{x:number;z:number},avatar:THREE.Object3D,shadow:THREE.Object3D){
  const quarterOrtho=new THREE.OrthographicCamera(-12,12,8,-8,.1,1300);
  const quarterPersp=new THREE.PerspectiveCamera(DIORAMA.fov,1,.1,1300);
  let quarterProjection:QuarterProjection="perspective";
  const quarterCamera=()=>quarterProjection==="perspective"?quarterPersp:quarterOrtho;
  const perspective=new THREE.PerspectiveCamera(64,1,.08,1300);
  let mode:CameraMode="quarter";
  let yaw=-Math.PI/2,pitch=-.08;
  let vistaYaw=-1.18,vistaPitch=-.18;
  let eyeLift=0; // negative while sitting in a boat
  const target=new THREE.Vector3(player.x,1.25,player.z);
  const dest=new THREE.Vector3();
  const vistaPosition=new THREE.Vector3(-36,30,32);
  function setMode(next:CameraMode){
    if(!modes.includes(next))throw new RangeError("Unknown camera mode");
    mode=next;
    avatar.visible=next!=="first";
    shadow.visible=next!=="first";
  }
  function cycle(){setMode(modes[(modes.indexOf(mode)+1)%modes.length]);return mode;}
  function look(dx:number,dy:number){
    if(mode==="quarter" || !Number.isFinite(dx) || !Number.isFinite(dy))return;
    if(mode==="first"){
      yaw-=dx*.0036;pitch=clamp(pitch-dy*.0034,-1.22,1.22);
    }else{
      vistaYaw-=dx*.0036;vistaPitch=clamp(vistaPitch-dy*.0032,-.95,.45);
    }
  }
  // Used only by opt-in visual-audit shots; ordinary player look still uses drag input.
  function setAuditAngles(nextYaw:number,nextPitch:number){
    if(!Number.isFinite(nextYaw)||!Number.isFinite(nextPitch))throw new RangeError("invalid audit angles");
    if(mode==="first"){yaw=nextYaw;pitch=clamp(nextPitch,-1.22,1.22);}
    else if(mode==="vista"){vistaYaw=nextYaw;vistaPitch=clamp(nextPitch,-.95,.45);}
  }
  function movement(input:{x:number;y:number;sprint:boolean},dt:number){
    if(mode==="vista")return {x:0,z:0};
    const speed=(input.sprint?7.1:4.35)*dt;
    if(mode==="quarter")return {
      x:(quarterRight.x*input.x+quarterForward.x*(-input.y))*speed,
      z:(quarterRight.z*input.x+quarterForward.z*(-input.y))*speed,
    };
    return planarMove(yaw,input.x,input.y,speed);
  }
  function resize(width:number,height:number){
    if(width<=0||height<=0)return;
    const aspect=width/height;
    const span=aspect<.76?19.5:aspect<1.1?17.6:14.2;
    quarterOrtho.left=-span*aspect*.5;quarterOrtho.right=span*aspect*.5;
    quarterOrtho.top=span*.5;quarterOrtho.bottom=-span*.5;quarterOrtho.updateProjectionMatrix();
    quarterPersp.aspect=aspect;
    // Tall portrait screens need a wider lens or the village is cropped.
    quarterPersp.fov=aspect<.76?DIORAMA.fov*1.55:aspect<1.1?DIORAMA.fov*1.28:DIORAMA.fov;
    quarterPersp.updateProjectionMatrix();
    perspective.aspect=aspect;perspective.updateProjectionMatrix();
  }
  function tick(dt:number){
    if(mode==="quarter"){
      dest.set(player.x,1.3+groundHeight(player.x,player.z),player.z);
      target.lerp(dest,1-Math.exp(-Math.max(0,dt)*6.5));
      const camera=quarterCamera();
      camera.position.copy(target).add(quarterProjection==="perspective"?dioramaOffset:quarterOffset);
      camera.lookAt(target);
      return camera;
    }
    if(mode==="first"){
      perspective.position.set(player.x,1.68+eyeLift+groundHeight(player.x,player.z),player.z);
      perspective.rotation.set(pitch,yaw,0,"YXZ");
    }else{
      perspective.position.copy(vistaPosition);
      perspective.rotation.set(vistaPitch,vistaYaw,0,"YXZ");
    }
    return perspective;
  }
  /** Rotate the first-person view with a vehicle (radians, positive = counter-clockwise from above). */
  function turn(delta:number){if(Number.isFinite(delta))yaw+=delta;}
  function setEyeLift(v:number){eyeLift=Number.isFinite(v)?v:0;}
  /** Face the view along a world direction (cos h, sin h) on the x/z plane. */
  function faceHeading(h:number){if(Number.isFinite(h))yaw=-h-Math.PI/2;}
  tick(0);
  return {setMode,cycle,look,setAuditAngles,movement,resize,tick,turn,setEyeLift,faceHeading,
    get mode(){return mode;},
    get focusPoint(){return target;},
    get camera(){return mode==="quarter"?quarterCamera():perspective;},
    get projection(){return mode==="quarter"?quarterProjection:"perspective";},
    get quarterProjection(){return quarterProjection;},
    setQuarterProjection(next:QuarterProjection){
      if(next!=="perspective"&&next!=="orthographic")throw new RangeError("Unknown quarter projection");
      quarterProjection=next;
    },
    get yaw(){return mode==="first"?yaw:vistaYaw;},
    get pitch(){return mode==="first"?pitch:vistaPitch;},
  };
}
