// Shared authored placements: visual props and overlap guards must read the same data.
export const BOAT_LOCATIONS = Object.freeze([
  Object.freeze({x:18,z:-3.5,scale:.88,seed:6}),
  Object.freeze({x:24,z:15.2,scale:1.22,seed:7}),
]);

// Conservative footprint of the original hull, spars, and a scaled rock.
// The larger-than-visible bounds are intentional to keep waterline silhouettes clear.
export function intersectsBoatFootprint(x,z,rockRadius,boats=BOAT_LOCATIONS){
  if(![x,z,rockRadius].every(Number.isFinite)||rockRadius<0)throw new RangeError("invalid rock footprint");
  return boats.some(boat=>
    Math.abs(x-boat.x)<=2.55*boat.scale+1.2*rockRadius &&
    Math.abs(z-boat.z)<=.98*boat.scale+1.8*rockRadius
  );
}
