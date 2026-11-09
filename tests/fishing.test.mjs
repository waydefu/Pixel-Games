import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createFishing, rollCatch, isOpenWater, SPECIES, CAST_RANGE, MAX_LINE, SWEET_ZONE } from "../src/game/fishing-logic.js";
import { mulberry32 } from "../src/game/wander.js";

const read = p => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const DT = 1 / 60;

/** Drive the machine with a scripted hold function of (state, time). Returns the visited phases. */
function play(f, policy, seconds = 120) {
  const phases = [f.state.phase];
  for (let i = 0; i < seconds * 60; i++) {
    f.update(DT, policy(f.state, i * DT));
    if (phases[phases.length - 1] !== f.state.phase) phases.push(f.state.phase);
    if (f.isFinished()) break;
  }
  return phases;
}

/** A competent angler: charge for ~0.4 s, cast, reel steadily, set the hook at once, then let line out in each run and reel in each rest. */
function competent() {
  let charged = 0, tapped = false;
  return (s) => {
    switch (s.phase) {
      case "idle": return true;
      case "charging": charged += DT; return charged < .45;
      case "casting": return false;
      case "lure": return true;
      case "strike": tapped = !tapped; return tapped;
      case "fighting": return s.fightMode !== "run";           // ease off while the fish runs, reel when it rests
      default: return false;
    }
  };
}

test("charging oscillates the power, and releasing casts as far as the power says", () => {
  const f = createFishing({ rng: mulberry32(3) });
  f.update(DT, true); assert.equal(f.state.phase, "charging");
  for (let i = 0; i < 30; i++) f.update(DT, true);
  const p = f.state.power; assert.ok(p > .3 && p < .9, "power builds, got " + p);
  f.update(DT, false); assert.equal(f.state.phase, "casting");
  assert.ok(Math.abs(f.state.castDistance - (CAST_RANGE.min + p * (CAST_RANGE.max - CAST_RANGE.min))) < .6);
  const wave = createFishing({ rng: mulberry32(3) });
  let max = 0, min = 1, seenDown = false;
  wave.update(DT, true);
  for (let i = 0; i < 400; i++) { wave.update(DT, true); max = Math.max(max, wave.state.power); min = Math.min(min, wave.state.power); if (wave.state.powerDir < 0) seenDown = true; }
  assert.ok(max >= .99 && min <= .05 && seenDown, "the power bar ping-pongs");
});

test("a lure that is never reeled in still gets a strike, and reeling it all the way in ends the attempt with no fish", () => {
  const f = createFishing({ rng: mulberry32(5) });
  const phases = play(f, (s) => s.phase === "idle" ? true : s.phase === "charging" ? s.power < .5 : false, 30);
  assert.ok(phases.includes("strike"), "a fish strikes a waiting lure: " + phases.join(">"));
  const g = createFishing({ rng: mulberry32(5), biteDelay: [200, 300], strikeFraction: [9, 9] });
  const phases2 = play(g, (s) => s.phase === "idle" ? true : s.phase === "charging" ? s.power < .3 : s.phase === "lure", 60);
  assert.equal(g.state.phase, "lost"); assert.match(g.state.reason, /沒有魚/);
  assert.ok(!phases2.includes("strike"));
});

test("an ignored strike loses the fish, a tap sets the hook", () => {
  const miss = createFishing({ rng: mulberry32(8) });
  play(miss, (s) => s.phase === "idle" ? true : s.phase === "charging" ? s.power < .4 : s.phase === "lure" ? true : false, 60);
  assert.equal(miss.state.phase, "lost"); assert.match(miss.state.reason, /吐鉤/);
  const hit = createFishing({ rng: mulberry32(8) });
  const phases = play(hit, competent(), 90);
  assert.ok(phases.includes("fighting"), phases.join(">"));
});

test("a patient angler lands fish: reel in the green, ease off in the red", () => {
  let landed = 0;
  const kinds = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const f = createFishing({ rng: mulberry32(seed) });
    play(f, competent(), 200);
    if (f.state.phase === "landed") { landed++; assert.ok(f.state.result && f.state.result.name); kinds.add(f.state.result.id); }
  }
  assert.equal(landed, 40, "a competent angler lands every fish, got " + landed + "/40");
  assert.ok(kinds.size >= 3, "different species turn up: " + [...kinds].join());
});

