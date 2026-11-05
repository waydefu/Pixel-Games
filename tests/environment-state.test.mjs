import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SUN_DIRECTION, HORIZON_LINEAR, FOG_DENSITY } from "../src/game/environment-state.js";

test("scene sun-to-light direction is normalized and above the horizon",()=>{
  const {x,y,z}=SUN_DIRECTION;
  assert.ok(Math.abs(Math.hypot(x,y,z)-1)<1e-12);
  assert.ok(x<0&&y>0&&z<0);
  assert.ok(Object.isFrozen(SUN_DIRECTION));
});
test("fog and sky horizon share a physically valid linear color",()=>{
  for(const c of Object.values(HORIZON_LINEAR))assert.ok(c>=0&&c<=1);
  assert.ok(FOG_DENSITY>0&&FOG_DENSITY<.02);
});
test("sun, shader fog and output-color stages are connected to the actual game",()=>{
  const src=(p)=>readFileSync(new URL("../src/game/"+p,import.meta.url),"utf8");
  const env=src("environment.ts"),sky=src("fjord.ts"),sea=src("ocean.ts"),world=src("world.ts");
  assert.match(env,/SUN_DIRECTION\.x\*34/);
  assert.match(sky,/uSunDirection/);
  assert.match(sea,/uSunDirection/);
  assert.match(sea,/fog:true/);
  assert.match(sea,/#include <fog_pars_vertex>/);
  assert.match(sea,/#include <fog_vertex>/);
  assert.match(sea,/#include <fog_pars_fragment>/);
  assert.match(sea,/#include <fog_fragment>/);
  for(const shader of [sky,sea]){
    assert.match(shader,/#include <tonemapping_fragment>/);
    assert.match(shader,/#include <colorspace_fragment>/);
  }
  assert.match(world,/new THREE\.FogExp2\(horizon\.clone\(\),FOG_DENSITY\)/);
  assert.doesNotMatch(sky,/normalize\(vec3\(-\.60,\.30,-\.74\)\)/);
});
