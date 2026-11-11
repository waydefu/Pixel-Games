import test from "node:test";
import assert from "node:assert/strict";
import { VISUAL_SHOTS, getVisualShot } from "../src/game/visual-audit.js";
import { canOccupy } from "../src/game/navigation.js";
test("shot catalog uses unique IDs and covers dawn, day, dusk, night and the moon",()=>{
  assert.equal(VISUAL_SHOTS.length,16);
  assert.equal(new Set(VISUAL_SHOTS.map(s=>s.id)).size,16);
  assert.equal(VISUAL_SHOTS.filter(s=>s.status==="supported").length,16);
  const hours=VISUAL_SHOTS.map(s=>s.hour);
  assert.ok(hours.some(h=>h<7),"a sunrise shot");
  assert.ok(hours.some(h=>h>9&&h<15),"a daytime shot");
  assert.ok(hours.some(h=>h>18&&h<20),"a dusk shot");
  assert.ok(hours.some(h=>h>20),"a night shot");
  assert.ok(getVisualShot("shot-07-dusk"));
  assert.ok(getVisualShot("shot-08-night-moon"));
  assert.equal(getVisualShot("does-not-exist"),null);
});
test("supported snapshots are finite, fixed-time, correctly classified",()=>{
  for(const shot of VISUAL_SHOTS.filter(s=>s.status==="supported")){
    assert.ok(Object.isFrozen(shot));
    assert.ok(["quarter","first","vista"].includes(shot.mode));
    assert.ok(["desktop","mobile"].includes(shot.viewport));
    for(const k of ["x","z","yaw","pitch","time","hour"])assert.ok(Number.isFinite(shot[k]));
    assert.equal(getVisualShot(shot.id),shot);
    assert.equal(canOccupy(shot.x,shot.z),true,"audit shot must be in walkable territory: "+shot.id);
  }
  assert.ok(Object.isFrozen(VISUAL_SHOTS));
});
