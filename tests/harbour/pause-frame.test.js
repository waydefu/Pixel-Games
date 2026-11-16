import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Execute the real frame prefix, stopping before world/GL work. This tests control
// flow and clock invariants, not a fake GPU or a device performance measurement.
const main=readFileSync(new URL('../../src/harbour/main.js',import.meta.url),'utf8');
const prefix=main.match(/function frame\(now\)\s*\{([\s\S]*?)const hourBefore/)[1];
function probe({paused=false,intro=false,redraw=false}={}) {
  const state={game:{G:{paused}},intro,redraw,last:0,time:10,ema:16,rendered:0,scheduled:0};
  state.requestAnimationFrame=()=>{state.scheduled++;};
  runInNewContext(`function frame(now){${prefix}rendered++;}frame(1000);`,state);
  return state;
}
test('paused game skips the expensive frame path and refreshes last timestamp',()=>{
  const s=probe({paused:true});
  assert.equal(s.rendered,0);assert.equal(s.scheduled,1);assert.equal(s.last,1000);
  assert.equal(s.time,10);assert.equal(s.ema,16);
});
test('paused resize/context recovery can redraw once without advancing the clock or FPS estimator',()=>{
  const s=probe({paused:true,redraw:true});
  assert.equal(s.rendered,1);assert.equal(s.time,10);assert.equal(s.ema,16);assert.equal(s.redraw,false);
});
test('unpaused gameplay still enters the render path and advances normally',()=>{
  const s=probe();assert.equal(s.rendered,1);assert.ok(s.time>10);assert.ok(s.ema>16);
});
test('intro camera animation is not disabled by the gameplay pause guard',()=>{
  const s=probe({paused:true,intro:true});assert.equal(s.rendered,1);assert.ok(s.time>10);
});
