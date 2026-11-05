// The traveller: an angler in an olive utility vest, painted texel by texel from the shared palette.
// 32x32 frames at the world density (16 texels per unit => a 2x2 unit quad, ~1.75 unit tall figure).
// Rows: 0 = facing the camera (+z), 1 = facing right (+x), 2 = facing away (-z), 3 = facing left (-x).
// Columns: 4 walk frames (stand, step, passing, step). A plum-black outline wraps every frame.
import { PALETTE, OUTLINE, parseHex } from "./palette.js";

export const FRAME = 32;
export const FRAMES = 4;
export const DIRECTIONS = 4;

const O = PALETTE.olive, G = PALETTE.shirt, H = PALETTE.hat, P = PALETTE.shorts,
  S = PALETTE.skin, K = PALETTE.black, F = PALETTE.shoe, HAIR = PALETTE.hair;

function newSheet() {
  const width = FRAME * FRAMES, height = FRAME * DIRECTIONS;
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

function frameWriter(sheet, ox, oy) {
  const put = (x, y, hex) => {
    if (x < 0 || y < 0 || x >= FRAME || y >= FRAME) return;
    const [r, g, b] = parseHex(hex), i = ((oy + y) * sheet.width + ox + x) * 4;
    sheet.data[i] = r; sheet.data[i + 1] = g; sheet.data[i + 2] = b; sheet.data[i + 3] = 255;
  };
  const rect = (x0, y0, x1, y1, hex) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, hex); };
  return { put, rect };
}

/** 1px outline on every transparent texel that touches the figure (per frame, 4-neighbour). */
function outlineFrame(sheet, ox, oy) {
  const [r, g, b] = parseHex(OUTLINE);
  const alpha = (x, y) => x < 0 || y < 0 || x >= FRAME || y >= FRAME ? 0 : sheet.data[((oy + y) * sheet.width + ox + x) * 4 + 3];
  const marks = [];
  for (let y = 0; y < FRAME; y++) for (let x = 0; x < FRAME; x++) {
    if (alpha(x, y)) continue;
    if (alpha(x - 1, y) || alpha(x + 1, y) || alpha(x, y - 1) || alpha(x, y + 1)) marks.push([x, y]);
  }
  for (const [x, y] of marks) {
    const i = ((oy + y) * sheet.width + ox + x) * 4;
    sheet.data[i] = r; sheet.data[i + 1] = g; sheet.data[i + 2] = b; sheet.data[i + 3] = 255;
  }
}

// Walk cycle: frame -> [leg phase, arm phase, body bob]
// Contact frames sink the body 1px (never lift it): keeps a clear texel above the outlined hat.
const CYCLE = [[0, 0, 0], [1, 1, 1], [0, 0, 0], [-1, -1, 1]];

function legsFront({ rect, put }, phase) {
  const lowL = phase === 1 ? 1 : 0, lowR = phase === -1 ? 1 : 0;
  rect(12, 26, 14, 28 + lowL - (phase === -1 ? 1 : 0), K[1]);
  rect(17, 26, 19, 28 + lowR - (phase === 1 ? 1 : 0), K[1]);
  put(12, 26, K[2]); put(17, 26, K[2]);
  const yl = 29 + lowL - (phase === -1 ? 1 : 0), yr = 29 + lowR - (phase === 1 ? 1 : 0);
  rect(11, yl, 14, yl + 1, F[3]); rect(11, yl + 1, 14, yl + 1, F[1]); put(11, yl, F[4]);
  rect(17, yr, 20, yr + 1, F[3]); rect(17, yr + 1, 20, yr + 1, F[1]); put(20, yr, F[4]);
}

