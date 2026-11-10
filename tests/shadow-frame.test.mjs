import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderWithSingleShadowUpdate } from "../src/rendering/shadow-frame.js";

/** Simulates the relevant WebGLShadowMap.render guards from Three.js r187. */
function sceneRender(shadowMap, label, shadowLights, refreshed) {
  if (!shadowMap.enabled || (!shadowMap.autoUpdate && !shadowMap.needsUpdate) || !shadowLights) return;
  refreshed.push(label);
  shadowMap.needsUpdate = false;
}

test("reflection and main scene share one fresh sun-shadow update per frame", () => {
  const shadowMap = { enabled: true, autoUpdate: true, needsUpdate: false };
  const refreshed = [];
  const renderer = { shadowMap };
  const drawFrame = withMirror => renderWithSingleShadowUpdate(renderer, () => {
    sceneRender(shadowMap, "cloud-shadow fullscreen", false, refreshed);
    if (withMirror) sceneRender(shadowMap, "water reflection", true, refreshed);
    sceneRender(shadowMap, "main scene", true, refreshed);
  });
  drawFrame(true);
  assert.deepEqual(refreshed, ["water reflection"]);
  assert.equal(shadowMap.autoUpdate, true);
  drawFrame(false);
  assert.deepEqual(refreshed, ["water reflection", "main scene"]);
  drawFrame(true);
  assert.deepEqual(refreshed, ["water reflection", "main scene", "water reflection"]);
});

test("manual and disabled shadow modes stay unchanged", () => {
  for (const mode of [{ enabled: false, autoUpdate: true, needsUpdate: false }, { enabled: true, autoUpdate: false, needsUpdate: false }]) {
    const shadowMap = { ...mode };
    assert.equal(renderWithSingleShadowUpdate({ shadowMap }, () => "drawn"), "drawn");
    assert.deepEqual(shadowMap, mode);
  }
  assert.equal(renderWithSingleShadowUpdate({}, () => 12), 12);
});

test("failed prepasses restore autoUpdate and allow subsequent frames", () => {
  const shadowMap = { enabled: true, autoUpdate: true, needsUpdate: false };
  assert.throws(() => renderWithSingleShadowUpdate({ shadowMap }, () => { throw Error("mirror unavailable"); }), /mirror unavailable/);
  assert.equal(shadowMap.autoUpdate, true);
  assert.equal(shadowMap.needsUpdate, true);
  assert.equal(renderWithSingleShadowUpdate({ shadowMap }, () => "recovered"), "recovered");
});

test("the pipeline covers prepasses and the main scene in one shadow-update scope", () => {
  const pipeline = readFileSync(new URL("../src/rendering/hd2d-pipeline.js", import.meta.url), "utf8");
  assert.match(pipeline, /renderWithSingleShadowUpdate\(renderer, \(\) => \{\s*if \(prePass\)/);
  assert.match(pipeline, /if \(prePass\)[\s\S]*measure\('scene'/);
});
