// Lure fishing rules (spinning rod): charge a cast, retrieve the lure, set the hook when a fish strikes, then fight the
// fish on a tension gauge. Independent of rendering: pure, deterministic for a given rng, testable in Node.
//
//   idle -> charging (hold) -> casting (release) -> lure (hold = reel in) -> strike (tap to set the hook)
//        -> fighting (hold = reel, release = let it run; keep the tension in the green) -> landed
//   a fight ends in "lost" when the line snaps (tension too high too long) or the fish runs out the line.
export const SPECIES = Object.freeze([
  Object.freeze({ id: "mackerel", name: "鯖魚", weight: 30, length: [24, 38], color: "#6fa3b8" }),
  Object.freeze({ id: "herring", name: "鯡魚", weight: 25, length: [18, 28], color: "#aab8c2" }),
  Object.freeze({ id: "cod", name: "鱈魚", weight: 22, length: [35, 70], color: "#a89a72" }),
  Object.freeze({ id: "flounder", name: "鰈魚", weight: 10, length: [25, 45], color: "#8d7a5a" }),
  Object.freeze({ id: "salmon", name: "鮭魚", weight: 8, length: [55, 90], color: "#e0866a" }),
  Object.freeze({ id: "crab", name: "螃蟹", weight: 3, length: [10, 18], color: "#c8553a" }),
  Object.freeze({ id: "boot", name: "一隻舊靴子", weight: 2, length: null, color: "#4a3a2a", junk: true }),
]);

export function rollCatch(rng) {
  const total = SPECIES.reduce((sum, s) => sum + s.weight, 0);
  let pick = rng() * total, species = SPECIES[SPECIES.length - 1];
  for (const s of SPECIES) { pick -= s.weight; if (pick < 0) { species = s; break; } }
  const length = species.length ? Math.round(species.length[0] + rng() * (species.length[1] - species.length[0])) : null;
  return Object.freeze({ id: species.id, name: species.name, length, junk: !!species.junk, color: species.color });
}

export const CAST_RANGE = Object.freeze({ min: 5, max: 22 });
export const MAX_LINE = 32;          // the fish wins when it runs out this much line
export const LANDING_DISTANCE = 1.6;
export const SWEET_ZONE = Object.freeze({ low: .32, high: .72 });

/**
 * `update(dt, hold)` drives everything; `hold` is whether the single button (F / the on-screen button) is held down.
 * The returned `state` is live: the view reads phase, power, lureDistance, fishDistance, tension and stamina.
 */
