// Shared wind across sky clouds, projected ground shade and coastal grasses.
// Immutable parameters keep screenshot time=31 deterministic across G2 shots.
export const CLOUD_WIND=Object.freeze({x:.0026,z:.0011});
export const CLOUD_FIELD_SIZE=128;
const TAU=Math.PI*2;
export function cloudCoverage(u,v){
  if(!Number.isFinite(u)||!Number.isFinite(v))throw new RangeError("Invalid cloud UV");
  // Integer harmonics make the low-resolution procedural mask seamless.
  const s=.46
    +.21*Math.sin(TAU*(2*u+v)+.2)
    +.17*Math.sin(TAU*(u-3*v)+1.1)
    +.10*Math.sin(TAU*(4*u+3*v)+2.4)
    +.07*Math.cos(TAU*(3*u-2*v)+.7);
  const t=Math.min(1,Math.max(0,(s-.38)/.39));
  return t*t*(3-2*t);
}
