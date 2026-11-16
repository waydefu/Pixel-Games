import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bakeTextures, LAYERS, SURF_GLSL, surfUniforms } from "../../src/harbour/textures.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../src/harbour");
const read = path => readFileSync(resolve(root, path.replace(/^src\//, "")), "utf8");
const textures = read("src/textures.js");
const layerBlock = textures.match(/export const LAYERS = \[([\s\S]*?)\n\];/)?.[1];
assert.ok(layerBlock, "LAYERS declaration exists");
const layers = [...layerBlock.matchAll(/\["([^"]+)",\s*([0-9.]+),\s*(\d+)\]/g)].map(([, name, scale, anti]) => ({
  name, scale: Number(scale), antiTile: Number(anti),
}));
const oldNames = ["grass", "dirt", "rock", "cobble", "gravel", "sand", "wood", "plaster", "clay", "slate", "thatch", "ashlar", "rubble", "beam", "bark", "brick", "tileRed2", "birch", "beechbark"];
const recipeNames = ["saltOak", "mossStone", "linenCanvas"];
const expectedDispatch = ["grass", "dirt", "rock", "cobble", "gravel", "sand", "wood", "plaster", "clay", "slate", "thatch", "ashlar", "rubble", "beam", "bark", "brick", "tileRed2", "birch", "beechbark", ...recipeNames];
const bodyOf = name => textures.match(new RegExp(`M ${name}\\(vec2 uv\\) \\{([\\s\\S]*?)\\n\\}`))?.[1];

test("appends recipes without changing legacy layer ids and keeps layer data valid", () => {
  assert.deepEqual(layers.slice(0, oldNames.length).map(layer => layer.name), oldNames);
  assert.deepEqual(layers.slice(oldNames.length).map(layer => layer.name), recipeNames);
  assert.equal(new Set(layers.map(layer => layer.name)).size, layers.length);
  for (const layer of layers) {
    assert.ok(Number.isFinite(layer.scale) && layer.scale > 0, `${layer.name} scale is finite and positive`);
    assert.ok(layer.antiTile === 0 || layer.antiTile === 1, `${layer.name} anti-tile flag is binary`);
  }
});

test("all layer ids, including the new recipes, have explicit GLSL dispatch", () => {
  const evalLayer = textures.match(/M evalLayer\(int id, vec2 uv\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(evalLayer, "evalLayer exists");
  const dispatch = [...evalLayer.matchAll(/if \(id == (\d+)\) return (\w+)\(uv\);/g)];
  assert.deepEqual(dispatch.map(([, id, name]) => [Number(id), name]), expectedDispatch.map((name, id) => [id, name]));
  assert.match(evalLayer, /return tileRed2\(uv\);\s*$/);
});

test("new recipes define bounded albedo, relief, roughness, and occlusion", () => {
  for (const name of recipeNames) {
    const body = bodyOf(name);
    assert.ok(body, `${name} GLSL recipe exists`);
    for (const channel of ["a", "h", "r", "ao", "b"]) {
      assert.match(body, new RegExp(`m\\.${channel}\\s*=\\s*clamp\\(`), `${name}.${channel} is bounded`);
    }
  }
  assert.match(bodyOf("saltOak"), /grain[\s\S]*?salt[\s\S]*?wet[\s\S]*?gap/);
  assert.match(bodyOf("mossStone"), /joint[\s\S]*?voro[\s\S]*?waterline[\s\S]*?moss/);
  assert.match(bodyOf("linenCanvas"), /warpThread[\s\S]*?weftThread[\s\S]*?voids/);
});

test("recipes are wired to their corresponding harbour models", () => {
  const landmarks = read("src/landmarks.js");
  const houses = read("src/houses.js");
  const boats = read("src/boats.js");
  assert.match(landmarks, /\/\/ deck planks[\s\S]*?o\(L\.saltOak/);
  assert.match(houses, /const fo = \{ mat: L\.mossStone/);
  const cloth = boats.match(/function cloth\([\s\S]*?\n\}/)?.[0];
  assert.ok(cloth, "cloth sail mesh builder exists");
  assert.match(cloth, /mat: L\.linenCanvas/);
});

function fakeRenderer({ failAt = Infinity } = {}) {
  const previous = {}, calls = [], disposed = new Set();
  let target = previous, layer = 4, mip = 2, renders = 0;
  const renderer = {
    autoClear: true,
    capabilities: { getMaxAnisotropy: () => 1 },
    getRenderTarget: () => target, getActiveCubeFace: () => layer, getActiveMipmapLevel: () => mip,
    setRenderTarget(next, nextLayer = 0, nextMip = 0) {
      target = next; layer = nextLayer; mip = nextMip;
      if (next?.addEventListener && !disposed.has(next)) { disposed.add(next); next.addEventListener("dispose", () => calls.push({ disposed: next })); }
    },
    render(scene) {
      calls.push({ target, layer, mipmapsAutoUpdate: target?.texture?.mipmapsAutoUpdate, autoClear: this.autoClear, visible: scene.children[0]?.visible });
      if (++renders === failAt) throw new Error("fake render failure");
    },
  };
  return { renderer, calls, getState: () => ({ target, layer, mip }), previous };
}

test("resolution banks keep all 22 IDs and defer each array mip chain", () => {
  const fake = fakeRenderer(), { renderer, calls } = fake;
  const baked = bakeTextures(renderer, 8);
  const layerPasses = calls.filter(call => call.mipmapsAutoUpdate === false);
  const mipPasses = calls.filter(call => call.mipmapsAutoUpdate === true);
  const expectedBank = LAYERS.map(() => 0);
  expectedBank.splice(19, 3, 1, 1, 1);

  assert.equal(layerPasses.length, LAYERS.length * 2);
  assert.equal(mipPasses.length, 4);
  assert.ok(layerPasses.every(call => call.autoClear === true));
  assert.ok(mipPasses.every(call => call.autoClear === false && call.visible === false));
  assert.deepEqual(mipPasses.map(call => call.target), baked.rts);
  assert.deepEqual(baked.layerBank, expectedBank);
  assert.deepEqual(baked.layerIndex, [...Array(19).keys(), 0, 1, 2]);
  assert.deepEqual(baked.banks.map(bank => [bank.size, bank.layers.length]), [[8, 19], [4, 3]]);
  assert.ok(baked.rts.every(rt => rt.texture.mipmapsAutoUpdate === true));
  assert.equal(fake.getState().target, fake.previous);
  assert.deepEqual(fake.getState(), { target: fake.previous, layer: 4, mip: 2 });
  assert.equal(renderer.autoClear, true);

  const variantA = surfUniforms(baked, 101), variantB = surfUniforms(baked, 303), sameSeed = surfUniforms(baked, 101);
  assert.equal(variantA.uTexA0.value, variantB.uTexA0.value);
  assert.deepEqual(Array.from(variantA.uTexBank.value), expectedBank);
  assert.deepEqual(variantA.uRecipePhase.value, sameSeed.uRecipePhase.value);
  assert.notDeepEqual(variantA.uRecipePhase.value, variantB.uRecipePhase.value);
  assert.match(SURF_GLSL, /if \(bank == 0\)[\s\S]*uTexA1/);
  assert.match(SURF_GLSL, /ii >= 19\) uv \+= uRecipePhase/);
  assert.equal(baked.albedo, baked.banks[0].albedo);
  assert.equal(baked.normal, baked.banks[0].normal);

  let releases = 0;
  for (const rt of baked.rts) rt.addEventListener("dispose", () => releases++);
  baked.dispose(); baked.dispose();
  assert.equal(releases, baked.rts.length);
});

test("failed bake releases every allocated target and restores renderer state", () => {
  const fake = fakeRenderer({ failAt: LAYERS.length * 2 + 1 });
  assert.throws(() => bakeTextures(fake.renderer, 8), /fake render failure/);
  assert.deepEqual(fake.getState(), { target: fake.previous, layer: 4, mip: 2 });
  assert.equal(fake.renderer.autoClear, true);
  assert.equal(fake.calls.filter(call => call.disposed).length, 4);
});

test("main releases the shared pack and its consuming materials outside BFCache", () => {
  const main = read("src/main.js");
  const townmat = read("src/townmat.js");
  assert.match(townmat, /makeTownMaterial\(tex, recipeSeed = 0\)/);
  assert.match(main, /makeTownMaterial\(TEX, 101\)/);
  assert.match(main, /makeTownMaterial\(TEX, 303\)/);
  assert.match(main, /if \(!event\.persisted\) \{ TEX\.dispose\(\); terrainMat\.dispose\(\); townMat\.dispose\(\); boatMat\.dispose\(\); glassMat\.dispose\(\); \}/);
});
