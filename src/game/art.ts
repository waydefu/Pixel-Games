import * as THREE from "three";

/**
 * Original procedural pixel materials, designed for consistent texel density.
 * These do not copy or import Luminati/Bells of Evermere assets or code.
 */
type ArtKind = "plaster"|"stone"|"roof-red"|"roof-blue"|"timber"|"cobble"|"grass"|"sand"|"planks"|"thatch"|"cliff"|"canvas"|"brick";
function rng(seed:number){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function pick<T>(values:T[],rand:()=>number):T{return values[Math.floor(rand()*values.length)];}
function px(ctx:CanvasRenderingContext2D,c:string,x:number,y:number,w:number,h:number){
  ctx.fillStyle=c;ctx.fillRect(Math.floor(x),Math.floor(y),Math.max(1,Math.ceil(w)),Math.max(1,Math.ceil(h)));
}
const palettes:Record<ArtKind,string[]>={
  plaster:["#ddc7a5","#e5d5b5","#c6ad8d","#f1d9ae","#b99f82"],
  stone:["#8d8c80","#a5a59a","#c6bda5","#7d817a","#d1c4a4"],
  "roof-red":["#8f5148","#a65e4d","#c2795b","#784e4c","#d09965"],
  "roof-blue":["#536b72","#637f7d","#40565d","#799294","#938472"],
  timber:["#4c3831","#64473c","#765344","#3f342f","#a47952"],
  cobble:["#98998d","#acb1a3","#888f88","#b5ac98","#777e76"],
  grass:["#537358","#627f60","#82946b","#496952","#91a179"],
  sand:["#d3ba91","#ecd2a2","#bca985","#ded0ac","#a9a58d"],
  planks:["#78563e","#8e6b48","#ad885b","#594536","#bc9869"],
  thatch:["#806c46","#9b8556","#b5a06a","#685e44","#c5a876"],
  cliff:["#797c72","#9b9c8b","#a9a58f","#616b65","#c0b7a1"],
  canvas:["#c6a479","#e1cc97","#a56d54","#e8d5ad","#a98667"],
  brick:["#946d5c","#b2836a","#c69a73","#79675f","#d0a482"],
};
const BASE:Record<ArtKind,string>={
  plaster:"#d9c5a3",stone:"#928f80","roof-red":"#935e52","roof-blue":"#536e75",
  timber:"#725444",cobble:"#989c91",grass:"#698260",sand:"#d7c4a3",planks:"#8d6749",
  thatch:"#8b7851",cliff:"#8d9084",canvas:"#cbb088",brick:"#a7816a",
};
function paint(kind:ArtKind,seed:number,side=96){
  const c=document.createElement("canvas");c.width=c.height=side;
  const ctx=c.getContext("2d",{alpha:false});if(!ctx)throw Error("Canvas 2D context unavailable");
  ctx.imageSmoothingEnabled=false;
  const r=rng(seed),colors=palettes[kind];px(ctx,BASE[kind],0,0,side,side);
  if(kind==="roof-red"||kind==="roof-blue"||kind==="thatch"){
    const tile=kind==="thatch"?8:12;
    for(let y=-tile;y<side+tile;y+=tile){
      const shift=((Math.floor(y/tile)%2)?tile/2:0);
      for(let x=-tile+shift;x<side+tile;x+=tile){
        const color=pick(colors,r);
        px(ctx,"#3c3e39",x,y,tile-1,tile-1);
        px(ctx,color,x+1,y+1,tile-2,tile-3);
        px(ctx,pick(colors,r),x+2,y+2,tile-5,2);
        if(kind==="thatch")for(let i=0;i<3;i++)px(ctx,"#b9a16c",x+2+i*2,y+4,1,5);
      }
    }
  }else if(kind==="cobble"||kind==="stone"||kind==="brick"){
    const w=kind==="brick"?20:19, h=kind==="brick"?10:15;
    for(let y=-h;y<side+h;y+=h){
      const shift=((Math.floor(y/h)%2)?w/2:0);
      for(let x=-w+shift;x<side+w;x+=w){
        const a=pick(colors,r);
        px(ctx,"#606c66",x,y,w-1,h-1);
        px(ctx,a,x+1,y+1,w-3,h-3);
        px(ctx,"#d0c2a4",x+2,y+2,w-7,1);
        if(r()<.5)px(ctx,pick(colors,r),x+4+r()*7,y+5,2+r()*4,1+r()*2);
      }
    }
  }else if(kind==="timber"||kind==="planks"){
    for(let x=0;x<side;x+=14){
      px(ctx,"#392f2d",x,0,2,side);
      px(ctx,pick(colors,r),x+2,0,11,side);
      for(let y=4;y<side;y+=8)px(ctx,pick(colors,r),x+4+r()*5,y,1+r()*3,1);
      if(r()<.7)px(ctx,"#d6b181",x+4,12,1,2);
    }
  }else if(kind==="canvas"){
    for(let x=0;x<side;x+=16)px(ctx,Math.floor(x/16)%2===0?"#c1a274":"#ebd4ab",x,0,16,side);
    for(let y=0;y<side;y+=6)px(ctx,"#f3daa8",0,y,side,1);
  }else{
    const count=kind==="grass"?1800:kind==="sand"?1150:kind==="cliff"?650:520;
    for(let i=0;i<count;i++){
      const x=r()*side,y=r()*side;let w=1+r()*3,h=1+r()*2;
      if(kind==="grass"&&r()<.35){w=1;h=4+r()*3;}
      if(kind==="cliff"&&r()<.3){w=8+r()*12;h=2;}
      px(ctx,pick(colors,r),x,y,w,h);
    }
    if(kind==="plaster"){
      for(let i=0;i<25;i++){
        const x=r()*side,y=r()*side;
        px(ctx,"#b89b7c",x,y,1+r()*5,1);
      }
    }
  }
  return c;
}
export function createArtLibrary(scope:{track:<T extends{dispose:()=>void}>(item:T)=>T}){
  const cache=new Map<string,THREE.CanvasTexture>();
  function texture(kind:ArtKind,seed=1,repeatX=1,repeatY=1):THREE.CanvasTexture{
    const key=kind+":"+seed+":"+repeatX+":"+repeatY;
    const cached=cache.get(key);if(cached)return cached;
    const result=new THREE.CanvasTexture(paint(kind,seed));
    result.colorSpace=THREE.SRGBColorSpace;
    result.magFilter=THREE.NearestFilter;
    result.minFilter=THREE.NearestMipmapLinearFilter;
    result.generateMipmaps=true;
    result.wrapS=THREE.RepeatWrapping;result.wrapT=THREE.RepeatWrapping;
    result.repeat.set(repeatX,repeatY);
    result.anisotropy=4;
    result.needsUpdate=true;
    scope.track(result);cache.set(key,result);
    return result;
  }
  function material(kind:ArtKind,seed=1,rx=1,ry=1):THREE.MeshStandardMaterial{
    const result=new THREE.MeshStandardMaterial({
      map:texture(kind,seed,rx,ry),roughness:.94,metalness:0,side:THREE.FrontSide,
    });
    scope.track(result);return result;
  }
  return {texture,material};
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
