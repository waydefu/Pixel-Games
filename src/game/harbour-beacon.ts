import * as THREE from "three";
import type { StageKit } from "./kit.js";

/**
 * The village's original medieval coastal watchtower. Geometry is intentionally
 * modular and static so the existing static-material batcher can merge pieces.
 * Its lantern is emissive (ready for G4 selective bloom), not a heavy point-light.
 */
export const BEACON_SITE = Object.freeze({x:-4,z:-21,radius:3.60,height:19.73});

export function buildHarbourBeacon(k:StageKit){
  const {x,z}=BEACON_SITE;
  const foundation=k.pattern("stone",21,3,2);
  const wall=k.pattern("stone",22,3,6);
  const mortar=k.solid("#626864");
  const edging=k.solid("#adb0a0");
  const trim=k.solid("#514739");
  const copper=k.solid("#506e70",.68);
  const roof=k.pattern("roof-blue",23,2,2);
  const glow=k.solid("#ffdf9a",.56,"#e8a85d");
  // HDR signal above bloom threshold: the lantern glows, never the whole tower.
  glow.emissiveIntensity=3.2;
  const glass=k.solid("#353d42",.45);

  const podium=k.put(new THREE.CylinderGeometry(3.1,3.5,.86,12),foundation,x,.36,z);
  podium.name="coastal-beacon-podium";
  const plinth=k.put(new THREE.CylinderGeometry(2.65,3.05,.58,12),edging,x,.83,z);
  plinth.name="coastal-beacon-plinth";
  // A tapered masonry shaft with several readable courses, not a tall box.
  const shaft=k.put(new THREE.CylinderGeometry(1.55,2.31,10.9,12,5),wall,x,6.35,z);
  shaft.name="coastal-beacon-stone-shaft";
  for(const [y,r] of [[2.1,2.22],[5.15,2.03],[8.2,1.82],[11.68,1.66]]){
    const ring=k.put(new THREE.CylinderGeometry(r,r+.04,.16,12),edging,x,y,z,false);
    ring.name="coastal-beacon-stone-course";
  }
  // Buttresses emphasize the taper with only four chunky structural ribs.
  for(const angle of [Math.PI/4,Math.PI*3/4,Math.PI*5/4,Math.PI*7/4]){
    const dx=Math.cos(angle),dz=Math.sin(angle);
    k.segment(new THREE.Vector3(x+dx*2.36,1.10,z+dz*2.36),
      new THREE.Vector3(x+dx*1.61,11.7,z+dz*1.61),.21,mortar,6);
  }
  // Four deep-looking dark window slots set on the octagonal middle levels.
  for(const angle of [0,Math.PI/2,Math.PI,3*Math.PI/2]){
    const dx=Math.cos(angle),dz=Math.sin(angle);
    for(const y of [4.6,8.2]){
      const pane=k.block(.63,1.16,.10,glass,x+dx*1.97,y,z+dz*1.97,false);
      // Front of the aperture must be tangent to the circular shaft.
      pane.rotation.y=Math.PI/2-angle;
      k.block(.24,1.24,.22,edging,x+dx*2.02+dz*.40,y,z+dz*2.02-dx*.40,false);
    }
  }
  // Wide watch platform, battlements and a visibly open lantern gallery.
  k.put(new THREE.CylinderGeometry(2.48,2.45,.48,12),foundation,x,12.03,z);
  k.put(new THREE.CylinderGeometry(2.37,2.37,.18,12),edging,x,12.38,z,false);
  for(let i=0;i<12;i++){
    const angle=i*Math.PI/6;
    const dx=Math.cos(angle),dz=Math.sin(angle);
    if(i%3!==1){
      const merlon=k.block(.87,.92,.52,wall,x+dx*2.20,13.0,z+dz*2.20,false);
      merlon.rotation.y=-angle;
    }
  }
  // The historic signal brazier is the focal warm emitter for future G4 bloom.
  const lanternBase=k.put(new THREE.CylinderGeometry(1.52,1.73,.44,10),copper,x,13.56,z);
  lanternBase.name="coastal-beacon-lantern-base";
  const fire=k.put(new THREE.CylinderGeometry(.68,1.12,2.5,9),glow,x,15.05,z,false);
  fire.name="coastal-beacon-signal";
  for(let i=0;i<8;i++){
    const angle=i*Math.PI/4;
    const dx=Math.cos(angle),dz=Math.sin(angle);
    k.column(.085,3.05,trim,x+dx*1.37,15.04,z+dz*1.37,6);
  }
  k.put(new THREE.CylinderGeometry(1.98,1.77,.22,12),edging,x,16.83,z,false);
  const cap=k.put(new THREE.ConeGeometry(2.29,2.85,12),roof,x,18.30,z);
  cap.name="coastal-beacon-roof";
  // Walkable world props remain solid. Do not create new gameplay entry or path.
  k.collider(x,z,BEACON_SITE.radius,BEACON_SITE.radius);
  return {shaft,fire,cap,podium};
}
