import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as THREE from "three";
import { batchVisibility, buildPlantLibrary, buildPlantMeshesBatched } from "../src/plants.js";
import { FOLIAGE_WIND_BOUNDS } from "../src/vegetation.js";

const TREE_SPECIES = ["oak", "linden", "birch", "poplar", "willow", "apple", "beech", "alder", "spruce", "pine"];
const library = buildPlantLibrary(0.55);
const vertices = tree => tree.fol.attributes.position.count + (tree.trunk?.attributes.position.count || 0);
const vegetationSource = readFileSync(new URL("../src/vegetation.js", import.meta.url), "utf8");
const weatherSource = readFileSync(new URL("../src/weather.js", import.meta.url), "utf8");

test("foliage wind bound covers the current weather and shader displacement", () => {
  assert.match(vegetationSource, /w1_ = [^;]*\* 0\.06, w2_ = [^;]*\* 0\.03;/);
  assert.match(vegetationSource, /transformed\.x \+= \(w1_ \+ w2_\)/);
  assert.match(vegetationSource, /transformed\.z \+= \(w1_ \* 0\.7 - w2_\)/);
  const winds = [...weatherSource.matchAll(/\bwind:\s*([0-9.]+)/g)].map(([, value]) => Number(value));
  assert.ok(winds.length > 0, "weather wind range is present");
  const scale = 0.35 + 1.8 * Math.max(...winds);
  const maxDisplacement = Math.hypot((0.06 + 0.03) * scale, (0.06 * 0.7 + 0.03) * scale);
  assert.ok(FOLIAGE_WIND_BOUNDS >= maxDisplacement, `${FOLIAGE_WIND_BOUNDS} m covers ${maxDisplacement} m of shader sway`);
});

function checkGeometry(geo, label) {
  const positions = geo.attributes.position.array, normals = geo.attributes.normal?.array;
  assert.ok(positions.length > 0, `${label} has vertices`);
  assert.ok([...positions].every(Number.isFinite), `${label} positions are finite`);
  if (normals) {
    assert.ok([...normals].every(Number.isFinite), `${label} normals are finite`);
    for (let i = 0; i < normals.length; i += 3) assert.ok(normals[i] ** 2 + normals[i + 1] ** 2 + normals[i + 2] ** 2 > 1e-12, `${label} normal ${i / 3} is nonzero`);
  }
  const indices = geo.index?.array ?? Array.from({ length: positions.length / 3 }, (_, i) => i);
  assert.ok(indices.every(i => Number.isInteger(i) && i >= 0 && i < positions.length / 3), `${label} indices are in range`);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    assert.ok(nx * nx + ny * ny + nz * nz > 1e-16, `${label} triangle ${i / 3} is not degenerate`);
  }
}

