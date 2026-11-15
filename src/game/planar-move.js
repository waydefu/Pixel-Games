// Pure helper for the first-person walk vector (no Three.js, so it is testable in Node). Camera.movement() calls this every
// frame; the two basis vectors are worked out in scalars, so no Vector3 is allocated per frame (see #121, O-05).
// With yaw as the bearing: front = (−sin, 0, −cos), right = (cos, 0, −sin); the walk is right·input.x − front·input.y.
export function planarMove(yaw, inputX, inputY, speed) {
  const s = Math.sin(yaw), c = Math.cos(yaw);
  return { x: (c * inputX + s * inputY) * speed, z: (-s * inputX + c * inputY) * speed };
}
