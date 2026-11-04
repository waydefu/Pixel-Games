import test from "node:test";
import assert from "node:assert/strict";
import { listGames, validateGame } from "../src/platform/registry.js";
test("the initial catalog is intentionally empty", () => assert.deepEqual(listGames(), []));
test("accepts a safe local entry", () => {
  assert.equal(validateGame({ id: "my-game", title: "遊戲", summary: "簡介", entry: "./games/my-game/index.html" }), true);
});
test("rejects external URL, traversal, and missing metadata", () => {
  const base = { id: "test", title: "遊戲", summary: "簡介", entry: "./games/test/index.html" };
  for (const entry of ["https://example.com/", "../oops", "./games/../../secrets"]) {
    assert.throws(() => validateGame({ ...base, entry }), TypeError);
  }
  assert.throws(() => validateGame({ ...base, title: "" }), TypeError);
});
