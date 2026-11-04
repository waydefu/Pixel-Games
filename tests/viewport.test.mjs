import test from "node:test";
import assert from "node:assert/strict";
import { fitPixelViewport, screenToLogical } from "../src/platform/viewport.js";

test("integer scale for large screens and letterboxing", () => {
  const v = fitPixelViewport(1000, 600, 320, 180);
  assert.equal(v.scale, 3);
  assert.equal(v.width, 960);
  assert.equal(v.x, 20);
});
test("fractional fallback on constrained phone", () => {
  const v = fitPixelViewport(160, 90, 320, 180);
  assert.equal(v.scale, 0.5);
  assert.deepEqual(screenToLogical(80, 45, v), { x: 160, y: 90 });
});
test("bars are not interactive logical space", () => {
  const v = fitPixelViewport(1000, 600, 320, 180);
  assert.equal(screenToLogical(0, 0, v), null);
  assert.equal(screenToLogical(1000, 600, v), null);
});
test("dimensions must be positive", () => assert.throws(() => fitPixelViewport(0, 100, 320, 180), RangeError));
