// Pure movement geometry; world objects have independently authored collision bounds.
// Deliberately keep a wide main path and clear spawn, avoiding box corner traps.
export function canOccupy(x, z, colliders = []) {
  if (![x,z].every(Number.isFinite)) return false;
  if (x < -25 || x > 30 || z < -25 || z > 25) return false;
  // Coast: ocean is off-limits except for the walkable wooden jetty.
  if (x > 13 && !(z > 5.7 && z < 10.3 && x < 28.8)) return false;
  const radius = 0.36;
  return !colliders.some(c => {
    const dx=Math.max(Math.abs(x-c.x)-(c.halfX??1),0);
    const dz=Math.max(Math.abs(z-c.z)-(c.halfZ??1),0);
    return dx*dx+dz*dz < radius*radius;
  });
}
export function stepOnGround(position, delta, colliders = []) {
  const proposedX=position.x+delta.x,proposedZ=position.z+delta.z;
  let x=position.x,z=position.z;
  if (canOccupy(proposedX,z,colliders)) x=proposedX;
  if (canOccupy(x,proposedZ,colliders)) z=proposedZ;
  return {x,z};
}
