// Read-only authored camera markers for deterministic visual regression evidence.
// This stays in the single playable game URL (?visualShot=<id>), not a new demo.
// Each shot also fixes the hour of the day, so dawn, noon, dusk and night are reproducible.
const supported=(id,mode,x,z,yaw,pitch,viewport="desktop",hour=9.5)=>
  Object.freeze({id,mode,x,z,yaw,pitch,viewport,hour,time:31,status:"supported"});
export const VISUAL_SHOTS=Object.freeze([
  supported("shot-01-quarter-street","quarter",9,4.2,0,0),
  supported("shot-02-first-wall","first",-12,-4.9,0,-.02),
  supported("shot-03-first-pier","first",20,8,0,-.07),
  supported("shot-04-vista-fjord","vista",9,4.2,-1.18,-.18),
  supported("shot-05-harbour-boats","first",25,8,.548,-.06),
  supported("shot-06-mobile-portrait","quarter",9,4.2,0,0,"mobile"),
  supported("shot-07-dusk","quarter",9,4.2,0,0,"desktop",18.9),
  supported("shot-08-night-moon","first",24,8,-1.5708,.42,"desktop",21.2),
  supported("shot-09-sunrise-mountain","first",14.5,8,1.5708,.10,"desktop",6.3),
  supported("shot-11-grass-quarter","quarter",2,7,0,0),
  supported("shot-12-grass-close","first",-2,8,-1.5708,-.55),
  supported("shot-13-grass-shore","first",5,9,-1.5708,-.42),
  supported("shot-14-grass-west","first",-16,-17,0,-.55),
  supported("shot-15-grass-field","first",-10,18,0,-.55),
  supported("shot-16-grass-coast","first",5,-6,-1.5708,-.55),
  supported("shot-10-sunset-sea","first",24,8,-1.5708,.06,"desktop",17.8),
]);
export function getVisualShot(id){
  return VISUAL_SHOTS.find(shot=>shot.id===id&&shot.status==="supported")??null;
}
