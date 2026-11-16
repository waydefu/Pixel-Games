// Terrain meshes: static chunked heightfield sampled from the world height function. Fine steps over the town, coarser outside, skirts hide LOD seams.
// Also builds the mask texture (road / plaza / yard) that the terrain shader samples.
import * as THREE from "three";
import { GRID } from "./world.js";
import { clamp, smoothstep } from "./util.js";

export const MASK = { x0: -320, z0: -320, size: 512 };   // metres covered by the mask texture (0.5 m / texel)

export function buildMaskTexture(W) {
  const n = GRID.n, res = Math.round(MASK.size / GRID.cell), data = new Uint8Array(res * res * 4);
  const i0 = Math.round((MASK.x0 - GRID.x0) / GRID.cell), j0 = Math.round((MASK.z0 - GRID.z0) / GRID.cell);
  const G = W.grid;
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
    const k = (j0 + j) * n + (i0 + i), o = (j * res + i) * 4;
    data[o] = G.maskRoad[k]; data[o + 1] = G.maskPlaza[k]; data[o + 2] = G.maskYard[k];
    const d = G.roadD[k]; data[o + 3] = d >= 20 ? 255 : Math.round(clamp((d + 4) / 24, 0, 1) * 255);   // distance to road edge, -4..20 m
  }
  const t = new THREE.DataTexture(data, res, res, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}

export function buildTerrain(W, material, opts = {}) {
  const group = new THREE.Group(); group.name = "terrain";
  const CH = 128, x0 = -512, z0 = -512, nc = 8;
  const stats = { verts: 0, tris: 0, chunks: 0 };
  for (let cj = 0; cj < nc; cj++) for (let ci = 0; ci < nc; ci++) {
    const cx = x0 + (ci + .5) * CH, cz = z0 + (cj + .5) * CH;
    const inTown = cx > -380 && cx < 260 && cz > -340 && cz < 250;
    const dTown = Math.hypot(Math.max(0, Math.abs(cx + 50) - 240), Math.max(0, Math.abs(cz + 30) - 220));
    const step = inTown ? 1 : dTown < 160 ? 2 : dTown < 380 ? 4 : 8;
    const m = CH / step + 1;
    // skip chunks that are far out at sea and deep (only flat sea floor there)
    const pos = new Float32Array((m * m + 4 * m) * 3), nor = new Float32Array((m * m + 4 * m) * 3);
    const idx = [];
    let allDeep = true;
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
      const x = x0 + ci * CH + i * step, z = z0 + cj * CH + j * step;
      const h = W.H(x, z); if (h > -2) allDeep = false;
      const e = Math.max(0.5, step * 0.6), hx = W.H(x + e, z) - W.H(x - e, z), hz = W.H(x, z + e) - W.H(x, z - e);
      const l = Math.hypot(hx, 2 * e, hz), o = (j * m + i) * 3;
      pos[o] = x; pos[o + 1] = h; pos[o + 2] = z; nor[o] = -hx / l; nor[o + 1] = 2 * e / l; nor[o + 2] = -hz / l;
    }
    if (allDeep && dTown > 100) continue;
    for (let j = 0; j < m - 1; j++) for (let i = 0; i < m - 1; i++) {
      const a = j * m + i, b = a + 1, c = a + m, d = c + 1;
      // alternate the diagonal to avoid directional artefacts
      if (((i + j) & 1) === 0) idx.push(a, c, b, b, c, d); else idx.push(a, c, d, a, d, b);
    }
    // skirts along the four borders
    let v = m * m;
    const skirt = (ids) => {
      const base = v;
      for (const s of ids) { const o = s * 3, p = v * 3; pos[p] = pos[o]; pos[p + 1] = pos[o + 1] - 6; pos[p + 2] = pos[o + 2]; nor[p] = nor[o]; nor[p + 1] = nor[o + 1]; nor[p + 2] = nor[o + 2]; v++; }
      for (let q = 0; q < ids.length - 1; q++) idx.push(ids[q], base + q, ids[q + 1], ids[q + 1], base + q, base + q + 1);
    };
    const row = j => Array.from({ length: m }, (_, i) => j * m + i), col = i => Array.from({ length: m }, (_, j) => j * m + i);
    skirt(row(0)); skirt(row(m - 1).reverse()); skirt(col(0).reverse()); skirt(col(m - 1));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos.subarray(0, v * 3), 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nor.subarray(0, v * 3), 3));
    g.setIndex(new THREE.BufferAttribute(v > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, 20, cz), CH * 0.75 + 60);
    const mesh = new THREE.Mesh(g, material); mesh.receiveShadow = true; mesh.castShadow = false; mesh.matrixAutoUpdate = false;
    mesh.userData.step = step; group.add(mesh);
    stats.verts += v; stats.tris += idx.length / 3; stats.chunks++;
  }
  group.userData.stats = stats;
  return group;
}
