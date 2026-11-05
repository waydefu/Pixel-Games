import test from "node:test";
import assert from "node:assert/strict";
import { partitionFacade } from "../src/game/facade-geometry.js";
test("facade masonry has physical openings instead of glass attached to a solid box",()=>{
  const holes=[{x:0,y:1.2,w:1.25,h:2.16},{x:-1.9,y:2.55,w:.99,h:1.31},{x:1.9,y:2.55,w:.99,h:1.31}];
  const cells=partitionFacade(6,.52,4.4,holes);
  assert.ok(cells.length>6 && cells.every(c=>c.w>0&&c.h>0));
  for(const c of cells){
    for(const h of holes){
      const overlapX=Math.max(0,Math.min(c.x+c.w/2,h.x+h.w/2)-Math.max(c.x-c.w/2,h.x-h.w/2));
      const overlapY=Math.max(0,Math.min(c.y+c.h/2,h.y+h.h/2)-Math.max(c.y-c.h/2,h.y-h.h/2));
      assert.ok(overlapX*overlapY<1e-5);
    }
  }
  const aperture=holes.reduce((sum,h)=>sum+h.w*(Math.min(4.4,h.y+h.h/2)-Math.max(.52,h.y-h.h/2)),0);
  const remaining=cells.reduce((sum,c)=>sum+c.w*c.h,0);
  assert.ok(Math.abs(remaining-(6*(4.4-.52)-aperture))<.002);
});
test("facade rejects invalid dimensions and out of bounds apertures",()=>{
  assert.throws(()=>partitionFacade(0,.5,3,[]),RangeError);
  assert.throws(()=>partitionFacade(4,2,1,[]),RangeError);
  assert.throws(()=>partitionFacade(4,0,2,[{x:0,y:1,w:0,h:1}]),RangeError);
});
