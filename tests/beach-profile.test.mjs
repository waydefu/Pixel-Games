import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { coastalOutline } from "../src/game/coastal-outline.js";
import { BEACH_DRY_Y, BEACH_SEABED_Y, beachSample } from "../src/game/beach-profile.js";

test("beach rises continuously from submerged shore to the grass and keeps headland closure",()=>{
  assert.ok(BEACH_DRY_Y > -0.187, "dry sand joins the grass just above its surface");
  assert.ok(BEACH_SEABED_Y < -0.38, "water-side sand lies below the still-water surface");
  for(let z=-47;z<=47;z+=0.5){
    const {ease,coast,grassRight}=coastalOutline(z);
    let previous=Number.POSITIVE_INFINITY;
    for(let i=0;i<=42;i++){
      const t=i/42;
      const sample=beachSample(t,z,ease);
      assert.ok(Number.isFinite(sample.y), `non-finite sand at z=${z},t=${t}`);
      assert.ok(sample.y<=previous+1e-12,`sand must slope toward the water at z=${z},t=${t}`);
      assert.ok(sample.y>=BEACH_SEABED_Y-1e-12&&sample.y<=BEACH_DRY_Y+1e-12);
      assert.ok(sample.wetness>=0&&sample.wetness<=1);
      assert.equal(sample.color.length,3);
      for(const channel of sample.color)assert.ok(Number.isFinite(channel)&&channel>=0&&channel<=1);
      const x=grassRight+(coast-grassRight)*t;
      assert.ok(Number.isFinite(x));
      previous=sample.y;
    }
    assert.ok(Math.abs(beachSample(0,z,ease).y-BEACH_DRY_Y)<1e-12);
  }
  for(const z of [-47,47]){
    assert.ok(Math.abs(beachSample(1,z,coastalOutline(z).ease).y-BEACH_DRY_Y)<1e-12,
      "closed headlands must not create a vertical underwater fin");
    assert.equal(beachSample(1,z,1).wetness,0);
  }
});

test("sand has restrained irregular wet tint, without changing pixel material or adding passes",()=>{
  const dry=beachSample(0,0),wet=beachSample(1,0);
  assert.ok(wet.wetness>dry.wetness);
  for(let i=0;i<3;i++)assert.ok(wet.color[i]<dry.color[i]);
  assert.deepEqual(beachSample(.72,12,.1),beachSample(.72,12,.1),"samples are deterministic");
  assert.throws(()=>beachSample(NaN,0),RangeError);
  assert.throws(()=>beachSample(0,Infinity),RangeError);
  assert.throws(()=>beachSample(0,0,NaN),RangeError);

  const src=readFileSync(new URL("../src/game/coastline.ts",import.meta.url),"utf8");
  assert.match(src,/material:k\.pattern\("sand",5,2,13\)/);
  assert.match(src,/s\.material\.vertexColors=true/);
  assert.match(src,/beachSample\(t,z,bounds\.ease\)/);
  assert.match(src,/g\.setAttribute\("color",new THREE\.Float32BufferAttribute\(colors,3\)\)/);
  assert.match(src,/cloudField\.applyToMaterial\(s\.material\)/);
  assert.doesNotMatch(src,/new THREE\.WebGLRenderTarget|new THREE\.DataTexture/);
});
