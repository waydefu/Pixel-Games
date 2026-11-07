// Time of day: the single source of truth for the sun, the moon and every colour that depends on them.
// Pure functions (no Three.js): testable in Node. The sea is east (+x), the mountains west (-x):
// the sun rises out of the sea, climbs a little toward the north (-z) and sets behind the mountains.
//
//   hour 6  -> sun on the eastern horizon     hour 12 -> highest      hour 18 -> western horizon
//   the moon is (almost) opposite the sun: it rises in the east as the sun sets.

export const DAY_HOURS = 24;
/** Where a new game starts: a bright, readable morning with the sun over the sea. */
export const HOUR_START = 9.5;
const TAU = Math.PI * 2;

const normalize = v => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
export const wrapHour = hour => ((hour % DAY_HOURS) + DAY_HOURS) % DAY_HOURS;

export function sunDirection(hour) {
  const a = (wrapHour(hour) - 6) / 12 * Math.PI;      // 0 at sunrise, pi at sunset, 2pi next sunrise
  return normalize({ x: -Math.cos(a), y: 0.72 * Math.sin(a), z: -0.34 * Math.sin(a) });
}
/**
 * Where the moon is. `phase` runs 0 (new) .. 0.5 (full) .. 1: the moon trails the sun by `phase` of a turn, so a full
 * moon is opposite the sun (rising over the mountains as the sun sets into the sea), a waxing crescent hangs just
 * behind the sun in the evening, and a new moon is lost in the sun's glare.
 */
export function moonDirection(hour, phase = 0.5) {
  const a = (wrapHour(hour) - 6) / 12 * Math.PI - phase * 2 * Math.PI;
  return normalize({ x: -Math.cos(a), y: 0.72 * Math.sin(a) * 0.94 + 0.04, z: -0.34 * Math.sin(a) + 0.10 * Math.sin(phase * Math.PI) });
}
/** 0 (dark) .. 1 (full) fraction of the disc that is lit. */
export const moonIllumination = phase => 0.5 - 0.5 * Math.cos(phase * 2 * Math.PI);
export const sunElevationDeg = hour => Math.asin(sunDirection(hour).y) * 180 / Math.PI;

const lerp = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * Keyframes by SUN ELEVATION (degrees), so twilight length follows the real sun, not the clock.
 * Colours are linear-light RGB. Values chosen from the reference mood: warm low sun, deep teal
 * shadows, hazy golden horizon, cold blue night.
 */
const KEYS = [
  { e: -18, zenith: [0.003, 0.006, 0.022], mid: [0.006, 0.012, 0.045], horizon: [0.012, 0.022, 0.065], fog: [0.012, 0.020, 0.050],
    sun: [0, 0, 0], sunI: 0, hemiSky: [0.10, 0.14, 0.30], hemiGround: [0.04, 0.05, 0.09], hemiI: 0.30, exposure: 1.30 },
  { e: -6, zenith: [0.008, 0.018, 0.11], mid: [0.12, 0.075, 0.27], horizon: [0.52, 0.20, 0.30], fog: [0.24, 0.16, 0.26],
    sun: [1.0, 0.45, 0.25], sunI: 0.0, hemiSky: [0.36, 0.42, 0.66], hemiGround: [0.16, 0.14, 0.20], hemiI: 0.95, exposure: 1.34 },
  { e: 0, zenith: [0.016, 0.060, 0.30], mid: [0.27, 0.15, 0.38], horizon: [1.0, 0.40, 0.14], fog: [0.66, 0.38, 0.32],
    sun: [1.0, 0.50, 0.22], sunI: 2.0, hemiSky: [0.62, 0.52, 0.52], hemiGround: [0.30, 0.22, 0.18], hemiI: 0.78, exposure: 1.08 },
  { e: 7, zenith: [0.028, 0.110, 0.44], mid: [0.20, 0.27, 0.56], horizon: [0.95, 0.58, 0.34], fog: [0.60, 0.60, 0.64],
    sun: [1.0, 0.74, 0.44], sunI: 3.3, hemiSky: [0.72, 0.78, 0.86], hemiGround: [0.36, 0.30, 0.24], hemiI: 1.0, exposure: 1.02 },
  { e: 22, zenith: [0.035, 0.130, 0.47], mid: [0.130, 0.33, 0.68], horizon: [0.66, 0.76, 0.88], fog: [0.62, 0.72, 0.84],
    sun: [1.0, 0.89, 0.72], sunI: 3.4, hemiSky: [0.74, 0.84, 0.90], hemiGround: [0.40, 0.35, 0.28], hemiI: 1.18, exposure: 1.0 },
  { e: 60, zenith: [0.030, 0.110, 0.45], mid: [0.110, 0.30, 0.66], horizon: [0.62, 0.74, 0.88], fog: [0.60, 0.71, 0.84],
    sun: [1.0, 0.95, 0.88], sunI: 3.0, hemiSky: [0.76, 0.86, 0.94], hemiGround: [0.42, 0.37, 0.30], hemiI: 1.3, exposure: 0.98 },
];

