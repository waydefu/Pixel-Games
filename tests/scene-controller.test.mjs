import test from "node:test";
import assert from "node:assert/strict";
import { createSceneController } from "../src/platform/scene-controller.js";
function scene(name, calls) {
  return {
    enter() { calls.push(name + ":enter"); },
    update() { calls.push(name + ":update"); },
    render() { calls.push(name + ":render"); },
    exit() { calls.push(name + ":exit"); },
  };
}
test("transactionally enters next scene before unloading previous", () => {
  const log = [], controller = createSceneController();
  controller.switchTo(scene("a", log));
  controller.update(0.02); controller.render(0.5);
  controller.switchTo(scene("b", log)); controller.switchTo(null);
  assert.deepEqual(log, ["a:enter","a:update","a:render","b:enter","a:exit","b:exit"]);
});
test("failed scene initialization cleans candidate, retains active scene", () => {
  const log=[], controller=createSceneController();
  const original=scene("original",log);
  controller.switchTo(original);
  const candidate=scene("candidate", log);
  candidate.enter=()=>{log.push("candidate:enter");throw new Error("asset-load");};
  assert.throws(()=>controller.switchTo(candidate), /asset-load/);
  assert.equal(controller.active, original);
  controller.update(0.1);
  assert.deepEqual(log,["original:enter","candidate:enter","candidate:exit","original:update"]);
});
test("previous exit failure rolls back next and does not commit new scene", () => {
  const log=[], controller=createSceneController();
  const previous=scene("a",log);previous.exit=()=>{log.push("a:failed-exit"); throw Error("exit");};
  controller.switchTo(previous);
  assert.throws(()=>controller.switchTo(scene("b",log)), /exit/);
  assert.equal(controller.active,previous);
  assert.deepEqual(log,["a:enter","b:enter","a:failed-exit","b:exit"]);
});
test("invalid scene rejected without changing active", () => {
  const c=createSceneController(), previous=scene("a",[]);
  c.switchTo(previous);
  assert.throws(()=>c.switchTo({enter(){}}),TypeError);
  assert.equal(c.active,previous);
});
