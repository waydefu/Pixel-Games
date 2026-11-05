// One immutable source of truth for the scene-to-sun vector and atmospheric colors.
// The direction points FROM a surface TOWARD the sun (opposite light rays).
const length = Math.hypot(-19,25,-10);
export const SUN_DIRECTION = Object.freeze({x:-19/length,y:25/length,z:-10/length});
export const HORIZON_LINEAR = Object.freeze({r:.54,g:.65,b:.70});
export const FOG_DENSITY = .0037;