function paintFront(w, phase, armPhase, b, back) {
  const { rect, put } = w;
  legsFront(w, phase);
  // cargo shorts
  rect(11, 22 + b, 14, 25 + b, P[3]); rect(17, 22 + b, 20, 25 + b, P[3]); rect(15, 22 + b, 16, 24 + b, P[2]);
  rect(11, 25 + b, 14, 25 + b, P[2]); rect(17, 25 + b, 20, 25 + b, P[2]);
  if (!back) { rect(12, 23 + b, 13, 23 + b, P[4]); rect(18, 23 + b, 19, 23 + b, P[4]); }
  else { rect(12, 24 + b, 13, 24 + b, P[2]); rect(18, 24 + b, 19, 24 + b, P[2]); }
  // base layer + sleeves
  rect(11, 14 + b, 20, 21 + b, G[3]);
  rect(9, 14 + b, 10, 22 + b + armPhase, G[3]); rect(21, 14 + b, 22, 22 + b - armPhase, G[3]);
  rect(9, 14 + b, 9, 22 + b + armPhase, G[2]); rect(22, 14 + b, 22, 22 + b - armPhase, G[2]);
  put(10, 15 + b, G[4]); put(21, 15 + b, G[4]);
  // fingerless gloves
  rect(9, 23 + b + armPhase, 10, 24 + b + armPhase, K[1]); put(9, 25 + b + armPhase, S[3]); put(10, 25 + b + armPhase, S[3]);
  rect(21, 23 + b - armPhase, 22, 24 + b - armPhase, K[1]); put(21, 25 + b - armPhase, S[3]); put(22, 25 + b - armPhase, S[3]);
  // utility vest
  rect(11, 14 + b, 14, 21 + b, O[4]); rect(17, 14 + b, 20, 21 + b, O[4]);
  rect(11, 14 + b, 14, 14 + b, O[5]); rect(17, 14 + b, 20, 14 + b, O[5]);
  rect(11, 21 + b, 14, 21 + b, O[3]); rect(17, 21 + b, 20, 21 + b, O[3]);
  if (!back) {
    rect(15, 15 + b, 16, 21 + b, G[2]); put(15, 14 + b, G[3]); put(16, 14 + b, G[3]);
    put(15, 16 + b, O[6]); put(15, 18 + b, O[6]); put(15, 20 + b, O[6]); // zipper
    for (const [x0, x1] of [[11, 13], [18, 20]]) {
      rect(x0, 15 + b, x1, 17 + b, O[3]); rect(x0, 15 + b, x1, 15 + b, O[6]);   // chest pocket + flap
      rect(x0, 18 + b, x1, 20 + b, O[3]); rect(x0, 18 + b, x1, 18 + b, O[6]);   // lower pocket + flap
      rect(x0, 17 + b, x1, 17 + b, O[2]); rect(x0, 20 + b, x1, 20 + b, O[2]);                  // pocket bottoms
      put(x0 === 11 ? x1 : x0, 16 + b, O[5]); put(x0 === 11 ? x1 : x0, 19 + b, O[5]); // button
    }
  } else {
    rect(15, 14 + b, 16, 21 + b, O[3]);
    rect(12, 18 + b, 19, 20 + b, O[3]); rect(12, 18 + b, 19, 18 + b, O[5]);
  }
}

function paintHeadFront({ rect, put }, b, back) {
  // bucket hat
  rect(12, 2 + b, 19, 5 + b, H[3]); rect(13, 2 + b, 17, 2 + b, H[4]); rect(12, 5 + b, 19, 5 + b, H[2]);
  rect(9, 6 + b, 22, 7 + b, H[3]); rect(9, 7 + b, 22, 7 + b, H[2]); put(9, 6 + b, H[4]); put(10, 6 + b, H[4]);
  put(9, 7 + b, H[1]); put(22, 7 + b, H[1]);
  if (!back) {
    rect(13, 8 + b, 18, 12 + b, S[3]); rect(13, 12 + b, 18, 12 + b, S[2]); put(13, 9 + b, S[4]); put(13, 10 + b, S[4]);
    rect(12, 9 + b, 19, 10 + b, K[0]); put(13, 9 + b, "#6f8190"); put(17, 9 + b, "#5a6a78"); // sunglasses + glints
    put(15, 11 + b, S[2]); put(16, 11 + b, S[2]);
    rect(14, 13 + b, 17, 13 + b, S[2]);
  } else {
    rect(13, 8 + b, 18, 11 + b, HAIR[1]); rect(14, 12 + b, 17, 13 + b, S[2]); put(13, 8 + b, HAIR[2]);
  }
}

