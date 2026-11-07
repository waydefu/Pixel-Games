import test from "node:test";
import assert from "node:assert/strict";
import { buildFish, buildCrab, buildBoot, buildCatchModel, FISH_SPECS } from "../src/game/fish-model.js";
import { SPECIES } from "../src/game/fishing-logic.js";

test("every species has a model: finite, coloured, a few hundred triangles, about its own length", () => {
  for (const s of SPECIES) {
    const m = buildCatchModel(s.id);
    assert.ok(m.positions.length > 0 && m.positions.length % 9 === 0, s.id + " has whole triangles");
    assert.equal(m.positions.length, m.colors.length, s.id + " colours match vertices");
    assert.ok([...m.positions].every(Number.isFinite) && [...m.colors].every(v => v >= 0 && v <= 1), s.id + " is finite");
    assert.ok(m.triangles >= 48 && m.triangles < 3000, s.id + " triangle count " + m.triangles);
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < m.positions.length; i += 3) { min = Math.min(min, m.positions[i]); max = Math.max(max, m.positions[i]); }
    assert.ok(max - min > m.length * .6 && max - min < m.length * 1.6, s.id + " spans " + (max - min).toFixed(2) + " of " + m.length);
  }
});

test("fish are lofted along x with the nose at +x, the back up and the belly paler than the back", () => {
  for (const kind of Object.keys(FISH_SPECS)) {
    const m = buildFish(kind);
    let top = null, bottom = null;
    for (let i = 0; i < m.positions.length; i += 3) {
      const y = m.positions[i + 1];
      if (top === null || y > m.positions[top + 1]) top = i;
      if (bottom === null || y < m.positions[bottom + 1]) bottom = i;
    }
    const lum = i => m.colors[i] * .3 + m.colors[i + 1] * .59 + m.colors[i + 2] * .11;
    if (!FISH_SPECS[kind].flat) assert.ok(m.positions[top + 1] > Math.abs(m.positions[bottom + 1]) * .5, kind + " is taller on the back");
    // average luminance of the lower half vs the upper half
    let up = 0, upN = 0, down = 0, downN = 0;
    for (let i = 0; i < m.positions.length; i += 3) { if (m.positions[i + 1] > 0) { up += lum(i); upN++; } else if (m.positions[i + 1] < -.002) { down += lum(i); downN++; } }
    if (!FISH_SPECS[kind].flat) assert.ok(down / downN > up / upN, kind + " belly is lighter than its back");
  }
});

test("each species looks different: colours and shapes are distinct", () => {
  const sig = id => { const m = buildCatchModel(id); let r = 0, g = 0, b = 0; for (let i = 0; i < m.colors.length; i += 3) { r += m.colors[i]; g += m.colors[i + 1]; b += m.colors[i + 2]; } const n = m.colors.length / 3; return [r / n, g / n, b / n, m.triangles].map(v => v.toFixed(2)).join(); };
  const all = SPECIES.map(s => sig(s.id));
  assert.equal(new Set(all).size, SPECIES.length);
  assert.ok(buildCrab().triangles > 100 && buildBoot().triangles >= 50);
  assert.throws(() => buildFish("dragon"), RangeError);
});

import { LURES, buildLureKind } from "../src/game/fish-model.js";
import fs from "node:fs";

test("the tackle box has four distinct finite lures with the line-tie nose toward +x", () => {
  assert.deepEqual(LURES.map(l => l.id), ["minnow", "spoon", "frog", "jig"]);
  const sigs = new Set();
  for (const l of LURES) {
    const m = buildLureKind(l.id);
    assert.ok(m.positions.length > 0 && m.positions.length % 9 === 0 && m.positions.length === m.colors.length, l.id);
    assert.ok([...m.positions].every(Number.isFinite) && [...m.colors].every(v => v >= 0 && v <= 1), l.id);
    assert.ok(m.length > .05 && m.length < .14, l.id + " is lure sized: " + m.length);
    let maxX = -Infinity; for (let i = 0; i < m.positions.length; i += 3) maxX = Math.max(maxX, m.positions[i]);
    assert.ok(maxX > m.length * .85, l.id + " nose at +x");
    sigs.add(m.triangles);
  }
  assert.equal(sigs.size, LURES.length);
});

test("fish carry rayed fins, gills and eyes with a pupil and a catch-light", () => {
  const src = fs.readFileSync(new URL("../src/game/fish-model.js", import.meta.url), "utf8");
  assert.match(src, /pushFin\(/);
  assert.match(src, /catch-light/);
  assert.match(src, /gill cover/);
  for (const k of ["mackerel", "cod", "flounder", "salmon", "herring"]) assert.ok(buildFish(k).triangles > 450, k + " is detailed");
});

test("the rod is a modelled spinning combo and the HUD can switch lures", () => {
  const rod = fs.readFileSync(new URL("../src/game/rod-model.ts", import.meta.url), "utf8");
  for (const part of ["bail", "line roller", "T-knob", "reel seat", "EVA", "thread wraps"]) assert.ok(rod.includes(part), part);
  assert.match(fs.readFileSync(new URL("../src/game/fishing.ts", import.meta.url), "utf8"), /createRodModel\(scope\)/);
  assert.match(fs.readFileSync(new URL("../index.html", import.meta.url), "utf8"), /id="fish-lure"/);
});
