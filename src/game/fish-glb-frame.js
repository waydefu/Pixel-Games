// Pure (no Three.js, so it runs in Node): maps a fish mesh from its CC0 source file into the frame that fish-model.js and
// fishing.ts already use: tail at x = 0, nose at x = length (metres), y up, z = the fish's right, centred on y and z.
// The five World Fish files (codepawl/world-fish-glb, CC0) all keep the body length on x with the tail at −x and the back up,
// which was checked by rendering them (see docs/ASSET-CREDITS.md), so no orientation detection is needed here.

/** Game fish id → bundled model file. Only these five are replaced; crab, boot and lure stay procedural. */
export const FISH_GLB_FILES = Object.freeze({
  mackerel: "assets/models/fish/scomber_scombrus.glb",
  herring: "assets/models/fish/clupea_harengus.glb",
  cod: "assets/models/fish/gadus_morhua.glb",
  flounder: "assets/models/fish/hippoglossus_hippoglossus.glb",   // stand-in: the dataset has no flounder species
  salmon: "assets/models/fish/salmo_salar.glb",
});

/** Flatfish: the model is laid on its side so its width runs along z, like the procedural flounder (`flat: true`). */
export const FLAT_FISH = Object.freeze(new Set(["flounder"]));

/**
 * @param {ArrayLike<number>} positions xyz triples in the source mesh's own world units (after its node transforms)
 * @param {{length:number, flat?:boolean}} spec length in metres; `flat` lays the body on its side
 * @returns {Float32Array} xyz triples in the fish frame: x from 0 (tail) to `length` (nose), centred on y and z
 */
export function toFishFrame(positions, { length, flat = false }) {
  if (!(length > 0)) throw new RangeError("fish length must be positive");
  const count = Math.floor(positions.length / 3);
  if (count === 0) throw new RangeError("fish mesh has no vertices");
  // flat: rotate +90° about x, as the file's own pose needs: (x, y, z) → (x, −z, y)
  const rotated = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    rotated[i * 3] = x;
    rotated[i * 3 + 1] = flat ? -z : y;
    rotated[i * 3 + 2] = flat ? y : z;
  }
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 3; k++) {
      const v = rotated[i * 3 + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }
  const extent = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  if (!(extent[0] >= extent[1] && extent[0] >= extent[2])) throw new Error("the fish body must be longest along x");
  const scale = length / extent[0];
  const cy = (min[1] + max[1]) / 2, cz = (min[2] + max[2]) / 2;
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    out[i * 3] = (rotated[i * 3] - min[0]) * scale;
    out[i * 3 + 1] = (rotated[i * 3 + 1] - cy) * scale;
    out[i * 3 + 2] = (rotated[i * 3 + 2] - cz) * scale;
  }
  return out;
}
