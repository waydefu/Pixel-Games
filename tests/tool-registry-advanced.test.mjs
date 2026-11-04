import test from "node:test";
import assert from "node:assert/strict";
import { createToolRegistry } from "../src/integrations/tool-registry.js";
test("adapter input/output schema and major-version check fail closed",async()=>{
 const r=createToolRegistry({allowedCapabilities:["assets.inspect"]});
 r.register({id:"tiled",version:"2.3.0",handlers:{"assets.inspect":{
  validateInput:x=>typeof x?.path==="string",
  validateOutput:x=>typeof x?.sha256==="string",
  run:async ({path})=>({sha256:path}),
 }}});
 await assert.rejects(r.call({id:"tiled",capability:"assets.inspect",input:42}),/input/);
 await assert.rejects(r.call({id:"tiled",capability:"assets.inspect",input:{path:"a"},requiredMajorVersion:1}),/incompatible/);
 assert.deepEqual(await r.call({id:"tiled",capability:"assets.inspect",input:{path:"x"},requiredMajorVersion:2}),{sha256:"x"});
});
test("abort and timeout propagate rather than return a success",async()=>{
 const r=createToolRegistry({allowedCapabilities:["qa.capture"]});
 r.register({id:"qa",handlers:{"qa.capture": async(_,ctx)=> new Promise((resolve,reject)=>{
  ctx.signal.addEventListener("abort",()=>reject(Error("stopped")),{once:true});
 })}});
 const abort=new AbortController();
 const task=r.call({id:"qa",capability:"qa.capture",signal:abort.signal,timeoutMs:300});
 abort.abort();
 await assert.rejects(task,error=>error.name==="AbortError");
 await assert.rejects(r.call({id:"qa",capability:"qa.capture",timeoutMs:10}),error=>error.name==="TimeoutError");
 await r.unregister("qa");
});
test("unregister aborts running tool requests",async()=>{
 const r=createToolRegistry({allowedCapabilities:["qa.capture"]});
 let listener;
 r.register({id:"qa",handlers:{"qa.capture": async(_,ctx)=> {
  await new Promise(resolve=>{listener=()=>resolve();ctx.signal.addEventListener("abort",listener,{once:true});});
  return "cancelled";
 }}});
 const t=r.call({id:"qa",capability:"qa.capture",timeoutMs:1000});
 await new Promise(resolve=>setImmediate(resolve));
 await r.unregister("qa");
 await assert.rejects(t,error=>error.name==="AbortError");
 await assert.rejects(r.call({id:"qa",capability:"qa.capture"}),/not connected/);
});
