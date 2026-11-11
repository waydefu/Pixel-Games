import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {cloudLighting,cloudShadowBase,CLOUD_SHADOW_BASE} from "../src/game/cloud-lighting.js";

test("default ground shadow strength is softer but still distinct between quality tiers",()=>{
  assert.deepEqual(CLOUD_SHADOW_BASE,{basic:.24,balanced:.30,high:.36});
  for(const q of ["basic","balanced","high"]){
    const base=cloudShadowBase(q);
    assert.ok(base>0&&base<=.4,q);
    assert.equal(cloudShadowBase(q,.5),.5);
  }
  assert.equal(cloudShadowBase("high",99),.65);
  assert.equal(cloudShadowBase("high",-9),0);
  assert.equal(cloudShadowBase("unexpected"),.30);
});

test("fully overcast shadow keeps sky fill and meaningful sunlight",()=>{
  const oldSun=(1-.78)*(1-.85*.82);   // old compounded attenuation: ~7% sunlight
  const newLight=cloudLighting(.36,1,.82,1);
  assert.ok(newLight.sunTransmission>.29);
  assert.ok(newLight.sunTransmission>oldSun*4);
  assert.ok(newLight.hemisphereScale>.81);
  assert.ok(newLight.groundStrength<.16);
  // No clouds means the shadow map does not dim the grass.
  const clear=cloudLighting(.36,1,0,0);
  assert.equal(clear.sunTransmission,1);
  assert.equal(clear.hemisphereScale,1);
  assert.equal(clear.groundStrength,.36);
});

test("shadow strength follows daylight/weather without lifting night or burning out storm",()=>{
  for(const d of [0,.15,.5,1])for(const w of [0,.08,.45,.62,.82,1])
    for(const occlusion of [0,.2,.8,1]){
      const l=cloudLighting(.36,d,w,occlusion);
      for(const value of Object.values(l))assert.ok(value>=0&&value<=1);
      assert.ok(l.sunTransmission>=.58*.42,"no near-black sunlight from stacked cloud and storm masks");
      assert.ok(l.groundStrength<=.36*d+1e-12);
      assert.ok(l.hemisphereScale>=.78);
    }
  assert.equal(cloudLighting(.36,0,0,1).groundStrength,0);
  assert.equal(cloudLighting(.36,0,0,1).sunTransmission,1);
  assert.deepEqual(cloudLighting(.36,1,0,0),cloudLighting(.36,1,0,Number.NaN));
});

test("game world retains a single cloud shadow map, linked daylight and preserved debug override",()=>{
  const world=readFileSync(new URL("../src/game/world.ts",import.meta.url),"utf8");
  const field=readFileSync(new URL("../src/game/cloud-field.ts",import.meta.url),"utf8");
  const shader=readFileSync(new URL("../src/game/cloud-shader.ts",import.meta.url),"utf8");
  assert.match(world,/cloudShadowBase\(quality,forcedShadow\)/);
  assert.match(world,/cloudLighting\(cloudStrength,liveSky\.dayLight\.value,W\.dark,cloudField\.sunOcclusion\(\)\)/);
  assert.match(world,/environment\.setSunTransmit\(transmit\)/);
  assert.match(world,/cloudField\.setStrength\(lighting\.groundStrength\)/);
  assert.match(field,/1\.0-uCloudStrength\*cloudOcclusion/);
  assert.match(shader,/vec2 evalLayer\(int id,vec2 P/);
  assert.match(shader,/float T=1\.0/);
});
