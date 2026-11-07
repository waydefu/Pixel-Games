// Rowing a boat: pure simulation (no Three.js), so it can be unit-tested and reused by the view.
//
// The boat is driven like a real rowboat. Holding "forward" makes the rower pull in strokes: each stroke is a
// pulse of thrust followed by a recovery, so the speed breathes instead of ramping smoothly. Water drag (linear
// plus quadratic) caps the cruising speed near 2.6 m/s. "Back" back-paddles more weakly, steering turns the bow
// (faster when moving) and costs a little speed.
import { canOccupy, PIER } from "./navigation.js";

/** The sea the hull may use: east of the seawall, inside the authored world. */
export const SEA_LIMITS = Object.freeze({ minX: 14.8, maxX: 118, maxZ: 40 });
/** The pier deck and its piles; the hull must stay clear of it. */
export const PIER_DECK = Object.freeze({ minX: 13.5, maxX: 30.9, minZ: 5.1, maxZ: 10.9 });
export const ROWING = Object.freeze({
  strokeHz: 0.8,          // strokes per second while pulling
  pull: 5.4,              // peak forward acceleration during the drive phase, m/s^2
  back: 2.4,              // peak backward acceleration
  drag: 0.35, dragSquare: 0.12,
  turnBase: 0.5, turnPerSpeed: 0.2,   // rad/s at full steering
  maxSpeed: 3.2,
});

/** A hull is approximated by three circles on its centreline (bow, middle, stern). */
export function hullCircles(x, z, heading, length, beam) {
  const r = beam / 2, reach = length / 2 - r * 0.8;
  const cx = Math.cos(heading), cz = Math.sin(heading);
  return [[x + cx * reach, z + cz * reach, r], [x, z, r], [x - cx * reach, z - cz * reach, r]];
}

/** Is a circle of the given radius in open water, clear of the pier, the shore and every blocker [x,z,r]? */
export function isClear(x, z, radius, blockers = []) {
  if (![x, z, radius].every(Number.isFinite)) return false;
  if (x - radius < SEA_LIMITS.minX || x + radius > SEA_LIMITS.maxX || Math.abs(z) + radius > SEA_LIMITS.maxZ) return false;
  const dx = Math.max(PIER_DECK.minX - x, 0, x - PIER_DECK.maxX), dz = Math.max(PIER_DECK.minZ - z, 0, z - PIER_DECK.maxZ);
  if (dx * dx + dz * dz < radius * radius) return false;
  return !blockers.some(b => Math.hypot(x - b[0], z - b[1]) < radius + b[2]);
}

export function hullClear(x, z, heading, length, beam, blockers) {
  return hullCircles(x, z, heading, length, beam).every(([cx, cz, r]) => isClear(cx, cz, r, blockers));
}

/**
 * @param {{x:number,z:number,heading?:number,length?:number,beam?:number,blockers?:number[][]}} options
 *   heading is the world direction of the bow: (cos h, sin h) on the (x, z) plane.
 */
