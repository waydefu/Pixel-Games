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
test("the western quarter is reachable and the sea edge is not a shortcut",()=>{
  assert.equal(canOccupy(-30,12),true);
  assert.equal(canOccupy(-39.5,-20),true);
  assert.equal(canOccupy(-41,0),false);
  assert.equal(canOccupy(13.8,5.8),false);
  assert.equal(canOccupy(13.8,6.3),true);
  assert.equal(canOccupy(25,10.2),false);
  assert.equal(canOccupy(28.8,8),true);
  assert.equal(canOccupy(29,8),false);
});
test("medieval props block player movement at their authored footprints",()=>{
  const barrel={x:4,z:8,halfX:.41,halfZ:.41};
  const stall={x:8,z:10.6,halfX:1.55,halfZ:.62};
  assert.equal(canOccupy(4,8,[barrel,stall]),false);
  assert.equal(canOccupy(8,10.6,[barrel,stall]),false);
  assert.equal(canOccupy(6,8,[barrel,stall]),true);
});
test("invalid values never become valid positions",()=>{
  assert.equal(canOccupy(Infinity,0),false);
  assert.equal(canOccupy(NaN,0),false);
});
