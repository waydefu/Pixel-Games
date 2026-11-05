import * as THREE from "three";

/**
 * Night lighting without a light per lantern. Every torch, hanging lantern and the beacon registers a LightSpot;
 * a small fixed pool of real point lights follows the spots nearest to the traveller. The pool size never
 * changes (changing the number of lights would recompile every material), unused lights simply sit at zero.
 * A spot that leaves the pool fades out and the slot fades another in, so lights never pop.
 */
export type LightSpot={
  x:number;y:number;z:number;
  /** Candela at full night. */
  intensity:number;
  /** Reach in world units. */
  distance:number;
  color?:string;
  /** 0..1: how much the flame wavers (torches more than lanterns). */
  flicker?:number;
};

export const POOL_SIZE=6;

type Slot={spot:LightSpot|null;level:number};

export function createNightLights(scene:THREE.Scene,count=POOL_SIZE){
  const spots:LightSpot[]=[];
  const lights:THREE.PointLight[]=[];
  const slots:Slot[]=[];
  for(let i=0;i<count;i++){
    const light=new THREE.PointLight("#ffb866",0,10,2);
    light.castShadow=false;
    scene.add(light);lights.push(light);slots.push({spot:null,level:0});
  }
  let previous=0;
  const phase=new WeakMap<LightSpot,number>();
  const score=(s:LightSpot,x:number,z:number)=>Math.hypot(s.x-x,s.z-z)/s.distance;

  function add(spot:LightSpot){
    spots.push(spot);phase.set(spot,spots.length*1.7+spot.x*.31+spot.z*.17);
    return spot;
  }

  /** `glow` is the sky's lamp factor (0 by day, 1 at night). */
  function update(focus:{x:number;z:number},glow:number,time:number){
    const dt=Math.min(.25,Math.max(0,time-previous));previous=time;
    // The spots a viewer could notice: closest relative to their reach.
    const wanted=glow>.01?[...spots].sort((a,b)=>score(a,focus.x,focus.z)-score(b,focus.x,focus.z)).slice(0,count):[];
    const wantedSet=new Set(wanted);
    const held=new Set(slots.map(s=>s.spot));
    for(const slot of slots){
      if(slot.spot&&!wantedSet.has(slot.spot)){
        slot.level=Math.max(0,slot.level-dt*2.2);
        if(slot.level<=0)slot.spot=null;
      }
    }
    for(const slot of slots){
      if(slot.spot)continue;
      const next=wanted.find(s=>!held.has(s));
      if(next){slot.spot=next;slot.level=0;held.add(next);}
    }
    slots.forEach((slot,i)=>{
      const light=lights[i],spot=slot.spot;
      if(!spot){light.intensity=0;return;}
      if(wantedSet.has(spot))slot.level=Math.min(1,slot.level+dt*2.2);
      const p=phase.get(spot)??0,f=spot.flicker??.12;
      const wave=1+f*(.55*Math.sin(time*9.3+p)+.3*Math.sin(time*17.9+p*2.1)+.15*Math.sin(time*31+p*3.7));
      light.position.set(spot.x,spot.y,spot.z);
      light.color.set(spot.color??"#ffb866");
      light.distance=spot.distance;
      light.intensity=spot.intensity*glow*slot.level*wave;
    });
  }
  return {add,update,spots,lights};
}
export type NightLights=ReturnType<typeof createNightLights>;
