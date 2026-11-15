import test from "node:test";
import assert from "node:assert/strict";
import { planarMove } from "../src/game/planar-move.js";

// The walk formula before the change (two Vector3 basis vectors per call), kept here as the reference.
function referenceMove(yaw, x, y, speed) {
  const front = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  return { x: (right.x * x - front.x * y) * speed, z: (right.z * x - front.z * y) * speed };
}

test("planarMove matches the original vector formula for any bearing and stick position", () => {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2000; i++) {
    const yaw = (rand() - .5) * 12, x = rand() * 2 - 1, y = rand() * 2 - 1, speed = rand() * 0.3;
    const a = planarMove(yaw, x, y, speed), b = referenceMove(yaw, x, y, speed);
    assert.ok(Math.abs(a.x - b.x) < 1e-12 && Math.abs(a.z - b.z) < 1e-12, `yaw ${yaw} input ${x},${y}`);
  }
});

test("pushing the stick forward walks along the bearing, and right strafes perpendicular to it", () => {
  // yaw 0: forward is −z (the default first-person heading), right is +x. The stick reads y < 0 when pushed forward.
  const forward = planarMove(0, 0, -1, 1), right = planarMove(0, 1, 0, 1);
  assert.deepEqual([forward.x, forward.z].map(v => Math.round(v * 1e9) / 1e9), [0, -1]);
  assert.deepEqual([right.x, right.z].map(v => Math.round(v * 1e9) / 1e9), [1, 0]);
  // with any bearing the walk length equals the stick magnitude times speed
  const d = planarMove(1.1, .6, .8, 2);
  assert.ok(Math.abs(Math.hypot(d.x, d.z) - Math.hypot(.6, .8) * 2) < 1e-12);
});