function sampleKeys(elevation) {
  if (elevation <= KEYS[0].e) return KEYS[0];
  const last = KEYS[KEYS.length - 1];
  if (elevation >= last.e) return last;
  let i = 0;
  while (elevation > KEYS[i + 1].e) i++;
  const a = KEYS[i], b = KEYS[i + 1], t = (elevation - a.e) / (b.e - a.e);
  const blend = {};
  for (const key of Object.keys(a)) {
    if (key === "e") continue;
    blend[key] = Array.isArray(a[key]) ? mix3(a[key], b[key], t) : lerp(a[key], b[key], t);
  }
  return blend;
}

/** Everything the renderer needs for an hour in [0, 24). */
export function skyAt(hour, phase = 0.5) {
  const h = wrapHour(hour);
  const sun = sunDirection(h), moon = moonDirection(h, phase);
  const elevation = Math.asin(sun.y) * 180 / Math.PI;
  const k = sampleKeys(elevation);
  const night = 1 - smooth(-12, 2, elevation);                 // 1 deep night .. 0 day
  const lampGlow = 1 - smooth(-2, 9, elevation);               // windows and lanterns come on at dusk
  const dayLight = smooth(-6, 12, elevation);
  return {
    hour: h, elevation,
    sunDir: sun, moonDir: moon,
    zenith: k.zenith, mid: k.mid, horizon: k.horizon, fog: k.fog,
    sunColor: k.sun, sunIntensity: k.sunI,
    hemiSky: k.hemiSky, hemiGround: k.hemiGround, hemiIntensity: k.hemiI,
    exposure: k.exposure,
    night, dayLight, lampGlow,
    starAlpha: smooth(-5, -15, elevation),
    // The moon is a cool, weak key light, strongest on a dark night with the moon up.
    moonIntensity: 0.55 * (0.2 + 0.8 * moonIllumination(phase)) * night * smooth(-0.05, 0.25, moon.y),
    moonPhase: phase,
    moonColor: [0.55, 0.68, 1.0],
    // God rays only while the sun is above (or just at) the horizon.
    sunRays: smooth(-3, 6, elevation),
    // 0..1 around sunrise and sunset (sun between about -9 and +8 degrees): the belt of Venus, fiery clouds, light shafts.
    twilight: smooth(-9, -2, elevation) * (1 - smooth(1, 9, elevation)),
    // Cloud lighting: lit tops take the sun colour, undersides the sky; both fade to moonlit blue-grey at night.
    cloudLit: mix3([0.10, 0.12, 0.22], k.sun.map(v => v * 1.55), dayLight),
    cloudShade: mix3([0.04, 0.05, 0.10], mix3(k.zenith, k.horizon, 0.5).map(v => v * 1.7 + 0.04), dayLight),
  };
}

/** "07:30" style label and a short phase name for the UI. */
export function describeHour(hour) {
  const h = wrapHour(hour), hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  const e = sunElevationDeg(h);
  const phase = e < -12 ? "夜晚" : e < 0 ? (h < 12 ? "黎明" : "黃昏") : e < 10 ? (h < 12 ? "日出" : "日落") : "白天";
  return { text: String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0"), phase };
}
export const HOUR_OF_FULL_CYCLE = TAU;
