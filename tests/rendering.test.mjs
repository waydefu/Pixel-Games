import test from "node:test";
import assert from "node:assert/strict";
import { calculateRenderSize, getQualityPreset } from "../src/rendering/quality.js";
import { configurePixelTexture } from "../src/rendering/pixel-texture.js";
import { createResourceScope } from "../src/rendering/resource-scope.js";
import { createFrameMetrics } from "../src/rendering/frame-metrics.js";

test("quality presets cap DPR and drawing buffer pixels", () => {
  const a = calculateRenderSize({ cssWidth: 844, cssHeight: 390, devicePixelRatio: 3, quality: "basic" });
  assert.equal(a.width, 844);
  assert.equal(a.height, 390);
  assert.equal(a.shadows, false);
  const b = calculateRenderSize({ cssWidth: 1920, cssHeight: 1080, devicePixelRatio: 3, quality: "high" });
  assert.ok(b.width * b.height <= getQualityPreset("high").maxPixels);
  assert.throws(() => calculateRenderSize({ cssWidth: 0, cssHeight: 100 }), RangeError);
  assert.throws(() => getQualityPreset("ultra"), RangeError);
});

test("pixel textures use nearest filtering and explicit color space", () => {
  const THREE = { NearestFilter: 1, ClampToEdgeWrapping: 2, SRGBColorSpace: "srgb", NoColorSpace: "none" };
  const color = configurePixelTexture(THREE, {}, { kind: "color" });
  assert.equal(color.magFilter, THREE.NearestFilter);
  assert.equal(color.minFilter, THREE.NearestFilter);
  assert.equal(color.generateMipmaps, false);
  assert.equal(color.colorSpace, "srgb");
  const data = configurePixelTexture(THREE, {}, { kind: "data" });
  assert.equal(data.colorSpace, "none");
  assert.throws(() => configurePixelTexture(THREE, {}, { kind: "unknown" }), RangeError);
});

test("resource cleanup is idempotent, reversed and aggregates failures", () => {
  const disposed = [];
  const scope = createResourceScope();
  const a = scope.track({ dispose: () => disposed.push("a") });
  scope.track(a);
  scope.track({ dispose: () => disposed.push("b") });
  assert.equal(scope.count, 2);
  scope.dispose();
  scope.dispose();
  assert.deepEqual(disposed, ["b", "a"]);
  assert.throws(() => scope.track(a), /disposed/);
  const failing = createResourceScope();
  failing.track({ dispose: () => { throw Error("failed"); } });
  assert.throws(() => failing.dispose(), AggregateError);
  assert.equal(failing.disposed, true);
});

test("frame metrics are bounded and use nearest-rank percentiles", () => {
  const m = createFrameMetrics({ capacity: 4 });
  assert.equal(m.summary().count, 0);
  for (const x of [9, 12, 15, 30, 45]) m.record(x);
  assert.deepEqual(m.summary(), { count: 4, p50Ms: 15, p95Ms: 45, meanMs: 25.5 });
  assert.throws(() => m.record(0), RangeError);
  m.reset();
  assert.equal(m.summary().count, 0);
});

