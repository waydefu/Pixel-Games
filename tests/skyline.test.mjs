import test from "node:test";
import assert from "node:assert/strict";
import { skylineTangents, skylineBytes, SKYLINE_BINS, SKYLINE_MAX_TANGENT } from "../src/game/skyline.js";
import { fjordSurfaceHeight } from "../src/game/terrain-profile.js";

test("flat land has a flat skyline and a wall to the west shows up only to the west", () => {
  const flat = skylineTangents(() => 0, 0, 0);
  assert.ok(flat.every(v => v === 0));
  const wall = skylineTangents((x) => (x < -50 ? 40 : 0), 0, 0);
  const west = wall[SKYLINE_BINS / 2], east = wall[0];
  assert.ok(west > 40 / 60 - 1e-6 || west === SKYLINE_MAX_TANGENT, "40 high at 50 away is at least ~0.8 -> clamped, got " + west);
  assert.equal(east, 0);
});

test("the real fjord has mountains to the west and an open sea to the east", () => {
  const heightAt = (x, z) => Math.max(...["mainland", "east", "north", "south"].map(r => fjordSurfaceHeight(x, z, r)));
  const table = skylineTangents(heightAt, 25, 8, { waterline: -.38 });
  const west = table[SKYLINE_BINS / 2];
  const east = table[0];
  assert.ok(west > .1, "mountains rise to the west, got " + west);
  assert.ok(east < west, "the sea corridor is lower than the mountains");
  const bytes = skylineBytes(table);
  assert.equal(bytes.length, SKYLINE_BINS * 4);
  assert.equal(bytes[3], 255);
});
