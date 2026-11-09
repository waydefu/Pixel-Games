import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makePerformanceSnapshot} from '../src/game/performance-report.js';

test('frame snapshot needs 15 seconds of play rather than an arbitrary frame count',()=>{
  const base={
    capturedAt:'2026-11-09T00:00:00Z',
    device:{viewportWidth:390,viewportHeight:844,devicePixelRatio:3},
    run:{quality:'high',reflect:'0',rtt:'default'},
    renderer:{drawCalls:100}
  };
  const report=(count,p50Ms,p95Ms,meanMs)=>makePerformanceSnapshot({...base,frame:{count,p50Ms,p95Ms,meanMs}});
  const phone10fps=report(180,100,120,100);
  assert.equal(phone10fps.schemaVersion,1);
  assert.match(phone10fps.source,/not a GPU timer/);
  assert.equal(phone10fps.validity.usable,true,'10 FPS for 18 seconds must be usable');
  assert.equal(phone10fps.validity.measuredDurationMs,18000);
  assert.equal(phone10fps.frame.medianFpsApprox,10);
  assert.equal(phone10fps.run.reflect,'0');
  const short60fps=report(240,16.67,33.33,17);
  assert.equal(short60fps.validity.usable,false,'240 frames are only about four seconds at 60 FPS');
  const fast120fps=report(1920,8.33,12,8.3333);
  assert.equal(fast120fps.validity.usable,true,'120 FPS for 16 seconds must be usable');
  const slow2fps=report(30,500,600,500);
  assert.equal(slow2fps.validity.usable,true,'very low FPS is diagnostic evidence too');
  const noFrame=report(0,null,null,null);
  assert.equal(noFrame.validity.usable,false);
  assert.equal(noFrame.frame.medianFpsApprox,null);
  assert.equal(noFrame.validity.measuredDurationMs,0);
});
