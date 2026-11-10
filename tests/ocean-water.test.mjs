import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const ocean=readFileSync(new URL("../src/game/ocean.ts",import.meta.url),"utf8");
const world=readFileSync(new URL("../src/game/world.ts",import.meta.url),"utf8");
const env=readFileSync(new URL("../src/game/environment.ts",import.meta.url),"utf8");
const fishing=readFileSync(new URL("../src/game/fishing.ts",import.meta.url),"utf8");

test("sea is the official three.js Water with a real planar reflection",()=>{
  assert.match(ocean,/from "three\/addons\/objects\/Water\.js"/);
  assert.match(ocean,/new Water\(/);
  assert.match(ocean,/mirrorSampler/);
});

test("the endless outer plane is hidden while the mirror renders (no feedback loop)",()=>{
  assert.match(ocean,/onBeforeRender/);
  assert.match(ocean,/outer\.visible\s*=\s*false/);
});

test("reflection can be switched off for the basic tier and is wired through the world",()=>{
  assert.match(ocean,/setReflection/);
  assert.match(env,/setSeaReflection/);
  assert.match(world,/setSeaReflection\(quality!=="basic"&&!softwareGpu&&new URLSearchParams\(window\.location\.search\)\.get\("reflect"\)!=="0"\)/);   // ?reflect=0: audit switch
});

test("rod shaft points forward from the grip (regression: rod looked like a short stump)",()=>{
  assert.match(fishing,/rotateX\(-Math\.PI\/2\+pitch\)/);
});

test("the mirror pass is throttled to every second frame to halve its cost",()=>{
  assert.match(ocean,/mirrorTick\+\+&1/);
});

test("software rasterisers skip the mirror pass unless ?mirror=1 forces it",()=>{
  const main=readFileSync(new URL("../src/game/main.ts",import.meta.url),"utf8");
  assert.match(main,/swiftshader\|llvmpipe/);
  assert.match(main,/get\("mirror"\)!=="1"/);
});

test("the composite pass tone-maps with AgX (ported from web-ocean, credited) and keeps ACES for A/B", () => {
  const pipeline = readFileSync(new URL("../src/rendering/hd2d-pipeline.js", import.meta.url), "utf8");
  assert.match(pipeline, /vec3 agxMap\(/);
  assert.match(pipeline, /uAgx:\s*\{ value: 1\.0 \}/);
  assert.match(pipeline, /acesFit\(col\)/);
  assert.match(pipeline, /Noniv\/web-ocean/);
  assert.match(readFileSync(new URL("../docs/ASSET-CREDITS.md", import.meta.url), "utf8"), /Noniv\/web-ocean/);
  assert.match(readFileSync(new URL("../src/game/main.ts", import.meta.url), "utf8"), /get\("tone"\)==="aces"/);
});


test("ocean limits storm crests at harbour edge and masks its water under dry land",()=>{
  assert.match(ocean,/SEA_LEVEL_Y/);
  assert.match(ocean,/mesh\\.position\\.set\\(140,SEA_LEVEL_Y,0\\)/);
  assert.match(ocean,/vWorld\\.x<shoreWaterLimit\\(vWorld\\.z\\)/);
  assert.match(ocean,/float damp=\\.06\\+\\.94\\*smoothstep\\(0\\.0,9\\.0,dist\\)/);
  assert.match(ocean,/float damp=\\.06\\+\\.94\\*smoothstep\\(0\\.0,9\\.0,shoreDist\\)/);
  assert.match(ocean,/mirrorSampler/);
});
