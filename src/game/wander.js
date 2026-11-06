// Villager and animal behaviour: walk to a waypoint, pause, pick the next. Pure (no Three.js) and deterministic.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A wanderer picks waypoints from `waypoints` (or random points within `radius` of `home` when none are given),
 * walks to each at `speed`, then idles for `pause` seconds [min, max].
 */
/** @param {{x:number,z:number,speed?:number,waypoints?:number[][]|null,home?:{x:number,z:number}|null,radius?:number,pause?:number[],seed?:number}} options */
export function createWanderer({ x, z, speed = 1, waypoints = null, home = null, radius = 3, pause = [2, 6], seed = 1 }) {
  if (![x, z, speed].every(Number.isFinite) || speed <= 0) throw new RangeError("invalid wanderer");
  const rng = mulberry32(seed);
  const state = { x, z, vx: 0, vz: 0, walking: false };
  let target = null, wait = rng() * (pause[1] - pause[0]) + pause[0] * .3;
  function pick() {
    if (waypoints && waypoints.length) { const p = waypoints[Math.floor(rng() * waypoints.length)]; return { x: p[0], z: p[1] }; }
    if (!home) throw new RangeError("a wanderer needs waypoints or a home");
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * radius;
    return { x: home.x + Math.cos(a) * r, z: home.z + Math.sin(a) * r };
  }
  function update(dt) {
    dt = Math.min(Math.max(dt, 0), .25);
    if (!target) {
      wait -= dt; state.vx = state.vz = 0; state.walking = false;
      if (wait <= 0) target = pick();
      return state;
    }
    const dx = target.x - state.x, dz = target.z - state.z, d = Math.hypot(dx, dz);
    const step = speed * dt;
    if (d <= step) {
      state.x = target.x; state.z = target.z; target = null;
      wait = pause[0] + rng() * (pause[1] - pause[0]);
      state.vx = state.vz = 0; state.walking = false;
      return state;
    }
    state.vx = dx / d * speed; state.vz = dz / d * speed; state.walking = true;
    state.x += dx / d * step; state.z += dz / d * step;
    return state;
  }
  return { state, update };
}

/** Sprite row for a heading on screen: 0 toward the camera, 1 right, 2 away, 3 left. */
export function facingRow(vx, vz, screenRight, screenUp, previous = 0) {
  if (Math.hypot(vx, vz) < 1e-4) return previous;
  const across = vx * screenRight.x + vz * screenRight.z, along = vx * screenUp.x + vz * screenUp.z;
  if (Math.abs(across) > Math.abs(along)) return across > 0 ? 1 : 3;
  return along > 0 ? 2 : 0;
}
