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
  assert.match(world,/setSeaReflection\(quality!=="basic"&&!softwareGpu\)/);
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