test("holding the reel without ever easing off snaps the line on a strong fish", () => {
  let snapped = 0, strong = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const f = createFishing({ rng: mulberry32(seed) });
    let tapped = false;
    play(f, (s) => { if (s.phase === "idle") return true; if (s.phase === "charging") return s.power < .4; if (s.phase === "strike") { tapped = !tapped; return tapped; } return s.phase === "lure" || s.phase === "fighting"; }, 200);
    if (f.state.reason === "斷線了！") snapped++;
    if (f.state.strength > 1) strong++;
  }
  assert.ok(snapped >= 8, "mashing the reel snaps the line on big fish, got " + snapped);
  assert.ok(strong > 5);
});

test("never reeling lets the fish run the line out", () => {
  let ran = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const f = createFishing({ rng: mulberry32(seed) });
    let tapped = false, fighting = false;
    play(f, (s) => { if (s.phase === "idle") return true; if (s.phase === "charging") return s.phase === "charging" && s.power < .4; if (s.phase === "lure") return true; if (s.phase === "strike") { tapped = !tapped; return tapped; } fighting = s.phase === "fighting"; return false; }, 200);
    if (f.state.reason.includes("拉光")) ran++;
    assert.ok(f.state.fishDistance <= MAX_LINE + 1);
  }
  assert.ok(ran >= 15, "an angler who never reels loses the fish, got " + ran);
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
  assert.ok(counts.mackerel > counts.salmon * 2 && counts.boot > 0 && counts.boot < counts.mackerel / 5);
});

test("only open water takes a cast", () => {
  assert.ok(isOpenWater(20, 0));
  assert.ok(!isOpenWater(10, 0) && !isOpenWater(20, 8) && !isOpenWater(NaN, 0));
  assert.ok(isOpenWater(20, 14));
});

test("fishing is wired into the game: hold F or the button, with a tension gauge", () => {
  const view = read("src/game/fishing.ts");
  assert.match(view, /matchesActionKey\(event,"KeyF","f"\)/);
  assert.match(view, /keyup/, "holding the key matters: a release is an input");
  assert.match(view, /setCameraMode\("first"\)/);
  const html = read("index.html");
  for (const id of ["fish-button", "fish-meter", "fish-tension", "fish-power"]) assert.match(html, new RegExp('id="' + id + '"'));
  assert.match(read("src/game/main.ts"), /createFishingView/);
});

test("HUD messages survive slow frames: written at once and kept for at least two rendered frames", () => {
  const src = read("src/game/fishing.ts");
  assert.match(src, /messageFrames=2;ui\.status\.textContent=text/);
  assert.match(src, /now<messageUntil\|\|messageFrames>0/);
});


test("every species can be landed, and a fight is two or three rounds of about ten seconds", () => {
  const landedKinds = new Set(), fights = [];
  let maxRound = 0, minRounds = 9;
  for (let seed = 1; seed <= 150; seed++) {
    const f = createFishing({ rng: mulberry32(seed) });
    // a slow human: reacts 0.6 s late to each change between run and rest
    let tapped = false, last = null, since = 0, want = false, start = null;
    for (let i = 0; i < 60 * 120 && !f.isFinished(); i++) {
      const s = f.state;
      let hold;
      switch (s.phase) {
        case "idle": hold = true; break;
        case "charging": hold = s.power < .45; break;
        case "casting": hold = false; break;
        case "lure": hold = true; break;
        case "strike": tapped = !tapped; hold = tapped; break;
        case "fighting":
          if (start === null) start = f.now();
          if (s.fightMode !== last) { last = s.fightMode; since = f.now(); }
          if (f.now() - since > .6) want = s.fightMode !== "run";
          hold = want; maxRound = Math.max(maxRound, s.round); break;
        default: hold = false;
      }
      f.update(DT, hold);
    }
    assert.equal(f.state.phase, "landed", "seed " + seed + " ended " + f.state.phase + " " + f.state.reason);
    landedKinds.add(f.state.result.id);
    fights.push(f.now() - start);
    minRounds = Math.min(minRounds, f.state.rounds);
  }
  for (const s of SPECIES) assert.ok(landedKinds.has(s.id), s.name + " is catchable");
  assert.ok(maxRound >= 2 && maxRound <= 3, "two or three runs, got " + maxRound);
  fights.sort((a, b) => a - b);
  assert.ok(fights[75] > 6 && fights[75] < 14, "median fight " + fights[75].toFixed(1) + " s");
  assert.ok(fights[148] < 25, "even the longest fight is under 25 s: " + fights[148].toFixed(1));
});

