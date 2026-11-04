// Explicit lifecycle prevents a scene from silently surviving a transition.
export function createSceneController() {
  let active = null;
  function switchTo(next, context = {}) {
    if (next !== null && (!next || ["enter", "update", "render", "exit"].some(method => typeof next[method] !== "function"))) {
      throw new TypeError("scene must implement enter/update/render/exit");
    }
    if (active) active.exit(context);
    active = next;
    if (active) active.enter(context);
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
