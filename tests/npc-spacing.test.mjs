import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createWanderer} from "../src/game/wander.js";
import {VILLAGER_START_INDICES,NPC_RADIUS,spriteFootInset,spriteCenterY,separateNpcActors} from "../src/game/npc-spacing.js";
import {paintVillagerSheet,paintAnimalSheet,VILLAGERS} from "../src/game/pixel/npc.js";

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const street=JSON.parse(read("src/game/life.ts").match(/const STREET:\[number,number\]\[\]=(\[[^;]+\]);/)[1]);

function assertClear(agents,player=null){
  for(let i=0;i<agents.length;i++){
    const a=agents[i];
    assert.ok(Number.isFinite(a.state.x)&&Number.isFinite(a.state.z),"NPC position finite");
    if(player)assert.ok(Math.hypot(a.state.x-player.x,a.state.z-player.z)>=a.radius+NPC_RADIUS.player-.002,
      "NPC "+i+" cannot occupy the player");
    for(let j=i+1;j<agents.length;j++){
      const b=agents[j];
      const d=Math.hypot(a.state.x-b.state.x,a.state.z-b.state.z);
      assert.ok(d>=a.radius+b.radius-.002,"NPC "+i+" and "+j+" overlapped by "+(a.radius+b.radius-d));
    }
  }
}

test("all five authored villagers spawn at distinct, physically separated promenade points",()=>{
  assert.equal(VILLAGER_START_INDICES.length,VILLAGERS.length);
  assert.equal(new Set(VILLAGER_START_INDICES).size,VILLAGERS.length);
  const agents=VILLAGER_START_INDICES.map(i=>({state:{x:street[i][0],z:street[i][1]},radius:NPC_RADIUS.villager}));
  assertClear(agents);
  const life=read("src/game/life.ts");
  assert.match(life,/STREET\[VILLAGER_START_INDICES\[i\]\]/);
  assert.doesNotMatch(life,/\(i\*2\+1\)%STREET\.length/);
});

test("cutout NPC sheets are pixel opaque and ground-contact calculations use the final visible pixel",()=>{
  const sheets=[...VILLAGERS.map((_,i)=>paintVillagerSheet(i)),
    ...["dog","chicken","cat"].map(paintAnimalSheet)];
  for(const sheet of sheets){
    const inset=spriteFootInset(sheet);
    assert.ok(inset>=0&&inset<=.15,"lowest opaque pixel is close to ground");
    for(const alpha of sheet.data.filter((_,i)=>i%4===3))
      assert.ok(alpha===0||alpha===255,"all NPC pixels are binary cutout alpha");
    for(const surfaceY of [-.062,0,.2925]){
      const size=2.3,center=spriteCenterY(surfaceY,size,inset);
      const actualFootY=center-size*.5+size*inset;
      assert.ok(Math.abs(actualFootY-(surfaceY+.015))<1e-9);
    }
  }
  assert.match(read("src/game/life.ts"),/transparent:false,alphaTest:\.5/);
  assert.match(read("src/game/world.ts"),/map:spriteTexture,transparent:false,alphaTest:\.5/);
  assert.throws(()=>spriteFootInset({width:32,height:32,data:new Uint8ClampedArray(4096)}),RangeError);
});

test("coincident actors separate deterministically and never push the player",()=>{
  const first=Array.from({length:10},()=>({state:{x:0,z:0},radius:.72}));
  const second=Array.from({length:10},()=>({state:{x:0,z:0},radius:.72}));
  const player={x:0,z:0};
  separateNpcActors(first,player);separateNpcActors(second,player);
  assertClear(first,player);
  assert.deepEqual(first,second);
  assert.deepEqual(player,{x:0,z:0});
});

test("ten independently wandering town actors remain separated from each other and moving player for three minutes",()=>{
  const actors=[];
  VILLAGER_START_INDICES.forEach((i,n)=>{
    const pt=street[i],w=createWanderer({x:pt[0],z:pt[1],waypoints:street,speed:.62+n*.09,pause:[2.5,7],seed:100+n*17});
    actors.push({state:w.state,radius:NPC_RADIUS.villager,w});
  });
  const dog=createWanderer({x:-6,z:3,home:{x:-6,z:3},radius:5,speed:1.15,pause:[1,4],seed:7});
  actors.push({state:dog.state,radius:NPC_RADIUS.dog,w:dog});
  for(let i=0;i<3;i++){
    const w=createWanderer({x:-9+i*1.5,z:5.5,home:{x:-9,z:6},radius:2.6,speed:.5,pause:[.5,2.5],seed:31+i});
    actors.push({state:w.state,radius:NPC_RADIUS.chicken,w});
  }
  const cat=createWanderer({x:-15,z:-4.4,home:{x:-16,z:-4.2},radius:2.2,speed:.7,pause:[3,9],seed:5});
  actors.push({state:cat.state,radius:NPC_RADIUS.cat,w:cat});
  assert.equal(actors.length,10);
  for(let tick=0;tick<3600;tick++){
    actors.forEach(a=>a.w.update(.05));
    const player={x:-7+17*Math.sin(tick*.005),z:1.2+2.8*Math.cos(tick*.003)};
    separateNpcActors(actors,player);
    assertClear(actors,player);
  }
});
