import test from "node:test";
import assert from "node:assert/strict";
import { TIER_FEATURES, getTierFeatures, linearDepth, circleOfConfusion } from "../src/rendering/hd2d-pipeline.js";

test("every quality tier uses the same linear pipeline and only differs in cost", () => {
  assert.deepEqual(Object.keys(TIER_FEATURES), ["basic", "balanced", "high"]);
  assert.equal(getTierFeatures("basic").msaa, 0);
  assert.equal(getTierFeatures("basic").bloom, false);
  assert.equal(getTierFeatures("balanced").bloom, true);
  assert.equal(getTierFeatures("balanced").dof, false);
  assert.equal(getTierFeatures("high").dof, true);
  assert.ok(getTierFeatures("high").bloomLevels > getTierFeatures("balanced").bloomLevels);
  assert.throws(() => getTierFeatures("ultra"), RangeError);
  assert.ok(Object.isFrozen(TIER_FEATURES.high));
});

test("depth buffer values map back to view distance for both projections", () => {
  assert.ok(Math.abs(linearDepth(0, 0.1, 100, false) - 0.1) < 1e-6);
  assert.ok(Math.abs(linearDepth(1, 0.1, 100, false) - 100) < 1e-3);
  assert.ok(Math.abs(linearDepth(0.5, 0.1, 101, true) - 50.55) < 1e-6);
  // Perspective depth is non-linear: half the buffer is still very close.
  assert.ok(linearDepth(0.5, 0.1, 1000, false) < 1);
});

test("circle of confusion is zero in focus, grows linearly and saturates", () => {
  assert.equal(circleOfConfusion(30, 30, 2, 10), 0);
  assert.equal(circleOfConfusion(31.9, 30, 2, 10), 0);
  assert.ok(Math.abs(circleOfConfusion(37, 30, 2, 10) - 0.5) < 1e-9);
  assert.equal(circleOfConfusion(500, 30, 2, 10), 1);
  assert.equal(circleOfConfusion(5, 30, 2, 10), 1);
  assert.equal(circleOfConfusion(33, 30, 2, 0), 1); // zero span must not divide by zero
});
