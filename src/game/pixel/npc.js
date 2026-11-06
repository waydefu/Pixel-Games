// Villagers and animals, painted texel by texel like the traveller (see character.js): 32x32 frames at 16 texels per
// unit, rows 0 = facing the camera, 1 = facing right, 2 = facing away, 3 = facing left (mirrored), 4 walk frames.
// Pure functions (no Three.js): deterministic, testable in Node.
import { OUTLINE, parseHex } from "./palette.js";

export const NPC_FRAME = 32;
export const NPC_FRAMES = 4;
export const NPC_DIRECTIONS = 4;

/** Villager looks: tunic, trousers (or skirt), hair, optional straw hat, skin tone. */
export const VILLAGERS = Object.freeze([
  Object.freeze({ name: "fishmonger", tunic: "#4f7fa3", legs: "#5b4a3a", hair: "#3a2a1d", skin: "#d9a273", hat: false, skirt: false, apron: "#e8e1d0" }),
  Object.freeze({ name: "farmer", tunic: "#9c6b3d", legs: "#3f4a3a", hair: "#b8863a", skin: "#cf9468", hat: true, skirt: false, apron: null }),
  Object.freeze({ name: "baker", tunic: "#c9b38a", legs: "#6b5640", hair: "#2a1f19", skin: "#e0b088", hat: false, skirt: true, apron: "#f1ebe0" }),
  Object.freeze({ name: "sailor", tunic: "#e7e3d8", legs: "#2f4a66", hair: "#6b4a2a", skin: "#c98f63", hat: false, skirt: false, apron: "#b5412f" }),
  Object.freeze({ name: "elder", tunic: "#6d5a8a", legs: "#4a4a55", hair: "#d9d6cf", skin: "#d5a07a", hat: false, skirt: true, apron: null }),
]);

export const ANIMALS = Object.freeze(["dog", "chicken", "cat"]);

const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
export function shade(hex, f) {
  const [r, g, b] = parseHex(hex);
  return "#" + [r, g, b].map(c => clamp(c * f).toString(16).padStart(2, "0")).join("");
}

function newSheet() {
  const width = NPC_FRAME * NPC_FRAMES, height = NPC_FRAME * NPC_DIRECTIONS;
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

function writer(sheet, ox, oy) {
  const put = (x, y, hex) => {
    if (x < 0 || y < 0 || x >= NPC_FRAME || y >= NPC_FRAME) return;
    const [r, g, b] = parseHex(hex), i = ((oy + y) * sheet.width + ox + x) * 4;
    sheet.data[i] = r; sheet.data[i + 1] = g; sheet.data[i + 2] = b; sheet.data[i + 3] = 255;
  };
  const rect = (x0, y0, x1, y1, hex) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, hex); };
  return { put, rect };
}

function outline(sheet, ox, oy) {
  const [r, g, b] = parseHex(OUTLINE);
  const alpha = (x, y) => x < 0 || y < 0 || x >= NPC_FRAME || y >= NPC_FRAME ? 0 : sheet.data[((oy + y) * sheet.width + ox + x) * 4 + 3];
  const marks = [];
  for (let y = 0; y < NPC_FRAME; y++) for (let x = 0; x < NPC_FRAME; x++) {
    if (alpha(x, y)) continue;
    if (alpha(x - 1, y) || alpha(x + 1, y) || alpha(x, y - 1) || alpha(x, y + 1)) marks.push([x, y]);
  }
  for (const [x, y] of marks) {
    const i = ((oy + y) * sheet.width + ox + x) * 4;
    sheet.data[i] = r; sheet.data[i + 1] = g; sheet.data[i + 2] = b; sheet.data[i + 3] = 255;
  }
}

function mirror(sheet, fromRow, toRow, frame) {
  for (let y = 0; y < NPC_FRAME; y++) for (let x = 0; x < NPC_FRAME; x++) {
    const s = ((fromRow * NPC_FRAME + y) * sheet.width + frame * NPC_FRAME + x) * 4;
    const d = ((toRow * NPC_FRAME + y) * sheet.width + frame * NPC_FRAME + (NPC_FRAME - 1 - x)) * 4;
    for (let c = 0; c < 4; c++) sheet.data[d + c] = sheet.data[s + c];
  }
}

// frame -> [leg phase, arm phase, body bob]
const CYCLE = [[0, 0, 0], [1, 1, 1], [0, 0, 0], [-1, -1, 1]];

