import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { coastX } from "../src/game/terrain-profile.js";
import { coastalOutline, coastalWaterLimit, SHORE_WATER_INSET, SHORE_PROFILE, COASTLINE_GLSL } from "../src/game/coastal-outline.js";
test("coast is broad where village exists and tapers at headland ends",()=>{
  const center=coastalOutline(0);
  assert.ok(center.coast>12&&center.coast<15);
  assert.ok(center.grassLeft<-45);
  assert.ok(center.grassRight>7);
  const edge=coastalOutline(47);
  assert.ok(Math.abs(edge.grassLeft-edge.grassRight)<1e-5);
  assert.ok(Math.abs(edge.grassRight-edge.coast)<1e-5);
  for(const z of [-33,-20,0,20,33]){
    const o=coastalOutline(z);
    assert.ok(o.grassRight>o.grassLeft);
    assert.ok(o.coast>o.grassRight);
  }
  assert.throws(()=>coastalOutline(NaN),RangeError);
});


test("coastline CPU and GLSL coefficients agree across both headland tapers",()=>{
  const p=SHORE_PROFILE;
  const glslValue=n=>Number.isInteger(n)?n.toFixed(1):String(n);
  for(const n of [p.center,p.waveFrequency1,p.waveAmplitude1,p.waveFrequency2,p.waveAmplitude2,p.taperStart,p.taperEnd,p.taperShift]){
    assert.ok(COASTLINE_GLSL.includes(glslValue(n)),`missing GLSL coefficient ${n}`);
  }
  for(let z=-50;z<=50;z+=0.25){
    const basis=p.center+Math.sin(z*p.waveFrequency1)*p.waveAmplitude1+Math.sin(z*p.waveFrequency2)*p.waveAmplitude2;
    assert.ok(Math.abs(basis-coastX(z))<1e-10,`drifted coastX at z=${z}`);
    const t=Math.max(0,Math.min(1,(Math.abs(z)-p.taperStart)/(p.taperEnd-p.taperStart)));
    const expected=basis-p.taperShift*t*t*(3-2*t);
    assert.ok(Math.abs(expected-coastalOutline(z).coast)<1e-10,`coastalOutline mismatch at z=${z}`);
  }
  assert.match(COASTLINE_GLSL,/float shore\(float z\)/);
  assert.match(COASTLINE_GLSL,/float shoreRegion\(float z\)/);
});

test("ocean vertex and fragment share coast profile and breakers move across shore",()=>{
  const ocean=readFileSync(new URL("../src/game/ocean.ts",import.meta.url),"utf8");
  assert.equal((ocean.match(/\$\{COASTLINE_GLSL\}/g)??[]).length,2);
  assert.match(ocean,/float damp=\.06\+\.94\*smoothstep\(0\.0,9\.0,dist\)/);
  assert.match(ocean,/coastWeight=shoreRegion\(vWorld\.z\)/);
  assert.match(ocean,/float shoreline=\(1\.0-smoothstep\(0\.0,2\.65,shoreDist\)\)\*coastWeight/);
  assert.match(ocean,/moving=sin\(shoreDist\*2\.2\+/);
  assert.doesNotMatch(ocean,/smoothstep\(32\.0,52\.0,abs\(/);
  assert.doesNotMatch(ocean,/float shore\(float z\)\{return 13\.3/);
});


test("shared water edge follows the curved beach and never exposes dry inland to the infinite sea",()=>{
  assert.ok(SHORE_WATER_INSET>0&&SHORE_WATER_INSET<1);
  assert.match(COASTLINE_GLSL,/float shoreWaterLimit\(float z\)/);
  for(let z=-47;z<=47;z+=.25){
    const p=coastalOutline(z);
    assert.ok(Math.abs(coastalWaterLimit(z)-(p.coast-Math.min(SHORE_WATER_INSET,(p.coast-p.grassRight)*.78)))<1e-12);
    assert.ok(coastalWaterLimit(z)>=p.grassRight-1e-12,`water limit invades dry grass at z=${z}`);
    assert.ok(coastalWaterLimit(z)<=p.coast+1e-12);
  }
});
