// Read-only authored camera markers for deterministic visual regression evidence.
// This stays in the single playable game URL (?visualShot=<id>), not a new demo.
// Until a time-of-day system exists, dusk/night shots are explicitly unsupported.
const supported=(id,mode,x,z,yaw,pitch,viewport="desktop")=>
  Object.freeze({id,mode,x,z,yaw,pitch,viewport,time:31,status:"supported"});
const unavailable=(id,reason)=>Object.freeze({id,status:"unsupported",reason});
export const VISUAL_SHOTS=Object.freeze([
  supported("shot-01-quarter-street","quarter",9,4.2,0,0),
  supported("shot-02-first-wall","first",-12,-4.9,0,-.02),
  supported("shot-03-first-pier","first",20,8,0,-.07),
  supported("shot-04-vista-fjord","vista",9,4.2,-1.18,-.18),
  supported("shot-05-harbour-boats","first",25,8,.548,-.06),
  supported("shot-06-mobile-portrait","quarter",9,4.2,0,0,"mobile"),
  unavailable("shot-07-dusk","no day/night environment state yet"),
  unavailable("shot-08-night","no night lighting or exposure state yet"),
]);
export function getVisualShot(id){
  return VISUAL_SHOTS.find(shot=>shot.id===id&&shot.status==="supported")??null;
}
