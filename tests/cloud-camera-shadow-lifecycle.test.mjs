import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { CLOUD_VERT, CLOUD_FRAG } from "../src/game/cloud-shader.ts";
import { registerHooks } from "node:module";

const fjordSource=readFileSync(new URL("../src/game/fjord.ts",import.meta.url),"utf8");
// Node does not apply TypeScript bundler-style '.js' -> '.ts' resolution.
// Use the documented Node loader hook ONLY for this test's two local imports,
// so the actual cloud-shadow.ts implementation can be exercised with a fake GPU.
const hooks=registerHooks({
  resolve(specifier,context,nextResolve){
    if(context.parentURL?.endsWith("/src/game/cloud-shadow.ts") &&
       (specifier==="./cloud-shader.js"||specifier==="./cloud-field.js"))
      return nextResolve(specifier.slice(0,-3)+".ts",context);
    return nextResolve(specifier,context);
  }
});
const {createCloudShadow}=await import("../src/game/cloud-shadow.ts");
hooks.deregister();


test("clouds and atmosphere share actual world-space camera rays",()=>{
  const expected=/vRay=worldPoint\.xyz-cameraPosition;/;
  assert.match(CLOUD_VERT,expected);
  assert.match(fjordSource,expected);
  assert.doesNotMatch(CLOUD_VERT,/vRay=position;/);
  assert.match(CLOUD_VERT,/gl_Position=projectionMatrix\*viewMatrix\*worldPoint;/);
  // With a moving camera, a geometric point has a different direction from
  // the sphere's local vertex. Both sky passes must use the former.
  const point=new THREE.Vector3(100,300,730),camera=new THREE.Vector3(65,3,-20);
  const actual=point.clone().sub(camera).normalize();
  assert.ok(actual.distanceTo(point.clone().normalize())>0.015);
  const origin=point.clone().sub(new THREE.Vector3()).normalize();
  assert.ok(origin.distanceTo(point.clone().normalize())<1e-12);
});

test("cloud horizon fades without an artificial clear zenith cap",()=>{
  assert.match(CLOUD_FRAG,/float mask=smoothstep\(0\.0,0\.20,ray\.y\)\*\(1\.0-0\.97\*uNightC\);/);
  assert.doesNotMatch(CLOUD_FRAG,/1\.0-smoothstep\(0\.86,0\.98,ray\.y\)/);
  const mask=y=>{const t=Math.min(1,Math.max(0,y/.2));return t*t*(3-2*t);};
  assert.equal(mask(0),0);
  assert.ok(mask(.03)>0,"low-elevation cloud fade begins immediately above horizon");
  assert.equal(mask(.20),1);
  assert.equal(mask(1),1,"no cloudless zenith hole");
});

function harness(){
  const scene=new THREE.Scene(),textures=[],occ=[];
  const scope={track:item=>{textures.push(item);return item;}};
  const cloudField={
    uniforms:{uCloudShadowMap:{value:null},uShadowCenter:{value:new THREE.Vector2()},uShadowSize:{value:900}},
    setSunOcclusion:value=>occ.push(value)
  };
  const gen={value:new Array(10).fill(0)};
  const common={
    uTime:{value:0},uCloudAmount:{value:1},uCloudDetailLevel:{value:2},
    uCloudWind:{value:new THREE.Vector2()},uNoise:{value:null},uGen:gen,
    uSunDirection:{value:new THREE.Vector3(0,1,0)}
  };
  const field=createCloudShadow({scene,scope,cloudField,uniforms:common,gen});
  const pending=[], stats={draw:0,clear:0,targets:[]},prev={name:"previous-target"};
  let current=prev;
  const renderer={
    getRenderTarget:()=>current,
    autoClear:false,
    setRenderTarget:t=>{stats.targets.push(t);current=t;},
    render:()=>{stats.draw++;},
    clear:()=>{stats.clear++;},
    readRenderTargetPixelsAsync:(_target,_x,_y,_w,_h,bytes)=>new Promise(resolve=>pending.push({resolve,bytes}))
  };
  return {field,cloudField,gen,renderer,stats,prev,occ,pending,tracked:textures};
}

test("cloud-shadow disabled/clear frames skip redundant target clears and restore renderer state",()=>{
  const h=harness();
  h.field.setQuality("basic",false);
  h.field.tick();h.field.run(h.renderer);
  assert.equal(h.stats.clear,1);
  assert.equal(h.renderer.getRenderTarget(),h.prev);
  assert.equal(h.renderer.autoClear,false);
  for(let i=0;i<5;i++){h.field.tick();h.field.run(h.renderer);}
  assert.equal(h.stats.clear,1,"inactive target clears once, not every frame");
  h.gen.value[8]=1;
  h.field.setQuality("balanced",true);
  h.field.tick();h.field.run(h.renderer);
  assert.equal(h.stats.draw,1);
  h.gen.value[8]=0;
  h.field.tick();h.field.run(h.renderer);
  assert.equal(h.stats.clear,2,"first clear after active clouds resets stale shadow map");
  h.field.tick();h.field.run(h.renderer);
  assert.equal(h.stats.clear,2);
  assert.equal(h.renderer.autoClear,false);
});

test("late shadow-map GPU readbacks cannot restore stale sun occlusion after quality change",async()=>{
  const h=harness();
  h.gen.value[8]=1;
  h.field.setQuality("high",true);
  for(let i=0;i<12;i++){h.field.tick();h.field.run(h.renderer);}
  assert.equal(h.pending.length,1);
  h.pending[0].bytes[0]=255;
  h.field.setQuality("balanced",false); // invalidate the in-flight GPU read
  assert.equal(h.occ.at(-1),0);
  h.pending[0].resolve();
  await Promise.resolve();
  assert.equal(h.occ.at(-1),0,"obsolete read cannot darken the new scene");
  h.field.tick();h.field.run(h.renderer);
  assert.equal(h.stats.clear,1);
  h.field.setQuality("balanced",true);
  // The obsolete completion must not make new readbacks stay blocked.
  for(let i=0;i<12;i++){h.field.tick();h.field.run(h.renderer);}
  assert.equal(h.pending.length,2);
  h.pending[1].bytes[0]=128;h.pending[1].resolve();
  await Promise.resolve();
  assert.ok(Math.abs(h.occ.at(-1)-128/255)<1e-9);
});

test("disposing the cloud render target invalidates an in-flight async readback",async()=>{
  const h=harness();
  h.gen.value[8]=1;h.field.setQuality("balanced",true);
  for(let i=0;i<12;i++){h.field.tick();h.field.run(h.renderer);}
  assert.equal(h.pending.length,1);
  h.pending[0].bytes[0]=255;
  h.tracked[0].dispose();
  assert.equal(h.occ.at(-1),0);
  h.pending[0].resolve();
  await Promise.resolve();
  assert.equal(h.occ.at(-1),0,"disposed GPU results must not revive cloud dimming");
});

test("renderer state restores even if the cloud-shadow pass throws",()=>{
  const h=harness();
  h.gen.value[8]=1;
  const broken={...h.renderer,render:()=>{throw Error("simulated WebGL error");}};
  h.field.tick();
  assert.throws(()=>h.field.run(broken),/simulated WebGL error/);
  assert.equal(broken.getRenderTarget(),h.prev);
  assert.equal(broken.autoClear,false);
});
