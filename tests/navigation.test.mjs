import test from "node:test";
import assert from "node:assert/strict";
import { canOccupy, stepOnGround, stepWalkingByElapsedTime, MAX_WALK_CATCHUP_SECONDS, WALK_COLLISION_STEP_SECONDS, groundHeight, PIER } from "../src/game/navigation.js";
test("spawn and main road remain walkable, water blocked except pier",()=>{
  assert.equal(canOccupy(2,2),true);
  assert.equal(canOccupy(18,0),false);
  assert.equal(canOccupy(18,8),true);
  assert.equal(canOccupy(31,8),false);
});
test("collisions slide along houses without crossing solid geometry",()=>{
  const obstacles=[{x:1,z:0,halfX:1,halfZ:1}];
  assert.equal(canOccupy(0,0,obstacles),false);
  const moved=stepOnGround({x:-1,z:-2},{x:1,z:1},obstacles);
  assert.ok(moved.z>=-2 && moved.z<=-1);
  assert.equal(canOccupy(moved.x,moved.z,obstacles),true);
});
test("the western quarter is reachable and the sea edge is not a shortcut",()=>{
  assert.equal(canOccupy(-30,12),true);
  assert.equal(canOccupy(-39.5,-20),true);
  assert.equal(canOccupy(-41,0),false);
  assert.equal(canOccupy(13.8,5.8),false);
  assert.equal(canOccupy(13.8,6.3),true);
  assert.equal(canOccupy(25,10.2),false);
  assert.equal(canOccupy(28.8,8),true);
  assert.equal(canOccupy(29,8),false);
});
test("the farm is reachable beyond the old western limit without opening the rest of the map",()=>{
  const fence=[
    {x:-49,z:-25.5,halfX:.2,halfZ:7.5},
    {x:-39,z:-33,halfX:10,halfZ:.2},
    {x:-39,z:-18,halfX:10,halfZ:.2},
  ];
  let player={x:-39,z:-25.7};
  for(let i=0;i<100;i++) player=stepOnGround(player,{x:-.1,z:0},fence);
  assert.ok(player.x < -48 && player.x > -49, `stopped at the fence: ${player.x}`);
  assert.equal(canOccupy(-45,-22,fence),true);
  assert.equal(canOccupy(-45,-29,fence),true);
  assert.equal(canOccupy(-49,-25.7,fence),false);
  assert.equal(canOccupy(-41,-17.9),false);
  assert.equal(canOccupy(-49.1,-25.7),false);
  assert.equal(canOccupy(-45,-33,fence),false);
  assert.equal(canOccupy(-45,-18,fence),false);
});
test("medieval props block player movement at their authored footprints",()=>{
  const barrel={x:4,z:8,halfX:.41,halfZ:.41};
  const stall={x:8,z:10.6,halfX:1.55,halfZ:.62};
  assert.equal(canOccupy(4,8,[barrel,stall]),false);
  assert.equal(canOccupy(8,10.6,[barrel,stall]),false);
  assert.equal(canOccupy(6,8,[barrel,stall]),true);
});
test("invalid values never become valid positions",()=>{
  assert.equal(canOccupy(Infinity,0),false);
  assert.equal(canOccupy(NaN,0),false);
});

test("shared walk-surface height matches pier plank top and player reachability",()=>{
  assert.equal(groundHeight(9,4.2),0);
  assert.equal(groundHeight(18,8),.2925);
  assert.equal(groundHeight(PIER.maxX,PIER.maxZ),.2925);
  assert.equal(groundHeight(18,10.1),0);
  assert.equal(groundHeight(13.49,8),0);
  assert.throws(()=>groundHeight(NaN,8),RangeError);
  assert.throws(()=>groundHeight(8,Infinity),RangeError);
});

test("walking uses real elapsed time at 2 FPS, not one capped 50ms frame",()=>{
  const speed=4.35;
  const step=dt=>({x:speed*dt,z:0});
  const result=stepWalkingByElapsedTime({x:0,z:0},step,[],0.5);
  assert.ok(Math.abs(result.x-speed*0.5)<1e-6, "must travel ~2.175m in half a second");
  assert.equal(result.z,0);
});
test("large frame gaps are bounded and split into collision-safe steps",()=>{
  const steps=[];
  const start={x:0,z:0};
  const next=stepWalkingByElapsedTime(start,dt=>{steps.push(dt);return{x:4.35*dt,z:0};},[],5);
  assert.ok(Math.abs(next.x-4.35*MAX_WALK_CATCHUP_SECONDS)<1e-6);
  assert.ok(steps.every(dt=>dt>0&&dt<=WALK_COLLISION_STEP_SECONDS+1e-8));
  assert.ok(steps.length>1);
  assert.deepEqual(start,{x:0,z:0});
  assert.deepEqual(stepWalkingByElapsedTime(start,()=>{throw Error("must not move");},[],0),start);
});
test("walking collision sweep cannot cross narrow obstacles at low FPS",()=>{
  const barrier=[{x:0.7,z:0,halfX:0.03,halfZ:0.7}];
  const next=stepWalkingByElapsedTime({x:0,z:0},dt=>({x:4.35*dt,z:0}),barrier,0.5);
  assert.ok(next.x<0.7-0.03, "blocked before the thin barrier");
  assert.equal(canOccupy(next.x,next.z,barrier),true);
});
