import test from "node:test";
import assert from "node:assert/strict";
import { createRowing, hullClear, isClear, findLanding, boardableBoat, ROWING, SEA_LIMITS, PIER_DECK } from "../src/game/rowing.js";
import { canOccupy } from "../src/game/navigation.js";
import { BOAT_LOCATIONS } from "../src/game/placements.js";
import fs from "node:fs";
const read = p => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");

const run = (boat, seconds, input, dt = 1 / 60) => { for (let t = 0; t < seconds; t += dt) boat.step(dt, input); return boat.state; };

test("rowing forward reaches a cruising speed of about 2.6 m/s and never exceeds the cap", () => {
  const boat = createRowing({ x: 40, z: -20, heading: 0 });
  let top = 0;
  for (let t = 0; t < 20; t += 1 / 60) { boat.step(1 / 60, { throttle: 1, steer: 0 }); top = Math.max(top, boat.state.speed); }
  assert.ok(top <= ROWING.maxSpeed + 1e-9);
  const avg = (() => { const b = createRowing({ x: 40, z: -20, heading: 0 }); run(b, 8, { throttle: 1, steer: 0 }); let sum = 0, n = 0; for (let t = 0; t < 6; t += 1 / 60) { b.step(1 / 60, { throttle: 1, steer: 0 }); sum += b.state.speed; n++; } return sum / n; })();
  assert.ok(avg > 2.0 && avg < 3.0, "cruise " + avg);
});

test("the speed breathes with the strokes instead of rising smoothly", () => {
  const boat = createRowing({ x: 40, z: -20, heading: 0 });
  run(boat, 6, { throttle: 1, steer: 0 });
  let min = Infinity, max = -Infinity;
  for (let t = 0; t < 3; t += 1 / 60) { boat.step(1 / 60, { throttle: 1, steer: 0 }); min = Math.min(min, boat.state.speed); max = Math.max(max, boat.state.speed); }
  assert.ok(max - min > 0.25, "stroke surge " + (max - min));
});

test("letting go coasts to a stop and back-paddling is weaker than rowing", () => {
  const boat = createRowing({ x: 40, z: -20, heading: 0 });
  run(boat, 6, { throttle: 1, steer: 0 });
  const moving = boat.state.speed;
  assert.ok(moving > 1.5);
  run(boat, 14, { throttle: 0, steer: 0 });
  assert.ok(Math.abs(boat.state.speed) < 0.35, "coasted to " + boat.state.speed);
  const back = createRowing({ x: 60, z: 0, heading: 0 });
  run(back, 8, { throttle: -1, steer: 0 });
  assert.ok(back.state.speed < 0 && Math.abs(back.state.speed) < moving);
});

test("steering turns the bow, and faster while moving", () => {
  const still = createRowing({ x: 60, z: 0, heading: 0 }); run(still, 2, { throttle: 0, steer: 1 });
  const moving = createRowing({ x: 60, z: 0, heading: 0 }); run(moving, 4, { throttle: 1, steer: 0 }); const h0 = moving.state.heading; run(moving, 2, { throttle: 1, steer: 1 });
  assert.ok(still.state.heading > 0.3, "turns in place a little");
  assert.ok(moving.state.heading - h0 > still.state.heading, "turns more under way");
});

test("the hull never enters the shore, the pier, the world edge or a rock", () => {
  const rocks = [[50, 0, 1.5]];
  for (const heading of [0, Math.PI, Math.PI / 2, -Math.PI / 2, 2.4]) {
    const boat = createRowing({ x: 30, z: -6, heading, blockers: rocks });
    for (let t = 0; t < 40; t += 1 / 30) {
      boat.step(1 / 30, { throttle: 1, steer: Math.sin(t) * 0.6 });
      assert.ok(hullClear(boat.state.x, boat.state.z, boat.state.heading, boat.state.length, boat.state.beam, rocks), `clear at t=${t} heading=${heading}`);
      assert.ok(boat.state.x >= SEA_LIMITS.minX - 1e-6 && Math.abs(boat.state.z) <= SEA_LIMITS.maxZ);
    }
  }
});

