// Dynamic weather: a small state machine whose *continuous* outputs (cloud cover, darkness, rain, storm, fog, wind) glide
// between presets, so the sky, the light, the sea, the wind and the sound can all follow one smooth state.
// Pure (no Three.js, no Web Audio): deterministic for a seed, testable in Node.
//
// Presets are my own design for this coast. `cover` is the cloud-coverage bias (0.35 sparse ... 1.5 solid), `dark` how much
// the daylight is dimmed and desaturated, `rain`/`storm` 0..1, `fog` 0..1, `wind` a multiplier on the climate wind.
export const WEATHER_PRESETS = Object.freeze({
  clear:    Object.freeze({ cover: 0.35, dark: 0.00, rain: 0.0, storm: 0.0, fog: 0.00, wind: 1.00, name: "晴" }),
  partly:   Object.freeze({ cover: 0.85, dark: 0.08, rain: 0.0, storm: 0.0, fog: 0.00, wind: 1.10, name: "多雲" }),
  overcast: Object.freeze({ cover: 1.25, dark: 0.45, rain: 0.0, storm: 0.0, fog: 0.15, wind: 1.20, name: "陰" }),
  rain:     Object.freeze({ cover: 1.40, dark: 0.62, rain: 0.7, storm: 0.0, fog: 0.30, wind: 1.50, name: "雨" }),
  storm:    Object.freeze({ cover: 1.50, dark: 0.82, rain: 1.0, storm: 1.0, fog: 0.40, wind: 2.10, name: "暴風雨" }),
  fog:      Object.freeze({ cover: 0.90, dark: 0.25, rain: 0.0, storm: 0.0, fog: 1.00, wind: 0.55, name: "霧" }),
});
const WEIGHTS = { clear: 0.42, partly: 0.26, overcast: 0.12, rain: 0.1, storm: 0.04, fog: 0.06 };
// weather changes gradually through neighbours: a storm does not follow a clear sky without clouding over first
const NEIGHBOURS = { clear: ["partly", "fog"], partly: ["clear", "overcast"], overcast: ["partly", "rain", "fog"], rain: ["overcast", "storm"], storm: ["rain"], fog: ["clear", "overcast"] };
const KEYS = ["cover", "dark", "rain", "storm", "fog", "wind"];
const smooth = t => t * t * (3 - 2 * t);

function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** @param {{seed?:number, lock?:string|null, start?:string}} [options] `lock` fixes one preset for ever (audits, ?weather=) */
export function createWeather({ seed = 7, lock: initialLock = null, start = "clear" } = {}) {
  let lock = initialLock;
  const rng = mulberry(seed);
  const first = lock && WEATHER_PRESETS[lock] ? lock : start;
  /** @type {{preset:string,next:string,ramp:number,hold:number,cover:number,dark:number,rain:number,storm:number,fog:number,wind:number,flash:number,time:number,thunder:{delay:number,loud:number}[]}} */
  const state = { preset: first, next: first, ramp: 1, hold: 70 + rng() * 40, ...Object.fromEntries(KEYS.map(k => [k, WEATHER_PRESETS[first][k]])), flash: 0, time: 0, thunder: [] };
  let from = { ...WEATHER_PRESETS[first] }, rampLen = 40, last = null, nextStrike = 3 + rng() * 5, flashClock = 99, flashPattern = [0, 0];
  const bolt = { active: false, age: 99, azimuth: 0, distance: 1000, seed: 1 };

  function pickNext() {
    const options = NEIGHBOURS[state.preset];
    const total = options.reduce((s, k) => s + WEIGHTS[k], 0);
    let r = rng() * total;
    for (const k of options) { r -= WEIGHTS[k]; if (r <= 0) return k; }
    return options[0];
  }
  function update(t) {
    const dt = last === null ? 0 : Math.min(0.5, Math.max(0, t - last)); last = t; state.time = t;
    if (lock) { if (state.ramp < 1) state.ramp = Math.min(1, state.ramp + dt / rampLen); }
    else {
      if (state.ramp >= 1) {
        state.hold -= dt;
        if (state.hold <= 0) { state.next = pickNext(); from = Object.fromEntries(KEYS.map(k => [k, state[k]])); state.ramp = 0; rampLen = 35 + rng() * 25; }
      } else {
        state.ramp = Math.min(1, state.ramp + dt / rampLen);
        if (state.ramp >= 1) { state.preset = state.next; state.hold = 60 + rng() * 120; }
      }
    }
    const target = WEATHER_PRESETS[state.next], e = smooth(state.ramp);
    for (const k of KEYS) state[k] = from[k] + (target[k] - from[k]) * (state.ramp >= 1 ? 1 : e);
    // lightning: only in a real storm; a double-pulse flash and a bolt, with thunder arriving later by distance
    state.flash = Math.max(0, state.flash - dt * 6);
    flashClock += dt; bolt.age += dt; if (bolt.age > 0.3) bolt.active = false;
    if (state.storm > 0.55) {
      nextStrike -= dt;
      if (nextStrike <= 0) {
        nextStrike = 3 + rng() * 9;
        const distance = 700 + rng() * 5000;
        bolt.active = true; bolt.age = 0; bolt.azimuth = rng() * Math.PI * 2; bolt.distance = distance; bolt.seed = Math.floor(rng() * 1e6);
        flashClock = 0; flashPattern = [0.05 + rng() * 0.05, 0.16 + rng() * 0.08];
        state.thunder.push({ delay: Math.min(9, distance / 343 * 0.8), loud: Math.max(0.15, 1 - distance / 6500) });
      }
    }
    if (flashClock < 0.35) {
      const [a, b] = flashPattern;
      const pulse = flashClock < a ? 1 : flashClock < b ? 0.25 : flashClock < b + 0.08 ? 0.9 : Math.max(0, 0.9 * (1 - (flashClock - b - 0.08) / 0.2));
      state.flash = Math.max(state.flash, pulse * (bolt.distance < 2500 ? 1 : 0.6));
    }
    return state;
  }
  /** Thunder claps whose delay has run out are handed over once. */
  function takeThunder(dt) {
    const due = [];
    state.thunder = state.thunder.filter(c => { c.delay -= dt; if (c.delay <= 0) { due.push(c); return false; } return true; });
    return due;
  }
  /** Fix the weather to a preset (it glides there), or pass null to let it change by itself again. */
  function setLock(name) {
    if (name && !WEATHER_PRESETS[name]) throw new RangeError("unknown weather " + name);
    lock = name || null;
    if (lock) { from = Object.fromEntries(KEYS.map(k => [k, state[k]])); state.next = lock; state.ramp = 0; rampLen = 12; state.preset = lock; }
    else { state.hold = 45 + rng() * 60; }
  }
  return { state, update, takeThunder, bolt, setLock, get locked() { return !!lock; } };
}
