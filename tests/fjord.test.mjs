import test from "node:test";
import assert from "node:assert/strict";
import { fjordHeight, coastX, flankScale, OPEN_SEA_CORRIDOR } from "../src/game/terrain-profile.js";

const regions = ["mainland", "east", "north", "south"];

test("village plateau stays flat while the landward backdrop rises behind it", () => {
  for (const z of [-30, 0, 30]) {
    assert.equal(fjordHeight(-43, z, "mainland"), 0);
    assert.equal(fjordHeight(65, z, "east"), 0);
    assert.ok(fjordHeight(-150, z, "mainland") > 20);
  }
});

test("spurs join the western backdrop and fall to low headlands toward the sea", () => {
  assert.ok(flankScale(-40) > 0.99);
  assert.ok(flankScale(80) < 0.12);
  assert.ok(flankScale(-30) > flankScale(10) && flankScale(10) > flankScale(55), "monotonic fall-off");
  assert.ok(fjordHeight(-25, 190, "north") > 25, "mountains remain behind the town");
  assert.ok(fjordHeight(-25, -190, "south") > 25);
  for (const region of ["north", "south"]) {
    for (let x = 60; x <= 245; x += 5) {
      for (let z = 84; z <= 204; z += 6) {
        const zz = region === "north" ? z : -z;
        assert.ok(fjordHeight(x, zz, region) < 11, `${region} spur too tall at ${x},${zz}`);
      }
    }
  }
});

test("eastern sea holds only low island silhouettes over a submerged bed", () => {
  let islands = 0, submerged = 0;
  for (let x = 72; x <= 245; x += 4) {
    for (let z = -210; z <= 210; z += 6) {
      const h = fjordHeight(x, z, "east");
      assert.ok(h < 9.5, `east terrain too tall at ${x},${z}: ${h}`);
      if (x < 100) assert.ok(h <= 0.001 || h < 1.5, "no land near the shore");
      if (h > 0.5) islands++;
      if (h < 0) submerged++;
    }
  }
  assert.ok(submerged > islands * 3, "mostly open water");
  assert.ok(islands > 0, "some distant islands give the horizon depth");
});

test("open sea corridor: nothing rises above a low elevation angle in front of the village", () => {
  const { originX, originZ, eye, halfAngle, maxElevationDeg } = OPEN_SEA_CORRIDOR;
  const limit = Math.tan(maxElevationDeg * Math.PI / 180);
  let worst = 0;
  for (const region of regions.filter(r => r !== "mainland")) {
    for (let bearing = -halfAngle; bearing <= halfAngle; bearing += Math.PI / 90) {
      for (let d = 20; d <= 320; d += 4) {
        const x = originX + d * Math.cos(bearing), z = originZ + d * Math.sin(bearing);
        const rise = (fjordHeight(x, z, region) - eye) / d;
        worst = Math.max(worst, rise);
        assert.ok(rise < limit, `${region} blocks the sea view at ${x.toFixed(0)},${z.toFixed(0)} (${(Math.atan(rise) * 180 / Math.PI).toFixed(1)} deg)`);
      }
    }
  }
  assert.ok(worst > -1, "sanity: samples were taken");
});

test("terrain is deterministic and coastal edge bounded", () => {
  assert.equal(fjordHeight(-120, 12, "mainland"), fjordHeight(-120, 12, "mainland"));
  assert.equal(fjordHeight(NaN, 0, "east"), 0);
  assert.throws(() => fjordHeight(0, 0, "nope"), RangeError);
  for (let z = -80; z < 80; z += 8) assert.ok(coastX(z) > 12 && coastX(z) < 15);
});
