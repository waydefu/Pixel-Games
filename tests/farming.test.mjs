import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CROPS,PLOTS,GROW_MS,emptyPlots,plant,stage,harvest,validPlots} from '../src/game/farming.js';
import {upgradeSave,validateSave} from '../src/game/save.js';

test('all crops grow, harvest once, accumulate and allow replanting',()=>{
 const farm=emptyPlots(),inventory={};
 for(const [i,crop] of Object.keys(CROPS).entries()){
  assert.equal(plant(farm,i,crop,1000),true);assert.equal(plant(farm,i,crop,1001),false);
  assert.equal(stage(farm[i],0),1);assert.equal(stage(farm[i],1000+GROW_MS/2),2);
  assert.equal(harvest(farm,i,inventory,1000+GROW_MS-1),false);
  assert.equal(harvest(farm,i,inventory,1000+GROW_MS),true);assert.equal(harvest(farm,i,inventory,1000+GROW_MS),false);
  assert.equal(inventory[crop],1);assert.equal(plant(farm,i,crop,2000),true);
  assert.equal(harvest(farm,i,inventory,2000+GROW_MS),true);assert.equal(inventory[crop],2);
 }
 assert.equal(PLOTS.length,24);assert.equal(plant(farm,24,'wheat',1),false);assert.equal(plant(farm,0,'bad',1),false);
});

test('legacy save upgrades without changing pickup accounting; invalid farm is rejected',()=>{
 const old={version:1,player:{x:9,z:4},hour:9,timeAuto:true,inventory:{shell:1},collected:['shell-1'],fishing:{count:0,best:null},boatsMovable:false,boats:[{x:0,z:0,heading:0}],aboard:-1};
 const save=upgradeSave(old);assert.equal(save.version,2);assert.equal(validPlots(save.farm),true);assert.deepEqual(old.inventory,save.inventory);
 save.inventory.wheat=3;assert.equal(validateSave(save),save);
 assert.throws(()=>validateSave({...save,inventory:{...save.inventory,shell:2}}),/背包數量/);
 assert.throws(()=>validateSave({...save,farm:[{crop:'wheat',plantedAt:-1}]}),/農田/);
 assert.throws(()=>validateSave({...save,farm:save.farm.map((p,i)=>i===0?{crop:'unknown',plantedAt:5}:p)}),/農田/);
});
