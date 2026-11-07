// What the traveller should hear where they stand. Pure (no Web Audio), so the rules can be tested in Node.
//
// These are my own mixing rules for this coast, not a standard: the sea matters most on the beach and the pier, the village
// is sheltered from it, the western hills are where the trees and the wind in them take over, and the night belongs to
// the crickets. All outputs are 0..1 *relative* levels per layer; the engine scales them and a limiter protects the sum.
export const SHORE_X = 13.3;
export const PIER_BOX = Object.freeze({ minX: 13.5, maxX: 30.9, minZ: 5.1, maxZ: 10.9 });
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** What the ground under the feet is: planks on the pier, sand on the beach, cobbles and turf in the village. */
export function groundSurface(x, z) {
  if (x >= PIER_BOX.minX && x <= PIER_BOX.maxX && z >= PIER_BOX.minZ - 0.6 && z <= PIER_BOX.maxZ + 0.6) return "wood";
  if (x >= 9.6) return "sand";
  return "stone";
}

/**
 * @param {{x:number,z:number,aboard?:boolean,night?:number,windStrength?:number,gust?:number}} s
 *   night 0..1, windStrength ~0.4..1.8 (1 = a light breeze), gust 0..1 at the traveller
 */
export function soundscapeMix(s) {
  const night = clamp(s.night ?? 0, 0, 1), wind = clamp(s.windStrength ?? 1, 0.3, 2.6), gust = clamp(s.gust ?? 0.4, 0, 1);
  const rainIn = clamp(s.rain ?? 0, 0, 1), storm = clamp(s.storm ?? 0, 0, 1);
  const aboard = !!s.aboard;
  const onWater = aboard || s.x > PIER_BOX.maxX;
  const onPier = !aboard && s.x >= PIER_BOX.minX && s.x <= PIER_BOX.maxX && s.z >= PIER_BOX.minZ - 0.6 && s.z <= PIER_BOX.maxZ + 0.6;
  // how far the water is, in metres (zero on the pier and afloat)
  const seaDist = onWater || onPier ? 0 : Math.max(0, SHORE_X - s.x);
  const waveEnergy = clamp(0.35 + 0.5 * (wind - 0.4) + 0.25 * storm, 0.3, 1);       // more wind, bigger surf
  let surf = Math.exp(-seaDist / 11) * waveEnergy;
  if (onWater) surf *= s.x > 40 || aboard ? 0.55 : 0.8;               // out at sea there is no surf line, only a hush
  const exposure = onWater ? 1.25 : onPier ? 1.1 : smooth(-14, 12, s.x) * 0.7 + 0.35;   // the village lies in the lee of the hill
  const trees = onWater || onPier ? 0 : 0.25 + 0.75 * smooth(2, -20, s.x);          // the hills to the west carry the forest
  const sheltered = onWater || onPier ? 1 : 0.55;           // roofs and trees take the edge off rain
  const windLevel = clamp((0.2 + 0.55 * smooth(0.4, 1.8, wind)) * (exposure + 0.45 * trees) * (0.8 + 0.5 * gust) * (1 + 0.35 * storm), 0, 1);   // wind in the trees is audible even in their lee
  const foliage = trees * (0.3 + 0.7 * smooth(0.5, 1.4, wind * (0.6 + 0.8 * gust)));
  const lap = onWater ? 1 : onPier ? 0.8 : seaDist < 6 ? 0.35 * (1 - seaDist / 6) : 0;   // water on hulls, piles and the strand
  const land = onWater || onPier ? 0 : smooth(14, 8, s.x);
  const rain = rainIn * (0.55 + 0.45 * sheltered);
  const crickets = (1 - rainIn) * night * land * (0.25 + 0.75 * smooth(14, 4, s.x)) * (1 - 0.6 * smooth(1.2, 1.8, wind));
  const gullRate = (1 - rainIn) * (1 - night) * (0.35 + 0.65 * smooth(2, 14, s.x));    // calls per minute scale; none at night
  return { surf, wind: windLevel, rain, foliage: clamp(foliage + 0.3 * rainIn * trees, 0, 1), lap, crickets, gullRate, onWater, onPier, seaDist };
}

/** Footstep cadence: seconds between steps for a speed in m/s (about two steps a second when walking). */
export const stepInterval = speed => clamp(1.05 / Math.max(speed, 0.5) * 1.55, 0.2, 0.7);
