import test from "node:test";
import assert from "node:assert/strict";
import { createFixedStepClock } from "../src/platform/clock.js";

test("first frame initializes without simulation step", () => {
  const clock = createFixedStepClock();
  const log = [];
  const out = clock.frame(100, () => log.push("update"), () => log.push("render"));
  assert.deepEqual(out, { steps: 0, alpha: 0 });
  assert.deepEqual(log, ["render"]);
});
test("advances at fixed dt despite varying display frame time", () => {
  const clock = createFixedStepClock({ hz: 10 });
  const dt = [];
  clock.frame(0, () => {}, () => {});
  const out = clock.frame(100, d => dt.push(d), () => {});
  assert.equal(out.steps, 1);
  assert.deepEqual(dt, [0.1]);
});
test("bounds catch-up steps after pause and resets", () => {
  const clock = createFixedStepClock({ hz: 60, maxFrameMs: 100, maxSteps: 3 });
  clock.frame(0, () => {}, () => {});
  const out = clock.frame(10000, () => {}, () => {});
  assert.equal(out.steps, 3);
  clock.reset();
  assert.equal(clock.frame(10, () => {}, () => {}).steps, 0);
});
test("rejects invalid options", () => assert.throws(() => createFixedStepClock({ hz: 0 }), RangeError));
