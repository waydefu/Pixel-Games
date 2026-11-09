import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collect,addCatch} from '../src/game/inventory.js';
import {readSave,writeSave,commitImportedSave,SAVE_KEY} from '../src/game/save.js';
const example=()=>({version:1,player:{x:9,z:4},hour:9.5,timeAuto:true,inventory:{shell:2},collected:['shell-1','shell-2'],fishing:{count:3,best:{name:'魚',length:12}},boatsMovable:true,boats:[{x:20,z:4,heading:0}],aboard:-1});
test('pickups stack by item and cannot be collected twice',()=>{const bag={},picked=[];assert.equal(collect(bag,picked,'shell-1'),true);assert.equal(collect(bag,picked,'shell-1'),false);assert.equal(collect(bag,picked,'shell-2'),true);assert.deepEqual(bag,{shell:2});});
test('save round trips and rejects invalid versions, items and positions',()=>{const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};const save=example();writeSave(storage,save);assert.deepEqual(readSave(storage),save);for(const bad of [{...save,version:2},{...save,inventory:{unknown:1}},{...save,player:{x:Infinity,z:0}},{...save,collected:['shell-1','shell-1']}])assert.throws(()=>writeSave(storage,bad));assert.deepEqual(JSON.parse(data.get(SAVE_KEY)),save);});
test('storage failures remain visible to the caller',()=>{assert.throws(()=>writeSave({setItem(){throw Error('quota');}},example()),/quota/);});

test("saves work when procedural fallback boats cannot move",()=>{const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};const save={...example(),boatsMovable:false,boats:[{x:0,z:0,heading:0}]};writeSave(storage,save);assert.deepEqual(readSave(storage),save);});

test('inventory quantities must match one-time pickup IDs',()=>{
  const s=example(),data=new Map(),storage={setItem:(k,v)=>data.set(k,v)};
  for(const invalid of [
    {...s,inventory:{shell:1}},
    {...s,inventory:{shell:2,stone:1}},
    {...s,inventory:{},collected:s.collected},
    {...s,inventory:{shell:2},collected:['shell-1']},
  ])assert.throws(()=>writeSave(storage,invalid),/背包數量/);
  assert.equal(data.has(SAVE_KEY),false);
});

test('failed import rolls back runtime state and leaves the original save untouched',()=>{
  const before=example(),after={...example(),hour:17,timeAuto:false};
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  writeSave(storage,before);
  let current=before;
  const apply=s=>{current=s;};
  commitImportedSave(storage,after,before,apply);
  assert.equal(current,after);
  assert.deepEqual(readSave(storage),after);
  writeSave(storage,before);current=before;
  const broken={...storage,setItem(k,v){if(k===SAVE_KEY)throw Error('quota');data.set(k,v);}};
  assert.throws(()=>commitImportedSave(broken,after,before,apply),/quota/);
  assert.equal(current,before);
  assert.deepEqual(readSave(storage),before);
  assert.throws(()=>commitImportedSave(storage,after,before,s=>{current=s;if(s===after)throw Error('apply failed');}),/apply failed/);
  assert.equal(current,before);
  assert.deepEqual(readSave(storage),before);
});

test('landed catches stack, survive saving, and cannot be fabricated beyond the tally',()=>{
  const bag={shell:2};
  assert.equal(addCatch(bag,{id:'mackerel',junk:false}),true);
  assert.equal(addCatch(bag,{id:'mackerel',junk:false}),true);
  assert.equal(addCatch(bag,{id:'crab',junk:false}),true);
  assert.equal(addCatch(bag,{id:'boot',junk:true}),false);
  assert.equal(addCatch(bag,{id:'unknown',junk:false}),false);
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  const save={...example(),inventory:bag};
  writeSave(storage,save);assert.deepEqual(readSave(storage),save);
  assert.throws(()=>writeSave(storage,{...save,fishing:{...save.fishing,count:2}}),/漁獲數量/);
  assert.deepEqual(readSave(storage),save);
});
