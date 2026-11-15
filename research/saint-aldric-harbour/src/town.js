// Assembles all static built geometry into chunked meshes (one draw per chunk per material).
import * as THREE from "three";
import { MeshBuilder } from "./mesh.js";
import { houseGeometry } from "./houses.js";
import { buildLandmarks, buildHarbour } from "./landmarks.js";
import { buildHarbourWorks } from "./harbour.js";

export class Chunks {
  constructor(size = 64) { this.size = size; this.map = new Map(); }
  at(x, z) {
    const k = Math.floor(x / this.size) + "," + Math.floor(z / this.size);
    let c = this.map.get(k); if (!c) { c = { T: new MeshBuilder(), G: new MeshBuilder(), x: (Math.floor(x / this.size) + .5) * this.size, z: (Math.floor(z / this.size) + .5) * this.size }; this.map.set(k, c); }
    return c;
  }
  meshes(townMat, glassMat, shadow = true) {
    const out = new THREE.Group();
    for (const c of this.map.values()) {
      if (c.T.count) { const m = new THREE.Mesh(c.T.toGeometry(), townMat); m.castShadow = shadow; m.receiveShadow = true; m.matrixAutoUpdate = false; out.add(m); }
      if (c.G.count) { const m = new THREE.Mesh(c.G.toGeometry(), glassMat); m.castShadow = false; m.receiveShadow = true; m.matrixAutoUpdate = false; out.add(m); }
    }
    return out;
  }
}

export function buildTown(W, opts = {}) {
  const C = new Chunks(128), detail = opts.detail ?? 2, stats = { tris: 0 };
  for (const b of W.buildings) { const c = C.at(b.x, b.z); houseGeometry(c.T, c.G, b, detail); }
  const lm = buildLandmarks(W, C, detail), hb = buildHarbour(W, C);
  const works = buildHarbourWorks(W, C, W.quayPts);
  hb.decks = works.decks; hb.beached = works.beached; hb.works = works; lm.colliders.push(...works.colliders);
  lm.colliders.push(...hb.colliders);
  const lamps = W.buildings.filter(b => b.lamp).map(b => b.lamp).concat(works.lamps);
  for (const c of C.map.values()) stats.tris += (c.T.count + c.G.count) / 3;
  return { chunks: C, stats, lm, hb, lamps };
}
