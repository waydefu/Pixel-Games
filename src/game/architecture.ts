import * as THREE from "three";
import type { StageKit } from "./kit.js";
import { partitionFacade } from "./facade-geometry.js";

function hash(n:number){const v=Math.sin(n*127.1+31.37)*43758.5453123;return v-Math.floor(v);}
type Roof="red"|"blue"|"thatch";
type House={x:number;z:number;w:number;d:number;h:number;roof:Roof;seed:number;name:string};

/** Real medieval construction grammar: rubble footing, timber framing, pitched roofs and carved fixtures. */
export function buildVillage(k:StageKit){
  const plaster=k.pattern("plaster"),stone=k.pattern("stone",2),timber=k.pattern("timber",4),
    wood=k.pattern("planks",6),brick=k.pattern("brick",11);
  const beams=k.solid("#554334"),trim=k.solid("#927758"),brass=k.solid("#bb9055"),
    darkIron=k.solid("#413f3b",.62);
  const lit=k.solid("#eed6a6",.7,"#d89e54");
  const seaGlass=k.solid("#6b938b",.6,"#293a33");
  const lamps:THREE.PointLight[]=[];
  // Windows are physically recessed: the masonry is absent in the aperture.
  // All glass, mullions and shutters stay behind the exterior wall face.
  function windowFrame(x:number,y:number,outerZ:number,front:number,shutters=true){
    const glass=k.solid("#d9c6a0",.38,"#9a7142");
    const darkReveal=k.solid("#2b2826");
    // Shadowed reveal lies between outside facade and glazing.
    k.block(.84,1.12,.06,darkReveal,x,y,outerZ-front*.49,false);
    k.block(.74,1.01,.055,glass,x,y,outerZ-front*.445,false);
    for(const dx of [-.49,.49]){
      k.block(.10,1.28,.38,stone,x+dx,y,outerZ-front*.21,false);
      k.block(.075,1.07,.12,beams,x+dx*.78,y,outerZ-front*.355,false);
    }
    k.block(1.08,.13,.40,stone,x,y-.64,outerZ-front*.205,false);
    k.block(1.07,.11,.36,stone,x,y+.63,outerZ-front*.19,false);
    k.block(.075,1.04,.09,beams,x,y,outerZ-front*.375,false);
    k.block(.78,.075,.09,beams,x,y+.035,outerZ-front*.365,false);
    if(shutters){
      const sh=k.pattern("timber",13);
      for(const dx of [-.68,.68]){
        k.block(.28,1.10,.09,sh,x+dx,y,outerZ-front*.11,false);
        k.block(.29,.085,.10,beams,x+dx,y+.23,outerZ-front*.095,false);
      }
    }
  }
  function door(x:number,y:number,outerZ:number,front:number){
    // Unlike the original pasted-on slab, this door is seated inside its void.
    k.block(1.07,2.04,.15,wood,x,y,outerZ-front*.37,false);
    for(const dx of [-.62,.62])k.block(.17,2.18,.32,beams,x+dx,y,outerZ-front*.18,false);
    k.block(1.45,.18,.35,stone,x,y+1.13,outerZ-front*.17,false);
    k.column(.072,.10,brass,x+.37,y-.08,outerZ-front*.27,8);
    k.block(1.56,.12,.54,stone,x,.07,outerZ+front*.11,false);
  }
  function makeRoof(h:House,roofY:number){
    const {x,z,w,d,roof,seed}=h;
    const rise=roof==="thatch"?2.07:1.68;
    const roofMaterial=k.pattern(roof==="thatch"?"thatch":roof==="blue"?"roof-blue":"roof-red",seed,2,2);
    const depth=d/2+.49,ww=w/2+.53;
    const left=k.quad([
      [x-ww,roofY-.12,z-depth],[x,roofY+rise,z-depth],
      [x,roofY+rise,z+depth],[x-ww,roofY-.12,z+depth]
    ],roofMaterial);
    const right=k.quad([
      [x,roofY+rise,z-depth],[x+ww,roofY-.12,z-depth],
      [x+ww,roofY-.12,z+depth],[x,roofY+rise,z+depth]
    ],roofMaterial);
    left.castShadow=right.castShadow=true;
    // Tiled course relief: deliberately inexpensive static geometry, preserving
    // the existing per-house painted pixel roof and its actual gable cut-outs.
    const courseTrim=k.solid(roof==="thatch"?"#726446":roof==="blue"?"#455b63":"#744c42");
    for(const side of [-1,1]){
      for(let row=1;row<=5;row++){
        const t=row/6;
        const px=x+side*ww*(1-t);
        const py=roofY-.12+(rise+.12)*t+.045;
        k.segment(new THREE.Vector3(px,py,z-depth),
          new THREE.Vector3(px,py,z+depth),.038,courseTrim,5);
      }
    }
    k.segment(new THREE.Vector3(x,roofY+rise+.07,z-depth),
      new THREE.Vector3(x,roofY+rise+.07,z+depth),.095,k.solid("#5d4740"),6);
    // Gable is a ShapeGeometry with a real cut-out, not a texture masking a solid wall.
    const wallGable=k.pattern("plaster",seed+4);
    for(const face of [-1,1]){
      const zz=z+face*(d/2+.021);
      const shape=new THREE.Shape();
      shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(0,rise-.17);shape.closePath();
      const opening=new THREE.Path();
      opening.moveTo(-.34,.25);opening.lineTo(-.34,1.02);
      opening.lineTo(.34,1.02);opening.lineTo(.34,.25);opening.closePath();
      shape.holes.push(opening);
      k.put(new THREE.ShapeGeometry(shape),wallGable,x,roofY,zz,false);
      const inset=zz-face*.26;
      k.block(.65,.72,.06,k.solid("#e4cca2",.4,"#b98c5a"),x,roofY+.64,inset,false);
      k.block(.065,.74,.08,beams,x,roofY+.64,inset+face*.04,false);
      for(const dx of [-.37,.37])
        k.block(.08,.83,.26,beams,x+dx,roofY+.64,zz-face*.12,false);
      k.block(.81,.09,.30,stone,x,roofY+.22,zz-face*.13,false);
      k.segment(new THREE.Vector3(x-w*.49,roofY,zz+face*.08),
        new THREE.Vector3(x,roofY+rise-.12,zz+face*.08),.085,beams,6);
      k.segment(new THREE.Vector3(x,roofY+rise-.12,zz+face*.08),
        new THREE.Vector3(x+w*.49,roofY,zz+face*.08),.085,beams,6);
    }
    // Eaves: substantial dark wood gutters, not floating thin cubes.
    for(const s of [-1,1]){
      k.segment(new THREE.Vector3(x+s*ww,roofY-.1,z-depth),
        new THREE.Vector3(x+s*ww,roofY-.1,z+depth),.13,beams,6);
    }
    return roofY+rise;
  }
  function buildHouse(h:House){
    const {x,z,w,d,h:height,roof,seed,name}=h;
    const face=z<0?1:-1;
    const wall=roof==="blue"?k.pattern("stone",seed+4):k.pattern("plaster",seed+2);
    // Stone plinth, unevenly dressed foundation and warm stucco walls.
    k.block(w+.38,.66,d+.38,stone,x,.25,z);
    // Inset core stops 0.55 m behind the street-facing wall; the facade
    // is partitioned into masonry cells with actual open window/door voids.
    k.block(w,height-.48,d-.55,wall,x,height/2+.28,z-face*.275);
    const outerZ=z+face*d/2;
    const doorX=x+(seed%2? .08:-.09);
    const holes=[
      {x:doorX-x,y:1.17,w:1.25,h:2.16},
      ...[-1,1].map(side=>({x:side*w*.33,y:height*.58,w:.99,h:1.31}))
    ];
    for(const cell of partitionFacade(w,.52,height+.04,holes)){
      k.block(cell.w,cell.h,.26,wall,x+cell.x,cell.y,outerZ-face*.13);
    }
    for(const sx of [-1,1]){
      k.block(.25,height-.19,.3,timber,x+sx*(w/2-.1),height/2,z);
      for(const zz of [-d/2+.3,d/2-.3]){
        k.block(.23,height-.05,.24,beams,x+sx*(w/2-.08),height/2,z+zz);
      }
    }
    for(const yy of [.73,height-1.16]){
      k.block(w+.29,.19,d+.31,beams,x,yy,z);
    }
    // Half-timber sits between the openings, never through glass.
    const frontZ=outerZ;
    for(const side of [-1,1]){
      k.block(.14,height*.84,.12,beams,x+side*w*.47,height*.57,frontZ-face*.075);
      k.segment(new THREE.Vector3(x+side*w*.48,height*.80,frontZ),
        new THREE.Vector3(x+side*w*.43,height*.36,frontZ),.053,beams,6);
    }
    const top=makeRoof(h,height+.04);
    door(doorX,1.17,outerZ,face);
    for(const sx of [-1,1])windowFrame(x+sx*w*.33,height*.58,outerZ,face);
    // Upper gable glazing is independently recessed in the real gable opening.
    // Stone chimney built in short courses, with a rim and narrow dark cavity.
    const cx=x+w*.28,cz=z-d*.23;
    k.block(.73,1.87,.72,brick,cx,top-.24,cz);
    k.block(.95,.18,.95,stone,cx,top+.70,cz);
    k.block(.50,.09,.49,darkIron,cx,top+.79,cz,false);
    // Under-eave wood braces.
    for(const sx of [-1,1]){
      k.segment(new THREE.Vector3(x+sx*w*.41,height-.15,frontZ+face*.14),
        new THREE.Vector3(x+sx*w*.32,height+.55,frontZ+face*.18),.084,beams,6);
    }
    // Hanging shop signage suspended from wrought iron, no modern street lamp.
    if(name==="tavern"||name==="fishmonger"){
      const signX=x+w*.36;
      const signY=height*.53;
      k.segment(new THREE.Vector3(signX,signY+.65,frontZ),
        new THREE.Vector3(signX+.95,signY+.65,frontZ+face*.43),.07,darkIron,6);
      k.segment(new THREE.Vector3(signX+.81,signY+.66,frontZ+face*.43),
        new THREE.Vector3(signX+.81,signY+.12,frontZ+face*.43),.035,darkIron,6);
      const plaque=k.block(1.17,.78,.14,wood,signX+.81,signY-.12,frontZ+face*.43);
      plaque.rotation.y=.11;
      const badge=k.solid(name==="tavern"?"#d9a86a":"#71949b");
      // Emblem belongs on the VERTICAL sign, not flat on the ground.
      const emblem=k.put(new THREE.CircleGeometry(1,24),badge,
        signX+.81,signY-.1,frontZ+face*.53,false);
      emblem.scale.set(.27,.19,1);
      emblem.rotation.y=face===1?0:Math.PI;
      // Sign sits vertical: a pixel-art emblem instead of unreadable text texture.
      k.block(.29,.22,.19,brass,signX+.81,signY-.07,frontZ+face*.59,false);
    }
    k.collider(x,z,w/2+.43,d/2+.43);
    // Wall sconces: bent iron hook + enclosed candle flame, no modern pole lights.
    if(seed%2===0){
      const lx=x-w*.23,ly=height*.65,lz=frontZ+face*.23;
      k.segment(new THREE.Vector3(lx,ly+.27,lz),
        new THREE.Vector3(lx,ly+.16,lz+face*.43),.045,darkIron,6);
      k.block(.18,.46,.18,beams,lx,ly-.06,lz+face*.47,false);
      k.block(.13,.30,.13,lit,lx,ly+.07,lz+face*.47,false);
      if(lamps.length<2){
        const lamp=new THREE.PointLight("#ffc77e",3.3,6.5,2);
        lamp.position.set(lx,ly+.14,lz+face*.49);k.scene.add(lamp);lamps.push(lamp);
      }
    }
  }
  const houses:House[]=[
    {x:-12,z:-9.5,w:6.1,d:5.4,h:4.4,roof:"red",seed:2,name:"tavern"},
    {x:-16,z:10.2,w:6,d:5.7,h:4.8,roof:"blue",seed:3,name:"residence"},
    {x:1,z:-11.8,w:6.7,d:5.9,h:4.5,roof:"thatch",seed:4,name:"residence"},
    {x:1,z:13.1,w:6.2,d:6.1,h:4.5,roof:"red",seed:5,name:"fishmonger"},
    {x:-24,z:-11,w:6.0,d:5.7,h:4.1,roof:"blue",seed:6,name:"residence"},
    {x:-26,z:12,w:6.7,d:6.1,h:4.7,roof:"thatch",seed:7,name:"residence"},
    // G3 hero block: a varied set of real structures, not image billboards.
    {x:8,z:-15,w:4.3,d:4.3,h:3.8,roof:"red",seed:8,name:"residence"},
    {x:2,z:-25,w:4.8,d:4.3,h:4.0,roof:"blue",seed:9,name:"residence"},
    {x:-8,z:26,w:5.1,d:4.4,h:4.2,roof:"thatch",seed:10,name:"residence"},
    {x:-33,z:27,w:4.6,d:4.2,h:3.7,roof:"red",seed:11,name:"residence"},
  ];
  for(const h of houses)buildHouse(h);
  // Street furniture and everyday medieval use, outside the accessible promenade.
  function barrel(x:number,z:number,s=1){
    const wood=k.pattern("timber",15);
    const cy=k.put(new THREE.CylinderGeometry(.36*s,.40*s,.91*s,10),wood,x,.46*s,z);
    cy.castShadow=true;
    for(const y of [.2*s,.7*s])
      k.column(.408*s,.07*s,darkIron,x,y,z,12);
    k.collider(x,z,.41*s,.41*s);
    const top=k.column(.36*s,.05*s,timber,x,.92*s,z,10);top.castShadow=false;
  }
  function crate(x:number,z:number,s=1){
    const w=k.pattern("planks",12);
    k.block(.94*s,.71*s,.87*s,w,x,.355*s,z);
    for(const y of [.08*s,.63*s])
      k.block(1.04*s,.07*s,.96*s,beams,x,y,z);
    k.collider(x,z,.55*s,.50*s);
  }
  [[-7,-6.1],[-18,5.4],[5,9.1],[-8,6.4]].forEach(([x,z],i)=>{
    barrel(x,z,i%2?.86:1);crate(x+1.07,z+.3,.88);
  });
  // Stone drinking well anchors the centre of the settlement.
  const wellX=-5.0,wellZ=7.15;
  const rim=k.pattern("stone",8);
  const ring=k.put(new THREE.CylinderGeometry(1.09,1.14,1.16,12,1,true),rim,wellX,.56,wellZ);
  k.column(1.08,.12,k.solid("#b6a88f"),wellX,1.14,wellZ,12);
  k.column(.88,.08,k.solid("#293b44",.48),wellX,1.19,wellZ,12);
  for(const s of [-1,1])k.block(.23,3,.23,beams,wellX+s*.92,2.0,wellZ);
  const wellRoof=k.block(2.55,.19,2.12,k.pattern("thatch",11),wellX,3.41,wellZ);
  wellRoof.rotation.z=-.07;
  k.collider(wellX,wellZ,1.18,1.18);

  // Fishmonger's rustic trestle market, canvas roof and fish crates.
  const mx=8.0,mz=11.0;
  for(const x of [mx-1.8,mx+1.8])for(const z of [mz-1,mz+1])
    k.column(.115,2.4,beams,x,1.25,z,6);
  const awning=k.block(4.3,.11,3.0,k.pattern("canvas",4,2,1),mx,2.63,mz);
  awning.rotation.z=-.04;
  k.block(3,.45,1.06,wood,mx,1.08,mz-.4);
  k.collider(mx,mz-.4,1.55,.62);
  for(const x of [mx-1,mx+.1,mx+1.1])crate(x,mz-.39,.51);
  // A few hand-crafted medieval essentials: wall baskets, mooring posts, sacks.
  k.put(new THREE.SphereGeometry(.46,8,6),k.pattern("thatch",8),-8,.27,-5.75,false);
  k.put(new THREE.SphereGeometry(.42,8,6),k.pattern("canvas",7),5,.28,9.1,false);
  return {lamps,houses};
}
