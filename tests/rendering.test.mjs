import test from "node:test";
import assert from "node:assert/strict";
import { calculateRenderSize, getQualityPreset } from "../src/rendering/quality.js";
import { configurePixelTexture } from "../src/rendering/pixel-texture.js";
import { createResourceScope } from "../src/rendering/resource-scope.js";
import { createFrameMetrics } from "../src/rendering/frame-metrics.js";
import { createThreeRendererHost } from "../src/rendering/three-host.js";

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

test("Three host handles resize, GPU loss, stats and disposal without DOM globals", () => {
  const events = new Map();
  const calls = [];
  const canvas = {
    addEventListener(k, listener) { events.set(k, listener); },
    removeEventListener(k, listener) { if (events.get(k) === listener) events.delete(k); },
  };
  class WebGLRenderer {
    constructor(opts) { assert.equal(opts.canvas, canvas); this.shadowMap = {}; this.info = { render: { calls: 4, triangles: 24 }, memory: { geometries: 2, textures: 3 } }; }
    setPixelRatio(v) { calls.push(["ratio", v]); }
    setSize(w, h, css) { calls.push(["size", w, h, css]); }
    render() { calls.push(["render"]); }
    dispose() { calls.push(["dispose"]); }
  }
  const statuses = [];
  const host = createThreeRendererHost({
    THREE: { WebGLRenderer, SRGBColorSpace: "srgb" }, canvas, scene: {}, camera: {},
    onStatus: status => statuses.push(status), quality: "basic",
  });
  assert.equal(host.state, "ready");
  assert.equal(host.resize(390, 844, 3).width, 390);
  host.resize(390, 844, 3);
  assert.equal(calls.filter(x => x[0] === "size").length, 1);
  assert.equal(host.render(), true);
  assert.equal(host.stats().textures, 3);
  let prevented = false;
  events.get("webglcontextlost")({ preventDefault: () => prevented = true });
  assert.equal(prevented, true);
  assert.equal(host.render(), false);
  events.get("webglcontextrestored")({});
  assert.equal(host.render(), true);
  host.dispose();
  host.dispose();
  assert.equal(host.render(), false);
  assert.equal(host.state, "disposed");
  assert.equal(events.size, 0);
  assert.deepEqual(statuses, ["context-lost", "context-restored", "disposed"]);
  assert.throws(() => host.resize(100, 100), /disposed/);
});
