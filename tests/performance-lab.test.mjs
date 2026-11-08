import test from 'node:test';
import assert from 'node:assert/strict';
import {summarize,median,improvement,compareConditions,stutters} from '../scripts/performance/metrics.mjs';

test('RAF summaries preserve percentiles, thresholds and empty data',()=>{
  assert.deepEqual(summarize([]),{count:0,p50Ms:null,p95Ms:null,p99Ms:null,meanMs:null,over16_7Pct:null,over33_3Pct:null});
  assert.deepEqual(summarize([10,16.7,20,40]),{count:4,p50Ms:16.7,p95Ms:40,p99Ms:40,meanMs:21.675,over16_7Pct:50,over33_3Pct:25});
  assert.equal(median([30,10,20]),20);assert.equal(median([10,20]),15);assert.equal(median([]),null);
  assert.equal(improvement(20,15),25);assert.equal(improvement(0,15),null);assert.equal(improvement(null,15),null);
});
test('stutters keep exact thresholds, maxima, and nearby evidence without inventing samples',()=>{
  const samples=[{atMs:10,frameMs:33.3},{atMs:60,frameMs:50},{atMs:170,frameMs:80}];
  const result=stutters(samples,[{atMs:65,gpuMs:7}],[{atMs:60,movementMs:1}]);
  assert.equal(result.over33Count,2);assert.equal(result.over50Count,1);assert.equal(result.maxFrameMs,80);
  assert.equal(result.events[0].gpuMs,7);assert.equal(result.events[0].gpuOffsetMs,5);assert.equal(result.events[1].gpuMs,null);
  assert.equal(stutters([]).maxFrameMs,null);assert.equal(summarize([0,1],{allowZero:true}).count,2);
});
test('comparison rejects different or incomplete conditions',()=>{
  const run={schemaVersion:1,protocolVersion:1,valid:true,dirty:false,environment:{browser:'Chromium',browserVersion:'1',gpuRenderer:'GPU',scenarios:['street'],repetitions:1,viewport:{width:1280,height:720}},results:[{scenario:'street',iteration:1,samples:[{frameMs:10}],state:{bufferWidth:1280,bufferHeight:720,renderScale:1,pipeline:'on',weather:'clear'}}]};
  assert.deepEqual(compareConditions(run,structuredClone(run)),[]);
  const altered=structuredClone(run);altered.environment.viewport.width=900;altered.results[0].state.bufferWidth=900;
  assert.ok(compareConditions(run,altered).some(x=>x.includes('viewport')));assert.ok(compareConditions(run,altered).some(x=>x.includes('render conditions')));
  assert.ok(compareConditions(run,{...run,valid:false}).some(x=>x.includes('invalid')));
  assert.ok(compareConditions(run,{...run,dirty:true}).some(x=>x.includes('uncommitted')));
  assert.ok(compareConditions(run,{...run,results:[]}).some(x=>x.includes('missing')));
  assert.ok(compareConditions(run,{...run,results:[{...run.results[0],samples:[]}]}).some(x=>x.includes('missing')));
});
