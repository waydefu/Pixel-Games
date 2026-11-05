import test from "node:test";
import assert from "node:assert/strict";
import { createOnDemandEffects } from "../src/rendering/effects-on-demand.js";

test("basic and balanced never allocate HDR targets before high is selected",async()=>{
  const trace=[];
  const fx=createOnDemandEffects(()=>{
    trace.push("allocate");
    return {setSize:(w,h)=>trace.push("size:"+w+"x"+h),
      setQuality:q=>trace.push("quality:"+q),
      setCamera:c=>trace.push("camera:"+c.id),
      render:()=>trace.push("render"),
      dispose:()=>trace.push("dispose")};
  });
  fx.setSize(1280,720);fx.setCamera({id:"quarter"});
  fx.setQuality("balanced");
  assert.equal(fx.allocated,false);
  assert.equal(fx.enabled(),false);
  assert.equal(fx.render(),false);
  assert.deepEqual(trace,[]);
  fx.setQuality("high");
  assert.equal(fx.enabled(),true);
  fx.render();
  assert.deepEqual(trace.slice(0,4),["allocate","quality:high","size:1280x720","camera:quarter"]);
  assert.equal(fx.allocated,true);
  fx.setSize(900,600);fx.setQuality("basic");
  assert.equal(fx.enabled(),false);
  assert.equal(fx.render(),false);
  assert.ok(trace.includes("size:900x600"));
  await fx.dispose();
  assert.equal(fx.allocated,false);
  assert.equal(fx.enabled(),false);
  assert.deepEqual(trace.slice(-1),["dispose"]);
});

test("invalid factory or effects pipeline cannot silently report success",()=>{
  assert.throws(()=>createOnDemandEffects(null),TypeError);
  const fx=createOnDemandEffects(()=>({}));
  fx.setQuality("high");
  assert.throws(()=>fx.render(),/invalid effects pipeline/);
});
