import test from "node:test";
import assert from "node:assert/strict";
import { createRope } from "../src/game/rope.js";

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function run(rope, seconds, start, end, length, floor = null) {
  for (let i = 0; i < seconds * 60; i++) rope.step(1 / 60, start, end, length, floor);
}

test("a slack rope between two pinned points sags below the straight line and stays finite", () => {
  const rope = createRope({ count: 22 });
  const a = [0, 2, 0], b = [6, 0, 0];
  rope.reset(a, b, 7);
  run(rope, 4, a, b, 7);
  const mid = rope.point(11);
  assert.ok(Number.isFinite(mid[0]) && Number.isFinite(mid[1]));
  assert.ok(mid[1] < 1 - .15, "the middle hangs below the chord (y=1), got " + mid[1].toFixed(2));
  assert.deepEqual(rope.point(0), a); assert.deepEqual(rope.point(21), b);
});

test("a rope never stretches much past its paid-out length", () => {
  const rope = createRope({ count: 22 });
  const a = [0, 2, 0], b = [6, 0, 0];
  rope.reset(a, b, 7);
  run(rope, 3, a, b, 7);
  let total = 0;
  for (let i = 0; i < 21; i++) total += dist(rope.point(i), rope.point(i + 1));
  assert.ok(total < 7 * 1.08, "total length " + total.toFixed(2));
});

test("a taut line reports tension and a slack one does not", () => {
  const rope = createRope({ count: 22 });
  const a = [0, 1, 0], b = [6, 1, 0];
  rope.reset(a, b, 8);
  run(rope, 3, a, b, 8);
  assert.equal(rope.tension(), 0, "slack");
  rope.reset(a, b, 6);
  run(rope, 3, a, b, 5.8);
  assert.ok(rope.tension() > .02, "taut, got " + rope.tension());
});

test("the line floats on the water: nothing sinks below the surface", () => {
  const rope = createRope({ count: 22 });
  const a = [0, 1.6, 0], b = [5, -.38, 0];
  rope.reset(a, b, 7);
  run(rope, 5, a, b, 7, -.38);
  for (let i = 1; i < 22; i++) assert.ok(rope.point(i)[1] >= -.38 - 1e-6, "particle " + i + " at " + rope.point(i)[1]);
});

test("a free end hangs from the start and big time steps stay stable", () => {
  const rope = createRope({ count: 18 });
  const a = [0, 3, 0];
  rope.reset(a, [0, 1, 0], 2);
  for (let i = 0; i < 40; i++) rope.step(.25, a, null, 2);
  const end = rope.point(17);
  assert.ok(end[1] < 3 - 1.5 && end[1] > 3 - 2.3, "hangs about a rope length below, got " + end[1].toFixed(2));
  assert.ok(Math.abs(end[0]) < .5, "straight down");
});
