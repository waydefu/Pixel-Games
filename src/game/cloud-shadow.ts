import * as THREE from "three";
import { CLOUD_SHADOW_VERT, CLOUD_SHADOW_FRAG } from "./cloud-shader.js";
import { SHADOW_EXTENT, type CloudField } from "./cloud-field.js";

/**
 * Cloud shadows on the ground: the cloud shader's layers seen from the sun, drawn into one small map centred on the player.
 * Ground materials read it (cloud-field.ts), so the shadow under you is the shadow of the cloud you see overhead.
 *
 * Budget: one full-screen pass into a square target of at most 256 px (128 on Balanced, 64 on Basic), at most once a frame,
 * and none at all on a software rasteriser or when no cloud is up. The pass runs from a hook object's onBeforeRender, the way
 * the sea's mirror does, because that is where the renderer is at hand.
 */
export function createCloudShadow(opts:{
  scene:THREE.Scene;scope:{track:<T extends{dispose:()=>void}>(item:T)=>T};cloudField:CloudField;
  uniforms:Record<string,{value:unknown}>;gen:{value:number[]};
}){
  const {scene,scope,cloudField,gen}=opts;
  let size=256,enabled=true,frame=0,lastFrame=-1,readPending=false,readClock=0;
  const target=scope.track(new THREE.WebGLRenderTarget(size,size,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false}));
  target.texture.wrapS=target.texture.wrapT=THREE.ClampToEdgeWrapping;
  cloudField.uniforms.uCloudShadowMap.value=target.texture;
  const material=scope.track(new THREE.ShaderMaterial({
    uniforms:{...opts.uniforms,uShadowCenter:cloudField.uniforms.uShadowCenter,uShadowSize:cloudField.uniforms.uShadowSize},
    vertexShader:CLOUD_SHADOW_VERT,fragmentShader:CLOUD_SHADOW_FRAG,depthTest:false,depthWrite:false,
  }));
  const shadowScene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const quad=new THREE.Mesh(scope.track(new THREE.PlaneGeometry(2,2)),material);
  quad.frustumCulled=false;shadowScene.add(quad);
  const probe=new Uint8Array(4);
  const hook=new THREE.Mesh(scope.track(new THREE.PlaneGeometry(.01,.01)),scope.track(new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false})));
  hook.frustumCulled=false;hook.renderOrder=-1000;hook.userData.dynamic=true;hook.name="cloud-shadow-hook";
  hook.onBeforeRender=renderer=>{
    if(frame===lastFrame)return;                         // the scene is drawn several times a frame: the map once
    lastFrame=frame;
    let any=enabled;
    if(any){any=false;for(let i=0;i<gen.value.length;i++)if(gen.value[i]>.01){any=true;break;}}
    const previous=renderer.getRenderTarget(),autoClear=renderer.autoClear;
    renderer.setRenderTarget(target);renderer.autoClear=true;
    if(any)renderer.render(shadowScene,camera);else renderer.clear();
    renderer.setRenderTarget(previous);renderer.autoClear=autoClear;
    // how much of the sun the cloud over the player hides: the centre texel, read back a few times a second
    readClock++;
    if(any&&!readPending&&readClock%12===0&&typeof renderer.readRenderTargetPixelsAsync==="function"){
      readPending=true;
      renderer.readRenderTargetPixelsAsync(target,size>>1,size>>1,1,1,probe)
        .then(()=>{cloudField.setSunOcclusion(probe[0]/255);readPending=false;}).catch(()=>{readPending=false;});
    }
    if(!any)cloudField.setSunOcclusion(0);
  };
  scene.add(hook);
  return {
    /** Call once per frame: lets the hook know a new frame has begun. */
    tick(){frame++;},
    /** The map's cost follows the quality tier; a software rasteriser has no cloud shadows at all. */
    setQuality(quality:"basic"|"balanced"|"high",on=true){
      enabled=on;
      const next=quality==="high"?256:quality==="balanced"?128:64;
      if(next!==size){size=next;target.setSize(next,next);}
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
