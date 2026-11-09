import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collect} from '../src/game/inventory.js';
import {readSave,writeSave,SAVE_KEY} from '../src/game/save.js';
const example=()=>({version:1,player:{x:9,z:4},hour:9.5,timeAuto:true,inventory:{shell:2},collected:['shell-1','shell-2'],fishing:{count:3,best:{name:'魚',length:12}},boatsMovable:true,boats:[{x:20,z:4,heading:0}],aboard:-1});
test('pickups stack by item and cannot be collected twice',()=>{const bag={},picked=[];assert.equal(collect(bag,picked,'shell-1'),true);assert.equal(collect(bag,picked,'shell-1'),false);assert.equal(collect(bag,picked,'shell-2'),true);assert.deepEqual(bag,{shell:2});});
test('save round trips and rejects invalid versions, items and positions',()=>{const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};const save=example();writeSave(storage,save);assert.deepEqual(readSave(storage),save);for(const bad of [{...save,version:2},{...save,inventory:{unknown:1}},{...save,player:{x:Infinity,z:0}},{...save,collected:['shell-1','shell-1']}])assert.throws(()=>writeSave(storage,bad));assert.deepEqual(JSON.parse(data.get(SAVE_KEY)),save);});
test('storage failures remain visible to the caller',()=>{assert.throws(()=>writeSave({setItem(){throw Error('quota');}},example()),/quota/);});

test("saves work when procedural fallback boats cannot move",()=>{const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};const save={...example(),boatsMovable:false,boats:[{x:0,z:0,heading:0}]};writeSave(storage,save);assert.deepEqual(readSave(storage),save);});
