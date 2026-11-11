import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {useNearTree,TREE_LOD_DISTANCE,treeModelVariant} from "../src/game/tree-lod.js";
test("town tree LOD thresholds are ordered and hysteretic",()=>{
  assert.deepEqual(TREE_LOD_DISTANCE.high,{enter:24,exit:31});
  for(const q of ["balanced","high"]){
    const {enter,exit}=TREE_LOD_DISTANCE[q];
    assert.ok(enter<exit);
    assert.equal(useNearTree(enter-.01,false,q),true);
    assert.equal(useNearTree(enter+1,false,q),false);
    assert.equal(useNearTree(enter+1,true,q),true);
    assert.equal(useNearTree(exit+1,true,q),false);
  }
  assert.equal(useNearTree(0,true,"basic"),false);
  assert.equal(useNearTree(Number.NaN,true,"high"),false);
  assert.equal(useNearTree(-1,false,"high"),false);
  assert.deepEqual([1,2,3,4].map(x=>treeModelVariant(x,3)),[0,1,2,0]);
});
test("imported tree GLBs are complete local glTF 2.0 assets with two PBR parts",()=>{
  for(let variant=1;variant<=3;variant++){
    const name="tree-0"+variant+".glb";
    const glb=readFileSync(new URL("../assets/models/quaternius/"+name,import.meta.url));
    assert.equal(glb.toString("ascii",0,4),"glTF",name);
    assert.equal(glb.readUInt32LE(4),2,name);
    assert.equal(glb.readUInt32LE(8),glb.length,name);
    assert.equal(glb.toString("ascii",16,20),"JSON",name);
    const json=JSON.parse(glb.toString("utf8",20,20+glb.readUInt32LE(12)));
    assert.ok(json.meshes?.length>=1,name);
    assert.ok(json.materials.some(x=>/bark/i.test(x.name)),name);
    assert.ok(json.materials.some(x=>/leaves/i.test(x.name)),name);
    assert.ok(json.images?.length>=2,name);
    const triangles=json.meshes.flatMap(m=>m.primitives).reduce((count,part)=>{
      const accessor=json.accessors[part.indices??part.attributes.POSITION];
      return count+accessor.count/3;
    },0);
    assert.ok(triangles>1500&&triangles<10000,name+" triangles="+triangles);
  }
});