function paintVillagerFront({ rect, put }, v, phase, arm, bob, back) {
  const light = shade(v.tunic, 1.18), dark = shade(v.tunic, .78), skinDark = shade(v.skin, .82);
  const legTop = v.skirt ? 26 : 22;
  // legs and shoes
  if (!v.skirt) {
    const lowL = phase === 1 ? 1 : 0, lowR = phase === -1 ? 1 : 0;
    rect(12, 22 + bob, 14, 27 + lowL, v.legs); rect(17, 22 + bob, 19, 27 + lowR, v.legs);
    rect(12, 22 + bob, 12, 27 + lowL, shade(v.legs, .8)); rect(17, 22 + bob, 17, 27 + lowR, shade(v.legs, .8));
    rect(11, 28 + lowL, 14, 29 + lowL, "#2a211b"); rect(17, 28 + lowR, 20, 29 + lowR, "#2a211b");
  } else {
    rect(12, 26, 14, 27 + (phase === 1 ? 1 : 0), skinDark); rect(17, 26, 19, 27 + (phase === -1 ? 1 : 0), skinDark);
    rect(11, 28 + (phase === 1 ? 1 : 0), 14, 29 + (phase === 1 ? 1 : 0), "#2a211b");
    rect(17, 28 + (phase === -1 ? 1 : 0), 20, 29 + (phase === -1 ? 1 : 0), "#2a211b");
    rect(10, 20 + bob, 21, legTop - 1, v.tunic); rect(10, legTop - 1, 21, legTop - 1, dark); // skirt
  }
  // tunic and sleeves
  rect(11, 13 + bob, 20, 21 + bob, v.tunic); rect(11, 13 + bob, 20, 13 + bob, light); rect(11, 21 + bob, 20, 21 + bob, dark);
  rect(9, 14 + bob, 10, 20 + bob + arm, v.tunic); rect(21, 14 + bob, 22, 20 + bob - arm, v.tunic);
  rect(9, 14 + bob, 9, 20 + bob + arm, dark); rect(22, 14 + bob, 22, 20 + bob - arm, dark);
  rect(9, 21 + bob + arm, 10, 22 + bob + arm, v.skin); rect(21, 21 + bob - arm, 22, 22 + bob - arm, v.skin);
  if (v.apron) { rect(13, 16 + bob, 18, 21 + bob, v.apron); rect(13, 16 + bob, 18, 16 + bob, shade(v.apron, .85)); }
  if (!back) put(15, 14 + bob, skinDark), put(16, 14 + bob, skinDark);
  // head
  rect(13, 6 + bob, 18, 12 + bob, v.skin); rect(13, 12 + bob, 18, 12 + bob, skinDark);
  if (!back) {
    put(14, 9 + bob, "#1c1a1a"); put(17, 9 + bob, "#1c1a1a"); put(15, 11 + bob, shade(v.skin, .7)); put(16, 11 + bob, shade(v.skin, .7));
    rect(13, 6 + bob, 18, 7 + bob, v.hair); put(13, 8 + bob, v.hair); put(18, 8 + bob, v.hair);
  } else {
    rect(13, 6 + bob, 18, 11 + bob, v.hair);
  }
  if (v.hat) { rect(10, 5 + bob, 21, 6 + bob, "#d9bf6a"); rect(13, 3 + bob, 18, 4 + bob, "#e6cd7c"); rect(10, 6 + bob, 21, 6 + bob, "#b89a4c"); }
}

function paintVillagerSide({ rect, put }, v, phase, arm, bob) {
  const light = shade(v.tunic, 1.18), dark = shade(v.tunic, .78), skinDark = shade(v.skin, .82);
  const swing = phase * 2;
  if (!v.skirt) {
    rect(14 - swing, 22, 16 - swing, 27, shade(v.legs, .8)); rect(13 - swing, 28, 18 - swing, 29, "#2a211b");
    rect(14 + swing, 22, 16 + swing, 27, v.legs); rect(13 + swing, 28, 18 + swing, 29, "#2a211b"); put(18 + swing, 28, "#3d3128");
  } else {
    rect(14 - swing, 26, 16 - swing, 27, skinDark); rect(14 + swing, 26, 16 + swing, 27, v.skin);
    rect(13 - swing, 28, 18 - swing, 29, "#2a211b"); rect(13 + swing, 28, 18 + swing, 29, "#2a211b");
    rect(11, 20 + bob, 20, 25, v.tunic); rect(11, 25, 20, 25, dark);
  }
  rect(12, 13 + bob, 19, 21 + bob, v.tunic); rect(12, 13 + bob, 19, 13 + bob, light); rect(12, 21 + bob, 19, 21 + bob, dark);
  if (v.apron) rect(17, 16 + bob, 19, 21 + bob, v.apron);
  rect(14 - arm, 14 + bob, 16 - arm, 20 + bob, dark); rect(14 - arm, 21 + bob, 16 - arm, 22 + bob, skinDark);
  rect(14 + arm, 14 + bob, 16 + arm, 20 + bob, v.tunic); rect(14 + arm, 21 + bob, 16 + arm, 22 + bob, v.skin);
  rect(14, 6 + bob, 19, 12 + bob, v.skin); rect(14, 12 + bob, 19, 12 + bob, skinDark); put(20, 9 + bob, v.skin);
  put(18, 9 + bob, "#1c1a1a");
  rect(14, 6 + bob, 19, 7 + bob, v.hair); rect(13, 7 + bob, 15, 11 + bob, v.hair);
  if (v.hat) { rect(11, 5 + bob, 22, 6 + bob, "#d9bf6a"); rect(14, 3 + bob, 19, 4 + bob, "#e6cd7c"); rect(11, 6 + bob, 22, 6 + bob, "#b89a4c"); }
}

