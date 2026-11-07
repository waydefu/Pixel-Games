import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { soundscapeMix, groundSurface, stepInterval, SHORE_X } from "../src/game/audio-mix.js";
const read = p => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const base = { night: 0, windStrength: 1, gust: .4 };

test("the sea is loudest on the beach and the pier, hushed in the village, and the hills belong to the trees", () => {
  const beach = soundscapeMix({ ...base, x: 11, z: 0 }), village = soundscapeMix({ ...base, x: -2, z: 4 }), hills = soundscapeMix({ ...base, x: -30, z: 8 });
  const pier = soundscapeMix({ ...base, x: 22, z: 8 });
  assert.ok(beach.surf > village.surf * 3 && pier.surf > village.surf * 3, "surf fades inland");
  assert.ok(hills.foliage > village.foliage && hills.foliage > beach.foliage, "foliage grows toward the hills");
  assert.ok(pier.lap > beach.lap && pier.onPier, "water laps at the pier");
  assert.ok(hills.surf < 0.02, "the sea is inaudible in the hills");
});

test("wind drives the wind and surf layers, but with gentle, bounded curves", () => {
  const calm = soundscapeMix({ ...base, x: 20, z: 8, windStrength: 0.5, gust: 0 }), gale = soundscapeMix({ ...base, x: 20, z: 8, windStrength: 1.8, gust: 1 });
  assert.ok(gale.wind > calm.wind * 1.8 && gale.surf > calm.surf);
  for (const m of [calm, gale]) for (const k of ["surf", "wind", "foliage", "lap", "crickets", "gullRate"]) assert.ok(m[k] >= 0 && m[k] <= 1.0001, k);
});

test("gulls call by day and are silent at night; crickets sing at night on land only", () => {
  const day = soundscapeMix({ ...base, x: 12, z: 0 }), night = soundscapeMix({ ...base, x: 4, z: 0, night: 1 }), nightSea = soundscapeMix({ ...base, x: 40, z: 0, night: 1, aboard: true });
  assert.ok(day.gullRate > 0.4 && night.gullRate === 0 && day.crickets === 0);
  assert.ok(night.crickets > 0.4 && nightSea.crickets === 0, "no crickets on the water");
});

test("afloat, the sea is a hush and a slap; the pier is wood, the beach sand, the village stone", () => {
  const boat = soundscapeMix({ ...base, x: 50, z: -10, aboard: true });
  assert.ok(boat.onWater && boat.lap === 1 && boat.surf < 0.6);
  assert.equal(groundSurface(20, 8), "wood");
  assert.equal(groundSurface(11, 0), "sand");
  assert.equal(groundSurface(0, 0), "stone");
  assert.ok(SHORE_X > 9.6);
});

test("footsteps come about twice a second when walking and faster when sprinting", () => {
  assert.ok(Math.abs(stepInterval(4.35) - 0.37) < 0.1 && stepInterval(7.1) < stepInterval(4.35));
  assert.ok(stepInterval(0.1) <= 0.7 && stepInterval(30) >= 0.2);
});

test("the soundscape is synthesised (no recordings), starts only after a user gesture, pauses in the background, and has volume controls", () => {
  const main = read("src/game/main.ts"), engine = read("src/game/soundscape.ts"), html = read("index.html");
  assert.match(main, /"pointerdown","keydown","touchstart"/);
  assert.match(main, /soundCtx\.suspend\(\)/);
  for (const id of ["vol-master", "vol-ambient", "vol-sfx", "audio-mute"]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(engine, /DynamicsCompressor/);                 // a limiter protects the sum
  assert.doesNotMatch(engine, /decodeAudioData|fetch\(/);     // nothing is downloaded
  assert.match(read("src/game/fishing.ts"), /api\.cast\(\)/);
  assert.match(read("src/game/boating.ts"), /api\.oar\(/);
});
