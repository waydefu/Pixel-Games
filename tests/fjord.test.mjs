import test from "node:test";
import assert from "node:assert/strict";
import { fjordHeight, coastX } from "../src/game/terrain-profile.js";
test("village plateau remains flat while distant mountains rise",()=>{
  for(const z of [-30,0,30]){
    assert.equal(fjordHeight(-43,z,"mainland"),0);
    assert.equal(fjordHeight(65,z,"east"),0);
    assert.ok(fjordHeight(-150,z,"mainland")>20);
    assert.ok(fjordHeight(190,z,"east")>20);
  }
});
test("fjord flanks frame open sea",()=>{
  assert.equal(fjordHeight(30,0,"north"),0);
  assert.equal(fjordHeight(30,0,"south"),0);
  assert.ok(fjordHeight(100,190,"north")>15);
  assert.ok(fjordHeight(100,-190,"south")>15);
});
test("terrain is deterministic and coastal edge bounded",()=>{
  assert.equal(fjordHeight(-120,12,"mainland"),fjordHeight(-120,12,"mainland"));
  assert.equal(fjordHeight(NaN,0,"east"),0);
  assert.throws(()=>fjordHeight(0,0,"nope"),RangeError);
  for(let z=-80;z<80;z+=8)assert.ok(coastX(z)>12&&coastX(z)<15);
});
