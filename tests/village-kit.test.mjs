import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const manifest = JSON.parse(readFileSync("assets/manifest.json", "utf8"));
const read = path => readFileSync(path, "utf8");

test("every kit model is a registered CC BY 4.0 Polyfork mesh with a credit", () => {
  const credits = read("docs/ASSET-CREDITS.md");
  assert.ok(manifest.assets.length >= 10);
  for (const asset of manifest.assets) {
    assert.equal(asset.author, "Polyfork");
    assert.equal(asset.license, "CC-BY-4.0");
    assert.match(asset.source, /^https:\/\/polyfork\.dev\/asset\//);
    assert.ok(existsSync(asset.path), asset.path + " exists");
    const bytes = readFileSync(asset.path);
    assert.equal(bytes.subarray(0, 4).toString(), "glTF", "binary glTF header");
    assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256);
    assert.ok(credits.includes(asset.source), "credited: " + asset.source);
  }
  assert.ok(!manifest.assets.some(a => /\.mjs$/.test(a.path)), "Polyfork ES modules are not stored (Polyfork licence only)");
});

test("houses and props only ask for models that ship in the repository", () => {
  const names = new Set(manifest.assets.map(a => a.id.replace(/^polyfork-/, "")));
  const arch = read("src/game/architecture.ts");
  const used = [...arch.matchAll(/"(village-tavern|two-story-house|thatched-cottage|fisherman-shack|blacksmith-forge|stone-chapel|timber-barn|stilted-granary|village-well|market-stall|barrel|wooden-crate)"/g)].map(m => m[1]);
  assert.ok(used.length > 8);
  for (const name of used) assert.ok(names.has(name), name + " is registered");
});

test("the procedural village stays as the fallback when the kit cannot load", () => {
  const arch = read("src/game/architecture.ts");
  assert.match(arch, /else buildHouse\(h\)/);
  const main = read("src/game/main.ts");
  assert.match(main, /loadVillageKit\(\)\.catch\(/);
});
