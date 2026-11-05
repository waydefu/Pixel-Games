import { coastX } from "./terrain-profile.js";
export function coastalOutline(z){
  if(!Number.isFinite(z))throw new RangeError("invalid shore coordinate");
  const t=Math.min(1,Math.max(0,(Math.abs(z)-35)/12));
  const ease=t*t*(3-2*t);
  const coast=coastX(z)-8*ease;
  const beachWidth=5.1*(1-ease);
  const grassRight=coast-beachWidth;
  const inland=-51.0+Math.sin(z*.13)*1.8+Math.sin(z*.41)*.48;
  const grassLeft=inland*(1-ease)+grassRight*ease;
  return Object.freeze({grassLeft,grassRight,coast,ease});
}
