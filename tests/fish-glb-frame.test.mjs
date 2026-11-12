import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { FISH_GLB_FILES, FLAT_FISH, toFishFrame } from "../src/game/fish-glb-frame.js";
import { FISH_SPECS } from "../src/game/fish-model.js";

// A box of x in [-3, 3] (the body), y in [-0.2, 0.6] (height, off-centre on purpose), z in [-0.1, 0.1] (width).
function box() {
  const corners = [];
  for (const x of [-3, 3]) for (const y of [-0.2, 0.6]) for (const z of [-0.1, 0.1]) corners.push(x, y, z);
  return corners;
}
const bounds = (positions, axis) => {
  const values = []; for (let i = axis; i < positions.length; i += 3) values.push(positions[i]);
  return [Math.min(...values), Math.max(...values)];
};

test("toFishFrame puts the tail at x=0, the nose at the species length and centres y and z", () => {
  const out = toFishFrame(box(), { length: .34 });
  const [x0, x1] = bounds(out, 0);
  assert.ok(Math.abs(x0) < 1e-6 && Math.abs(x1 - .34) < 1e-6, `x ${x0}..${x1}`);
  const [y0, y1] = bounds(out, 1), [z0, z1] = bounds(out, 2);
  assert.ok(Math.abs(y0 + y1) < 1e-6, "height is centred on the spine line");
  assert.ok(Math.abs(z0 + z1) < 1e-6, "width is centred on the midline");
  assert.ok(y1 > 0 && z1 > 0);
});

test("a flatfish is laid on its side: width moves to z and the thin axis to y", () => {
  const upright = toFishFrame(box(), { length: 1, flat: false });   // y is the tall axis here (0.8 units), z is thin (0.2)
  const laid = toFishFrame(box(), { length: 1, flat: true });
  const [uy0, uy1] = bounds(upright, 1), [uz0, uz1] = bounds(upright, 2);
  const [ly0, ly1] = bounds(laid, 1), [lz0, lz1] = bounds(laid, 2);
  assert.ok(uy1 - uy0 > uz1 - uz0, "upright: tall in y");
  assert.ok(lz1 - lz0 > ly1 - ly0, "laid: wide in z");
});

test("the body must be longest along x and the input is validated", () => {
  const tall = [0, 0, 0, 1, 5, 0, 0.1, 0, 0.2];   // y is longest
  assert.throws(() => toFishFrame(tall, { length: 1 }), /longest along x/);
  assert.throws(() => toFishFrame(box(), { length: 0 }), /must be positive/);
  assert.throws(() => toFishFrame([], { length: 1 }), /no vertices/);
});

test("the five game fish map to one bundled model each, and only the flatfish is laid flat", () => {
  assert.deepEqual(Object.keys(FISH_GLB_FILES).sort(), ["cod", "flounder", "herring", "mackerel", "salmon"]);
  for (const id of Object.keys(FISH_GLB_FILES)) assert.ok(FISH_SPECS[id], `${id} has a procedural spec`);
  assert.deepEqual([...FLAT_FISH], ["flounder"]);
  assert.ok(FISH_SPECS.flounder.flat, "the procedural flounder is also flat, so the laid pose matches it");
});

test("every mapped model is in the asset manifest as CC0 and exists on disk", () => {
  const manifest = JSON.parse(readFileSync("assets/manifest.json", "utf8"));
  for (const path of Object.values(FISH_GLB_FILES)) {
    const entry = manifest.assets.find(asset => asset.path === path);
    assert.ok(entry, `${path} is listed in assets/manifest.json`);
    assert.equal(entry.license, "CC0-1.0");
    assert.match(entry.source, /^https:\/\/huggingface\.co\/datasets\/codepawl\/world-fish-glb$/);
    assert.ok(existsSync(path), `${path} exists`);
  }
});

test("the credits document names every fish model", () => {
  const credits = readFileSync("docs/ASSET-CREDITS.md", "utf8");
  for (const path of Object.values(FISH_GLB_FILES)) {
    assert.ok(credits.includes(path.split("/").pop()), `${path} is credited`);
  }
  assert.match(credits, /CC0 1\.0/);
});
