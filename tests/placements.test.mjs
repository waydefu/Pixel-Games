import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BOAT_LOCATIONS, intersectsBoatFootprint } from "../src/game/placements.js";

const noise=(seed)=>{const v=Math.sin(seed*182.739+22.13)*43758.5453;return v-Math.floor(v);};

test("authored boat placements are immutable and shared with renderer",()=>{
  assert.equal(BOAT_LOCATIONS.length,2);
  assert.ok(Object.isFrozen(BOAT_LOCATIONS));
  for(const boat of BOAT_LOCATIONS)assert.ok(Object.isFrozen(boat));
});
test("the generated i=7 rock overlaps the first boat, and is explicitly rejected",()=>{
  const i=7,x=18+noise(i*5)*12,z=-31+noise(i*9)*55,r=.22+noise(i+33)*.92;
  assert.ok(x>18&&x<20);
  assert.ok(Math.abs(z+3.5)<.5);
  assert.equal(intersectsBoatFootprint(x,z,r),true);
  assert.equal(intersectsBoatFootprint(0,-3.5,.8),false);
});
test("rock exclusion considers radius, rejects invalid geometry, and guards the scene loop",()=>{
  assert.equal(intersectsBoatFootprint(18,-3.5,0),true);
  assert.equal(intersectsBoatFootprint(30,-3.5,.1),false);
  assert.throws(()=>intersectsBoatFootprint(18,NaN,1),RangeError);
  assert.throws(()=>intersectsBoatFootprint(18,-3.5,-1),RangeError);
  const source=readFileSync(new URL("../src/game/environment.ts",import.meta.url),"utf8");
  assert.match(source,/intersectsBoatFootprint\(x,z,r\)/);
});
