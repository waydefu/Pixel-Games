import test from "node:test";
import assert from "node:assert/strict";
import { createSceneController } from "../src/platform/scene-controller.js";

function scene(name, calls) {
  return {
    enter() { calls.push(name + ":enter"); },
    update() { calls.push(name + ":update"); },
    render() { calls.push(name + ":render"); },
    exit() { calls.push(name + ":exit"); }
  };
}
test("scene is entered, updated, rendered and disposed in order", () => {
  const calls = [];
  const manager = createSceneController();
  manager.switchTo(scene("a", calls));
  manager.update(1 / 60);
  manager.render(0.5);
  manager.switchTo(scene("b", calls));
  manager.switchTo(null);
  assert.deepEqual(calls, ["a:enter", "a:update", "a:render", "a:exit", "b:enter", "b:exit"]);
});
test("invalid scene is rejected before replacing active", () => {
  const manager = createSceneController();
  const previous = scene("a", []);
  manager.switchTo(previous);
  assert.throws(() => manager.switchTo({ enter() {} }), TypeError);
  assert.equal(manager.active, previous);
});
