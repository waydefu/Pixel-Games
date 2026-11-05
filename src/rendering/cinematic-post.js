import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const BLOOM_LAYER=1;

/**
 * Two-composer SELECTIVE HDR glow, following the official three.js selective
 * UnrealBloomPass example. A sky with HDR scattering must never glow en masse.
 * Source: https://github.com/mrdoob/three.js/blob/r187/examples/webgl_postprocessing_unreal_bloom_selective.html
 *
 * Bloom composer draws the scene with non-emissive materials temporarily black.
 * Final composer draws the original scene, applies orthographic tilt-shift and
 * adds ONLY the masked bloom. OutputPass tone-maps/colorspaces exactly once.
 * Basic/balanced bypass both composers; high is allocated lazily by host.
 */
export function createCinematicPost({renderer,scene,camera}){
  if(!renderer||!scene||!camera)throw new TypeError("renderer, scene and camera are required");
  const hdr=renderer.extensions?.has("EXT_color_buffer_float")??false;
  const format=hdr?THREE.HalfFloatType:THREE.UnsignedByteType;
  const makeTarget=(name)=>{
    const target=new THREE.WebGLRenderTarget(1,1,{type:format,depthBuffer:true,stencilBuffer:false});
    target.texture.name=name;
    return target;
  };
  const bloomComposer=new EffectComposer(renderer,makeTarget("selective-bloom"));
  bloomComposer.setPixelRatio(1);
  bloomComposer.renderToScreen=false;
  const bloomRenderPass=new RenderPass(scene,camera);
  bloomComposer.addPass(bloomRenderPass);
  const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.85,.38,.78);
  bloomComposer.addPass(bloom);

  const finalComposer=new EffectComposer(renderer,makeTarget("cinematic-final"));
  finalComposer.setPixelRatio(1);
  const renderPass=new RenderPass(scene,camera);
  finalComposer.addPass(renderPass);

  const focus=new ShaderPass({
    uniforms:{
      tDiffuse:{value:null},
      uTexel:{value:new THREE.Vector2(1,1)},
      uBlur:{value:0},
      uFocusLine:{value:.53},
    },
    vertexShader:`varying vec2 vUv;
      void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
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
        vec4 result=texture2D(tDiffuse,vUv)*.25;
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
  finalComposer.addPass(focus);

  const composite=new ShaderPass({
    uniforms:{
      tDiffuse:{value:null},
      uBloom:{value:bloomComposer.renderTarget2.texture},
    },
    vertexShader:`varying vec2 vUv;
      void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`precision highp float;
      varying vec2 vUv;
      uniform sampler2D tDiffuse;
      uniform sampler2D uBloom;
      void main(){
        vec4 base=texture2D(tDiffuse,vUv);
        vec3 halo=texture2D(uBloom,vUv).rgb;
        gl_FragColor=vec4(base.rgb+halo,base.a);
      }`,
  });
  finalComposer.addPass(composite);
  finalComposer.addPass(new OutputPass());

  const bloomMask=new THREE.Layers();
  bloomMask.set(BLOOM_LAYER);
  const darkMaterial=new THREE.MeshBasicMaterial({color:0x000000,fog:false});
  const savedMaterials=new Map();
  const blackBackground=new THREE.Color(0x000000);

  // Scene batcher is run before creating this pipeline: emissive intensity is
  // now a data-driven bloom eligibility criterion, including merged windows.
  let bloomSources=0;
  scene.traverse(object=>{
    if(!object.isMesh)return;
    const mat=object.material;
    if(!Array.isArray(mat)&&mat?.isMeshStandardMaterial&&
       mat.emissiveIntensity>=1.4&&mat.emissive?.r+mat.emissive?.g+mat.emissive?.b>0){
      object.layers.enable(BLOOM_LAYER);
      bloomSources++;
    }
  });
  if(bloomSources===0)console.warn("Selective Bloom has no HDR emitters");

  function darkenNonBloomed(object){
    if(!object.isMesh||bloomMask.test(object.layers))return;
    savedMaterials.set(object,object.material);
    object.material=darkMaterial;
  }
  function restoreNonBloomed(){
    for(const [mesh,material] of savedMaterials)mesh.material=material;
    savedMaterials.clear();
  }

  let disposed=false,currentQuality="balanced",size={width:1,height:1};
  function setSize(width,height){
    if(disposed)return;
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)
      throw new RangeError("invalid post target dimensions");
    size={width:Math.max(1,Math.floor(width)),height:Math.max(1,Math.floor(height))};
    bloomComposer.setSize(size.width,size.height);
    finalComposer.setSize(size.width,size.height);
    bloom.setSize(Math.max(1,size.width>>1),Math.max(1,size.height>>1));
    focus.uniforms.uTexel.value.set(1/size.width,1/size.height);
  }
  function setQuality(value){currentQuality=value;}
  function setCamera(value){
    bloomRenderPass.camera=value;
    renderPass.camera=value;
    const quarter=value.isOrthographicCamera===true;
    focus.enabled=quarter;
    focus.uniforms.uBlur.value=quarter?5.2:0;
    focus.uniforms.uFocusLine.value=.55;
  }
  function enabled(value=currentQuality){return !disposed&&value==="high";}
  function render(){
    if(!enabled())return false;
    const originalBackground=scene.background;
    const originalFog=scene.fog;
    const info=renderer.info;
    const originalAutoReset=info?.autoReset;
    // Preserve geometry + effect draw-call counts, rather than reporting only
    // the final OutputPass quad (previous run falsely showed 1 draw call).
    if(info){info.autoReset=false;info.reset();}
    try{
      scene.background=blackBackground;
      scene.fog=null;
      scene.traverse(darkenNonBloomed);
      try{
        bloomComposer.render();
      }finally{
        restoreNonBloomed();
        scene.background=originalBackground;
        scene.fog=originalFog;
      }
      finalComposer.render();
    }finally{
      restoreNonBloomed();
      scene.background=originalBackground;
      scene.fog=originalFog;
      if(info)info.autoReset=originalAutoReset;
    }
    return true;
  }
  function dispose(){
    if(disposed)return;
    disposed=true;
    restoreNonBloomed();
    bloomComposer.dispose();
    finalComposer.dispose();
    darkMaterial.dispose();
  }
  setCamera(camera);
  return Object.freeze({
    enabled,render,setSize,setQuality,setCamera,dispose,
    get size(){return Object.freeze({...size});},
    get bloomSources(){return bloomSources;},
    get halfFloat(){return hdr;},
    get passes(){return Object.freeze(["SelectiveBloom","RenderPass","TiltShiftDoF","BloomComposite","OutputPass"]);},
  });
}
