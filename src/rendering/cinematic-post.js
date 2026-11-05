import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/**
 * HDR-aware WebGL2 post effects. These are Three's maintained addons, not a
 * second rendering engine: RenderPass -> focus blur -> Bloom -> OutputPass.
 * The renderer port owns the pipeline and bypasses it for basic/balanced.
 *
 * Design: do not hide subpar geometry under DoF. The orthographic camera gets
 * subtle cinematic tilt-shift, perspective near-wall views remain sharp.
 */
export function createCinematicPost({renderer,scene,camera}){
  if(!renderer || !scene || !camera)throw new TypeError("renderer, scene and camera are required");
  const halfFloat=renderer.extensions?.has("EXT_color_buffer_float") ?? false;
  const target=new THREE.WebGLRenderTarget(1,1,{
    type:halfFloat?THREE.HalfFloatType:THREE.UnsignedByteType,
    depthBuffer:true,stencilBuffer:false,
  });
  target.texture.name="cinematic-post-scene";
  const composer=new EffectComposer(renderer,target);
  composer.setPixelRatio(1);

  const renderPass=new RenderPass(scene,camera);
  composer.addPass(renderPass);

  // Screen-space tilt blur is deliberate for the orthographic 2.5D viewpoint.
  // It uses 9 color samples instead of a second 3D depth re-render. First-
  // person geometry remains pin-sharp, particularly around wall details.
  const focus=new ShaderPass({
    uniforms:{
      tDiffuse:{value:null},
      uTexel:{value:new THREE.Vector2(1,1)},
      uBlur:{value:0},
      uFocusLine:{value:.53},
    },
    vertexShader:`varying vec2 vUv;
      void main(){
        vUv=uv;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }`,
    fragmentShader:`precision highp float;
      varying vec2 vUv;
      uniform sampler2D tDiffuse;
      uniform vec2 uTexel;
      uniform float uBlur;
      uniform float uFocusLine;
      void main(){
        float distanceFromFocus=abs(vUv.y-uFocusLine);
        float blur=smoothstep(.18,.47,distanceFromFocus)*uBlur;
        vec2 stepUv=uTexel*blur;
        vec4 center=texture2D(tDiffuse,vUv);
        vec4 result=center*.25;
        result+=texture2D(tDiffuse,vUv+vec2(stepUv.x,0.0))*.125;
        result+=texture2D(tDiffuse,vUv-vec2(stepUv.x,0.0))*.125;
        result+=texture2D(tDiffuse,vUv+vec2(0.0,stepUv.y))*.125;
        result+=texture2D(tDiffuse,vUv-vec2(0.0,stepUv.y))*.125;
        result+=texture2D(tDiffuse,vUv+vec2(stepUv.x,stepUv.y))*.0625;
        result+=texture2D(tDiffuse,vUv-vec2(stepUv.x,stepUv.y))*.0625;
        result+=texture2D(tDiffuse,vUv+vec2(stepUv.x,-stepUv.y))*.0625;
        result+=texture2D(tDiffuse,vUv+vec2(-stepUv.x,stepUv.y))*.0625;
        gl_FragColor=result;
      }`,
  });
  composer.addPass(focus);

  // Bloom only affects pixels above the high-luminance threshold; keep it
  // restrained in daylight and visibly present on emissive windows / beacon.
  const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.68,.32,.87);
  composer.addPass(bloom);
  const output=new OutputPass();
  composer.addPass(output);

  let disposed=false;
  let lastWidth=1,lastHeight=1;
  let currentCamera=camera;
  let currentQuality="balanced";
  function setSize(width,height){
    if(disposed)return;
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)
      throw new RangeError("invalid cinematic pipeline size");
    lastWidth=Math.max(1,Math.floor(width));
    lastHeight=Math.max(1,Math.floor(height));
    composer.setSize(lastWidth,lastHeight);
    // Half-res bloom and its mip chain; no reflected scene pass.
    bloom.setSize(Math.max(1,lastWidth>>1),Math.max(1,lastHeight>>1));
    focus.uniforms.uTexel.value.set(1/lastWidth,1/lastHeight);
  }
  function setQuality(quality){
    currentQuality=quality;
  }
  function setCamera(camera){
    currentCamera=camera;
    renderPass.camera=camera;
    const isQuarter=camera.isOrthographicCamera===true;
    focus.uniforms.uBlur.value=isQuarter?5.2:0;
    focus.uniforms.uFocusLine.value=.55;
    focus.enabled=isQuarter;
  }
  function enabled(quality=currentQuality){return quality==="high"&&!disposed;}
  function render(){
    if(!enabled())return false;
    // No separate UI render target: HTML overlay is always outside post FX.
    composer.render();
    return true;
  }
  function dispose(){
    if(disposed)return;
    disposed=true;
    composer.dispose();
  }
  setCamera(camera);
  return Object.freeze({
    enabled,render,setSize,setQuality,setCamera,dispose,
    get state(){return disposed?"disposed":"ready";},
    get passes(){return Object.freeze(["RenderPass","TiltShiftDoF","UnrealBloomPass","OutputPass"]);},
    get size(){return Object.freeze({width:lastWidth,height:lastHeight});},
    get halfFloat(){return halfFloat;},
  });
}
