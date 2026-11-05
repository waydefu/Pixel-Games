import * as THREE from "three";
import { createPixelMaterialFactory } from "./pixel/world-material.js";
import { paintTravellerSheet } from "./pixel/character.js";

/**
 * World materials: every surface comes from the shared pixel palette with one world-space
 * texel density (see pixel/). The old random-speckle canvas painter was removed.
 */
export type ArtKind="plaster"|"stone"|"roof-red"|"roof-blue"|"timber"|"cobble"|"grass"|"foliage"|"sand"|"planks"|"thatch"|"cliff"|"rock"|"canvas"|"brick"|"bark"|"birch-bark";
export function createArtLibrary(scope:{track:<T extends{dispose:()=>void}>(item:T)=>T}){
  const factory=createPixelMaterialFactory(scope);
  return {material:(kind:ArtKind,seed=1):THREE.MeshStandardMaterial=>factory.material(kind,seed)};
}

/** The angler traveller: 4 directions x 4 walk frames, 32x32 texels each (16 texels per world unit). */
export function createTravellerAtlas(){
  const sheet=paintTravellerSheet();
  const canvas=document.createElement("canvas");
  canvas.width=sheet.width;canvas.height=sheet.height;
  const ctx=canvas.getContext("2d");
  if(!ctx)throw Error("Cannot paint traveller");
  ctx.putImageData(new ImageData(new Uint8ClampedArray(sheet.data),sheet.width,sheet.height),0,0);
  return canvas;
}
