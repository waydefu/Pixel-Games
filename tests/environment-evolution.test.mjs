import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fjordHeight,fjordSurfaceHeight,fjordMeshHeight } from "../src/game/terrain-profile.js";

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
  assert.match(s,/y<\(region==="mainland"\?11:2\.4\)\|\|y>79/); // backdrop needs 11m; low headlands carry trees too
  assert.match(s,/slope>1\.18/);
  assert.match(s,/new THREE\.InstancedMesh/);
  assert.match(s,/computeBoundingSphere\(\)/);
  assert.match(s,/prefixes\.push\(\[c,br\]\)/);
  assert.match(s,/cones\.count=prefixes\[visible\]\[0\]/);
  assert.match(s,/broad\.count=prefixes\[visible\]\[1\]/);
  assert.match(read("fjord.ts"),/forests\.push\(buildMountainForest\(k,region,layouts\[region\],index,cloudField,mesh\.geometry\)\)/);
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
  assert.match(world,/cloudField\.setWind\(wind\.state\.aloftDriftX/);
  assert.match(world,/forest\.setDensity\(density\)/);
  assert.match(world,/environment\.setFoliageDensity\(density\)/);
  assert.match(fjord,/texture2D\(uCloudMap,cloudUV\)/);
  assert.match(coast,/cloudField\.applyToMaterial\(s\.material\)/);
  assert.match(environment,/cloudField\.applyToMaterial\(stone\)/);
});

test("near-coast plants include branch silhouettes and instanced shrubs/grass",()=>{
  const s=read("environment.ts");
  assert.match(s,/name="coastal-understory-shrubs"/);
  assert.match(s,/new THREE\.InstancedMesh\(shrubGeo,shrubMat,280\)/);
  assert.match(s,/new THREE\.InstancedMesh\(grassGeom,grassMaterial,9000\)/);
  assert.match(s,/getTreeKit\(k,cloudField\)/);   // town trees: procedural branches + leaf cards
  assert.match(s,/treeKit\.plant\(/);
});

test("water stays an analytic WebGL2 single-pass sea",()=>{
  const s=read("ocean.ts");
  assert.match(s,/uHorizon/);
  assert.match(s,/Fresnel/);
  assert.doesNotMatch(s,/new THREE\.WebGLRenderTarget/);
  assert.doesNotMatch(s,/new THREE\.WebGLRenderTarget|FFTCompute|uFftSpectrum/);
});

test("tree root heights interpolate real fjord triangles and reuse baked vertex positions",()=>{
  const e={x0:-175,x1:-43,z0:-190,z1:190,columns:86,rows:145};
  const i=24,j=65;
  const x=e.x0+(e.x1-e.x0)*i/e.columns;
  const z=e.z0+(e.z1-e.z0)*j/e.rows;
  const y=fjordMeshHeight(x,z,"mainland",e);
  assert.ok(Math.abs(y-fjordSurfaceHeight(x,z,"mainland"))<1e-7);
  let calls=0;
  const height=(ix,iz)=>{calls++;return iz*(e.columns+1)+ix;};
  const xc=x+(e.x1-e.x0)/e.columns*.25;
  const zc=z+(e.z1-e.z0)/e.rows*.32;
  const sampled=fjordMeshHeight(xc,zc,"mainland",e,height);
  const a=j*(e.columns+1)+i,b=a+1,c=a+e.columns+1;
  assert.ok(Math.abs(sampled-(a*.43+b*.25+c*.32))<1e-7);
  assert.equal(calls,4,"sample exactly the existing four mesh vertices, not noise functions");
});

test("vegetation sway shares wind with cloud drift and keeps conservative bounds",()=>{
  const wind=read("vegetation-wind.ts");
  const mountains=read("mountain-forest.ts");
  const coast=read("environment.ts");
  assert.match(wind,/#ifdef USE_INSTANCING/);
  assert.match(wind,/uCloudWind/);
  assert.match(wind,/windTip=smoothstep/);
  assert.match(mountains,/addVegetationWind\(leafMat,clouds,\.12\)/);
  assert.match(mountains,/fjordMeshHeight\(x,z,region,extent/);
  assert.match(mountains,/boundingSphere\.radius\+=\.42/);
  assert.match(coast,/addVegetationWind\(shrubMat,cloudField,\.075\)/);
  assert.match(coast,/addVegetationWind\(grassMaterial,cloudField,\.13\)/);
});