export function paintVillagerSheet(look) {
  const v = typeof look === "number" ? VILLAGERS[look % VILLAGERS.length] : look;
  const sheet = newSheet();
  for (let frame = 0; frame < NPC_FRAMES; frame++) {
    const [phase, arm, bob] = CYCLE[frame];
    for (const [row, kind] of [[0, "front"], [1, "side"], [2, "back"]]) {
      const w = writer(sheet, frame * NPC_FRAME, row * NPC_FRAME);
      if (kind === "side") paintVillagerSide(w, v, phase, arm, bob);
      else paintVillagerFront(w, v, phase, arm, bob, kind === "back");
      outline(sheet, frame * NPC_FRAME, row * NPC_FRAME);
    }
    mirror(sheet, 1, 3, frame);
  }
  return sheet;
}

// ---- animals: side view (rows 1/3), and a simplified body for front/back rows. 2 steps repeated over 4 frames. ----
function paintDog({ rect, put }, step) {
  const fur = "#9a6a3c", dark = "#6e4624", light = "#d9b98a";
  rect(9, 18, 20, 23, fur); rect(9, 22, 20, 23, dark); rect(10, 18, 19, 18, light);
  rect(19, 14, 24, 19, fur); rect(24, 16, 26, 18, light); put(26, 16, "#1c1a1a"); put(22, 15, "#1c1a1a");
  rect(19, 12, 20, 15, dark); // ear
  rect(6, 16 - step, 9, 18 - step, fur); // tail wags
  const a = step ? 1 : -1;
  rect(10 + a, 24, 12 + a, 27, dark); rect(17 - a, 24, 19 - a, 27, dark);
  rect(11 - a, 24, 13 - a, 27, fur); rect(16 + a, 24, 18 + a, 27, fur);
}
function paintChicken({ rect, put }, step) {
  const body = "#f1ece0", shadow = "#cfc7b4";
  rect(12, 19, 20, 25, body); rect(12, 24, 20, 25, shadow);
  rect(19, 14, 23, 20, body); rect(21, 12, 22, 13, "#d8402f"); rect(24, 16, 25, 17, "#e6a82e"); put(22, 15, "#1c1a1a");
  rect(9, 18, 12, 23, shadow); // tail
  const a = step ? 1 : 0;
  rect(14 + a, 26, 14 + a, 28, "#d99a2e"); rect(18 - a, 26, 18 - a, 28, "#d99a2e");
  rect(13 + a, 29, 15 + a, 29, "#d99a2e"); rect(17 - a, 29, 19 - a, 29, "#d99a2e");
}
function paintCat({ rect, put }, step) {
  const fur = "#d98b3a", dark = "#a8622a", light = "#f0c999";
  rect(10, 20, 20, 25, fur); rect(10, 24, 20, 25, dark); rect(11, 20, 19, 20, light);
  rect(19, 16, 24, 21, fur); rect(19, 14, 20, 16, fur); rect(23, 14, 24, 16, fur); put(23, 18, "#1c1a1a"); put(21, 18, "#1c1a1a");
  rect(5, 14 - step * 2, 9, 16 - step * 2, fur); rect(4, 12 - step * 2, 6, 14 - step * 2, dark);
  const a = step ? 1 : -1;
  rect(11 + a, 26, 13 + a, 28, dark); rect(17 - a, 26, 19 - a, 28, dark);
}

export function paintAnimalSheet(kind) {
  const painter = { dog: paintDog, chicken: paintChicken, cat: paintCat }[kind];
  if (!painter) throw new RangeError("unknown animal " + kind);
  const sheet = newSheet();
  for (let frame = 0; frame < NPC_FRAMES; frame++) {
    for (const row of [0, 1, 2]) {
      const w = writer(sheet, frame * NPC_FRAME, row * NPC_FRAME);
      painter(w, frame % 2);
      outline(sheet, frame * NPC_FRAME, row * NPC_FRAME);
    }
    mirror(sheet, 1, 3, frame);
  }
  return sheet;
}
