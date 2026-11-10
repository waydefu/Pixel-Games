import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const root = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, root));

test("official ambientCG Ground027+Ground059 CC0 scans are committed and integrity-registered", () => {
  const manifest = JSON.parse(read("assets/manifest.json").toString("utf8"));
  const expected = [
    ["ambientcg-beach-dry-wet-albedo", "assets/materials/ambientcg-sand-albedo.webp"],
    ["ambientcg-beach-dry-wet-normal-roughness", "assets/materials/ambientcg-sand-normal-roughness.png"],
  ];
  for (const [id, path] of expected) {
    const entry = manifest.assets.find(a => a.id === id);
    assert.equal(entry?.path, path);
    assert.equal(entry?.license, "CC0-1.0");
    assert.equal(entry?.author, "ambientCG");
    assert.match(entry?.notes ?? "", /Ground027/);
    assert.match(entry?.notes ?? "", /Ground059/);
    assert.equal(createHash("sha256").update(read(path)).digest("hex"), entry.sha256);
  }
});

test("local beach atlases are compact, have valid image headers and a 2x1 tile arrangement", () => {
  const color = read("assets/materials/ambientcg-sand-albedo.webp");
  const normal = read("assets/materials/ambientcg-sand-normal-roughness.png");
  assert.equal(color.toString("ascii", 0, 4), "RIFF");
  assert.equal(color.toString("ascii", 8, 12), "WEBP");
  assert.ok(color.byteLength < 180_000, "compact mobile albedo asset");
  assert.equal(normal.toString("hex", 0, 8), "89504e470d0a1a0a");
  assert.equal(normal.readUInt32BE(16), 1024);
  assert.equal(normal.readUInt32BE(20), 512);
  assert.ok(normal.byteLength < 2_000_000, "compact packed normal / roughness asset");
});

test("sand sampling uses local Vite-bundled atlases and keeps a procedural fallback", () => {
  const src = read("src/game/pixel/world-material.ts").toString("utf8");
  assert.match(src, /ambientcg-sand-albedo\.webp/);
  assert.match(src, /ambientcg-sand-normal-roughness\.png/);
  assert.match(src, /sandAtlasUv/);
  assert.match(src, /sandWetBlend/);
  assert.match(src, /sandAtlasReady/);
  assert.match(src, /procedural-fallback/);
  assert.match(src, /THREE\.SRGBColorSpace/);
  assert.match(src, /THREE\.NoColorSpace/);
  assert.doesNotMatch(src, /ambientcg\.com\/get\?/);
});
