import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("bloom is selective: physical sky, rock, water, and roads are masked black",()=>{
  const s=read("src/rendering/cinematic-post.js");
  assert.match(s,/const BLOOM_LAYER=1/);
  assert.match(s,/const bloomMask=new THREE\.Layers\(\)/);
  assert.match(s,/object\.layers\.enable\(BLOOM_LAYER\)/);
  assert.match(s,/scene\.traverse\(darkenNonBloomed\)/);
  assert.match(s,/scene\.background=blackBackground/);
  assert.match(s,/scene\.fog=null/);
  assert.match(s,/bloomComposer\.render\(\)/);
  assert.match(s,/restoreNonBloomed\(\)/);
  assert.match(s,/finalComposer\.render\(\)/);
  assert.match(s,/uBloom:\{value:bloomComposer\.renderTarget2\.texture\}/);
  assert.match(s,/new OutputPass\(\)/);
  assert.match(s,/info\.autoReset=false/);
});

test("HDR emitters come from candle windows and beacon, not all bright pixels",()=>{
  const s=read("src/game/architecture.ts");
  const beacon=read("src/game/harbour-beacon.ts");
  assert.match(s,/glass\.emissiveIntensity=1\.9/);
  assert.match(s,/atticGlow\.emissiveIntensity=1\.8/);
  assert.match(beacon,/glow\.emissiveIntensity=3\.2/);
});

test("official physically-based Sky has independent cloud noise disabled for aligned ground shadows",()=>{
  const s=read("src/game/fjord.ts");
  assert.match(s,/new Sky\(\)/);
  assert.match(s,/physicalUniforms\.cloudCoverage\.value=0/);
  assert.match(s,/texture2D\(uCloudMap,cloudUV\)/);
  assert.match(s,/cloudDome\.renderOrder=-999/);
  assert.match(s,/transparent:true,side:THREE\.BackSide/);
});