test("the tension gauge is steerable: it moves slowly and never jumps", () => {
  const f = createFishing({ rng: mulberry32(4) });
  let tapped = false, prev = null, maxStep = 0, maxRate = 0;
  for (let i = 0; i < 60 * 90 && !f.isFinished(); i++) {
    const s = f.state;
    let hold = s.phase === "idle" || s.phase === "lure" || (s.phase === "charging" && s.power < .45);
    if (s.phase === "strike") { tapped = !tapped; hold = tapped; }
    if (s.phase === "fighting") hold = s.fightMode !== "run";
    f.update(DT, hold);
    if (s.phase === "fighting") { if (prev !== null) { maxStep = Math.max(maxStep, Math.abs(s.tension - prev)); } prev = s.tension; }
  }
  maxRate = maxStep / DT;
  assert.ok(maxRate < 1.2, "the gauge never moves faster than 1.2 per second, got " + maxRate.toFixed(2));
});

test("a fish nibbles before it strikes (the lure twitches in the view)", () => {
  const f = createFishing({ rng: mulberry32(11) });
  let sawNibble = false, tapped = false;
  for (let i = 0; i < 60 * 40 && f.state.phase !== "strike"; i++) {
    const s = f.state;
    f.update(DT, s.phase === "idle" || s.phase === "lure" || (s.phase === "charging" && s.power < .45));
    if (s.phase === "lure" && s.nibble > .3) sawNibble = true;
  }
  assert.ok(sawNibble, "nibble rises before the strike");
  void tapped;
});


test("the view: the idle lure hangs from the tip, the reel-in arc does not run away, a marker shows the lure, and the HUD is minimal", () => {
  const src = read("src/game/fishing.ts");
  assert.match(src, /body="hang"/);                                  // idle: a lure dangling from the tip, not a line to the sky
  assert.match(src, /lurePos\.y\+=\(goal-lurePos\.y\)\*Math\.min\(1,dt\*7\)/);   // eased, not accumulated every frame
  assert.doesNotMatch(src, /lurePos\.y=Math\.max\(lurePos\.y,WATER_Y\+\.05\)\+Math\.min\(1\.4,d\*\.04\)/);
  assert.match(src, /markerGroup/);
  assert.match(src, /st\.nibble>\.05/);                              // bite twitches
  assert.match(src, /strikeSide/);                                    // the strike darts sideways
  assert.match(src, /st\.fightMode==="run"/);                        // runs drag the lure across the water
  assert.match(src, /ui\.lure\.hidden=!\(phase==="idle"&&nearWater\(\)\)/);   // no lure switch once a line is out
  assert.match(src, /isAboard\?\.\(\)/);                            // fishing is offered from a boat too
  assert.doesNotMatch(src, /面向海面，按住 F 蓄力拋竿/);               // the redundant idle hint is gone
});

test("a tap squeezed between two frames still sets the hook while the reel is held", () => {
  const src = read("src/game/fishing.ts");
  assert.match(src, /if\(tap&&lastHold\)logic\.update\(\.001,false\)/);
});

test("when a fish strikes it drags the lure away from the angler", () => {
  const f = createFishing({ rng: mulberry32(11) });
  let atStrike = null, later = null;
  for (let i = 0; i < 60 * 40; i++) {
    const s = f.state;
    f.update(DT, s.phase === "idle" || s.phase === "lure" || (s.phase === "charging" && s.power < .45));
    if (s.phase === "strike") { if (atStrike === null) atStrike = s.lureDistance; later = s.lureDistance; if (later > atStrike + 1) break; }
  }
  assert.ok(atStrike !== null && later > atStrike + 1, `the lure is pulled out (${atStrike} -> ${later})`);
});

test("no torch stands on the centreline of the pier: an angler at its end looks straight out to sea", () => {
  const src = read("src/game/architecture.ts");
  assert.doesNotMatch(src, /\[28\.6,8\]/);
  assert.match(src, /\[28\.6,5\.5\],\[28\.6,10\.5\]/);
});

test("the rod is only out while fishing: drawn on a cast, kept briefly, then lowered; never carried while walking or rowing", () => {
  const src = read("src/game/fishing.ts");
  assert.match(src, /now-lastActiveAt<2\.2/);
  assert.match(src, /stow\*\.95/);
  assert.doesNotMatch(src, /const showRod=mode==="first"&&\(rodView\|\|active\|\|nearWater\(\)/);
});