function paintSide({ rect, put }, phase, armPhase, b) {
  // far leg (darker) and near leg swing opposite
  const swing = phase * 2;
  rect(14 - swing, 26, 16 - swing, 28, K[0]);
  rect(13 - swing, 29, 18 - swing, 30, F[1]); rect(13 - swing, 29, 17 - swing, 29, F[2]);
  rect(14 + swing, 26, 16 + swing, 28, K[1]); put(14 + swing, 26, K[2]);
  rect(13 + swing, 29, 18 + swing, 30, F[3]); rect(13 + swing, 30, 18 + swing, 30, F[1]); put(18 + swing, 29, F[4]);
  // far arm (behind torso)
  rect(14 - armPhase, 15 + b, 15 - armPhase, 21 + b, G[2]); rect(14 - armPhase, 22 + b, 15 - armPhase, 23 + b, K[0]);
  // shorts, torso
  rect(12, 22 + b, 19, 25 + b, P[3]); rect(12, 25 + b, 19, 25 + b, P[2]); rect(16, 23 + b, 18, 23 + b, P[4]);
  rect(12, 14 + b, 19, 21 + b, G[3]);
  rect(12, 14 + b, 19, 21 + b, O[4]); rect(12, 14 + b, 13, 21 + b, O[3]); rect(12, 14 + b, 19, 14 + b, O[5]);
  rect(16, 15 + b, 19, 17 + b, O[3]); rect(16, 15 + b, 19, 15 + b, O[6]); rect(16, 17 + b, 19, 17 + b, O[2]);
  rect(16, 18 + b, 19, 20 + b, O[3]); rect(16, 18 + b, 19, 18 + b, O[6]); rect(16, 20 + b, 19, 20 + b, O[2]); put(19, 16 + b, O[5]); put(19, 19 + b, O[5]);
  rect(12, 21 + b, 19, 21 + b, O[3]);
  // near arm swings
  rect(15, 14 + b, 16, 18 + b, G[3]); rect(15, 14 + b, 15, 18 + b, G[4]);
  rect(15 + armPhase, 19 + b, 16 + armPhase, 22 + b, G[3]); rect(15 + armPhase, 23 + b, 16 + armPhase, 24 + b, K[1]);
  put(15 + armPhase, 25 + b, S[3]); put(16 + armPhase, 25 + b, S[3]);
  // head: hat brim leads, sunglasses at the front
  rect(13, 2 + b, 19, 5 + b, H[3]); rect(14, 2 + b, 17, 2 + b, H[4]); rect(13, 5 + b, 19, 5 + b, H[2]);
  rect(11, 6 + b, 24, 7 + b, H[3]); rect(11, 7 + b, 24, 7 + b, H[2]); put(24, 6 + b, H[4]); put(24, 7 + b, H[1]);
  rect(14, 8 + b, 19, 12 + b, S[3]); rect(14, 12 + b, 19, 12 + b, S[2]); put(20, 10 + b, S[3]);
  rect(15, 9 + b, 20, 10 + b, K[0]); put(19, 9 + b, "#6f8190"); put(14, 9 + b, K[0]); put(14, 10 + b, S[2]);
  rect(13, 8 + b, 14, 11 + b, HAIR[1]);
  rect(14, 13 + b, 17, 13 + b, S[2]);
}

function mirrorFrame(sheet, fromRow, toRow, frame) {
  for (let y = 0; y < FRAME; y++) for (let x = 0; x < FRAME; x++) {
    const s = ((fromRow * FRAME + y) * sheet.width + frame * FRAME + x) * 4;
    const d = ((toRow * FRAME + y) * sheet.width + frame * FRAME + (FRAME - 1 - x)) * 4;
    for (let c = 0; c < 4; c++) sheet.data[d + c] = sheet.data[s + c];
  }
}

/** Paint the whole 128x128 sheet (RGBA bytes). Deterministic. */
export function paintTravellerSheet() {
  const sheet = newSheet();
  for (let frame = 0; frame < FRAMES; frame++) {
    const [phase, armPhase, bob] = CYCLE[frame];
    for (const [row, kind] of [[0, "front"], [1, "side"], [2, "back"]]) {
      const w = frameWriter(sheet, frame * FRAME, row * FRAME);
      if (kind === "side") paintSide(w, phase, armPhase, bob);
      else { paintFront(w, phase, armPhase, bob, kind === "back"); paintHeadFront(w, bob, kind === "back"); }
      outlineFrame(sheet, frame * FRAME, row * FRAME);
    }
    mirrorFrame(sheet, 1, 3, frame); // facing left = mirrored right (outline mirrors with it)
  }
  return sheet;
}
