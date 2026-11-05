// Keeps basic/balanced mode free of HDR composer targets and shaders.
// One WebGLRenderer still owns the canvas; the expensive pipeline is allocated
// only when the user explicitly selects the cinematic High quality preset.
export function createOnDemandEffects(factory){
  if(typeof factory!=="function")throw new TypeError("factory must be a function");
  let pipeline=null,quality="balanced",size=null,camera=null,disposed=false;
  function ensure(){
    if(disposed)throw new Error("effects disposed");
    if(!pipeline){
      pipeline=factory();
      if(!pipeline||typeof pipeline.render!=="function")throw new TypeError("invalid effects pipeline");
      pipeline.setQuality(quality);
      if(size)pipeline.setSize(size.width,size.height);
      if(camera)pipeline.setCamera(camera);
    }
    return pipeline;
  }
  function setSize(width,height){
    if(disposed)return;
    size={width,height};
    pipeline?.setSize(width,height);
  }
  function setCamera(next){
    if(disposed)return;
    camera=next;pipeline?.setCamera(next);
  }
  function setQuality(next){
    if(disposed)return;
    quality=next;pipeline?.setQuality(next);
  }
  function enabled(next=quality){return !disposed&&next==="high";}
  function render(){
    if(!enabled())return false;
    return ensure().render();
  }
  async function dispose(){
    if(disposed)return;
    disposed=true;
    await pipeline?.dispose();
    pipeline=null;
  }
  return Object.freeze({setSize,setCamera,setQuality,enabled,render,dispose,
    get allocated(){return pipeline!==null;}
  });
}
