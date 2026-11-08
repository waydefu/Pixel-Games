import test from "node:test";
import assert from "node:assert/strict";
import { movementKey } from "../src/game/input.ts";

test("WASD physical scan codes work with non-Latin IME key values",()=>{
  for(const [code,wanted] of [["KeyW","w"],["KeyA","a"],["KeyS","s"],["KeyD","d"]]){
    assert.equal(movementKey({code,key:"Process"}),wanted);
    assert.equal(movementKey({code,key:"ㄊ"}),wanted);
  }
});
test("arrow keys, shift and virtual keyboard fallback remain supported",()=>{
  for(const [code,key,wanted] of [
    ["ArrowUp","ArrowUp","arrowup"],["ArrowLeft","ArrowLeft","arrowleft"],
    ["ShiftLeft","Shift","shift"],["ShiftRight","Shift","shift"],
    ["Unidentified","w","w"],["","A","a"],
  ])assert.equal(movementKey({code,key}),wanted);
  assert.equal(movementKey({code:"Escape",key:"Escape"}),null);
  assert.equal(movementKey({code:"KeyQ",key:"q"}),null);
});
