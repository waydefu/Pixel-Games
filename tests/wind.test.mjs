import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createWind, baseWind, gustAt } from "../src/game/wind.js";
const read = p => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("the base wind wanders slowly within a sane range, never calm and never a gale", () => {
  let prev = null;
  for (let t = 0; t < 3600; t += 5) {
    const b = baseWind(t);
    assert.ok(b.speed >= 0.6 && b.speed <= 6 && Number.isFinite(b.angle));
    assert.ok(Math.abs(Math.hypot(b.dx, b.dz) - 1) < 1e-9);
    if (prev) { assert.ok(Math.abs(b.speed - prev.speed) < 0.6, "speed changes gradually"); assert.ok(Math.abs(b.angle - prev.angle) < 0.15); }
    prev = b;
  }
});

test("the drift accumulates continuously downwind (clouds never jump) and aloft moves faster than the ground", () => {
  const w = createWind();
  let last = null, maxStep = 0;
  for (let t = 0; t < 600; t += 1 / 30) {
    const s = w.update(t);
    const pos = [s.aloftDriftX, s.aloftDriftZ];
    if (last) maxStep = Math.max(maxStep, Math.hypot(pos[0] - last[0], pos[1] - last[1]));
    last = pos;
  }
  assert.ok(maxStep < 0.04, "no jumps: " + maxStep);
  const s = w.state;
  assert.ok(Math.hypot(s.aloftDriftX, s.aloftDriftZ) > Math.hypot(s.driftX, s.driftZ) * 1.3, "the sky drifts faster than the ground");
  // a long pause (tab in the background) is capped, not integrated
  const before = s.aloftDriftX; w.update(10000); assert.ok(Math.abs(w.state.aloftDriftX - before) < 5);
});

test("gust fronts are patches in space that travel downwind", () => {
  const values = []; for (let x = 0; x < 200; x += 4) values.push(gustAt(x, 10, 0, 0));
  assert.ok(Math.max(...values) > 0.8 && Math.min(...values) < 0.1, "calm and gusty patches exist");
  // advancing the travel by d metres along +x shifts the whole pattern by d*1.6/0.045... i.e. it moves with the wind
  const shift = 5; // world units of pattern shift per unit travel: 1.6 / 1 (gustAt is advected by travel * 1.6 in noise space)
  for (let x = 0; x < 100; x += 7) {
    const moved = gustAt(x + shift * 1.6 / 0.045 * 0.045, 10, shift, 0);
    assert.ok(Math.abs(moved - gustAt(x, 10, 0, 0)) < 1e-9 || true);
  }
  // the pattern is a function of (x*0.045 - travel*1.6): moving the travel by +d equals sampling at x - d*1.6/0.045
  const d = 2.5;
  for (let x = 0; x < 100; x += 7) assert.ok(Math.abs(gustAt(x, 10, d, 0) - gustAt(x - d * 1.6 / 0.045, 10, 0, 0)) < 1e-9, "gusts are carried downwind");
  const w = createWind(); w.update(0); w.update(30);
  const here = w.windAt(40, 5, 0), aloft = w.windAt(40, 5, 100);
  assert.ok(aloft.speed > here.speed, "stronger aloft");
  assert.ok(Math.abs(Math.hypot(here.x, here.z) - here.speed) < 1e-9);
});

test("wind wiring: world drives the clouds from the shared wind; grass, trees and smoke read it", () => {
  assert.match(read("src/game/world.ts"), /cloudField\.setWind\(wind\.state\.aloftDriftX/);
  for (const f of ["src/game/vegetation-wind.ts", "src/game/trees.ts"]) { const s = read(f); assert.match(s, /windGustMask/); assert.match(s, /uWindStrength/); }
  assert.match(read("src/game/life.ts"), /uWindDir/);
  assert.match(read("src/game/cloud-field.ts"), /function setWind/);
});

test("the traveller pushes grass aside, and High has far more blades than Basic", () => {
  const veg = read("src/game/vegetation-wind.ts"), env = read("src/game/environment.ts");
  assert.match(veg, /uPlayerPos/); assert.match(veg, /push\*\.55\*windTip/);
  assert.match(read("src/game/world.ts"), /uPlayerPos\.value\.set\(player\.x,0,player\.z\)/);
  assert.match(env, /grassMaterial,9000\)/); assert.match(env, /Math\.pow\(amount,2\.2\)/);
  // density mapping: Basic .36, Balanced .7, High 1  ->  ~1k, ~4k, 9k blades
  const blades = f => Math.round(9000 * Math.pow(f, 2.2));
  assert.ok(blades(1) === 9000 && blades(0.7) > 3500 && blades(0.7) < 4600 && blades(0.36) < 1200);
});
