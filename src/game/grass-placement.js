import { coastalOutline } from "./coastal-outline.js";
export const PHOTO_GRASS_CELL_SIZE=4;
// Basic quality reduces the expensive near meshes; balanced and high retain approved density.
export function grassQualityDensity(factor){
  const value=Math.max(0,Math.min(1,factor));
  return value<.5?value*value:value;
}
export const GRASS_RESERVED=Object.freeze([
  Object.freeze({x0:-50,x1:-26,z0:-34,z1:-17}),
  Object.freeze({x0:-46,x1:-28,z0:-6,z1:6}),
]);
export const isGrassReserved=(x,z)=>GRASS_RESERVED.some(r=>x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1);

// Shared exclusions follow authored road/landmark footprints without changing collision.
export function grassSuitability(x,z,colliders=[]){
  const shore=coastalOutline(z);
  if(x<shore.grassLeft+.3||x>shore.grassRight-.15||isGrassReserved(x,z))return 0;
  if(x>-29.3&&x<13.2&&Math.abs(z)<3.6)return 0;
  if(((x+5)/6.4)**2+((z-6.1)/5.4)**2<1)return 0;
  if(Math.abs(x-9)<1.95&&z>-1.7&&z<12.1)return 0;
  if(colliders.some(c=>Math.abs(x-c.x)<c.halfX+.32&&Math.abs(z-c.z)<c.halfZ+.32))return 0;
  const coastal=Math.max(0,Math.min(1,(shore.grassRight-x)/3));
  const road=Math.max(0,Math.min(1,(Math.abs(z)-3.6)/2));
  const roadside=x>-29.3&&x<13.2? .3+.7*road:1;
  return (.25+.75*coastal)*roadside;
}

// Join the visual grass strip to the beach edge without a sub-centimetre crack.
export function grassEdgeHeight(t){
  const a=Math.max(0,Math.min(1,(t-.94)/.06));
  return -.187+.003*a*a*(3-2*a);
}
