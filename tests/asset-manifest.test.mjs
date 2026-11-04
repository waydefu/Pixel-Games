import test from "node:test";
import assert from "node:assert/strict";
import { validateAssetManifest } from "../src/platform/asset-manifest.js";

const good = { id: "hero-sprite", path: "assets/sprites/hero.png", author: "Original", license: "CC0-1.0", source: "original", sha256: "a".repeat(64) };

test("empty asset manifest is intentional", () => assert.deepEqual(validateAssetManifest({ version: 1, assets: [] }), []));
test("valid metadata accepted", () => assert.deepEqual(validateAssetManifest({ version: 1, assets: [good] }), [good]));
test("paths, duplicates, digest and provenance must be safe", () => {
  for (const path of ["../hero.png", "assets/../hero.png", "https://example.com/a.png", "assets/.secret.png"]) {
    assert.throws(() => validateAssetManifest({ version: 1, assets: [{ ...good, path }] }));
  }
  assert.throws(() => validateAssetManifest({ version: 1, assets: [good, good] }), /duplicate/);
  assert.throws(() => validateAssetManifest({ version: 1, assets: [{ ...good, sha256: "bad" }] }), /sha256/);
  assert.throws(() => validateAssetManifest({ version: 1, assets: [{ ...good, source: "http://example.com" }] }), /source/);
});
