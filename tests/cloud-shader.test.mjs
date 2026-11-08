import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CLOUD_COMMON, CLOUD_FRAG, CLOUD_SHADOW_FRAG, CLOUD_VERT, CLOUD_SHADOW_VERT } from "../src/game/cloud-shader.ts";
import { GENERA } from "../src/game/cloud-genera.js";

const read = p => readFileSync(new URL("../src/game/" + p, import.meta.url), "utf8");
const balanced = (text, open, close) => { let d = 0; for (const c of text) { if (c === open) d++; if (c === close) d--; if (d < 0) return false; } return d === 0; };
const arrayOf = name => { const m = CLOUD_COMMON.match(new RegExp("const (?:float|int) " + name + "\\[10\\]=(?:float|int)\\[10\\]\\(([^)]*)\\)")); assert.ok(m, name); return m[1].split(",").map(Number); };

test("both shaders are balanced and use no reserved GLSL identifiers", () => {
  for (const [name, src] of [["sky", CLOUD_FRAG], ["shadow", CLOUD_SHADOW_FRAG], ["vert", CLOUD_VERT], ["shadow vert", CLOUD_SHADOW_VERT]]) {
    assert.ok(balanced(src, "{", "}"), name + " braces");
    assert.ok(balanced(src, "(", ")"), name + " parens");
    assert.ok(balanced(src, "[", "]"), name + " brackets");
  }
  // 'patch' once stopped the whole sky compiling; keep the other reserved words out as identifiers too
  for (const word of ["patch", "sample", "common", "partition", "active", "filter", "input", "output", "superp", "noinline"]) {
    assert.doesNotMatch(CLOUD_COMMON + CLOUD_FRAG, new RegExp("\\b(?:float|vec[234]|int|bool)\\s+" + word + "\\b"), word);
  }
});

test("the sky and the ground shadow draw the same layers: one shared block, one layer evaluator", () => {
  assert.ok(CLOUD_FRAG.includes(CLOUD_COMMON), "the sky includes the shared block");
  assert.ok(CLOUD_SHADOW_FRAG.includes(CLOUD_COMMON), "the shadow includes the shared block");
  assert.match(CLOUD_COMMON, /vec2 evalLayer\(int id,vec2 P,vec2 ldir,int Q,out float alpha\)/);
  assert.match(CLOUD_FRAG, /evalLayer\(id,cameraPosition\.xz\+plane\*LH\[id\]/);
  assert.match(CLOUD_SHADOW_FRAG, /evalLayer\(id,ground\+off\*LH\[id\]/);
  // the shadow has no lighting and no sky uniforms
  assert.match(CLOUD_SHADOW_FRAG, /gNeedLit=false/);
  assert.doesNotMatch(CLOUD_SHADOW_FRAG, /uTwilight|uWeatherDark|paintCloud\(/);
});

test("the layer tables cover all ten genera, in cloud-genera order, with sensible heights and cell sizes", () => {
  const order = arrayOf("ORDER");
  assert.deepEqual([...order].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], "every genus is drawn once");
  const H = arrayOf("LH"), S = arrayOf("LS"), W = arrayOf("LW"), A = arrayOf("LALT"), R = arrayOf("LRIM");
  for (const t of [H, S, W, A, R]) assert.equal(t.length, 10);
  GENERA.forEach((g, i) => {
    assert.ok(H[i] > 0 && S[i] > 0, g.id);
    assert.ok(A[i] >= 0 && A[i] <= 1 && R[i] >= 0 && R[i] <= 1, g.id);
  });
  // the high band is above the middle band, which is above the low one
  const byLevel = level => GENERA.map((g, i) => [g, i]).filter(([g]) => g.level === level).map(([, i]) => H[i]);
  assert.ok(Math.min(...byLevel("high")) > Math.max(...byLevel("mid")), "high above middle");
  assert.ok(Math.min(...byLevel("mid")) > Math.max(...byLevel("low")), "middle above low");
  // drawn from the lowest (nearest) layer to the highest
  const drawnHeights = order.map(i => H[i]);
  for (let i = 1; i < drawnHeights.length; i++) assert.ok(drawnHeights[i] >= drawnHeights[i - 1] * 0.6, "low to high: " + drawnHeights);
  // the lump scale of the low clouds is small against the island (about 100 across) so their shadows are patches to walk through
  for (const id of [6, 7, 8]) assert.ok(S[id] <= 100, "cell size of genus " + id);
});

test("clouds are built the way the failure modes taught: separate lumps, rotated lattices, footprint-faded octaves", () => {
  assert.match(CLOUD_COMMON, /float vn\(vec2 p\)/);
  assert.match(CLOUD_COMMON, /float cuLump|0\.28\+smoothstep\(0\.35,0\.80,vn\(/, "cumulus is part separate lumps");
  assert.match(CLOUD_COMMON, /const mat2 R15/);
  assert.match(CLOUD_COMMON, /const mat2 R60/);
  assert.match(CLOUD_COMMON, /smoothstep\(0\.25,0\.8,fq\)/, "an octave finer than the pixel fades to its mean");
  assert.match(CLOUD_COMMON, /fwidth\(uv\)/);
  assert.doesNotMatch(CLOUD_COMMON, /worley|cellular|voronoi/i, "no grids of cells");
  for (const form of ["cumulusForm", "granularForm", "flockForm", "stratiform", "filament"]) assert.match(CLOUD_COMMON, new RegExp(form + "\\("));
});

test("light: the sun's own colour on the lit side, sky light in shade, high layers keep the sun longest, with an afterglow", () => {
  assert.match(CLOUD_FRAG, /smoothstep\(-0\.035-0\.07\*alt01,0\.015-0\.015\*alt01,gSunEl\)/);
  assert.match(CLOUD_FRAG, /vec3 shadeCol=/);
  assert.match(CLOUD_FRAG, /vec3 glow=/);
  assert.match(CLOUD_FRAG, /gDirect=mix\(uSunColor\*2\.2,fiery/);
  assert.match(CLOUD_FRAG, /uGen\[3\]\+uGen\[5\]/, "overcast decks flatten the light");
  assert.match(CLOUD_FRAG, /#include <tonemapping_fragment>/);
  assert.match(CLOUD_FRAG, /#include <colorspace_fragment>/);
});

test("the sky shader is wired to the mix, the noise and the audit switches", () => {
  const fjord = read("fjord.ts"), world = read("world.ts");
  assert.match(fjord, /uGen:\{value:new Array\(10\)\.fill\(0\)\}/);
  assert.match(fjord, /function setCloudMix\(/);
  assert.match(fjord, /cloudOnly/);
  assert.match(fjord, /forcedMix/);
  assert.match(fjord, /uHalo/);
  assert.match(world, /fjord\.setCloudMix\(cloudMix\(weatherToCloudInputs\(W\)\)\)/);
  // the 22-degree halo is 21.7 degrees out and only while an ice veil is up
  assert.match(fjord, /acos\(clamp\(s,0\.0,1\.0\)\)-0\.379/);
});
