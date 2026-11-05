export const clamp01 = value => Math.min(1,Math.max(0,value));
const wave = (x,z) => Math.sin(x*.083+Math.sin(z*.039)*1.7)*.42+Math.sin(z*.065-x*.051)*.27+Math.sin(x*.17+z*.12)*.12+Math.sin(z*.215-x*.096)*.07;
const ridge = (x,z) => Math.pow(Math.abs(Math.sin(z*.039+x*.026+wave(x,z)*.8)),.66);
export function fjordHeight(x,z,region) {
  if(!Number.isFinite(x)||!Number.isFinite(z))return 0;
  let distance;
  switch(region){
    case "mainland":distance=(-x-44)/85;break;
    case "east":distance=(x-(80+12*Math.sin(z*.025)+6*Math.sin(z*.083)))/85;break;
    case "north":distance=(z-(92+14*Math.sin(x*.027)+5*Math.sin(x*.081)))/78;break;
    case "south":distance=((-z)-(90+13*Math.sin(x*.031)+5*Math.sin(x*.072)))/82;break;
    default:throw new RangeError("Unknown terrain region");
  }
  const approach=clamp01(distance);
  // Rounded piedmont avoids the old nearly vertical wall immediately outside town.
  const slope=Math.pow(approach,1.60)*(1.12-.12*approach);
  const summit=24+56*ridge(x,z)+18*Math.abs(wave(x,z));
  const small=2.9*(Math.sin(x*.38+z*.22)+Math.sin(x*.24-z*.33));
  let height=Math.max(0,slope*(summit+small));
  if(region==="east"){
    if(x<72)return height; // Outside authored eastern terrain, do not excavate the sea bed.
    // A sea channel bends between the ridges instead of a solid mountain wall
    // blocking the entire horizon. Its bed stays UNDER the water plane.
    const channelZ=8-(x-72)*.34+6*Math.sin(x*.028);
    const d=Math.abs(z-channelZ);
    const bank=clamp01((d-29)/34);
    const raisedBank=bank*bank*(3-2*bank);
    const seabed=-5; // No raised green strip blocking the fjord channel.
    height=height*raisedBank+seabed*(1-raisedBank);
  }
  return height;
}
export function coastX(z) {return 13.3+Math.sin(z*.13)*.65+Math.sin(z*.37)*.22;}

// Geometry-aligned height for decorative forest instances. Keep this displacement
// identical to the highland crest modification in fjord.ts; no floating trees.
export function fjordSurfaceHeight(x,z,region){
  const base=fjordHeight(x,z,region)-.16;
  const exposure=Math.min(1.75,Math.max(0,(base-9)/30));
  const crack=Math.sin(x*.145+Math.sin(z*.046)*2.1)*Math.cos(z*.17-x*.033);
  return base+exposure*crack;
}
