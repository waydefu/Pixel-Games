// The ten WMO cloud genera as data, and the rule that turns the weather into how much of each is in the sky.
// Pure (no Three.js): deterministic and testable in Node. The sky shader reads the result as `uGen[10]`.
//
// A genus is an observed FORM, not a fixed height: the table groups them the way the sky does, as 4 forms x 3 height
// bands (WMO International Cloud Atlas: high Ci/Cc/Cs, middle Ac/As/Ns, low Sc/St/Cu, and Cb standing through all).
// The coverage ramps are my own tuning for this coast (the idea of a cover number plus precipitation, convection and haze
// choosing the mix is takustaqu/atmosphere's, MIT):
// one cover number plus precipitation, convection and haze decide the mix, and the sky's total cover is the union of
// the layers' independent occlusion, not a sum of alphas.

/** Order matters: it is the index into the shader's `uGen` array. `opacity` is the layer's alpha at full amount. */
export const GENERA = Object.freeze([
  Object.freeze({ id: "cirrus",         code: "Ci", level: "high", form: "filament",   opacity: 0.15, name: "卷雲" }),
  Object.freeze({ id: "cirrostratus",   code: "Cs", level: "high", form: "stratiform", opacity: 0.45, name: "卷層雲" }),
  Object.freeze({ id: "cirrocumulus",   code: "Cc", level: "high", form: "granular",   opacity: 0.25, name: "卷積雲" }),
  Object.freeze({ id: "altostratus",    code: "As", level: "mid",  form: "stratiform", opacity: 0.90, name: "高層雲" }),
  Object.freeze({ id: "altocumulus",    code: "Ac", level: "mid",  form: "granular",   opacity: 0.45, name: "高積雲" }),
  Object.freeze({ id: "nimbostratus",   code: "Ns", level: "mid",  form: "stratiform", opacity: 1.00, name: "雨層雲" }),
  Object.freeze({ id: "stratus",        code: "St", level: "low",  form: "stratiform", opacity: 0.95, name: "層雲" }),
  Object.freeze({ id: "stratocumulus",  code: "Sc", level: "low",  form: "granular",   opacity: 0.75, name: "層積雲" }),
  Object.freeze({ id: "cumulus",        code: "Cu", level: "low",  form: "convective", opacity: 0.40, name: "積雲" }),
  Object.freeze({ id: "cumulonimbus",   code: "Cb", level: "low",  form: "convective", opacity: 0.28, name: "積雨雲" }),
]);
export const GENUS_INDEX = Object.freeze(Object.fromEntries(GENERA.map((g, i) => [g.id, i])));

const clamp01 = v => Math.min(1, Math.max(0, v));
/** smoothstep ramp from 0 at `lo` to 1 at `hi`. */
export const ramp = (v, lo, hi) => { const t = clamp01((v - lo) / (hi - lo)); return t * t * (3 - 2 * t); };

/**
 * How much of each genus is in the sky, 0..1, in GENERA order.
 * @param {{cover:number, precipitation?:number, convection?:number, haze?:number}} w
 *   cover 0 (clear) .. 1 (solid deck); precipitation 0..1; convection 0..1 (a storm brewing); haze 0..1 (fog, damp air)
 */
export function cloudMix({ cover, precipitation = 0, convection = 0, haze = 0 }) {
  const c = clamp01(cover), wet = clamp01(precipitation), dry = 1 - wet, hz = clamp01(haze), cv = clamp01(convection);
  // Each genus lives in its own stretch of the cover scale, so a middling sky has a few kinds of cloud with blue between
  // them and an overcast one is a deck, never every layer at once (that reads as one grey sheet).
  const mix = [
    ramp(c, 0.0, 0.25) * (1 - ramp(c, 0.40, 0.70)) * 0.70 * (1 - hz * 0.6),       // Ci   streaks in fair weather, hidden under a deck
    ramp(c, 0.25, 0.50) * (1 - ramp(c, 0.60, 0.80)) * 0.45,                       // Cs   a veil ahead of weather
    ramp(c, 0.15, 0.30) * (1 - ramp(c, 0.40, 0.60)) * 0.30 * dry,                 // Cc   a trace of scales
    ramp(c, 0.65, 0.85) * 0.85 * dry * (1 - hz * 0.8),                            // As   grey deck, dimmed sun
    ramp(c, 0.30, 0.50) * (1 - ramp(c, 0.62, 0.85)) * 0.70 * dry * (1 - hz * 0.8),// Ac   flocks
    wet * ramp(c, 0.60, 0.85),                                                    // Ns   only with rain
    ramp(c, 0.30, 0.60) * Math.min(1, hz * 0.95 + wet * 0.55),                    // St   low sheet: damp air, rain, fog
    ramp(c, 0.50, 0.70) * (1 - ramp(c, 0.85, 0.97)) * 0.80 * (1 - wet * 0.7) * (1 - hz * 0.8),  // Sc   rolls with blue gaps
    ramp(c, 0.0, 0.12) * (1 - ramp(c, 0.55, 0.80)) * (0.45 + 0.50 * Math.min(1, c * 1.6)) * dry * (1 - hz * 0.7),  // Cu   fair-weather lumps
    cv * ramp(c, 0.02, 0.25),                                                     // Cb   only when convection is high
  ];
  return mix.map(clamp01);
}

/** The sky's total cover: layers occlude independently, so cover = 1 - product(1 - amount * opacity). */
export function aggregateCover(mix) {
  let clear = 1;
  for (let i = 0; i < GENERA.length; i++) clear *= 1 - clamp01(mix[i] || 0) * GENERA[i].opacity;
  return clamp01(1 - clear);
}

/**
 * Weather state (see weather.js) -> inputs of cloudMix. `cover` there runs 0.35 (sparse) .. 1.5 (solid), so it is
 * rescaled; a storm drives convection, fog and rain drive haze and precipitation.
 */
export function weatherToCloudInputs(state) {
  // fog thickens the sky it sits under, so damp air reads as a low deck
  const cover = clamp01(Math.pow(clamp01((state.cover - 0.2) / 1.3), 1.35) + state.fog * 0.35);
  return { cover, precipitation: clamp01(state.rain), convection: clamp01(state.storm), haze: clamp01(state.fog + state.rain * 0.4) };
}
