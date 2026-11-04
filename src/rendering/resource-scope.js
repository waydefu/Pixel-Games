// Explicit ownership for geometries, textures, materials and render targets.
// Share a resource between scopes only with a separate ownership policy.
export function createResourceScope() {
  const tracked = new Set();
  let disposed = false;
  function track(resource) {
    if (disposed) throw new Error("resource scope already disposed");
    if (resource === null || typeof resource?.dispose !== "function") throw new TypeError("resource must expose dispose()");
    tracked.add(resource);
    return resource;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    const errors = [];
    for (const resource of [...tracked].reverse()) {
      try { resource.dispose(); } catch (error) { errors.push(error); }
    }
    tracked.clear();
    if (errors.length) throw new AggregateError(errors, "Resource cleanup failed");
  }
  return Object.freeze({ track, dispose, get disposed() { return disposed; }, get count() { return tracked.size; } });
}
