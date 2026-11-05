import test from "node:test";
import assert from "node:assert/strict";
import { createRendererPort } from "../src/rendering/renderer-port.js";
import { createAdaptiveResolutionController } from "../src/rendering/quality.js";

function setup(asyncBackend=false) {
  const listeners = new Map(), calls=[], statuses=[];
  const canvas={addEventListener:(n,fn)=>listeners.set(n,fn),removeEventListener:(n)=>listeners.delete(n)};
  const renderer={info:{render:{calls:5,triangles:10},memory:{textures:2,geometries:1}},shadowMap:{},setSize:(...args)=>calls.push(["size",...args]),setPixelRatio:v=>calls.push(["ratio",v]),dispose:()=>calls.push(["disposed"]),render:()=>calls.push(["draw"])};
  if(asyncBackend) {renderer.init=async()=>calls.push(["init"]); renderer.renderAsync=async()=>calls.push(["drawAsync"]);}
  const host=createRendererPort({renderer,canvas,scene:{},camera:{},resizeCamera:(w,h)=>calls.push(["camera",w,h]),onStatus:s=>statuses.push(s)});
  return {listeners,calls,statuses,host,renderer};
}
test("generic port awaits async initialize and draw",async()=>{
 const {host,calls}=setup(true);
 assert.equal(await host.draw(),false);
 await host.initialize();
 assert.equal(host.state,"ready");
 host.resize(800,600,3);
 await host.draw();
 assert.ok(calls.some(v=>v[0]==="drawAsync"));
 assert.ok(calls.some(v=>v[0]==="camera"));
 assert.ok(host.stats().textures===2);
 await host.dispose();
 assert.equal(host.state,"disposed");
});
test("camera switching follows active projection without recreating renderer",async()=>{
 const {host,renderer}=setup();
 const cameras=[];
 renderer.render=(_,cam)=>cameras.push(cam);
 await host.initialize();
 const first={updateProjectionMatrix(){}},quarter={updateProjectionMatrix(){}};
 host.setCamera(first);
 await host.draw();
 host.setCamera(quarter);
 await host.draw();
 assert.deepEqual(cameras,[first,quarter]);
 assert.throws(()=>host.setCamera(null),TypeError);
 await host.dispose();
 assert.throws(()=>host.setCamera(first),/disposed/);
});
test("sync WebGL backend also uses same port and quality can change",async()=>{
 const {host,calls}=setup();
 await host.initialize();host.resize(300,200,2);
 host.setQuality("basic");host.setRenderScale(0.7);host.resize(300,200,2);
 assert.ok(calls.filter(v=>v[0]==="size").length===2);
 assert.equal(await host.draw(),true);
 assert.ok(calls.some(v=>v[0]==="draw"));
 assert.throws(()=>host.setRenderScale(0.1),RangeError);
 await host.dispose();
 await assert.rejects(host.initialize(),/disposed/);
});
test("WebGL context loss and async restore block drawing until resources recover",async()=>{
 const {host,listeners,statuses}=setup();
 await host.initialize();
 listeners.get("webglcontextlost")({preventDefault(){}});
 assert.equal(host.state,"lost");assert.equal(await host.draw(),false);
 listeners.get("webglcontextrestored")({});
 assert.equal(host.state,"restoring");
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(host.state,"ready");
 assert.ok(statuses.includes("restoring"));
 await host.dispose();
 assert.equal(listeners.size,0);
});
test("failed async initialization reports failure",async()=>{
 const {host,renderer}=setup();renderer.init=async()=>{throw Error("no adapter");};
 await assert.rejects(host.initialize(),/no adapter/);
 assert.equal(host.state,"failed");
 await host.dispose();
});
test("adaptive resolution degrades and recovers with hysteresis",()=>{
 const q=createAdaptiveResolutionController({windowSize:5,cooldownWindows:0});
 for(let i=0;i<5;i++)q.observe(28);
 assert.ok(q.scale<1);
 for(let i=0;i<5;i++)q.observe(6);
 assert.equal(q.scale,1);
 assert.throws(()=>q.observe(NaN),RangeError);
});

test("the HD-2D pipeline renders every tier, tracks camera, size and quality, and disposes cleanly",async()=>{
  const {renderer,listeners}=setup();
  const calls=[];
  const effects={
    setSize:(w,h)=>calls.push(["size",w,h]),
    setQuality:q=>calls.push(["quality",q]),
    setCamera:cam=>calls.push(["camera",cam]),
    render:t=>{calls.push(["post",t]);return true;},
    dispose:()=>calls.push(["disposed-post"]),
  };
  const port=createRendererPort({
    renderer,canvas:{addEventListener:(n,fn)=>listeners.set(n,fn),removeEventListener:n=>listeners.delete(n)},
    scene:{},camera:{},quality:"balanced",effects,
  });
  renderer.render=()=>calls.push(["direct"]);
  await port.initialize();
  port.resize(640,480,1);
  assert.deepEqual(calls[0],["size",640,480]);
  assert.equal(port.effects,"on");
  await port.draw(1.5);
  assert.ok(calls.some(x=>x[0]==="post"&&x[1]===1.5));
  assert.ok(!calls.some(x=>x[0]==="direct"),"no direct render while the pipeline works");
  const nextCamera={updateProjectionMatrix(){}};
  port.setCamera(nextCamera);
  port.setQuality("basic");
  await port.draw();
  assert.equal(port.effects,"on");
  assert.ok(calls.some(x=>x[0]==="camera"&&x[1]===nextCamera));
  assert.ok(calls.some(x=>x[0]==="quality"&&x[1]==="basic"));
  await port.dispose();
  assert.ok(calls.some(x=>x[0]==="disposed-post"));
});

test("failed pipeline falls back to the direct renderer instead of making the game unplayable",async()=>{
  const {renderer,listeners}=setup();
  let direct=0,post=0,failed=0;
  const effects={
    setSize(){},setCamera(){},setQuality(){},
    render(){post++;throw Error("simulated shader failure");},dispose(){},
    onFailure(){failed++;},
  };
  renderer.render=()=>direct++;
  const port=createRendererPort({
    renderer,canvas:{addEventListener:(n,fn)=>listeners.set(n,fn),removeEventListener:n=>listeners.delete(n)},
    scene:{},camera:{},quality:"high",effects,
  });
  await port.initialize();port.resize(400,300,1);
  const old=console.warn;console.warn=()=>{};
  try{assert.equal(await port.draw(),true);}finally{console.warn=old;}
  assert.equal(port.effects,"fallback");
  assert.equal(failed,1,"the host gets a chance to restore tone mapping");
  assert.equal(post,1);assert.equal(direct,1);
  assert.equal(await port.draw(),true);
  assert.equal(post,1);assert.equal(direct,2);
  await port.dispose();
});
