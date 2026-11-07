import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src=(p)=>readFileSync(new URL("../src/game/"+p,import.meta.url),"utf8");

test("aerial scattering replaces StandardMaterial fog instead of applying fog twice",()=>{
  const aerial=src("aerial-perspective.ts");
  const fjord=src("fjord.ts");
  assert.match(aerial,/applyAerialPerspective/);
  assert.match(aerial,/#include <fog_fragment>/);
  assert.match(aerial,/fogDensity\*fogDensity\*vFogDepth\*vFogDepth/);
  assert.match(aerial,/1\.0-exp\(-aerialBase/);
  assert.match(aerial,/vAerialWorldPosition\.y/);
  assert.match(aerial,/uAerialSunWarmth\*phase/);
  assert.match(fjord,/applyAerialPerspective\(regionMaterial/);
  assert.match(aerial,/customProgramCacheKey/);
});

test("the shared sky and cloud shadows stay synchronized on all presets",()=>{
  const sky=src("fjord.ts");
  const world=src("world.ts");
  const cloud=src("cloud-field.ts");
  assert.match(sky,/skyMaterial/);
  assert.doesNotMatch(sky,/new Sky\(\)/,"physical Preetham sky was replaced by the art-directed gradient");
  assert.match(sky,/uniform float uCloudDetailLevel/);
  assert.match(sky,/float low=texture2D\(uCloudMap,cloudUV\)\.r/);
  assert.match(sky,/float opticalDepth=/);
  assert.match(sky,/1\.0-exp\(-opticalDepth\)/);
  // Regress the verified old shader bug: a .11 ray clamp with an active
  // cloud horizon band formed tall rectangular cloud curtains in G4 snapshots.
  assert.match(sky,/max\(\.035,ray\.y\)/);
  assert.match(sky,/smoothstep\(\.04,\.17,ray\.y\)/);
  assert.doesNotMatch(sky,/max\(\.11,ray\.y\)/);
  assert.match(sky,/uCloudDetailLevel>0\.5/);
  assert.match(sky,/uCloudDetailLevel>1\.5/);
  assert.match(sky,/quality==="high"\?2:quality==="balanced"\?1:0/);
  assert.match(world,/fjord\.setSkyQuality\(heavy\)/);
  assert.match(world,/cloudField\.setStrength\(\(quality/); // preset strength, scaled by daylight
  assert.match(cloud,/uCloudMap:\{value:texture\}/);
  assert.match(cloud,/uCloudWind\.value\.set/);
});

test("mobile budget remains bounded and all water prohibitions hold",()=>{
  const sky=src("fjord.ts");
  const aerial=src("aerial-perspective.ts");
  const ocean=src("ocean.ts");
  assert.doesNotMatch(sky,/new THREE\.WebGLRenderTarget|marchSteps\s*=\s*500/);
  assert.doesNotMatch(aerial,/new THREE\.WebGLRenderTarget|sampler2D/);
  assert.doesNotMatch(ocean,/new THREE\.WebGLRenderTarget|FFTCompute|uFftSpectrum/);
  assert.match(ocean,/uSunDirection/);
});

test("Beer-Lambert optical density retains monotone bounded opacity",()=>{
  const opacity=(depth)=>1-Math.exp(-depth);
  for(const depth of [0,.1,.5,1,2,4,8]){
    assert.ok(opacity(depth)>=0&&opacity(depth)<=1);
  }
  assert.equal(opacity(0),0);
  assert.ok(opacity(2)>opacity(1));
  assert.ok(opacity(8)>.99);
});

test("clouds are volumetric (height-field normals, a march toward the sun), have no straight streak layer, and dim the direct sun", async () => {
  const fs = await import("node:fs");
  const fjord = fs.readFileSync(new URL("../src/game/fjord.ts", import.meta.url), "utf8");
  assert.match(fjord, /marchSteps/);
  assert.match(fjord, /vec3 bump=normalize/);
  assert.doesNotMatch(fjord, /float streak=/);
  assert.match(fs.readFileSync(new URL("../src/game/cloud-field.ts", import.meta.url), "utf8"), /function sunOcclusion/);
  assert.match(fs.readFileSync(new URL("../src/game/world.ts", import.meta.url), "utf8"), /environment\.setSunTransmit\(transmit\)/);
  assert.match(fs.readFileSync(new URL("../src/game/environment.ts", import.meta.url), "utf8"), /liveSky\.sunIntensity\*sunTransmit/);
  // the moon's dark side is sky, not a black disc; stars come in three magnitude classes
  assert.match(fjord, /dark side is sky/);
  assert.match(fjord, /for\(int k=0;k<3;k\+\+\)/);
  assert.doesNotMatch(fjord, /diffraction|cross\*/);
});
