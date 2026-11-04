import test from "node:test";
import assert from "node:assert/strict";
import { createToolRegistry } from "../src/integrations/tool-registry.js";

test("does not execute anything on registration and denies capabilities by default", async () => {
  const registry = createToolRegistry();
  let invoked = 0;
  registry.register({ id: "local-asset", handlers: { "assets.inspect": () => ++invoked } });
  assert.equal(invoked, 0);
  await assert.rejects(registry.call({ id: "local-asset", capability: "assets.inspect" }), /not allowed/);
  assert.equal(invoked, 0);
});

test("explicitly routed provider returns results only for approved capability", async () => {
  const registry = createToolRegistry({ allowedCapabilities: ["assets.inspect"] });
  registry.register({ id: "tiled-importer", version: "1.2.3", handlers: {
    "assets.inspect": async input => ({ inspected: input.path }),
    "assets.write": async () => "unsafe",
  } });
  registry.register({ id: "other-provider", handlers: { "assets.inspect": async () => "other" } });
  assert.deepEqual(registry.providersFor("assets.inspect"), ["other-provider", "tiled-importer"]);
  assert.deepEqual(await registry.call({ id: "tiled-importer", capability: "assets.inspect", input: { path: "sprites.png" } }), { inspected: "sprites.png" });
  await assert.rejects(registry.call({ id: "tiled-importer", capability: "assets.write" }), /not allowed/);
  assert.deepEqual(registry.list().find(x => x.id === "tiled-importer").capabilities, ["assets.inspect", "assets.write"]);
});

test("duplicate provider, malformed id and capability, unknown provider are rejected", async () => {
  const registry = createToolRegistry({ allowedCapabilities: ["qa.capture"] });
  registry.register({ id: "browser-qa", handlers: { "qa.capture": async () => true } });
  assert.throws(() => registry.register({ id: "browser-qa", handlers: { "qa.capture": async () => true } }), /already registered/);
  assert.throws(() => registry.register({ id: "../bad", handlers: { "qa.capture": () => {} } }), /invalid provider/);
  assert.throws(() => registry.register({ id: "bad", handlers: { command: () => {} } }), /invalid capability/);
  assert.throws(() => registry.register({ id: "bad", handlers: { "qa.capture": 10 } }), /invalid capability/);
  await assert.rejects(registry.call({ id: "missing", capability: "qa.capture" }), /not connected/);
  await assert.rejects(registry.call({ id: "browser-qa", capability: "qa.inspect" }), /not allowed/);
  assert.throws(() => createToolRegistry({ allowedCapabilities: ["*"] }), /allowedCapabilities/);
});

test("provider errors propagate; unregister is idempotent and revokes access before cleanup", async () => {
  const registry = createToolRegistry({ allowedCapabilities: ["qa.capture"] });
  let ended = 0;
  registry.register({ id: "qa", handlers: { "qa.capture": async () => { throw Error("tool failed"); } }, dispose: async () => { ended++; } });
  await assert.rejects(registry.call({ id: "qa", capability: "qa.capture" }), /tool failed/);
  assert.equal(await registry.unregister("qa"), true);
  assert.equal(await registry.unregister("qa"), false);
  assert.equal(ended, 1);
  await assert.rejects(registry.call({ id: "qa", capability: "qa.capture" }), /not connected/);

  registry.register({ id: "broken", handlers: { "qa.capture": async () => true }, dispose: async () => { throw Error("cleanup"); } });
  await assert.rejects(registry.unregister("broken"), /cleanup/);
  assert.deepEqual(registry.providersFor("qa.capture"), []);
});
