import { coastX } from "./terrain-profile.js";

/**
 * Harbour sand tapers into the headlands between |z| = 35 and 47.
 * The coastline and both stages of the Water shader use the same taper.
 *
 * The coastX coefficients mirror terrain-profile.js while PR #108 is editing
 * that file. tests/coastline.test.mjs checks every coefficient against the CPU
 * implementation so they cannot drift unnoticed.
 */
export const SHORE_PROFILE = Object.freeze({
  center: 13.3, waveFrequency1: 0.13, waveAmplitude1: 0.65,
  waveFrequency2: 0.37, waveAmplitude2: 0.22,
  taperStart: 35, taperEnd: 47, taperShift: 8,
});
const glsl = n => Number.isInteger(n) ? n.toFixed(1) : String(n);
export const SHORE_WATER_INSET = 0.55; // metres of permitted swash beyond the curved waterline
const p = SHORE_PROFILE;

export const COASTLINE_GLSL = `
float shore(float z) {
  float coast = ${glsl(p.center)} + sin(z*${glsl(p.waveFrequency1)})*${glsl(p.waveAmplitude1)}
              + sin(z*${glsl(p.waveFrequency2)})*${glsl(p.waveAmplitude2)};
  float t = clamp((abs(z)-${glsl(p.taperStart)})/${glsl(p.taperEnd-p.taperStart)}, 0.0, 1.0);
  return coast-${glsl(p.taperShift)}*t*t*(3.0-2.0*t);
}
float shoreWaterLimit(float z) {
  return shore(z)-${glsl(SHORE_WATER_INSET)};
}
float shoreRegion(float z) {
  return 1.0-smoothstep(${glsl(p.taperStart)},${glsl(p.taperEnd)},abs(z));
}`;

export function coastalOutline(z){
  if(!Number.isFinite(z))throw new RangeError("invalid shore coordinate");
  const t=Math.min(1,Math.max(0,(Math.abs(z)-p.taperStart)/(p.taperEnd-p.taperStart)));
  const ease=t*t*(3-2*t);
  const coast=coastX(z)-p.taperShift*ease;
  const beachWidth=5.1*(1-ease);
  const grassRight=coast-beachWidth;
  const inland=-51.0+Math.sin(z*.13)*1.8+Math.sin(z*.41)*.48;
  const grassLeft=inland*(1-ease)+grassRight*ease;
  return Object.freeze({grassLeft,grassRight,coast,ease});
}

/** The shader and CPU share this curved coast boundary. */
export function coastalWaterLimit(z){return coastalOutline(z).coast-SHORE_WATER_INSET;}
