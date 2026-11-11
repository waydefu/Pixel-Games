/**
 * A submerged beach bed instead of a horizontal sheet above the water.
 *
 * The grass is at y=-0.187. The existing Water mesh has its still-water plane
 * at y=-0.38, so the sea-side sand bed gently slopes below it. Water now covers
 * the shallow end instead of exposing a flat hard-cut seam.
 *
 * All values are deterministic and sampled only while building the mesh.
 * R2's time-dependent swash/moisture simulation is tracked separately in #115.
 */
export const SEA_LEVEL_Y = -0.38;
export const BEACH_DRY_Y = -0.184;
export const BEACH_SEABED_Y = -0.425;

const clamp01 = n => Math.max(0, Math.min(1, n));
const smooth01 = n => { const t=clamp01(n); return t*t*(3-2*t); };

/** t=0 meets the grass, t=1 meets the water; taper=1 closes the headland. */
export function beachSample(t, z, taper=0) {
  if (![t,z,taper].every(Number.isFinite)) throw new RangeError("invalid beach coordinate");
  const u=clamp01(t);
  const width=1-clamp01(taper);
  // Fade the slope away with the sand width: no vertical fin at z=+/-47.
  const slope=smooth01(u)*width;
  const y=BEACH_DRY_Y+(BEACH_SEABED_Y-BEACH_DRY_Y)*slope;

  // Soft irregular dry/wet transition along the same sand mesh, not another
  // intersecting strip. Keep the palette understated and pixel UVs unchanged.
  const wetStart=0.39+0.055*Math.sin(z*0.28)+0.025*Math.sin(z*0.71);
  const wetness=width*smooth01((u-wetStart)/(0.95-wetStart));
  const mottling=1+0.018*Math.sin(z*0.74+u*7.2)+0.012*Math.sin(z*1.57-u*10.1);
  const mix=(dry,wet)=>Math.min(1,Math.max(0,(dry+(wet-dry)*wetness)*mottling));

  return {
    y, wetness,
    color:[mix(0.99,0.66),mix(0.97,0.67),mix(0.92,0.64)],
  };
}
