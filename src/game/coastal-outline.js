import { coastX } from "./terrain-profile.js";
import { BEACH_DRY_Y, BEACH_SEABED_Y } from "./beach-profile.js";

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
  // The available beach tapers to zero at both headlands; swash cannot overrun its dry edge.
  float beachWidth=5.1*(1.0-smoothstep(${glsl(p.taperStart)},${glsl(p.taperEnd)},abs(z)));
  return shore(z)-min(${glsl(SHORE_WATER_INSET)},beachWidth*0.78);
}
// Analytic derivative of shore(z), so the ocean surface normal matches the curved bank.
float shoreSlope(float z) {
  float t=clamp((abs(z)-35.0)/12.0,0.0,1.0);
  return 0.08450*cos(z*.13)+0.08140*cos(z*.37)-4.0*t*(1.0-t)*sign(z);
}
float shoreTaper(float z) {
  return smoothstep(35.0,47.0,abs(z));
}
// True sand-bed height. A water trough beneath the bed must not render through the beach.
float shoreBeachBed(float x,float z) {
  float available=1.0-shoreTaper(z);
  float width=5.1*available;
  float t=clamp((x-(shore(z)-width))/max(0.0001,width),0.0,1.0);
  float slope=t*t*(3.0-2.0*t)*available;
  return -0.184+(-0.241)*slope;
}
float shoreRegionSlope(float z) {
  float t=clamp((abs(z)-35.0)/12.0,0.0,1.0);
  return -0.5*t*(1.0-t)*sign(z);
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
export function coastalWaterLimit(z){
  const o=coastalOutline(z),beachWidth=o.coast-o.grassRight;
  return o.coast-Math.min(SHORE_WATER_INSET,beachWidth*.78);
}
