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
  const clouds=src("cloud-shader.ts");
  const world=src("world.ts");
  const cloud=src("cloud-field.ts");
  assert.match(sky,/skyMaterial/);
  assert.doesNotMatch(sky,/new Sky\(\)/,"physical Preetham sky was replaced by the art-directed gradient");
  assert.match(clouds,/uniform float uCloudDetailLevel/);
  // each layer is a point on a plane at its own height, so the sky and the ground shadows read one world position
  assert.match(clouds,/cameraPosition\.xz\+layerPlane\*LH\[ID\]/);
  assert.match(clouds,/ground\+layerOff\*LH\[ID\]/);
  // Regress the verified old shader bug: a .11 ray clamp with an active
  // cloud horizon band formed tall rectangular cloud curtains in G4 snapshots.
  // The stretch of a flat layer at a low angle is capped (it drew every cloud as a thin rod), and the sky and the shadows share it.
  assert.match(clouds,/vec2 skyPlane\(vec2 dirXZ,float elevation\)\{return dirXZ\/\(0\.28\+0\.72\*max\(elevation,0\.0\)\);\}/);
  assert.match(clouds,/vec2 plane=skyPlane\(ray\.xz,ray\.y\)/);
  assert.match(clouds,/vec2 off=skyPlane\(s\.xz,s\.y\)/);
  assert.doesNotMatch(clouds,/ray\.xz\/max\(ray\.y/);
  assert.match(clouds,/smoothstep\(0\.0,0\.20,ray\.y\)/);
  assert.doesNotMatch(clouds,/1\.0-smoothstep\(0\.86,0\.98,ray\.y\)/,"no artificial cloudless zenith cap");
  assert.doesNotMatch(clouds,/max\(0?\.11,ray\.y\)/);
  assert.match(clouds,/uCloudDetailLevel>0\.5/);
  assert.match(clouds,/uCloudDetailLevel>1\.5/);
  assert.match(sky,/quality==="high"\?2:quality==="balanced"\?1:0/);
  assert.match(world,/fjord\.setSkyQuality\(heavy\)/);
  assert.match(world,/cloudField\.setStrength\(/); // preset strength, scaled by daylight
  assert.match(cloud,/uCloudShadowMap:\{value:null/);
});

test("mobile budget remains bounded and all water prohibitions hold",()=>{
  const sky=src("fjord.ts");
  const shader=src("cloud-shader.ts");
  const shadow=src("cloud-shadow.ts");
  const aerial=src("aerial-perspective.ts");
  const ocean=src("ocean.ts");
  const world=src("world.ts");
  assert.doesNotMatch(sky,/new THREE\.WebGLRenderTarget|marchSteps\s*=\s*500/);
  assert.doesNotMatch(shader,/marchSteps\s*=\s*500|for\(int i=0;i<(2[89]|[3-9]\d|\d{3,});/);   // no long ray march
  // the one extra pass is the cloud-shadow map: one square target, <= 256 px, a tier smaller on Balanced and Basic,
  // at most once a frame, and none on a software rasteriser
  assert.equal((shadow.match(/new THREE\.WebGLRenderTarget/g)||[]).length,1);
  assert.match(shadow,/let size=256/);
  assert.match(shadow,/quality==="high"\?256:quality==="balanced"\?128:64/);
  assert.match(shadow,/if\(frame===lastFrame\)return/);
  assert.match(world,/fjord\.setShadowQuality\(quality,!softwareGpu\)/);
  // a software rasteriser renders at a fixed reduced scale (smaller on High), also on ?visualShot= pages (the browser tests
  // use them); only ?fullres=1 (audit PNGs) and ?mirror=1 keep full resolution
  const main=src("main.ts");
  assert.match(main,/const lowPower=softwareGpu&&new URLSearchParams\(location\.search\)\.get\("fullres"\)!=="1"/);
  assert.match(main,/quality\.value==="high"\?\.45:\.55/);
  assert.doesNotMatch(main,/const lowPower=softwareGpu&&!visualShot/);
  assert.match(main,/if\(lowPower\)host\.setRenderScale\(lowScale\(\)\);\n      resize\(\);/,"the scale follows a quality change");
  assert.match(readFileSync(new URL("../e2e/visual-audit.spec.mjs",import.meta.url),"utf8"),/&fullres=1/,"audit PNGs stay full resolution");
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

test("clouds are shaded toward the sun, have no straight streak layer, and dim the direct sun", async () => {
  const fs = await import("node:fs");
  const fjord = fs.readFileSync(new URL("../src/game/fjord.ts", import.meta.url), "utf8");
  const clouds = fs.readFileSync(new URL("../src/game/cloud-shader.ts", import.meta.url), "utf8");
  // lit-ness: the density read again shifted toward the sun; the sun-facing side brightens, the far side darkens
  assert.match(clouds, /ldir\*0\.16/);
  assert.match(clouds, /lit=clamp\(\(d-dl\)/);
  assert.match(clouds, /vec3 paintCloud\(/);
  assert.doesNotMatch(clouds, /float streak=/);
  assert.match(fs.readFileSync(new URL("../src/game/cloud-field.ts", import.meta.url), "utf8"), /const sunOcclusion=/);
  assert.match(fs.readFileSync(new URL("../src/game/world.ts", import.meta.url), "utf8"), /environment\.setSunTransmit\(transmit\)/);
  assert.match(fs.readFileSync(new URL("../src/game/environment.ts", import.meta.url), "utf8"), /liveSky\.sunIntensity\*sunTransmit/);
  // the moon's dark side is sky, not a black disc; stars come in three magnitude classes
  assert.match(fjord, /dark side is sky/);
  assert.match(fjord, /for\(int k=0;k<3;k\+\+\)/);
  assert.doesNotMatch(fjord, /diffraction|cross\*/);
});
