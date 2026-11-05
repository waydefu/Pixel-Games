import test from "node:test";
import { skyAt } from "../src/game/time-of-day.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=(file)=>readFileSync(new URL("../src/game/"+file,import.meta.url),"utf8");

test("terrain adopts existing physically lit mesh, cloud cover, aerial and rock material plugins",()=>{
  const src=source("fjord.ts");
  assert.match(src,/new THREE\.MeshStandardMaterial/);
  assert.match(src,/cloudField\.applyToMaterial\(regionMaterial\)/);
  assert.match(src,/applyAerialPerspective\(regionMaterial/);
  assert.match(src,/applyRockSurface\(regionMaterial\)/);
  assert.match(src,/fjordSurfaceHeight/); // keeps source height aligned with forest
});
test("rock strata do not need large triplanar textures or new render passes",()=>{
  const rock=source("rock-surface.ts");
  assert.match(rock,/#include <color_fragment>/);
  assert.match(rock,/#include <normal_fragment_maps>/);
  assert.match(rock,/vRockWorldPosition\.y\*1\.68/);
  assert.match(rock,/rockSteepness/);
  assert.match(rock,/viewMatrix\*vec4\(rockWorldNormalOffset/);
  assert.match(rock,/customProgramCacheKey/);
  assert.doesNotMatch(rock,/new THREE\.WebGLRenderTarget|texture2D|triplanarTexture/);
});
test("sky is an art-directed gradient driven by the time of day: deep blue zenith over a pale horizon at noon",()=>{
  const fjord=source("fjord.ts");
  assert.match(fjord,/uZenith:\{value:liveSky\.zenith\}/);
  assert.match(fjord,/uHorizon:\{value:liveSky\.horizon\}/);
  assert.doesNotMatch(fjord,/new Sky\(\)/);
  const noon=skyAt(12);
  assert.ok(noon.zenith[0]<noon.mid[0]&&noon.mid[0]<noon.horizon[0],"deeper overhead than at the horizon");
  assert.ok(noon.zenith[2]>noon.zenith[0]*5,"the zenith is clearly blue");
});
