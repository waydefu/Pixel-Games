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
  const slope=Math.pow(clamp01(distance),1.12);
  const summit=28+57*ridge(x,z)+24*Math.abs(wave(x,z));
  const small=3.1*(Math.sin(x*.38+z*.22)+Math.sin(x*.24-z*.33));
  return Math.max(0,slope*(summit+small));
}
export function coastX(z) {return 13.3+Math.sin(z*.13)*.65+Math.sin(z*.37)*.22;}
