import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../src/game/"+path,import.meta.url),"utf8");
const beacon=read("harbour-beacon.ts");
const village=read("architecture.ts");
const world=read("world.ts");
const fjord=read("fjord.ts");

test("G3 coastal hero landmark is built into the sole playable world",()=>{
  assert.match(world,/buildHarbourBeacon\(kit\)/);
  assert.match(beacon,/coastal-beacon-stone-shaft/);
  assert.match(beacon,/coastal-beacon-lantern-base/);
  assert.match(beacon,/coastal-beacon-signal/);
  assert.match(beacon,/coastal-beacon-roof/);
  assert.match(beacon,/k\.collider\(x,z,BEACON_SITE\.radius,BEACON_SITE\.radius\)/);
  // Signal is deliberately emissive; we do not add a costly new scene light.
  assert.doesNotMatch(beacon,/new THREE\.PointLight/);
});

test("new homes do not overlap the beacon's physical footprint",()=>{
  const p=beacon.match(/BEACON_SITE\s*=\s*Object\.freeze\(\{x:([-\d.]+),z:([-\d.]+),radius:([\d.]+)/);
  assert.ok(p,"beacon must have a fixed, inspectable authored footprint");
  const [,x,z,radius]=p.map(Number);
  let homes=0;
  for(const match of village.matchAll(/\{x:([-\d.]+),z:([-\d.]+),w:([\d.]+),d:([\d.]+),h:[\d.]+,roof:/g)){
    const [hx,hz,w,d]=match.slice(1).map(Number);
    const dx=Math.max(0,Math.abs(hx-x)-w/2);
    const dz=Math.max(0,Math.abs(hz-z)-d/2);
    assert.ok(Math.hypot(dx,dz)>radius+.15,
      "beacon overlaps house at "+hx+","+hz);
    homes++;
  }
  assert.ok(homes>=10,"G3 must add at least four real authored houses");
});

test("beacon physical collider reaches the actual foundation and slots face out",()=>{
  const site=beacon.match(/BEACON_SITE\s*=\s*Object\.freeze\(\{x:[-\d.]+,z:[-\d.]+,radius:([\d.]+),height:([\d.]+)/);
  assert.ok(site);
  assert.ok(Number(site[1])>=3.5,"podium extends to a 3.5-m radius");
  assert.ok(Number(site[2])>=19.725,"visual metadata includes roof apex");
  assert.match(beacon,/pane\.rotation\.y=Math\.PI\/2-angle/);
});

test("rock strata are baked into geometry without new water or GPU fragment passes",()=>{
  assert.match(fjord,/const crack=Math\.sin/);
  assert.match(fjord,/const fissure=Math\.pow/);
  assert.match(fjord,/scratch\.lerp\(weathered/);
  assert.match(fjord,/new THREE\.MeshStandardMaterial\(/);
  assert.doesNotMatch(fjord,/new THREE\.WebGLRenderTarget/);
  assert.match(village,/Tiled course relief/);
});
