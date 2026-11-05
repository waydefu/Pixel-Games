// One immutable source of truth for the scene-to-sun vector and atmospheric colors.
// The direction points FROM a surface TOWARD the sun (opposite light rays).
// Golden hour: a low sun (~19 degrees) over the northern sea horizon, so the quarter, pier and harbour
// views look toward it: backlit silhouettes, long shadows, a glare on the water.
const length = Math.hypot(-.237,.326,-.915);
export const SUN_DIRECTION = Object.freeze({x:-.237/length,y:.326/length,z:-.915/length});
export const SUN_ELEVATION_DEG = Math.asin(SUN_DIRECTION.y) * 180 / Math.PI;
// Warm-neutral haze: golden-hour air, not clear-noon blue.
export const HORIZON_LINEAR = Object.freeze({r:.56,g:.64,b:.74});
export const FOG_DENSITY = .0037;
