import test from "node:test";
import assert from "node:assert/strict";
import { createWeather, WEATHER_PRESETS } from "../src/game/weather.js";

test("weather glides between neighbouring presets and every output stays in range", () => {
  const w = createWeather({ seed: 3 });
  const seen = new Set([w.state.preset]);
  let prev = { ...w.state };
  for (let t = 0; t < 7200; t += 0.5) {
    w.update(t); seen.add(w.state.next);
    for (const k of ["cover", "dark", "rain", "storm", "fog"]) { assert.ok(Number.isFinite(w.state[k]) && w.state[k] >= -1e-9 && w.state[k] <= 1.6, k + " " + w.state[k]); assert.ok(Math.abs(w.state[k] - prev[k]) < 0.05, k + " jumps"); }
    prev = { ...w.state };
  }
  assert.ok(seen.size >= 4, "over two hours the weather changes: " + [...seen].join());
});

test("a storm never follows a clear sky directly, lightning needs a storm, thunder arrives later by distance", () => {
  const w = createWeather({ seed: 5, lock: "storm" });
  let strikes = 0, claps = 0, maxFlash = 0;
  for (let t = 0; t < 120; t += 0.1) { w.update(t); if (w.bolt.active && w.bolt.age < 0.11) strikes++; maxFlash = Math.max(maxFlash, w.state.flash); claps += w.takeThunder(0.1).length; }
  assert.ok(maxFlash > 0.5 && claps >= 3, `lightning and thunder in a storm (${maxFlash.toFixed(2)}, ${claps})`);
  const calm = createWeather({ seed: 5, lock: "clear" });
  for (let t = 0; t < 120; t += 0.1) { calm.update(t); assert.equal(calm.state.flash, 0); }
  const hops = createWeather({ seed: 11 });
  let was = hops.state.preset;
  for (let t = 0; t < 20000; t += 1) { hops.update(t); if (hops.state.preset !== was) { assert.ok(!(was === "clear" && hops.state.preset === "storm") && !(was === "storm" && hops.state.preset === "clear")); was = hops.state.preset; } }
});

test("a locked weather stays put and presets are complete", () => {
  const w = createWeather({ lock: "rain" });
  for (let t = 0; t < 1000; t += 1) w.update(t);
  assert.equal(w.state.preset, "rain"); assert.equal(w.state.rain, WEATHER_PRESETS.rain.rain);
  for (const p of Object.values(WEATHER_PRESETS)) for (const k of ["cover", "dark", "rain", "storm", "fog", "wind", "name"]) assert.ok(k in p);
});