export function createRowing({ x, z, heading = 0, length = 4.5, beam = 1.5, blockers = [] }) {
  const state = { x, z, heading, speed: 0, yawRate: 0, stroke: 0, stroking: false, bumped: 0, length, beam };
  /** Replace the list of fixed obstacles (the other boats move, so the caller refreshes it). */
  function setBlockers(list) { blockers = list; }

  /** @param {number} dt seconds  @param {{throttle:number,steer:number}} input both in -1..1 */
  function step(dt, input) {
    dt = Math.min(Math.max(dt, 0), 0.1);
    const throttle = Math.max(-1, Math.min(1, input.throttle || 0)), steer = Math.max(-1, Math.min(1, input.steer || 0));
    state.bumped = Math.max(0, state.bumped - dt);
    // ---- strokes: the rower keeps pulling while the key is held and always finishes the stroke in progress
    if (throttle !== 0) state.stroking = true;
    let thrust = 0;
    if (state.stroking) {
      state.stroke += dt * ROWING.strokeHz;
      const p = state.stroke % 1;
      const drive = p < 0.5 ? Math.sin(p * 2 * Math.PI) : 0;   // a half-sine pulse over the drive half of the stroke
      thrust = throttle >= 0 ? drive * ROWING.pull * throttle : drive * ROWING.back * throttle;
      if (state.stroke >= 1 && throttle === 0) { state.stroke = 0; state.stroking = false; thrust = 0; }
      if (state.stroke >= 1) state.stroke -= 1;
    }
    const v = state.speed;
    state.speed = Math.max(-1.4, Math.min(ROWING.maxSpeed, v + (thrust - ROWING.drag * v - ROWING.dragSquare * v * Math.abs(v)) * dt));
    // ---- steering: the bow answers faster while the boat carries way
    const targetRate = steer * (ROWING.turnBase + ROWING.turnPerSpeed * Math.abs(state.speed));
    state.yawRate += (targetRate - state.yawRate) * Math.min(1, dt * 4);
    if (Math.abs(steer) > 0.05) state.speed *= 1 - 0.1 * Math.abs(steer) * dt;
    // ---- move, never into the shore, the pier, a rock or another boat
    const nextHeading = state.heading + state.yawRate * dt;
    if (hullClear(state.x, state.z, nextHeading, length, beam, blockers)) state.heading = nextHeading;
    else state.yawRate = 0;
    const nx = state.x + Math.cos(state.heading) * state.speed * dt, nz = state.z + Math.sin(state.heading) * state.speed * dt;
    if (hullClear(nx, nz, state.heading, length, beam, blockers)) { state.x = nx; state.z = nz; }
    else if (hullClear(nx, state.z, state.heading, length, beam, blockers)) { state.x = nx; state.speed *= 0.7; state.bumped = 0.4; }
    else if (hullClear(state.x, nz, state.heading, length, beam, blockers)) { state.z = nz; state.speed *= 0.7; state.bumped = 0.4; }
    else { state.speed = -state.speed * 0.3; state.bumped = 0.4; }
    return state;
  }
  /** Put the boat somewhere else without a physics step (boarding, tests). */
  function place(nx, nz, nHeading = state.heading) { state.x = nx; state.z = nz; state.heading = nHeading; state.speed = 0; state.yawRate = 0; }
  return { state, step, place, setBlockers };
}

/** Where the rower can step off: the pier deck or the beach, whichever is near the hull. Null if nothing is in reach. */
export function findLanding(boat, colliders = []) {
  const reach = boat.length / 2 + 3.0;
  const candidates = [];
  // the pier: the nearest walkable plank (kept inside the deck so the walking rules accept it)
  const px = Math.min(Math.max(boat.x, PIER.minX + 0.5), PIER.maxX - 0.5);
  const pz = boat.z < PIER.minZ + (PIER.maxZ - PIER.minZ) / 2 ? PIER.minZ + 0.5 : PIER.maxZ - 0.5;
  candidates.push({ x: px, z: pz, kind: "pier" });
  // the beach, at the same latitude as the boat
  candidates.push({ x: 13.4, z: boat.z, kind: "shore" });
  /** @type {{x:number,z:number,kind:string,d:number}|null} */
  let best = null;
  for (const c of candidates) {
    const d = Math.hypot(c.x - boat.x, c.z - boat.z);
    if (d <= reach && canOccupy(c.x, c.z, colliders) && (!best || d < best.d)) best = { ...c, d };
  }
  return best && { x: best.x, z: best.z, kind: best.kind };
}

/** The boat a walker can board, if any: the nearest hull whose centre is within reach. */
export function boardableBoat(player, boats) {
  /** @type {{index:number,d:number}|null} */
  let best = null;
  for (let index = 0; index < boats.length; index++) {
    const b = boats[index], d = Math.hypot(player.x - b.x, player.z - b.z);
    if (d <= b.length / 2 + 2.6 && (!best || d < best.d)) best = { index, d };
  }
  return best;
}
