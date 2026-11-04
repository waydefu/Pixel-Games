import test from "node:test";
import assert from "node:assert/strict";
import { coastalOutline } from "../src/game/coastal-outline.js";
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
