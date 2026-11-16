import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readSave, writeSave, clearSave, validate } from '../../src/harbour/save.js';
import { isCorePath } from '../../scripts/pr-governance-core.mjs';

const original = globalThis.localStorage;
afterEach(() => { if (original === undefined) delete globalThis.localStorage; else globalThis.localStorage = original; });
const state = () => ({v:1,clock:{hour:12,dayCount:0},player:{x:60,z:40,yaw:3,pitch:0,mode:'walk'},inv:{coins:15,items:{seed_rye:2}},weather:'clear'});
function storage() { const m=new Map(); globalThis.localStorage={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}; return m; }

test('promoted mainline and root build entrypoints are collaboration core paths',()=>{
  for (const p of ['src/harbour/main.js','src/harbour/save.js','index.html','vite.config.mjs','scripts/inline-mainline.mjs','scripts/check-mainline.mjs']) assert.equal(isCorePath(p),true,p);
});
test('existing Aldric save namespace survives source promotion',()=>{
  const m=storage(); m.set('aldric.save',JSON.stringify(state()));
  assert.equal(readSave().player.x,60);
  assert.equal(writeSave({...state(),player:{...state().player,x:61}}),true);
  assert.equal(JSON.parse(m.get('aldric.save')).player.x,61);
  assert.equal(JSON.parse(m.get('aldric.save.bak')).player.x,60);
});
test('a corrupt primary save falls back to the actual rolling backup',()=>{
  const m=storage();m.set('aldric.save','{bad');m.set('aldric.save.bak',JSON.stringify(state()));
  assert.equal(readSave().player.z,40);
});
test('old game storage is neither treated as an Aldric save nor removed',()=>{
  const m=storage();m.set('legacy-game-data','preserve');
  assert.equal(readSave(),null);writeSave(state());clearSave();
  assert.deepEqual([...m],[['legacy-game-data','preserve']]);
});
test('blocked storage fails explicitly rather than crashing startup or inventing a save',()=>{
  globalThis.localStorage={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')},removeItem(){throw Error('blocked')}};
  assert.equal(readSave(),null);assert.equal(writeSave(state()),false);assert.doesNotThrow(clearSave);
});
test('migration fills old v1 missing fields without modifying input',()=>{
  const s=state(), out=validate(s);assert.ok(out.farm);assert.ok(out.dex);assert.equal(out.tool,'hoe');assert.equal(s.farm,undefined);
});
test('invalid future schema and non-finite coordinates are rejected',()=>{
  assert.equal(validate({...state(),v:2}),null);
  assert.equal(validate({...state(),player:{x:Infinity,z:1}}),null);
});
test('save validation discards unknown inventory and caps known stacks',()=>{
  const s=state();s.inv={coins:-10,items:{seed_rye:500,unknown_asset:20}};
  const out=validate(s);assert.equal(out.inv.coins,0);assert.deepEqual(out.inv.items,{seed_rye:200});
});
