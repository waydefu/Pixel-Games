// Explicit in-process capability routing. This is NOT a sandbox, MCP client or permission broker.
// Provider code is supplied by a trusted host; importing this file never launches tools.
const ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const CAPABILITY = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$/;

export function createToolRegistry({ allowedCapabilities = [] } = {}) {
  if (!Array.isArray(allowedCapabilities) || allowedCapabilities.some(name => typeof name !== "string" || !CAPABILITY.test(name))) {
    throw new TypeError("allowedCapabilities must contain namespaced capability names");
  }
  // Immutable policy captured at construction. Only the external trusted host can authorize tools.
  const allow = new Set(allowedCapabilities);
  const providers = new Map();

  function register({ id, version = "1.0.0", handlers, dispose } = {}) {
    if (typeof id !== "string" || !ID.test(id)) throw new TypeError("invalid provider id");
    if (typeof version !== "string" || !VERSION.test(version)) throw new TypeError("invalid adapter version");
    if (!handlers || typeof handlers !== "object" || Array.isArray(handlers)) throw new TypeError("handlers object required");
    const capabilities = Object.keys(handlers);
    if (!capabilities.length) throw new TypeError("at least one capability required");
    for (const capability of capabilities) {
      if (!CAPABILITY.test(capability) || typeof handlers[capability] !== "function") {
        throw new TypeError("invalid capability or handler: " + capability);
      }
    }
    if (dispose !== undefined && typeof dispose !== "function") throw new TypeError("dispose must be a function");
    if (providers.has(id)) throw new Error("provider already registered: " + id);
    const safeHandlers = new Map(capabilities.map(capability => [capability, handlers[capability]]));
    providers.set(id, { id, version, handlers: safeHandlers, dispose });
    return id;
  }

  function list() {
    return Object.freeze([...providers.values()]
      .map(({ id, version, handlers }) => Object.freeze({
        id,
        version,
        capabilities: Object.freeze([...handlers.keys()].sort()),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)));
  }

  function providersFor(capability) {
    if (typeof capability !== "string" || !CAPABILITY.test(capability)) throw new TypeError("invalid capability");
    return Object.freeze([...providers.values()].filter(provider => provider.handlers.has(capability)).map(provider => provider.id).sort());
  }

  async function call({ id, capability, input } = {}) {
    if (typeof capability !== "string" || !CAPABILITY.test(capability)) throw new TypeError("invalid capability");
    if (!allow.has(capability)) throw new Error("capability not allowed by host policy: " + capability);
    const provider = providers.get(id);
    if (!provider) throw new Error("provider not connected: " + String(id));
    const handler = provider.handlers.get(capability);
    if (!handler) throw new Error("provider does not implement: " + capability);
    // Provider failures propagate to the caller; do not convert them into fake success.
    return await handler(input);
  }

  async function unregister(id) {
    const provider = providers.get(id);
    if (!provider) return false;
    providers.delete(id); // Fail closed even if cleanup throws.
    if (provider.dispose) await provider.dispose();
    return true;
  }

  return Object.freeze({ register, list, providersFor, call, unregister });
}
