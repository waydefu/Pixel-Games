import test from "node:test";
import assert from "node:assert/strict";
import { createWanderer, facingRow, mulberry32 } from "../src/game/wander.js";
import { paintVillagerSheet, paintAnimalSheet, VILLAGERS, ANIMALS, NPC_FRAME } from "../src/game/pixel/npc.js";

test("a wanderer stays inside its radius and never exceeds its speed", () => {
  const w = createWanderer({ x: 0, z: 0, home: { x: 0, z: 0 }, radius: 3, speed: 1.2, seed: 7 });
  let moved = 0, last = { x: 0, z: 0 };
  for (let i = 0; i < 4000; i++) {
    const s = w.update(.05);
    assert.ok(Math.hypot(s.x, s.z) <= 3 + 1e-6, "inside the radius");
    const step = Math.hypot(s.x - last.x, s.z - last.z);
    assert.ok(step <= 1.2 * .05 + 1e-9, "never faster than its speed");
    moved += step; last = { x: s.x, z: s.z };
  }
  assert.ok(moved > 20, "it actually walks about, moved " + moved.toFixed(1));
});

test("waypoint walkers only ever visit their waypoints and pause between them", () => {
  const points = [[-5, 0], [5, 0]];
  const w = createWanderer({ x: -5, z: 0, waypoints: points, speed: 1, pause: [1, 2], seed: 3 });
  let paused = 0;
  for (let i = 0; i < 6000; i++) {
    const s = w.update(.05);
    assert.ok(Math.abs(s.z) < 1e-9 && s.x >= -5 - 1e-9 && s.x <= 5 + 1e-9, "stays on the street line");
    if (!s.walking) paused++;
  }
  assert.ok(paused > 200, "it rests between walks");
});

test("the same seed gives the same walk", () => {
  const a = createWanderer({ x: 0, z: 0, home: { x: 0, z: 0 }, radius: 4, seed: 11 }), b = createWanderer({ x: 0, z: 0, home: { x: 0, z: 0 }, radius: 4, seed: 11 });
  for (let i = 0; i < 500; i++) { a.update(.1); b.update(.1); }
  assert.deepEqual(a.state, b.state);
  assert.notEqual(mulberry32(1)(), mulberry32(2)());
});

test("facing follows the screen direction", () => {
  const right = { x: 1, z: 0 }, up = { x: 0, z: -1 };
  assert.equal(facingRow(1, 0, right, up), 1);
  assert.equal(facingRow(-1, 0, right, up), 3);
  assert.equal(facingRow(0, -1, right, up), 2, "walking away from the camera");
  assert.equal(facingRow(0, 1, right, up), 0, "walking toward the camera");
  assert.equal(facingRow(0, 0, right, up, 2), 2, "standing keeps the last facing");
});

test("every villager look and animal paints a complete, outlined 4x4 sheet", () => {
  for (const sheet of [...VILLAGERS.map((_, i) => paintVillagerSheet(i)), ...ANIMALS.map(paintAnimalSheet)]) {
    assert.equal(sheet.width, NPC_FRAME * 4);
    assert.equal(sheet.height, NPC_FRAME * 4);
    for (let row = 0; row < 4; row++) for (let frame = 0; frame < 4; frame++) {
      let opaque = 0;
      for (let y = 0; y < NPC_FRAME; y++) for (let x = 0; x < NPC_FRAME; x++) if (sheet.data[((row * NPC_FRAME + y) * sheet.width + frame * NPC_FRAME + x) * 4 + 3]) opaque++;
      assert.ok(opaque > 40, "row " + row + " frame " + frame + " is painted");
    }
  }
});

import fs from "node:fs";
const read = p => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("the sea is endless: a huge plane under the detailed one, and open water outside the harbour", () => {
  const ocean = read("src/game/ocean.ts");
  assert.match(ocean, /endless-sea/);
  assert.match(ocean, /PlaneGeometry\(9000,9000/);
  assert.match(ocean, /dist=mix\(60\.0,dist,1\.0-smoothstep\(32\.0,52\.0,abs\(w\.z\)\)\)/, "pale shallows only inside the harbour");
});

test("life is wired in: villagers, gulls, smoke and the beacon flame", () => {
  const world = read("src/game/world.ts");
  assert.match(world, /createLife\(kit,village\.chimneys\)/);
  assert.match(world, /life\.update\(time\)/);
  assert.match(world, /fixtures\.bigFlame\(BEACON_SITE\.x/);
  assert.match(read("src/game/architecture.ts"), /CHIMNEYS:Record/);
});
