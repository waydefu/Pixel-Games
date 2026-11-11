import test from "node:test";
import assert from "node:assert/strict";
import { paintNaturalLeafSheet, NATURAL_FOLIAGE_SIZE } from "../src/game/natural-foliage-atlas.js";

test("natural leaf atlas is deterministic, differs by seed, and keeps its source RGBA bounds", () => {
  assert.equal(NATURAL_FOLIAGE_SIZE, 256);
  for (const species of ["oak", "birch", "pine"]) {
    const a = paintNaturalLeafSheet(species, 5);
    const b = paintNaturalLeafSheet(species, 5);
    assert.equal(a.color.length, 256 * 256 * 4);
    assert.deepEqual(a.color, b.color);
    assert.notDeepEqual(a.color, paintNaturalLeafSheet(species, 6).color);
    let solid = 0, edge = 0, transparent = 0;
    const rgb = new Set();
    for (let i = 0; i < a.color.length; i += 4) {
      const alpha = a.color[i + 3];
      if (alpha >= 200) solid++;
      if (alpha > 0 && alpha < 255) edge++;
      if (alpha === 0) transparent++;
      if (alpha >= 200) rgb.add(a.color[i] + "," + a.color[i + 1] + "," + a.color[i + 2]);
    }
    assert.ok(solid > 3000 && solid < 55000, species + " silhouette coverage: " + solid);
    assert.ok(transparent > 5000, species + " transparency");
    assert.ok(edge > 150, species + " antialiased edges");
    assert.ok(rgb.size > 30, species + " natural leaf shading");
    // Four atlas cells must remain independent cutout sprites, not a shared solid tile.
    for (let cell = 0; cell < 4; cell++) {
      const ox = (cell & 1) * 128, oy = (cell >> 1) * 128;
      const at = (x, y) => a.color[((oy + y) * 256 + ox + x) * 4 + 3];
      for (let n = 0; n < 128; n++) {
        assert.equal(at(n, 0), 0);
        assert.equal(at(0, n), 0);
        assert.equal(at(n, 127), 0);
        assert.equal(at(127, n), 0);
      }
    }
  }
});
