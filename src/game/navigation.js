// Walkability is gameplay state, independent of decorative Three.js meshes.
// Bounds follow the actual authored terrain and the navigable area of the pier.
export const WALK_BOUNDS = Object.freeze({ minX: -40, maxX: 28.85, minZ: -33, maxZ: 33 });
// The farm predates the western walking limit and extends beyond it. Share its
// footprint with the fence so the exception cannot drift away from the scene.
export const FARM_BOUNDS = Object.freeze({ x0: -49, x1: -29, z0: -33, z1: -18 });
export const PIER = Object.freeze({ minX: 13.5, maxX: 28.85, minZ: 6.0, maxZ: 10.0 });
const PLAYER_RADIUS = 0.36;
// The wharf's plank top is y=.275 + .035/2. Treat the walk surface,
// player sprite, ground shadow and first-person eye as one height model.
export function groundHeight(x,z){
  if(!Number.isFinite(x)||!Number.isFinite(z))throw new RangeError("invalid ground position");
  return x>=PIER.minX&&x<=PIER.maxX&&z>=PIER.minZ&&z<=PIER.maxZ ? .2925 : 0;
}
export function canOccupy(x, z, colliders = []) {
  if (![x,z].every(Number.isFinite)) return false;
  const inFarm = x >= FARM_BOUNDS.x0 && x <= FARM_BOUNDS.x1 && z >= FARM_BOUNDS.z0 && z <= FARM_BOUNDS.z1;
  if ((x < WALK_BOUNDS.minX && !inFarm) || x > WALK_BOUNDS.maxX ||
      z < WALK_BOUNDS.minZ || z > WALK_BOUNDS.maxZ) return false;
  // Ocean begins east of the beach. Only the pier is walkable there.
  if (x > PIER.minX && !(z >= PIER.minZ && z <= PIER.maxZ && x <= PIER.maxX)) return false;
  return !colliders.some(c => {
    const dx=Math.max(Math.abs(x-c.x)-(c.halfX??1),0);
    const dz=Math.max(Math.abs(z-c.z)-(c.halfZ??1),0);
    return dx*dx+dz*dz < PLAYER_RADIUS*PLAYER_RADIUS;
  });
}
export function stepOnGround(position, delta, colliders = []) {
  const proposedX=position.x+delta.x,proposedZ=position.z+delta.z;
  let x=position.x,z=position.z;
  if (canOccupy(proposedX,z,colliders)) x=proposedX;
  if (canOccupy(x,proposedZ,colliders)) z=proposedZ;
  return {x,z};
}

// Movement advances by real elapsed time even when GPU rendering takes >50ms.
// Simulate small collision-safe steps, but cap catch-up to 0.5s to avoid jumping
// across the map after a suspended tab or a multi-second graphics stall.
export const MAX_WALK_CATCHUP_SECONDS = 0.5;
export const WALK_COLLISION_STEP_SECONDS = 0.05;
/**
 * @param {{x:number,z:number}} position
 * @param {(seconds:number)=>{x:number,z:number}} movement
 * @param {Array<{x:number,z:number,halfX?:number,halfZ?:number}>} colliders
 * @param {number} elapsedSeconds
 */
export function stepWalkingByElapsedTime(position, movement, colliders, elapsedSeconds) {
  let remaining=Number.isFinite(elapsedSeconds)?Math.max(0,Math.min(elapsedSeconds,MAX_WALK_CATCHUP_SECONDS)):0;
  let next={x:position.x,z:position.z};
  while(remaining>1e-7){
    const seconds=Math.min(remaining,WALK_COLLISION_STEP_SECONDS);
    next=stepOnGround(next,movement(seconds),colliders);
    remaining-=seconds;
  }
  return next;
}
