import * as THREE from "three";
import type { StageKit } from "./kit.js";
import { CLOUD_FIELD_SIZE, CLOUD_WIND, cloudCoverage } from "./cloud-field.js";

/**
 * One moving, translucent cloud-pattern projection on the village ground.
 * No realtime shadow-map cloud geometry, fog pass, volumetric march or water RTT.
 * The land-only rectangle deliberately ends before the sea/pier at x>11.
 */
export function buildGroundCloudShadows(k:StageKit){
  const c=document.createElement("canvas");
  c.width=c.height=CLOUD_FIELD_SIZE;
  const ctx=c.getContext("2d");
  if(!ctx)throw new Error("Cloud shadow canvas unavailable");
  const pixels=ctx.createImageData(CLOUD_FIELD_SIZE,CLOUD_FIELD_SIZE);
  for(let j=0;j<CLOUD_FIELD_SIZE;j++)for(let i=0;i<CLOUD_FIELD_SIZE;i++){
    const value=Math.round(255*cloudCoverage(i/CLOUD_FIELD_SIZE,j/CLOUD_FIELD_SIZE));
    const p=(j*CLOUD_FIELD_SIZE+i)*4;
    pixels.data[p]=pixels.data[p+1]=pixels.data[p+2]=value;
    pixels.data[p+3]=255;
  }
  ctx.putImageData(pixels,0,0);
  const texture=k.scope.track(new THREE.CanvasTexture(c));
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;
  texture.colorSpace=THREE.NoColorSpace;
  texture.needsUpdate=true;
  const material=k.scope.track(new THREE.MeshBasicMaterial({
    color:"#2a3b4d",alphaMap:texture,transparent:true,opacity:.24,
    depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,
    polygonOffsetFactor:-1,fog:false,
  }));
  // Stays above the village's flat ground and stone road, below buildings and
  // trees. A larger sloped-world decal is deliberately not claimed here.
  const geometry=k.scope.track(new THREE.PlaneGeometry(54,79));
  const projected=new THREE.Mesh(geometry,material);
  projected.name="moving-cloud-ground-shade";
  projected.rotation.x=-Math.PI/2;
  projected.position.set(-16.0,-.015,0);
  projected.renderOrder=1;
  projected.userData.dynamic=true; // The texture's UV offset animates each tick.
  projected.castShadow=false;
  projected.receiveShadow=false;
  k.scene.add(projected);
  function update(time:number){
    texture.offset.set(-time*CLOUD_WIND.x,-time*CLOUD_WIND.z);
  }
  return {mesh:projected,update,texture};
}
