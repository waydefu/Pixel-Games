// One shared wind for the whole coast: clouds, cloud shadows, grass, trees and chimney smoke all read the same state, so
// a gust that sweeps the meadow is the one that pushes the clouds, and a still afternoon is still everywhere.
//
//   W(x, z, h, t) = W_base(h, t) + W_gust(x, z, t)
//
// W_base: a slowly wandering direction and speed (a weather that breathes between a light and a fresh breeze).
// W_gust: gust fronts, patches of stronger wind that travel downwind across the ground. Aloft (large h) the wind is
// stronger and a little rotated, so clouds drift faster than the grass sways. Pure: no Three.js, testable in Node.
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
}
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Weather: the base wind at time t (seconds): direction angle (radians, over the x/z plane) and speed (m/s). */
export function baseWind(t, climate = 1) {
  const angle = 0.45 + 0.5 * Math.sin(t * 0.006) + 0.2 * Math.sin(t * 0.021 + 1.3);   // a sea breeze, blowing toward the land (-x ... +x) a little askew
  const speed = clamp(2.6 * climate + 1.5 * Math.sin(t * 0.011) + 0.9 * Math.sin(t * 0.037 + 1.0), 0.6, 6);
  return { angle, speed, dx: Math.cos(angle), dz: Math.sin(angle) };
}
/** Gust factor 0..1 at a ground position: patches advected downwind by the accumulated travel (metres). */
export function gustAt(x, z, travelX, travelZ) {
  return smooth(0.35, 0.8, vnoise(x * 0.045 - travelX * 1.6, z * 0.045 - travelZ * 1.6));
}

export function createWind({ climate = 1 } = {}) {
  const state = { angle: 0, speed: 3, dx: 1, dz: 0, strength: 1, driftX: 0, driftZ: 0, aloftDriftX: 0, aloftDriftZ: 0, time: 0 };
  let last = null;
  /** Advance to time t (seconds). The drift accumulates, so a change of wind never makes the clouds jump. */
  function update(t) {
    const dt = last === null ? 0 : clamp(t - last, 0, 0.25);
    last = t; state.time = t;
    const b = baseWind(t, climate);
    state.angle = b.angle; state.speed = b.speed; state.dx = b.dx; state.dz = b.dz;
    state.strength = clamp(b.speed / 3.2, 0.4, 1.8);
    // ground-level drift drives grass and trees; the sky moves faster and a little rotated
    state.driftX += b.dx * b.speed * 0.10 * dt; state.driftZ += b.dz * b.speed * 0.10 * dt;
    const ca = Math.cos(0.35), sa = Math.sin(0.35);
    const ax = b.dx * ca - b.dz * sa, az = b.dx * sa + b.dz * ca;
    state.aloftDriftX += ax * b.speed * 0.16 * dt; state.aloftDriftZ += az * b.speed * 0.16 * dt;
    return state;
  }
  /** The wind vector (m/s) at a point and height: base plus the gust passing over that spot. */
  function windAt(x, z, h = 0) {
    const g = gustAt(x, z, state.driftX, state.driftZ);
    const lift = 1 + clamp(h, 0, 120) / 60;                     // stronger aloft
    const s = state.speed * lift * (0.75 + 0.9 * g);
    return { x: state.dx * s, z: state.dz * s, speed: s, gust: g };
  }
  return { state, update, windAt };
}
