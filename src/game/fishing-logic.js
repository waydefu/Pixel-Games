// Fishing rules, independent of rendering: cast, wait for a bite, reel in inside the bite window. Pure and testable.
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

/**
 * Phases: idle -> casting -> waiting -> bite -> landed | escaped, or waiting -> early (reeled in too soon).
 * `press` is the single input (F key / button): it casts, reels, or acknowledges a result depending on the phase.
 */
export function createFishing({ rng = Math.random, castTime = .75, biteDelay = [2.5, 7], biteWindow = 2.2 } = {}) {
  /** @type {{phase:string,t0:number,biteAt:number,result:null|{id:string,name:string,length:number|null,junk:boolean,color:string}}} */
  const state = { phase: "idle", t0: 0, biteAt: 0, result: null };
  const finished = () => state.phase === "landed" || state.phase === "escaped" || state.phase === "early";
  function cast(t) {
    if (state.phase !== "idle") return false;
    state.phase = "casting"; state.t0 = t; state.result = null;
    state.biteAt = t + castTime + biteDelay[0] + rng() * (biteDelay[1] - biteDelay[0]);
    return true;
  }
  function press(t) {
    switch (state.phase) {
      case "idle": return cast(t);
      case "casting": return false;                 // the line is still in the air
      case "waiting": state.phase = "early"; return true;
      case "bite": state.phase = "landed"; state.result = rollCatch(rng); return true;
      default: state.phase = "idle"; state.result = null; return true;
    }
  }
  function update(t) {
    if (state.phase === "casting" && t >= state.t0 + castTime) state.phase = "waiting";
    if (state.phase === "waiting" && t >= state.biteAt) state.phase = "bite";
    else if (state.phase === "bite" && t > state.biteAt + biteWindow) state.phase = "escaped";
    return state;
  }
  function cancel() { state.phase = "idle"; state.result = null; }
  return { state, cast, press, update, cancel, isActive: () => state.phase !== "idle", isFinished: finished };
}

/** Open water the bobber may land in: past the seawall, outside the pier deck. */
export function isOpenWater(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  if (x < 14.4 || x > 120 || Math.abs(z) > 44) return false;
  if (x < 30.9 && z > 5.1 && z < 10.9) return false;   // the pier deck
  return true;
}