export function createFishing({ rng = Math.random, castTime = .8, strikeWindow = 1.7, biteDelay = [3, 8], strikeFraction = [.25, .8] } = {}) {
  /** @type {{phase:string,t:number,power:number,powerDir:number,castDistance:number,lureDistance:number,
   *  biteAt:number,fishDistance:number,tension:number,stamina:number,overload:number,pull:number,burst:number,
   *  result:null|{id:string,name:string,length:number|null,junk:boolean,color:string},reason:string,strength:number,
   *  hooked:null|{id:string,name:string,length:number|null,junk:boolean,color:string}}} */
  const state = {
    phase: "idle", t: 0, power: 0, powerDir: 1, castDistance: 0, lureDistance: 0, biteAt: 0, fishDistance: 0,
    tension: 0, stamina: 1, overload: 0, pull: 0, burst: 0, result: null, reason: "", strength: 1, hooked: null,
  };
  let wasHeld = false, retrieved = 0, fish = null, clock = 0, waitSince = 0, strikeAt = 0;
  const finished = () => state.phase === "landed" || state.phase === "lost";

  function startCharge() { state.phase = "charging"; state.power = 0; state.powerDir = 1; state.t = clock; state.result = null; state.reason = ""; }
  function release() {
    state.castDistance = CAST_RANGE.min + state.power * (CAST_RANGE.max - CAST_RANGE.min);
    state.phase = "casting"; state.t = clock;
  }
  function land() {
    state.phase = "lure"; state.lureDistance = state.castDistance; retrieved = 0; waitSince = clock;
    state.biteAt = biteDelay[0] + rng() * (biteDelay[1] - biteDelay[0]);   // seconds a motionless lure waits for a strike
    // ...and a fish may strike anywhere along the retrieve: after the lure has come in this fraction of its cast
    strikeAt = state.castDistance * (1 - (strikeFraction[0] + rng() * (strikeFraction[1] - strikeFraction[0])));
    fish = null;
  }
  function strike() { state.phase = "strike"; state.t = clock; fish = rollCatch(rng); state.hooked = fish; state.strength = fish.junk ? .35 : .5 + (fish.length ?? 20) / 90; }
  function hook() {
    state.phase = "fighting"; state.t = clock; state.fishDistance = state.lureDistance;
    state.tension = .3; state.stamina = 1; state.overload = 0; state.burst = 0; state.pull = .4;
  }
  function lose(reason) { state.phase = "lost"; state.reason = reason; state.t = clock; fish = null; state.hooked = null; }

  function update(dt, hold) {
    dt = Math.min(Math.max(dt, 0), .1);
    clock += dt;
    const pressed = hold && !wasHeld, released = !hold && wasHeld;
    wasHeld = hold;
    switch (state.phase) {
      case "idle":
        if (pressed) startCharge();
        break;
      case "charging":
        state.power += state.powerDir * dt * 1.15;
        if (state.power >= 1) { state.power = 1; state.powerDir = -1; }
        if (state.power <= 0) { state.power = 0; state.powerDir = 1; }
        if (released) release();
        break;
      case "casting":
        if (clock - state.t >= castTime) land();
        break;
      case "lure": {
        // Reeling brings the lure in at 2.6 m/s. A fish strikes somewhere along the retrieve, or a lure left sitting
        // still for long enough.
        if (hold) { state.lureDistance = Math.max(0, state.lureDistance - 2.6 * dt); retrieved += dt; }
        const waited = clock - waitSince - retrieved;
        if ((state.lureDistance <= strikeAt || waited >= state.biteAt) && state.lureDistance > 2.5) strike();
        else if (state.lureDistance <= 1.2) { state.phase = "lost"; state.reason = "沒有魚上鉤，重新拋竿"; state.t = clock; }
        break;
      }
      case "strike":
        if (pressed) hook();
        else if (clock - state.t > strikeWindow) lose("魚吐鉤了…");
        break;
      case "fighting": {
        const f = state.strength;
        // The fish runs in bursts: a base pull plus surges that come and go.
        state.burst = Math.max(0, state.burst - dt * .75);
        if (rng() < dt * (1.1 + f * .6)) state.burst = Math.min(1, state.burst + .55 + rng() * .45);
        const pull = (.3 + .26 * f) * (.55 + .45 * state.stamina) + state.burst * (.72 + .28 * f) * (.4 + .6 * state.stamina);
        state.pull = pull;
        const reel = hold ? 1 : 0;
        // Tension rises with the fish's pull and with every turn of the reel; it eases off when you let line out.
        const target = Math.min(1.4, pull * (hold ? 1.3 : .55) + reel * .22);
        state.tension += (target - state.tension) * Math.min(1, dt * 4.5);
        // Distance: the fish takes line when you do not reel, you gain it when you do (more once it tires).
        const run = pull * 3.4 * (hold ? .25 : 1);
        const gain = reel * (1.1 + 2.2 * (1 - state.stamina) + .6 * (1 - Math.min(1, f)));
        state.fishDistance = Math.max(0, state.fishDistance + (run - gain) * dt);
        // The fish tires fastest while the tension is in the green zone.
        const inZone = state.tension >= SWEET_ZONE.low && state.tension <= SWEET_ZONE.high;
        state.stamina = Math.max(0, state.stamina - dt * (inZone ? .085 : .02) / (.6 + f * .6));
        state.overload = state.tension > .96 ? state.overload + dt : Math.max(0, state.overload - dt * 1.5);
        if (state.overload > .45) lose("斷線了！");
        else if (state.fishDistance >= MAX_LINE) lose("魚把線拉光逃走了");
        else if (state.fishDistance <= LANDING_DISTANCE) { state.phase = "landed"; state.result = fish; state.t = clock; }
        break;
      }
      default:
        // landed / lost: a tap acknowledges and returns to idle
        if (pressed) { state.phase = "idle"; state.result = null; state.reason = ""; state.hooked = null; }
    }
    return state;
  }
  function cancel() { state.phase = "idle"; state.result = null; state.reason = ""; fish = null; state.hooked = null; }
  return { state, update, cancel, isActive: () => state.phase !== "idle", isFinished: finished, now: () => clock };
}

/** Open water the lure may land in: past the seawall, outside the pier deck. */
export function isOpenWater(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  if (x < 14.4 || x > 120 || Math.abs(z) > 44) return false;
  if (x < 30.9 && z > 5.1 && z < 10.9) return false;   // the pier deck
  return true;
}
