import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fjordHeight,fjordSurfaceHeight } from "../src/game/terrain-profile.js";

const read=(file)=>readFileSync(new URL("../src/game/"+file,import.meta.url),"utf8");

test("forest surface samples stay aligned with deformed mountain geometry",()=>{
  const regions=[
    {region:"mainland",x:-105,z:-32},
    {region:"east",x:141,z:76},
    {region:"north",x:21,z:144},
    {region:"south",x:30,z:-157},
  ];
  for(const {region,x,z} of regions){
    const base=fjordHeight(x,z,region)-.16;
    const surface=fjordSurfaceHeight(x,z,region);
    assert.ok(Number.isFinite(surface),region+" terrain height must be finite");
    assert.ok(Math.abs(surface-base)<=1.751,region+" deformation bounded to 1.75m");
  }
  assert.ok(Number.isFinite(fjordSurfaceHeight(12,8,"east")));
});

test("mountain forest uses region buckets, elevation and slope masks, never 150k blades",()=>{
  const s=read("mountain-forest.ts");
  assert.match(s,/const BUDGET=370/);
  assert.match(s,/slopeAt\(x,z,region\)/);
  assert.match(s,/y<11\|\|y>79/);
  assert.match(s,/slope>1\.18/);
  assert.match(s,/new THREE\.InstancedMesh/);
  assert.match(s,/computeBoundingSphere\(\)/);
  assert.match(read("fjord.ts"),/forests\.push\(buildMountainForest\(k,region,layouts\[region\],index\)\)/);
});

test("sky and terrain share one moving cloud map and sun-projected shadows",()=>{
  const field=read("cloud-field.ts");
  const world=read("world.ts"),fjord=read("fjord.ts");
  const coast=read("coastline.ts"),environment=read("environment.ts");
  assert.match(field,/const SIZE=128/);
  assert.match(field,/new THREE\.DataTexture/);
  assert.match(field,/onBeforeCompile/);
  assert.match(field,/uCloudSun\.xz/);
  assert.match(field,/uCloudWind\.value\.set/);
  assert.match(field,/1\.0-uCloudStrength\*cloudOcclusion/);
  assert.match(world,/const cloudField=createCloudField\(scope\)/);
  assert.match(world,/cloudField\.update\(time\)/);
  assert.match(fjord,/texture2D\(uCloudMap,cloudUV\)/);
  assert.match(coast,/cloudField\.applyToMaterial\(s\.material\)/);
  assert.match(environment,/cloudField\.applyToMaterial\(stone\)/);
});

test("near-coast plants include branch silhouettes and instanced shrubs/grass",()=>{
  const s=read("environment.ts");
  assert.match(s,/name="coastal-understory-shrubs"/);
  assert.match(s,/new THREE\.InstancedMesh\(shrubGeo,shrubMat,280\)/);
  assert.match(s,/new THREE\.InstancedMesh\(grassGeom,grassMaterial,1600\)/);
  assert.match(s,/branchMaterial/);
});

test("water stays an analytic WebGL2 single-pass sea",()=>{
  const s=read("ocean.ts");
  assert.match(s,/uHorizon/);
  assert.match(s,/Fresnel/);
  assert.doesNotMatch(s,/new THREE\.WebGLRenderTarget/);
  assert.doesNotMatch(s,/new THREE\.WebGLRenderTarget|FFTCompute|uFftSpectrum/);
});