test("town tree far variants are lower-detail and generated geometry stays valid", () => {
  for (const q of [0.4, 0.55, 1]) {
    const lib = q === 0.55 ? library : buildPlantLibrary(q);
    for (const species of TREE_SPECIES) {
      assert.ok(lib.far[species]?.length, `${species} has a far LOD`);
      assert.equal(lib.far[species].length, lib.near[species].length, `${species} keeps matching variant ids`);
      for (let variant = 0; variant < lib.near[species].length; variant++) {
        assert.ok(vertices(lib.far[species][variant]) < vertices(lib.near[species][variant]), `${species} variant ${variant} far geometry is smaller at quality ${q}`);
      }
    }
  }

  let checked = 0, batchBoundsChecked = false;
  for (const set of [library.near, library.far]) for (const variants of Object.values(set)) for (const tree of variants) {
    for (const geo of [tree.trunk, tree.fol]) if (geo) {
      checkGeometry(geo, `${geo === tree.fol ? "foliage" : "trunk"} ${checked}`);
      if (geo === tree.fol) {
        assert.ok(geo.boundingBox && geo.boundingSphere, "foliage has both BatchedMesh bounds");
        const p = geo.attributes.position.array, box = geo.boundingBox, sphere = geo.boundingSphere;
        if (!batchBoundsChecked) {
          const raw = new THREE.BufferGeometry(); raw.setAttribute("position", geo.attributes.position); raw.computeBoundingSphere();
          const batch = new THREE.BatchedMesh(1, geo.attributes.position.count, geo.index.count, new THREE.MeshBasicMaterial());
          const gid = batch.addGeometry(geo), cullSphere = batch.getBoundingSphereAt(gid, new THREE.Sphere());
          assert.ok(cullSphere.radius + 1e-5 >= raw.boundingSphere.radius + FOLIAGE_WIND_BOUNDS, "BatchedMesh retains the wind-safe bound");
          batchBoundsChecked = true;
        }
        for (let i = 0; i < p.length; i += 3) {
          assert.ok(p[i] - FOLIAGE_WIND_BOUNDS >= box.min.x - 1e-5 && p[i] + FOLIAGE_WIND_BOUNDS <= box.max.x + 1e-5, "wind margin covers foliage X");
          assert.ok(p[i + 2] - FOLIAGE_WIND_BOUNDS >= box.min.z - 1e-5 && p[i + 2] + FOLIAGE_WIND_BOUNDS <= box.max.z + 1e-5, "wind margin covers foliage Z");
          const d = Math.hypot(p[i] - sphere.center.x, p[i + 1] - sphere.center.y, p[i + 2] - sphere.center.z);
          assert.ok(d + FOLIAGE_WIND_BOUNDS <= sphere.radius + 1e-5, "wind margin covers the foliage sphere");
        }
      }
      checked++;
    }
  }
  assert.ok(checked > 0);
});

test("distance LOD uses hysteresis, never hides both levels, and survives teleports", () => {
  const tree = {}, soloTree = {}, visible = { near: true, far: true }, writes = [];
  let soloVisible = false;
  const bm = level => ({ setVisibleAt(_id, value) { visible[level] = value; writes.push([level, value]); } });
  const entries = [
    { tree, x: 0, z: 0, lod: "near", bm: bm("near"), id: 0 },
    { tree, x: 0, z: 0, lod: "far", bm: bm("far"), id: 1 },
    { tree: soloTree, x: 1000, z: 0, lod: "near", bm: { setVisibleAt(_id, value) { soloVisible = value; } }, id: 2 },
  ];
  const vis = batchVisibility(entries, { near: 100, hysteresis: 10 });
  const check = expected => {
    assert.equal(visible.near, expected === "near");
    assert.equal(visible.far, expected === "far");
    assert.equal(Number(visible.near) + Number(visible.far), 1);
  };
  vis.update(0, 0); check("near"); assert.equal(soloVisible, true);
  vis.update(0, 105); check("near");
  vis.update(0, 111); check("far");
  vis.update(0, 105); check("far");
  vis.update(0, 89); check("near");
  vis.update(1000, 0); check("far");
  vis.update(0, 0); check("near");
  assert.ok(writes.length > 0);
});

test("batched town trees are wired to both LOD levels", () => {
  const scene = new THREE.Scene();
  const trees = TREE_SPECIES.map(sp => ({ x: 0, y: 0, z: 0, s: 1, r: 0, v: 0, sp }));
  const tex = { leaf: new THREE.Texture(), needle: new THREE.Texture(), blossom: new THREE.Texture() };
  const built = buildPlantMeshesBatched(scene, { trees, forest: [], shrubs: [], beds: [] }, library, tex, new THREE.MeshStandardMaterial(), null);
  for (const tree of trees) {
    const levels = new Set(built.entries.filter(entry => entry.tree === tree).map(entry => entry.lod));
    assert.ok(levels.has("near") && levels.has("far"), `${tree.sp} includes both visibility levels`);
  }
  built.vis.update(0, 0);
  assert.ok(built.entries.filter(entry => entry.lod === "near").every(entry => entry.bm.getVisibleAt(entry.id)));
  assert.ok(built.entries.filter(entry => entry.lod === "far").every(entry => !entry.bm.getVisibleAt(entry.id)));
  built.vis.update(0, 200);
  assert.ok(built.entries.filter(entry => entry.lod === "near").every(entry => !entry.bm.getVisibleAt(entry.id)));
  assert.ok(built.entries.filter(entry => entry.lod === "far").every(entry => entry.bm.getVisibleAt(entry.id)));
});
