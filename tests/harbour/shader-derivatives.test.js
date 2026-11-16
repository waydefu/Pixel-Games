import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as THREE from "three";

const source = path => readFileSync(new URL(path, import.meta.url), "utf8");
const textures = source("../../src/harbour/textures.js");
const terrain = source("../../src/harbour/terrainmat.js");
const town = source("../../src/harbour/townmat.js");
const plants = source("../../src/harbour/plants.js");
const water = source("../../src/harbour/water.js");
const sampleSurf = textures.match(/Surf sampleSurf\([\s\S]*?\n\}/)?.[0];

test("water height lookups use a non-mipmapped linear DataTexture", () => {
  assert.equal(THREE.REVISION, "187");
  assert.ok(water.includes("new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.HalfFloatType)"));
  const texture = new THREE.DataTexture(new Uint16Array(1), 1, 1, THREE.RedFormat, THREE.HalfFloatType);
  assert.equal(texture.generateMipmaps, false);
  assert.ok(water.includes("t.minFilter = t.magFilter = THREE.LinearFilter"));
  assert.ok(water.includes("t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping"));
  assert.equal(water.split("texture(uHeight, uv)").length - 1, 2);
});

test("surface array reads use explicit gradients through bank and anti-tile branches", () => {
  assert.ok(sampleSurf, "sampleSurf exists");
  assert.match(sampleSurf, /vec2 dUdx, vec2 dUdy/);
  assert.doesNotMatch(sampleSurf, /\btexture\s*\(/, "implicit derivatives are unsafe inside non-uniform sampler branches");
  assert.match(sampleSurf, /textureGrad\(uTexA0/);
  assert.match(sampleSurf, /textureGrad\(uTexN1/);
  assert.equal((sampleSurf.match(/\btextureGrad\s*\(/g) ?? []).length, 8);
  assert.match(sampleSurf, /vec2 uvDx = dUdx \/ uTexScale\[ii\], uvDy = dUdy \/ uTexScale\[ii\]/);
  assert.match(sampleSurf, /rotateUV \* uvDx \* 1\.37, uv2Dy = rotateUV \* uvDy \* 1\.37/);
});

test("town material supplies gradients before layer-dependent sampler branches", () => {
  assert.match(town, /sampleSurf\(vMat, vUvm, dFdx\(vUvm\), dFdy\(vUvm\)\)/);
});

test("terrain precomputes gradients before weight-dependent sampling and forwards triplanar derivatives", () => {
  const gradients = terrain.indexOf("vec3 dpdx_ = dFdx(vWPos), dpdy_ = dFdy(vWPos);");
  const firstLayerBranch = terrain.indexOf("if (W_[i] > 0.015)");
  assert.ok(gradients >= 0 && gradients < firstLayerBranch, "screen derivatives are evaluated before non-uniform layer branches");
  assert.match(terrain, /Surf triSurf\(float id, vec2 uvH, vec2 uvHDx, vec2 uvHDy, vec3 wn, float steep, vec3 p, vec3 pDx, vec3 pDy\)/);
  assert.match(terrain, /sampleSurf\(id, uvH, uvHDx, uvHDy\)/);
  assert.match(terrain, /vec2\(pDx\.z, pDx\.y\)/);
  assert.match(terrain, /vec2\(pDx\.x, pDx\.y\)/);
  assert.match(terrain, /triSurf\(ID_\[i\], i == 2 \? ruv_ : xz_, i == 2 \? ruvDx_ : xzDx_, i == 2 \? ruvDy_ : xzDy_, wn_, slope_, vWPos, dpdx_, dpdy_\)/);
});

test("terrain mask and forest lookups do not use implicit derivatives inside varying bounds guards", () => {
  assert.ok(terrain.indexOf("vec2 muvDx_ = xzDx_ / uMaskRect.z") < terrain.indexOf("textureGrad(uMask"));
  assert.ok(terrain.indexOf("vec2 fuvDx_ = xzDx_ / uForestRect.z") < terrain.indexOf("textureGrad(uForest"));
  assert.match(terrain, /textureGrad\(uMask, muv_, muvDx_, muvDy_\)/);
  assert.match(terrain, /textureGrad\(uForest, fuv_, fuvDx_, fuvDy_\)/);
  assert.doesNotMatch(terrain, /\btexture\s*\(/);
});

test("grass vertex-stage samples select explicit mip level zero", () => {
  for (const [sampler, uv] of [["uHeight", "huv_"], ["uMask", "muv_"], ["uExcl", "euv_"], ["uForestTex", "fuv_"]]) {
    assert.ok(new RegExp(`textureLod\\(${sampler}, ${uv}, 0\\.0\\)`).test(plants), `${sampler} uses explicit LOD 0`);
    assert.ok(!new RegExp(`\\btexture\\(${sampler},`).test(plants), `${sampler} avoids implicit vertex derivatives`);
  }
});
