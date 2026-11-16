// Grass / shrub exclusion map (round 5): a 256x256 R8 texture over [-520, 520]^2 that marks ground which must stay bare or paved:
// building footprints, landmark colliders (churches, castle block, well house, harbour works), the wall band (3.5 m either side of the wall line),
// the market square and the castle courtyard. The grass vertex shader reads it and drops blades inside.
import * as THREE from "three";
import { wallGeo } from "./geo.js";

export const EXCL_RECT = { x0: -520, z0: -520, size: 1040 }, EXCL_RES = 256;

function obbInside(b, x, z, pad) { const dx = x - b.x, dz = z - b.z, lx = dx * b.ax + dz * b.az, lz = -dx * b.az + dz * b.ax; return Math.abs(lx) < b.hw + pad && Math.abs(lz) < b.hd + pad; }

export function buildExclusion(W, TOWN, castle = null) {
  const N = EXCL_RES, cell = EXCL_RECT.size / N, data = new Uint8Array(N * N * 4), WG = wallGeo(W);
  const boxes = [...W.buildings, ...(TOWN && TOWN.lm && TOWN.lm.colliders ? TOWN.lm.colliders : [])].filter(b => b && b.hw != null);
  // coarse bucket of boxes by 16 m cell to keep the loop cheap
  const buckets = new Map(), bk = (x, z) => Math.floor(x / 16) + "," + Math.floor(z / 16);
  for (const b of boxes) { const r = Math.hypot(b.hw, b.hd) + 2; for (let x = b.x - r; x <= b.x + r + 16; x += 16) for (let z = b.z - r; z <= b.z + r + 16; z += 16) { const k = bk(x, z); (buckets.get(k) || buckets.set(k, []).get(k)).push(b); } }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = EXCL_RECT.x0 + (i + 0.5) * cell, z = EXCL_RECT.z0 + (j + 0.5) * cell;
    let ex = 0;
    const list = buckets.get(bk(x, z));
    if (list) for (const b of list) if (obbInside(b, x, z, 0.8)) { ex = 1; break; }
    if (!ex && Math.abs(WG.sd(x, z)) < 3.5) ex = 1;                       // wall band
    if (!ex && W.inSquare && W.inSquare(x, z, 0)) ex = 1;                // market square
    if (!ex && castle && Math.hypot(x - castle.x, z - castle.z) < castle.r * 0.6) ex = 1;   // castle courtyard
    const k = (j * N + i) * 4; data[k] = data[k + 1] = data[k + 2] = ex ? 255 : 0; data[k + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true;
  return tex;
}
