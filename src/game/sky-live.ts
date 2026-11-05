import * as THREE from "three";
import { skyAt, HOUR_START } from "./time-of-day.js";

/**
 * Live sky state shared by every renderer module. Shaders hold references to these exact Vector3/Color
 * instances (never copies), so `applyHour()` updates the sky, clouds, sea, haze, lights and exposure in one
 * place and every consumer sees it on the next frame. Colours are linear-light.
 */
const color=()=>new THREE.Color();
export const liveSky={
  sunDir:new THREE.Vector3(),moonDir:new THREE.Vector3(),
  zenith:color(),mid:color(),horizon:color(),fog:color(),sunColor:color(),
  hemiSky:color(),hemiGround:color(),moonColor:color(),cloudLit:color(),cloudShade:color(),
  // scalar uniforms are {value} objects so shaders can share them directly
  night:{value:0},dayLight:{value:1},lampGlowU:{value:0},starAlpha:{value:0},moonStrength:{value:0},
  sunIntensity:0,hemiIntensity:1,moonIntensity:0,exposure:1,sunRays:1,lampGlow:0,hour:HOUR_START,elevation:30,
};
const set=(c:THREE.Color,v:number[])=>c.setRGB(v[0],v[1],v[2]);
export function applyHour(hour:number){
  const s=skyAt(hour);
  liveSky.sunDir.set(s.sunDir.x,s.sunDir.y,s.sunDir.z);
  liveSky.moonDir.set(s.moonDir.x,s.moonDir.y,s.moonDir.z);
  set(liveSky.zenith,s.zenith);set(liveSky.mid,s.mid);set(liveSky.horizon,s.horizon);set(liveSky.fog,s.fog);
  set(liveSky.sunColor,s.sunColor);set(liveSky.hemiSky,s.hemiSky);set(liveSky.hemiGround,s.hemiGround);
  set(liveSky.moonColor,s.moonColor);set(liveSky.cloudLit,s.cloudLit);set(liveSky.cloudShade,s.cloudShade);
  liveSky.night.value=s.night;liveSky.dayLight.value=s.dayLight;liveSky.starAlpha.value=s.starAlpha;
  liveSky.moonStrength.value=.25+.75*s.night;
  liveSky.lampGlowU.value=s.lampGlow;
  liveSky.sunIntensity=s.sunIntensity;liveSky.hemiIntensity=s.hemiIntensity;liveSky.moonIntensity=s.moonIntensity;
  liveSky.exposure=s.exposure;liveSky.sunRays=s.sunRays;liveSky.lampGlow=s.lampGlow;
  liveSky.hour=s.hour;liveSky.elevation=s.elevation;
  return s;
}
applyHour(HOUR_START);