test("driving straight at the pier stops against it", () => {
  const boat = createRowing({ x: 22, z: 20, heading: -Math.PI / 2 });
  run(boat, 20, { throttle: 1, steer: 0 });
  assert.ok(boat.state.z > PIER_DECK.maxZ, "stopped at z=" + boat.state.z);
  assert.ok(Math.abs(boat.state.speed) < 1.2);
});

test("a rock blocks the water; open water clear of everything is clear", () => {
  assert.equal(isClear(60, 0, 1, []), true);
  assert.equal(isClear(60, 0, 1, [[60.5, 0, 0.5]]), false);
  assert.equal(isClear(20, 8, 0.5, []), false);       // on the pier deck
  assert.equal(isClear(14, 0, 0.5, []), false);       // on the beach side of the seawall
});

test("both authored moorings start in clear water", () => {
  for (const b of BOAT_LOCATIONS) assert.ok(hullClear(b.x, b.z, 0, b === BOAT_LOCATIONS[0] ? 4.5 : 6.3, 1.5, []), `mooring ${b.x},${b.z}`);
});

test("a rower can step off onto the pier or the beach only when one is in reach", () => {
  const colliders = [];
  const nearPier = findLanding({ x: 24, z: 12.4, length: 6.3 }, colliders);
  assert.equal(nearPier.kind, "pier");
  assert.ok(canOccupy(nearPier.x, nearPier.z, colliders));
  const nearBeach = findLanding({ x: 16, z: -3.5, length: 4.5 }, colliders);
  assert.equal(nearBeach.kind, "shore");
  assert.ok(canOccupy(nearBeach.x, nearBeach.z, colliders));
  assert.equal(findLanding({ x: 60, z: -20, length: 4.5 }, colliders), null);
});

test("boarding picks the nearest boat in reach", () => {
  const boats = [{ x: 18, z: -3.5, length: 4.5 }, { x: 24, z: 15.2, length: 6.3 }];
  assert.equal(boardableBoat({ x: 13.4, z: -3.5 }, boats).index, 0);
  assert.equal(boardableBoat({ x: 24, z: 10, length: 0 }, boats).index, 1);
  assert.equal(boardableBoat({ x: 0, z: 0 }, boats), null);
});

test("the physics is deterministic and finite", () => {
  const a = createRowing({ x: 50, z: 0 }), b = createRowing({ x: 50, z: 0 });
  for (let t = 0; t < 30; t += 1 / 60) { const i = { throttle: Math.sin(t) > 0 ? 1 : 0, steer: Math.cos(t * 0.7) }; a.step(1 / 60, i); b.step(1 / 60, i); }
  assert.deepEqual({ ...a.state }, { ...b.state });
  for (const v of Object.values(a.state)) if (typeof v === "number") assert.ok(Number.isFinite(v));
});

test("boating wiring: key E and the HUD button board and leave; the view uses the pure physics", () => {
  const src = read("src/game/boating.ts"), main = read("src/game/main.ts"), html = read("index.html");
  assert.match(src, /matchesActionKey\(e,"KeyE","e"\)/);
  assert.match(src, /isEditingTarget\(e\.target\)/);
  assert.match(src, /from "\.\/rowing\.js"/);
  assert.match(src, /靠近碼頭或岸邊才能下船/);
  assert.match(main, /createBoating\(/);
  assert.match(main, /boating\.update\(dt,/);
  for (const id of ["boat-hud", "boat-status", "boat-button"]) assert.match(html, new RegExp(`id="${id}"`));
});

test("boats expose their hull size, a YXZ rotation order and the model's own oars are replaced while rowing", () => {
  const boats = read("src/game/boats.ts");
  assert.match(boats, /rotation\.order="YXZ"/);
  assert.match(boats, /userData\.length=length/);
  assert.match(boats, /ownOars/);
});

test("the authored moorings can be left again for the beach or the pier they were boarded from", () => {
  const [rowboat, longboat] = BOAT_LOCATIONS;
  assert.equal(findLanding({ x: rowboat.x, z: rowboat.z, length: 4.5 }, []).kind, "shore");
  assert.equal(findLanding({ x: longboat.x, z: longboat.z, length: 6.3 }, []).kind, "pier");
});
