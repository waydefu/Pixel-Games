import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { markGlass } from "../src/game/kit-glass.js";

const read = p => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const MODELS = "assets/models/polyfork/";

async function glowShare(name) {
  const buf = fs.readFileSync(new URL("../" + MODELS + name + ".glb", import.meta.url));
  const gltf = await new Promise((res, rej) => new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "", res, rej));
  gltf.scene.updateMatrixWorld(true);
  let lit = 0, total = 0;
  gltf.scene.traverse(node => {
    if (!node.isMesh || !node.geometry.getAttribute("color")) return;
    const g = node.geometry.clone();
    g.applyMatrix4(node.matrixWorld);
    g.setAttribute("glow", new THREE.BufferAttribute(new Float32Array(g.getAttribute("position").count), 1));
    markGlass(g);
    const glow = g.getAttribute("glow");
    for (let i = 0; i < glow.count; i++) { total++; lit += glow.getX(i); }
  });
  return { lit, total };
}

test("only window panes are marked to glow, never walls, doors or beams", async () => {
  for (const name of ["village-tavern", "two-story-house", "thatched-cottage", "stone-chapel"]) {
    const { lit, total } = await glowShare(name);
    assert.ok(lit > 0, name + " has windows that light up");
    assert.ok(lit / total < .04, name + " lights only a few percent of its vertices, got " + (lit / total).toFixed(3));
  }
});

test("models without windows (boats, barrels) are not in the glazed list", () => {
  const kit = read("src/game/village-kit.ts");
  const list = kit.match(/const GLAZED=new Set\(\[([^\]]*)\]\)/)[1];
  for (const name of ["rowboat", "ship-s-longboat", "barrel", "wooden-crate", "market-stall", "blacksmith-forge"])
    assert.ok(!list.includes(name), name + " must not glow");
  assert.match(kit, /step\(\.5,vKitGlow\)/, "the shader glows only flagged vertices");
  assert.doesNotMatch(kit, /darkest=max\(vColor/, "no more near-black colour guessing");
});

test("night light pool has a fixed size and fades slots instead of popping", () => {
  const src = read("src/game/night-lights.ts");
  assert.match(src, /POOL_SIZE=6/);
  assert.match(src, /castShadow=false/);
  assert.match(src, /slot\.level=Math\.max\(0,slot\.level-dt/, "leaving spots fade out");
  assert.match(src, /slot\.level=Math\.min\(1,slot\.level\+dt/, "arriving spots fade in");
  assert.doesNotMatch(src, /\.visible\s*=/, "toggling visibility would recompile every material");
});

test("fixtures are medieval iron lanterns and torches that register real light spots", () => {
  const src = read("src/game/torches.ts");
  for (const fn of ["hangingLantern", "lanternPost", "torchPost"]) assert.match(src, new RegExp("function " + fn));
  assert.equal((src.match(/lights\.add\(/g) || []).length, 3, "each fixture lights its surroundings");
  const world = read("src/game/world.ts");
  assert.match(world, /lights\.update\(player,liveSky\.lampGlow,time\)/);
  assert.match(world, /BEACON_SITE\.x/, "the beacon is a light source too");
  const village = read("src/game/architecture.ts");
  assert.match(village, /hangingLantern\(h\.x/, "every kit house gets a door lantern");
  assert.doesNotMatch(village, /new THREE\.PointLight/, "no per-house point lights");
});

test("kit buildings use one world scale instead of fitting each model to a footprint", () => {
  const src = read("src/game/architecture.ts");
  assert.match(src, /const HOUSE_SCALE=1;/);
  assert.doesNotMatch(src, /fit:\{w:h\.w,d:h\.d\}/);
});
