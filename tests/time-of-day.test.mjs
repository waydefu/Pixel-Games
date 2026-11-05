import test from "node:test";
import assert from "node:assert/strict";
import { sunDirection, moonDirection, sunElevationDeg, skyAt, describeHour, wrapHour } from "../src/game/time-of-day.js";

test("the sun rises in the east (the sea), peaks at noon and sets in the west", () => {
  const rise = sunDirection(6), noon = sunDirection(12), set = sunDirection(18);
  assert.ok(rise.x > 0.99 && Math.abs(rise.y) < 1e-9, "sunrise on the eastern horizon");
  assert.ok(set.x < -0.99 && Math.abs(set.y) < 1e-9, "sunset on the western horizon");
  assert.ok(noon.y > 0.85 && Math.abs(noon.x) < 1e-6, "noon: highest, near the zenith");
  for (const h of [9, 10, 12, 15, 17]) assert.ok(sunElevationDeg(h) > 0, `up at ${h}h`);
  for (const h of [0, 2, 21, 23]) assert.ok(sunElevationDeg(h) < -10, `down at ${h}h`);
  assert.ok(sunDirection(9).x > 0 && sunDirection(15).x < 0, "east in the morning, west in the afternoon");
  assert.ok(sunDirection(12).z < 0, "the sun passes to the north of the village");
});

test("the moon is up when the sun is down and rises in the east as the sun sets", () => {
  assert.ok(moonDirection(0).y > 0.5, "high at midnight");
  assert.ok(moonDirection(18.5).x > 0.5 && moonDirection(18.5).y > -0.1, "rising in the east at dusk");
  assert.ok(moonDirection(5.5).x < -0.5, "setting in the west before dawn");
  assert.ok(moonDirection(12).y < 0, "below the horizon at noon");
  for (const h of [0, 7, 13, 21]) {
    const m = moonDirection(h);
    assert.ok(Math.abs(Math.hypot(m.x, m.y, m.z) - 1) < 1e-9);
  }
});

test("lighting follows the sun: strong at noon, absent at night, lamps on after dusk", () => {
  const noon = skyAt(12), dusk = skyAt(18.6), night = skyAt(0), dawn = skyAt(6.2);
  assert.ok(noon.sunIntensity > 2.5 && noon.dayLight > 0.99 && noon.night < 0.01 && noon.lampGlow < 0.01);
  assert.equal(night.sunIntensity, 0);
  assert.ok(night.night > 0.99 && night.starAlpha > 0.99 && night.lampGlow > 0.99);
  assert.ok(night.moonIntensity > 0.3 && noon.moonIntensity === 0);
  assert.ok(dusk.lampGlow > 0.5 && dusk.sunIntensity < noon.sunIntensity, "lamps light before the sky is dark");
  assert.ok(dawn.horizon[0] > dawn.horizon[2], "a warm horizon at sunrise");
  assert.ok(night.exposure > noon.exposure, "the camera opens up at night");
  assert.ok(noon.sunRays > 0.99 && night.sunRays < 0.01);
});

test("every colour is finite and changes continuously through the whole day", () => {
  let previous = null;
  for (let h = 0; h < 24; h += 0.05) {
    const s = skyAt(h);
    for (const c of [s.zenith, s.mid, s.horizon, s.fog, s.sunColor, s.hemiSky, s.hemiGround, s.cloudLit, s.cloudShade]) {
      assert.equal(c.length, 3);
      for (const v of c) assert.ok(Number.isFinite(v) && v >= 0 && v < 5);
    }
    if (previous) {
      for (const key of ["zenith", "mid", "horizon", "fog", "hemiSky"]) {
        for (let i = 0; i < 3; i++) assert.ok(Math.abs(s[key][i] - previous[key][i]) < 0.08, `${key} jumps at ${h.toFixed(2)}h`);
      }
      assert.ok(Math.abs(s.sunIntensity - previous.sunIntensity) < 0.2);
    }
    previous = s;
  }
});

test("hours wrap and are described for the HUD", () => {
  assert.equal(wrapHour(25.5), 1.5);
  assert.equal(wrapHour(-1), 23);
  assert.equal(describeHour(7.5).text, "07:30");
  assert.equal(describeHour(12).phase, "白天");
  assert.equal(describeHour(0).phase, "夜晚");
  assert.equal(describeHour(6.1).phase, "日出");
  assert.equal(describeHour(17.8).phase, "日落");
  assert.equal(describeHour(18.1).phase, "黃昏");
  assert.equal(describeHour(5.9).phase, "黎明");
  const a = skyAt(3.3).sunDir, b = skyAt(27.3).sunDir;
  for (const k of ["x", "y", "z"]) assert.ok(Math.abs(a[k] - b[k]) < 1e-12, "a full day later is the same sky");
});
