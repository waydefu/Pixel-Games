import * as THREE from "three";
import { createPixelMaterialFactory } from "./pixel/world-material.js";

/**
 * World materials: every surface comes from the shared pixel palette with one world-space
 * texel density (see pixel/). The old random-speckle canvas painter was removed.
 */
export type ArtKind="plaster"|"stone"|"roof-red"|"roof-blue"|"timber"|"cobble"|"grass"|"foliage"|"sand"|"planks"|"thatch"|"cliff"|"canvas"|"brick";
export function createArtLibrary(scope:{track:<T extends{dispose:()=>void}>(item:T)=>T}){
  const factory=createPixelMaterialFactory(scope);
  return {material:(kind:ArtKind,seed=1):THREE.MeshStandardMaterial=>factory.material(kind,seed)};
}

function px(ctx:CanvasRenderingContext2D,c:string,x:number,y:number,w:number,h:number){
  ctx.fillStyle=c;ctx.fillRect(Math.floor(x),Math.floor(y),Math.max(1,Math.ceil(w)),Math.max(1,Math.ceil(h)));
}

/** Procedural, original 48x64 four-way pixel traveller, four animation frames per facing. */
export function createTravellerAtlas(){
  const W=48,H=64,N=4,c=document.createElement("canvas");c.width=W*N;c.height=H*N;
  const ctx=c.getContext("2d");if(!ctx)throw Error("Cannot paint traveller");
  ctx.imageSmoothingEnabled=false;
  for(let row=0;row<4;row++)for(let frame=0;frame<4;frame++){
    const ox=frame*W,oy=row*H;
    const p=(color:string,x:number,y:number,w:number,h:number)=>px(ctx,color,ox+x,oy+y,w,h);
    const bob=frame===1||frame===3?-1:0;
    const leg=frame%2===0?0:3,front=row===0,back=row===2,side=row===1||row===3;
    // Soft gold-bordered hood and traveler's cloak silhouette.
    p("#202b33",15,5+bob,19,22);
    p("#604735",12,9+bob,23,22);p("#c5a16f",14,9+bob,18,3);
    p("#a8825a",14,12+bob,19,4);
    p("#d6ac82",17,16+bob,14,15);
    if(!back){
      p("#2b3539",19,24+bob,3,2);p("#2b3539",28,24+bob,3,2);
      p("#b77c60",23,27+bob,5,2);
    }
    if(side){p("#b97857",32,19+bob,3,8);p("#342d2e",18,23+bob,2,7);}
    if(back){p("#775c4d",18,16+bob,14,13);p("#c69f6c",23,18+bob,4,3);}
    p("#29484d",15,30+bob,20,18);
    p("#507579",17,32+bob,16,11);
    p("#9f7753",16,42+bob,18,3);
    p("#e4c8a1",11,31+bob,4,12);p("#e4c8a1",35,31+bob,4,12);
    p("#384b4d",12,39+bob,4,5);p("#384b4d",34,39+bob,4,5);
    p("#2b343d",17,46+bob,7,12);p("#2b343d",27,46+bob,7,12);
    p("#433a39",15,55+bob+leg,10,4);p("#433a39",27,55+bob+(3-leg),10,4);
    p("#d7bb86",13,27+bob,23,2);
    p("#6d4738",12,13+bob,2,17);p("#9d7050",36,13+bob,2,18);
    // A little leather travel satchel and copper clasp.
    if(!back){p("#664737",31,37+bob,8,10);p("#e2b975",34,39+bob,3,2);}
    if(front){p("#efe0bf",19,17+bob,2,3);p("#efe0bf",29,17+bob,2,3);}
  }
  return c;
}
