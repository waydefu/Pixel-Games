import test from "node:test";
import assert from "node:assert/strict";
import { GENERA, GENUS_INDEX, cloudMix, aggregateCover, ramp, weatherToCloudInputs } from "../src/game/cloud-genera.js";
import { WEATHER_PRESETS } from "../src/game/weather.js";

const mixOf = name => cloudMix(weatherToCloudInputs(WEATHER_PRESETS[name]));
const at = (mix, id) => mix[GENUS_INDEX[id]];

test("the ten WMO genera are all present, once, as 4 forms x 3 height bands", () => {
  assert.equal(GENERA.length, 10);
  assert.deepEqual(GENERA.map(g => g.code).sort(), ["Ac", "As", "Cb", "Cc", "Ci", "Cs", "Cu", "Ns", "Sc", "St"]);
  assert.equal(new Set(GENERA.map(g => g.id)).size, 10);
  for (const g of GENERA) {
    assert.ok(["high", "mid", "low"].includes(g.level), g.id);
    assert.ok(["filament", "stratiform", "granular", "convective"].includes(g.form), g.id);
    assert.ok(g.opacity > 0 && g.opacity <= 1, g.id);
    assert.ok(g.name.length >= 2);
  }
  // high: Ci Cc Cs; middle: Ac As Ns; low: Sc St Cu (Cb stands through all, kept with the low convective form)
  assert.deepEqual(GENERA.filter(g => g.level === "high").map(g => g.code).sort(), ["Cc", "Ci", "Cs"]);
  assert.deepEqual(GENERA.filter(g => g.level === "mid").map(g => g.code).sort(), ["Ac", "As", "Ns"]);
  assert.deepEqual(GENERA.filter(g => g.form === "convective").map(g => g.code).sort(), ["Cb", "Cu"]);
  GENERA.forEach((g, i) => assert.equal(GENUS_INDEX[g.id], i));
});

test("cloudMix stays in 0..1 for every combination of its inputs", () => {
  for (const cover of [0, 0.1, 0.4, 0.7, 1]) for (const precipitation of [0, 0.5, 1]) for (const convection of [0, 1]) for (const haze of [0, 0.6, 1]) {
    const mix = cloudMix({ cover, precipitation, convection, haze });
    assert.equal(mix.length, 10);
    for (const v of mix) assert.ok(Number.isFinite(v) && v >= 0 && v <= 1, JSON.stringify({ cover, precipitation, convection, haze, v }));
  }
  assert.equal(ramp(0, 0.2, 0.8), 0);
  assert.equal(ramp(1, 0.2, 0.8), 1);
  assert.ok(ramp(0.5, 0.2, 0.8) > 0.4 && ramp(0.5, 0.2, 0.8) < 0.6);
});

test("each weather preset gets the clouds it should: a clear sky has a few lumps, rain has nimbostratus, fog a low sheet", () => {
  const clear = mixOf("clear"), partly = mixOf("partly"), overcast = mixOf("overcast"), rain = mixOf("rain"), storm = mixOf("storm"), fog = mixOf("fog");
  assert.ok(at(clear, "cumulus") > 0.1 && at(clear, "cumulus") < 0.5, "a few fair-weather lumps");
  assert.ok(at(clear, "nimbostratus") === 0 && at(clear, "altostratus") === 0);
  assert.ok(at(partly, "cumulus") > 0.5 && at(partly, "cirrus") > 0.3, "lumps and streaks");
  assert.ok(at(partly, "altostratus") === 0 && at(partly, "stratocumulus") < 0.2, "a middling sky is not a deck");
  assert.ok(at(overcast, "stratocumulus") > 0.5 && at(overcast, "altostratus") > 0.4, "overcast is a deck");
  assert.ok(at(overcast, "cumulus") < 0.15);
  assert.ok(at(rain, "nimbostratus") > 0.5 && at(rain, "stratus") > 0.5);
  assert.ok(at(rain, "cumulus") === 0 && at(rain, "altocumulus") === 0, "no fair-weather clouds in the rain");
  assert.equal(at(storm, "cumulonimbus"), 1);
  assert.ok(at(clear, "cumulonimbus") === 0 && at(partly, "cumulonimbus") === 0 && at(rain, "cumulonimbus") === 0);
  assert.ok(at(fog, "stratus") > 0.8, "fog is a low sheet");
  assert.ok(at(fog, "cumulus") < 0.15 && at(fog, "altostratus") < 0.2);
});

test("total cover is the union of independent layers and grows from clear to storm", () => {
  const one = new Array(10).fill(0); one[GENUS_INDEX.stratus] = 1;
  assert.ok(Math.abs(aggregateCover(one) - GENERA[GENUS_INDEX.stratus].opacity) < 1e-9);
  const two = new Array(10).fill(0); two[GENUS_INDEX.stratus] = 1; two[GENUS_INDEX.altostratus] = 1;
  const a = GENERA[GENUS_INDEX.stratus].opacity, b = GENERA[GENUS_INDEX.altostratus].opacity;
  assert.ok(Math.abs(aggregateCover(two) - (1 - (1 - a) * (1 - b))) < 1e-9, "occlusion is multiplied, not added");
  assert.equal(aggregateCover(new Array(10).fill(0)), 0);
  const cover = ["clear", "partly", "overcast", "rain", "storm"].map(n => aggregateCover(mixOf(n)));
  for (let i = 1; i < cover.length; i++) assert.ok(cover[i] > cover[i - 1], "cover rises with the weather: " + cover.join(", "));
  assert.ok(cover[0] < 0.25 && cover[4] > 0.95);
});

test("weather state maps into cloudMix inputs in range, with rain and storm driving precipitation and convection", () => {
  for (const [name, preset] of Object.entries(WEATHER_PRESETS)) {
    const i = weatherToCloudInputs(preset);
    for (const k of ["cover", "precipitation", "convection", "haze"]) assert.ok(i[k] >= 0 && i[k] <= 1, name + " " + k);
  }
  assert.ok(weatherToCloudInputs(WEATHER_PRESETS.rain).precipitation > 0.6);
  assert.equal(weatherToCloudInputs(WEATHER_PRESETS.storm).convection, 1);
  assert.equal(weatherToCloudInputs(WEATHER_PRESETS.clear).convection, 0);
  assert.ok(weatherToCloudInputs(WEATHER_PRESETS.fog).haze > 0.9);
});
