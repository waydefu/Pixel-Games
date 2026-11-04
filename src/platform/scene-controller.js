// Transactional synchronous scene changes. For asynchronous loading, preload a
// scene outside the controller, then commit only after assets are available.
export function createSceneController() {
  let active = null;
  const methods = ["enter", "update", "render", "exit"];
  function switchTo(next, context = {}) {
    if (next !== null && (!next || methods.some(method => typeof next[method] !== "function"))) {
      throw new TypeError("scene must implement enter/update/render/exit");
    }
    if (next === active) return;
    const previous = active;
    if (next) {
      try {
        const entered = next.enter(context);
        if (entered && typeof entered.then === "function") throw new TypeError("async enter unsupported: preload before switching");
      } catch (cause) {
        try { next.exit(context); } catch (cleanupError) { throw new AggregateError([cause, cleanupError], "scene enter and rollback failed"); }
        throw cause;
      }
    }
    try {
      if (previous) {
        const exited = previous.exit(context);
        if (exited && typeof exited.then === "function") throw new TypeError("async exit unsupported");
      }
    } catch (cause) {
      if (next) {
        try { next.exit(context); } catch (cleanupError) { throw new AggregateError([cause, cleanupError], "scene exit and rollback failed"); }
      }
      throw cause;
    }
    active = next;
  }
  function update(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError("invalid delta time");
    if (active) active.update(dt);
  }
  function render(alpha) {
    if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) throw new RangeError("invalid interpolation");
    if (active) active.render(alpha);
  }
  return Object.freeze({ switchTo, update, render, get active() { return active; } });
}
