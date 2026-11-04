import test from "node:test";
import assert from "node:assert/strict";
import { canOccupy, stepOnGround } from "../src/game/navigation.js";
test("spawn and main road remain walkable, water blocked except pier",()=>{
  assert.equal(canOccupy(2,2),true);
  assert.equal(canOccupy(18,0),false);
  assert.equal(canOccupy(18,8),true);
  assert.equal(canOccupy(31,8),false);
});
test("collisions slide along houses without crossing solid geometry",()=>{
  const obstacles=[{x:1,z:0,halfX:1,halfZ:1}];
  assert.equal(canOccupy(0,0,obstacles),false);
  const moved=stepOnGround({x:-1,z:-2},{x:1,z:1},obstacles);
  assert.ok(moved.z>=-2 && moved.z<=-1);
  assert.equal(canOccupy(moved.x,moved.z,obstacles),true);
});
test("invalid values never become valid positions",()=>{
  assert.equal(canOccupy(Infinity,0),false);
  assert.equal(canOccupy(NaN,0),false);
});
