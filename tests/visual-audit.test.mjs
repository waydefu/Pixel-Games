import test from "node:test";
import assert from "node:assert/strict";
import { VISUAL_SHOTS, getVisualShot } from "../src/game/visual-audit.js";
import { canOccupy } from "../src/game/navigation.js";
test("G2 shot catalog uses unique IDs and lists unsupported days truthfully",()=>{
  assert.equal(VISUAL_SHOTS.length,8);
  assert.equal(new Set(VISUAL_SHOTS.map(s=>s.id)).size,8);
  assert.equal(VISUAL_SHOTS.filter(s=>s.status==="supported").length,6);
  assert.equal(VISUAL_SHOTS.filter(s=>s.status==="unsupported").length,2);
  assert.equal(getVisualShot("shot-07-dusk"),null);
  assert.equal(getVisualShot("shot-08-night"),null);
  assert.equal(getVisualShot("does-not-exist"),null);
});
test("supported snapshots are finite, fixed-time, correctly classified",()=>{
  for(const shot of VISUAL_SHOTS.filter(s=>s.status==="supported")){
    assert.ok(Object.isFrozen(shot));
    assert.ok(["quarter","first","vista"].includes(shot.mode));
    assert.ok(["desktop","mobile"].includes(shot.viewport));
    for(const k of ["x","z","yaw","pitch","time"])assert.ok(Number.isFinite(shot[k]));
    assert.equal(getVisualShot(shot.id),shot);
    assert.equal(canOccupy(shot.x,shot.z),true,"audit shot must be in walkable territory: "+shot.id);
  }
  assert.ok(Object.isFrozen(VISUAL_SHOTS));
});
