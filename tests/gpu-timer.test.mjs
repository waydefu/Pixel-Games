import test from 'node:test';
import assert from 'node:assert/strict';
import {createGpuTimer} from '../src/rendering/gpu-timer.js';
function fakeGl(supported=true){
  const ext={GPU_DISJOINT_EXT:1,TIME_ELAPSED_EXT:2};let disjoint=false,next=0;const deleted=[];
  return {ext,deleted,QUERY_RESULT_AVAILABLE:3,QUERY_RESULT:4,getExtension:()=>supported?ext:null,getParameter:()=>disjoint,isContextLost:()=>false,createQuery:()=>({id:++next,ready:false}),beginQuery:(_target,q)=>{assert.ok(q)},endQuery:()=>{},getQueryParameter:(q,key)=>key===3?q.ready:4000000,deleteQuery:q=>deleted.push(q),setDisjoint:v=>{disjoint=v}};
}
test('GPU timer polls asynchronously and converts nanoseconds to milliseconds',()=>{
  const gl=fakeGl(),t=createGpuTimer(gl);let q;gl.beginQuery=(_target,query)=>{q=query};
  t.start();t.begin(12);t.end();t.stop();assert.equal(t.read().status,'PENDING');
  q.ready=true;assert.deepEqual(t.read(),{status:'OK',samples:[{atMs:12,gpuMs:4}],pending:0,dropped:0});assert.equal(gl.deleted.length,1);
  t.dispose();
});
test('unsupported and disjoint GPU timing never reports zero as a measurement',()=>{
  const unsupported=createGpuTimer(fakeGl(false));unsupported.start();unsupported.stop();assert.equal(unsupported.read().status,'UNSUPPORTED');
  const gl=fakeGl(),t=createGpuTimer(gl);t.start();t.begin(2);t.end();gl.setDisjoint(true);t.poll();assert.deepEqual(t.read(),{status:'DISJOINT',samples:[],pending:0,dropped:0});assert.equal(gl.deleted.length,1);
});
test('pending limit marks skipped queries and disposal releases them',()=>{
  const gl=fakeGl(),t=createGpuTimer(gl,{maxPending:1});t.start();t.begin(1);t.end();t.begin(2);t.stop();assert.equal(t.read().dropped,1);t.dispose();assert.equal(gl.deleted.length,1);
});
test('GPU pass queries are labeled and kept separate from whole-frame queries',()=>{
  const gl=fakeGl(),t=createGpuTimer(gl);let q;gl.beginQuery=(_target,query)=>{q=query};
  t.start();t.begin(5,'reflection');t.end();q.ready=true;t.stop();
  assert.deepEqual(t.read().samples,[{atMs:5,gpuMs:4,phase:'reflection'}]);
});
