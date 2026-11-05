// Walkability is gameplay state, independent of decorative Three.js meshes.
// Bounds follow the actual authored terrain and the navigable area of the pier.
export const WALK_BOUNDS = Object.freeze({ minX: -40, maxX: 28.85, minZ: -33, maxZ: 33 });
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
  if (x < WALK_BOUNDS.minX || x > WALK_BOUNDS.maxX ||
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
