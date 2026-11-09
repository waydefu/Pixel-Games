import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makePerformanceSnapshot} from '../src/game/performance-report.js';

test('phone performance export labels RAF interval estimates and diagnostic flags',()=>{
  const report=makePerformanceSnapshot({
    capturedAt:'2026-11-09T00:00:00Z',
    frame:{count:120,p50Ms:16.67,p95Ms:33.33,meanMs:20},
    device:{viewportWidth:390,viewportHeight:844,devicePixelRatio:3},
    run:{quality:'high',reflect:'0',rtt:'default'},
    renderer:{drawCalls:100}
  });
  assert.equal(report.schemaVersion,1);
  assert.match(report.source,/not a GPU timer/);
  assert.equal(report.validity.usable,true);
  assert.equal(report.frame.medianFpsApprox,60);
  assert.equal(report.frame.lowFpsApprox,30);
  assert.equal(report.run.reflect,'0');
  const insufficient=makePerformanceSnapshot({...report,frame:{count:0,p50Ms:null,p95Ms:null,meanMs:null}});
  assert.equal(insufficient.validity.usable,false);
  assert.equal(insufficient.frame.medianFpsApprox,null);
});
