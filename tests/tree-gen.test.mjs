import test from "node:test";
import assert from "node:assert/strict";
import { generateTree, triangleCount, TREE_SPECIES } from "../src/game/pixel/tree-gen.js";
import { paintLeafSheet, LEAF_SPECIES } from "../src/game/pixel/textures.js";

const finite = a => a.every(Number.isFinite);

test("every species and detail level produces finite, well-formed geometry", () => {
  for (const species of TREE_SPECIES) for (const detail of ["high", "low"]) {
    const t = generateTree(species, 3, detail);
    for (const part of [t.trunk, t.leaves]) {
      assert.ok(part.positions.length > 0 && part.positions.length % 3 === 0);
      assert.equal(part.normals.length, part.positions.length);
      assert.equal(part.uvs.length / 2, part.positions.length / 3);
      assert.equal(part.colors.length, part.positions.length);
      assert.ok(finite(part.positions) && finite(part.normals) && finite(part.uvs));
      assert.ok(part.indices.every(i => i < part.positions.length / 3));
      assert.equal(part.indices.length % 3, 0);
    }
    for (let i = 0; i < t.leaves.normals.length; i += 3) {
      assert.ok(Math.abs(Math.hypot(t.leaves.normals[i], t.leaves.normals[i + 1], t.leaves.normals[i + 2]) - 1) < 1e-4, "unit leaf normals");
    }
  }
});

test("generation is deterministic and varies with the seed", () => {
  const a = generateTree("oak", 5), b = generateTree("oak", 5), c = generateTree("oak", 6);
  assert.deepEqual(a.trunk.positions, b.trunk.positions);
  assert.deepEqual(a.leaves.positions, b.leaves.positions);
  assert.notDeepEqual(a.leaves.positions, c.leaves.positions);
});

test("trees have believable size and the low detail level is far cheaper", () => {
  const expected = { oak: [3.2, 6.8], birch: [3.4, 6.5], pine: [4.2, 6.4] };
  for (const species of TREE_SPECIES) {
    const high = generateTree(species, 2, "high"), low = generateTree(species, 2, "low");
    const [min, max] = expected[species];
    assert.ok(high.height > min && high.height < max, `${species} height ${high.height.toFixed(2)}`);
    assert.ok(high.crownRadius > 0.8 && high.crownRadius < 3.4, `${species} crown ${high.crownRadius.toFixed(2)}`);
    const hi = triangleCount(high.trunk) + triangleCount(high.leaves), lo = triangleCount(low.trunk) + triangleCount(low.leaves);
    assert.ok(hi < 9000, `${species} high ${hi} tris`);
    assert.ok(lo < hi * 0.3, `${species} low ${lo} vs high ${hi}`);
    assert.ok(lo < 700, `${species} low ${lo} tris`);
  }
});

test("leaf sprite sheets are cutout RGBA drawn from the shared palette", () => {
  for (const species of LEAF_SPECIES) {
    const sheet = paintLeafSheet(species, 1), colors = new Set();
    let opaque = 0, transparent = 0;
    for (let i = 0; i < sheet.color.length; i += 4) {
      if (sheet.color[i + 3] === 255) { opaque++; colors.add((sheet.color[i] << 16) | (sheet.color[i + 1] << 8) | sheet.color[i + 2]); }
      else { transparent++; assert.equal(sheet.color[i + 3], 0); }
    }
    assert.ok(opaque > 600 && transparent > 600, `${species}: cutout with real transparency`);
    assert.ok(colors.size <= 9, `${species}: palette-limited (${colors.size} colours)`);
  }
});
