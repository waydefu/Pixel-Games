import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createFishing, rollCatch, isOpenWater, SPECIES } from "../src/game/fishing-logic.js";
import { mulberry32 } from "../src/game/wander.js";

const read = p => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");

test("cast, wait, bite, reel in: the full catch", () => {
  const f = createFishing({ rng: mulberry32(4) });
  assert.equal(f.state.phase, "idle");
  assert.ok(f.press(0)); assert.equal(f.state.phase, "casting");
  assert.equal(f.press(.2), false, "cannot reel while the line is in the air");
  f.update(1); assert.equal(f.state.phase, "waiting");
  f.update(f.state.biteAt + .01); assert.equal(f.state.phase, "bite");
  assert.ok(f.press(f.state.biteAt + .3));
  assert.equal(f.state.phase, "landed");
  assert.ok(f.state.result && f.state.result.name);
  f.press(20); assert.equal(f.state.phase, "idle");
});

test("reeling in too early and letting the fish go are both failures, and a new cast always works afterwards", () => {
  const early = createFishing({ rng: mulberry32(9) });
  early.press(0); early.update(1);
  early.press(1.1); assert.equal(early.state.phase, "early");
  early.press(2); assert.equal(early.state.phase, "idle");
  const late = createFishing({ rng: mulberry32(9), biteWindow: 1 });
  late.press(0); late.update(1); late.update(late.state.biteAt + .1);
  late.update(late.state.biteAt + 2); assert.equal(late.state.phase, "escaped");
  late.press(30); assert.equal(late.state.phase, "idle");
  assert.ok(late.press(31), "can cast again");
});

test("the bite always comes within the configured delay", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const f = createFishing({ rng: mulberry32(seed), castTime: .75, biteDelay: [2.5, 7] });
    f.press(10);
    const wait = f.state.biteAt - 10;
    assert.ok(wait >= .75 + 2.5 - 1e-9 && wait <= .75 + 7 + 1e-9, "wait " + wait);
  }
});

test("the catch table is weighted and sizes stay in range", () => {
  const rng = mulberry32(5), counts = {};
  for (let i = 0; i < 4000; i++) {
    const c = rollCatch(rng);
    counts[c.id] = (counts[c.id] || 0) + 1;
    const s = SPECIES.find(x => x.id === c.id);
    if (s.length) assert.ok(c.length >= s.length[0] && c.length <= s.length[1]);
    else assert.equal(c.length, null);
  }
  assert.ok(counts.mackerel > counts.salmon * 2, "common fish are common");
  assert.ok(counts.boot > 0 && counts.boot < counts.mackerel / 5, "a boot is a rare joke");
});

test("only open water takes a cast", () => {
  assert.ok(isOpenWater(20, 0));
  assert.ok(!isOpenWater(10, 0), "the promenade");
  assert.ok(!isOpenWater(20, 8), "the pier deck");
  assert.ok(isOpenWater(20, 14), "water beside the pier");
  assert.ok(!isOpenWater(NaN, 0));
});

test("fishing is wired into the game with a HUD button and the F key", () => {
  const view = read("src/game/fishing.ts");
  assert.match(view, /toLowerCase\(\)==="f"/);
  assert.match(view, /setCameraMode\("first"\)/, "casting switches to the first-person view");
  assert.match(read("index.html"), /id="fish-button"/);
  assert.match(read("src/game/main.ts"), /createFishing|createFishingView/);
});
