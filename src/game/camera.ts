import * as THREE from "three";
import { groundHeight } from "./navigation.js";

export type CameraMode="quarter"|"first"|"vista";
const modes:CameraMode[]=["quarter","first","vista"];
const quarterOffset=new THREE.Vector3(14,19,15);
const quarterRight=new THREE.Vector3(quarterOffset.z,0,-quarterOffset.x).normalize();
const quarterForward=new THREE.Vector3(-quarterOffset.x,0,-quarterOffset.z).normalize();
const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

/** Scene-independent cameras. The eye is collision-bound to the player; panoramic mode is spectator-only. */
export function createCameraRig(player:{x:number;z:number},avatar:THREE.Object3D,shadow:THREE.Object3D){
  const quarter=new THREE.OrthographicCamera(-12,12,8,-8,.1,1300);
  const perspective=new THREE.PerspectiveCamera(64,1,.08,1300);
  let mode:CameraMode="quarter";
  let yaw=-Math.PI/2,pitch=-.08;
  let vistaYaw=-1.18,vistaPitch=-.18;
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
  function movement(input:{x:number;y:number;sprint:boolean},dt:number){
    if(mode==="vista")return {x:0,z:0};
    const speed=(input.sprint?7.1:4.35)*dt;
    if(mode==="quarter")return {
      x:(quarterRight.x*input.x+quarterForward.x*(-input.y))*speed,
      z:(quarterRight.z*input.x+quarterForward.z*(-input.y))*speed,
    };
    const front=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
    const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
    return {
      x:(right.x*input.x-front.x*input.y)*speed,
      z:(right.z*input.x-front.z*input.y)*speed,
    };
  }
  function resize(width:number,height:number){
    if(width<=0||height<=0)return;
    const aspect=width/height;
    const span=aspect<.76?19.5:aspect<1.1?17.6:14.2;
    quarter.left=-span*aspect*.5;quarter.right=span*aspect*.5;
    quarter.top=span*.5;quarter.bottom=-span*.5;quarter.updateProjectionMatrix();
    perspective.aspect=aspect;perspective.updateProjectionMatrix();
  }
  function tick(dt:number){
    if(mode==="quarter"){
      dest.set(player.x,1.3+groundHeight(player.x,player.z),player.z);
      target.lerp(dest,1-Math.exp(-Math.max(0,dt)*6.5));
      quarter.position.copy(target).add(quarterOffset);
      quarter.lookAt(target);
      return quarter;
    }
    if(mode==="first"){
      perspective.position.set(player.x,1.68+groundHeight(player.x,player.z),player.z);
      perspective.rotation.set(pitch,yaw,0,"YXZ");
    }else{
      perspective.position.copy(vistaPosition);
      perspective.rotation.set(vistaPitch,vistaYaw,0,"YXZ");
    }
    return perspective;
  }
  tick(0);
  return {setMode,cycle,look,movement,resize,tick,
    get mode(){return mode;},
    get camera(){return mode==="quarter"?quarter:perspective;},
    get projection(){return mode==="quarter"?"orthographic":"perspective";},
    get yaw(){return mode==="first"?yaw:vistaYaw;},
    get pitch(){return mode==="first"?pitch:vistaPitch;},
  };
}
