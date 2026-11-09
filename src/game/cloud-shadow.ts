import * as THREE from "three";
import { CLOUD_SHADOW_VERT, CLOUD_SHADOW_FRAG } from "./cloud-shader.js";
import { SHADOW_EXTENT, type CloudField } from "./cloud-field.js";

/**
 * Cloud shadows on the ground: the cloud shader's layers seen from the sun, drawn into one small map centred on the player.
 * Ground materials read it (cloud-field.ts), so the shadow under you is the shadow of the cloud you see overhead.
 *
 * Budget: one full-screen pass into a square target of at most 256 px (128 on Balanced, 64 on Basic), at most once a frame,
 * and none at all on a software rasteriser or when no cloud is up. `run(renderer)` is called by the frame pipeline BEFORE the scene
 * pass: switching render targets in the middle of a multisampled scene pass loses what was already drawn on phone GPUs
 * (WEBGL_multisampled_render_to_texture), which showed as every second frame going blank. The hook object's onBeforeRender
 * stays as the fallback for a renderer without that pipeline.
 */
export function createCloudShadow(opts:{
  scene:THREE.Scene;scope:{track:<T extends{dispose:()=>void}>(item:T)=>T};cloudField:CloudField;
  uniforms:Record<string,{value:unknown}>;gen:{value:number[]};
}){
  const {scene,scope,cloudField,gen}=opts;
  let size=256,enabled=true,frame=0,lastFrame=-1,readPending=false,readClock=0;
  // GPU readbacks may finish after a quality switch, a resize or cloud removal.
  let generation=0,cleared=false;
  const invalidate=()=>{generation++;readPending=false;cloudField.setSunOcclusion(0);};
  const target=scope.track(new THREE.WebGLRenderTarget(size,size,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false}));
  target.texture.wrapS=target.texture.wrapT=THREE.ClampToEdgeWrapping;
  cloudField.uniforms.uCloudShadowMap.value=target.texture;
  // setSize() and world teardown dispose target attachments; reject any in-flight readback.
  target.addEventListener("dispose",invalidate);
  const material=scope.track(new THREE.ShaderMaterial({
    uniforms:{...opts.uniforms,uShadowCenter:cloudField.uniforms.uShadowCenter,uShadowSize:cloudField.uniforms.uShadowSize},
    vertexShader:CLOUD_SHADOW_VERT,fragmentShader:CLOUD_SHADOW_FRAG,depthTest:false,depthWrite:false,
  }));
  const shadowScene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const quad=new THREE.Mesh(scope.track(new THREE.PlaneGeometry(2,2)),material);
  quad.frustumCulled=false;shadowScene.add(quad);
  const hook=new THREE.Mesh(scope.track(new THREE.PlaneGeometry(.01,.01)),scope.track(new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false})));
  hook.frustumCulled=false;hook.renderOrder=-1000;hook.userData.dynamic=true;hook.name="cloud-shadow-hook";
  function run(renderer:THREE.WebGLRenderer){
    if(frame===lastFrame)return;                         // only one cloud-shadow update per game frame
    lastFrame=frame;
    let any=enabled;
    if(any){any=false;for(let i=0;i<gen.value.length;i++)if(gen.value[i]>.01){any=true;break;}}
    // A disabled or empty cloud field requires ONE zero clear, not a render-target
    // switch and framebuffer clear on every frame.
    if(!any&&cleared)return;
    const previous=renderer.getRenderTarget(),autoClear=renderer.autoClear;
    try{
      renderer.setRenderTarget(target);renderer.autoClear=true;
      if(any)renderer.render(shadowScene,camera);else renderer.clear();
    }finally{
      renderer.setRenderTarget(previous);renderer.autoClear=autoClear;
    }
    if(!any){
      invalidate();cleared=true;
      return;
    }
    cleared=false;
    // Readbacks are async. Never let an old result darken the scene after
    // disable, resize or a new cloud generation.
    readClock++;
    if(!readPending&&readClock%12===0&&typeof renderer.readRenderTargetPixelsAsync==="function"){
      const ticket=generation;
      const sample=new Uint8Array(4);  // own buffer: late reads must not overwrite a newer result
      readPending=true;
      try{
        renderer.readRenderTargetPixelsAsync(target,size>>1,size>>1,1,1,sample)
          .then(()=>{
            if(ticket===generation){cloudField.setSunOcclusion(sample[0]/255);readPending=false;}
          })
          .catch(()=>{if(ticket===generation)readPending=false;});
      }catch{
        if(ticket===generation)readPending=false;
      }
    }
  }
  hook.onBeforeRender=run;
  scene.add(hook);
  return {
    /** Call once per frame: lets the hook know a new frame has begun. */
    tick(){frame++;},
    /** Draws the map for this frame (once); call it before the scene pass. */
    run,
    /** The map's cost follows the quality tier; a software rasteriser has no cloud shadows at all. */
    setQuality(quality:"basic"|"balanced"|"high",on=true){
      const next=quality==="high"?256:quality==="balanced"?128:64;
      if(enabled!==on||next!==size)invalidate();
      enabled=on;
      if(next!==size){size=next;target.setSize(next,next);cleared=false;}
      // The next pre-pass clears an inactive target exactly once.
      if(!on)cleared=false;
    },
    /** Centre the map on the player, snapped to its texels so the shadows do not swim. */
    setCenter(x:number,z:number){
      const texel=SHADOW_EXTENT/size;
      cloudField.uniforms.uShadowCenter.value.set(Math.round(x/texel)*texel,Math.round(z/texel)*texel);
    },
    get size(){return size;},
  };
}
export type CloudShadow=ReturnType<typeof createCloudShadow>;
