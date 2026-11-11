import test from "node:test";
import assert from "node:assert/strict";
import { grassSuitability, grassEdgeHeight } from "../src/game/grass-placement.js";
import { coastalOutline } from "../src/game/coastal-outline.js";
import { BEACH_DRY_Y } from "../src/game/beach-profile.js";

test("grass preserves the road, town square, pier road and landmark reservations",()=>{
  for(const [x,z] of [[0,0],[-5,6.1],[9,8],[-40,-25],[-39,0]])
    assert.equal(grassSuitability(x,z),0,`excluded ${x},${z}`);
});
test("grass grows on both sides of the village and respects shoreline and colliders",()=>{
  for(const [x,z] of [[-18,-14],[-10,18],[3,22]])assert.ok(grassSuitability(x,z)>0,`${x},${z}`);
  const z=20,edge=coastalOutline(z).grassRight;
  assert.equal(grassSuitability(edge+.2,z),0);
  assert.ok(grassSuitability(edge-4,z)>grassSuitability(edge-.2,z));
  assert.equal(grassSuitability(-18,-14,[{x:-18,z:-14,halfX:1,halfZ:1}]),0);
});

test("grass and sand geometry meet without a gap",()=>{
  assert.equal(grassEdgeHeight(0),-.187);
  assert.ok(Math.abs(grassEdgeHeight(1)-BEACH_DRY_Y)<1e-12);
  assert.ok(grassEdgeHeight(.98)>grassEdgeHeight(.94));
});
