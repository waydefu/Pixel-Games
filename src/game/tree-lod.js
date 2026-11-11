/** LOD distances in metres; hysteresis keeps the instanced crown from toggling at the threshold. */
export const TREE_LOD_DISTANCE=Object.freeze({
  basic: Object.freeze({enter:0,exit:0}),
  balanced: Object.freeze({enter:12,exit:17}),
  high: Object.freeze({enter:24,exit:31}),
});
export function useNearTree(distance,wasNear,quality="high"){
  const tier=TREE_LOD_DISTANCE[quality];
  if(!tier||!Number.isFinite(distance)||distance<0)return false;
  if(quality==="basic")return false;
  return distance<=(wasNear?tier.exit:tier.enter);
}
export function treeModelVariant(seed,count=3){
  if(!Number.isInteger(seed)||!Number.isInteger(count)||count<1)
    throw new RangeError("Invalid tree variant seed/count");
  return ((seed-1)%count+count)%count;
}
