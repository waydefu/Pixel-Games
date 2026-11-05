import test from "node:test";
import assert from "node:assert/strict";
import { paintTravellerSheet, FRAME, FRAMES, DIRECTIONS } from "../src/game/pixel/character.js";
import { OUTLINE, parseHex } from "../src/game/pixel/palette.js";
import { countColors } from "../src/game/pixel/painter.js";

const alphaAt = (sheet, x, y) => sheet.data[(y * sheet.width + x) * 4 + 3];
const opaqueIn = (sheet, col, row) => {
  let n = 0;
  for (let y = 0; y < FRAME; y++) for (let x = 0; x < FRAME; x++) if (alphaAt(sheet, col * FRAME + x, row * FRAME + y)) n++;
  return n;
};

test("traveller sheet is a deterministic 4x4 grid of 32px frames", () => {
  const a = paintTravellerSheet(), b = paintTravellerSheet();
  assert.equal(a.width, FRAME * FRAMES);
  assert.equal(a.height, FRAME * DIRECTIONS);
  assert.deepEqual(a.data, b.data);
});

test("every frame holds a figure that stays inside its cell and keeps its feet low", () => {
  const sheet = paintTravellerSheet();
  for (let row = 0; row < DIRECTIONS; row++) {
    for (let col = 0; col < FRAMES; col++) {
      const n = opaqueIn(sheet, col, row);
      assert.ok(n > 200 && n < 700, `frame ${col},${row} has ${n} opaque texels`);
      for (let k = 0; k < FRAME; k++) { // left, right and top borders stay clear; the soles may touch the bottom
        assert.equal(alphaAt(sheet, col * FRAME, row * FRAME + k), 0);
        assert.equal(alphaAt(sheet, col * FRAME + FRAME - 1, row * FRAME + k), 0);
        assert.equal(alphaAt(sheet, col * FRAME + k, row * FRAME), 0);
      }
      let lowest = 0;
      for (let y = 0; y < FRAME; y++) for (let x = 0; x < FRAME; x++) if (alphaAt(sheet, col * FRAME + x, row * FRAME + y)) lowest = Math.max(lowest, y);
      assert.ok(lowest >= 29 && lowest <= 31, `feet at row ${lowest}`);
    }
  }
});

test("the figure is outlined in plum-black and drawn from a small shared palette", () => {
  const sheet = paintTravellerSheet();
  const [r, g, b] = parseHex(OUTLINE);
  let outline = 0;
  for (let i = 0; i < sheet.data.length; i += 4) if (sheet.data[i + 3] && sheet.data[i] === r && sheet.data[i + 1] === g && sheet.data[i + 2] === b) outline++;
  assert.ok(outline > 300, "outline present");
  assert.ok(countColors(sheet.data) < 70, "limited palette");
});

test("facing left is the mirror of facing right", () => {
  const sheet = paintTravellerSheet();
  for (let frame = 0; frame < FRAMES; frame++) {
    for (let y = 0; y < FRAME; y++) for (let x = 0; x < FRAME; x++) {
      const right = ((1 * FRAME + y) * sheet.width + frame * FRAME + x) * 4;
      const left = ((3 * FRAME + y) * sheet.width + frame * FRAME + (FRAME - 1 - x)) * 4;
      for (let c = 0; c < 4; c++) assert.equal(sheet.data[right + c], sheet.data[left + c]);
    }
  }
});
