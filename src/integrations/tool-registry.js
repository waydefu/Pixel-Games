// In-process routing, NOT an OS sandbox or a credential broker.
// The trusted host must restrict actual filesystem, network, CLI and MCP permissions.
const ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const CAP = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;
const VERSION = /^([0-9]+)\.([0-9]+)\.([0-9]+)(?:-[a-zA-Z0-9.-]+)?$/;
function errorNamed(name, message) { const error = new Error(message); error.name = name; return error; }

export function createToolRegistry({ allowedCapabilities = [] } = {}) {
  if (!Array.isArray(allowedCapabilities) || allowedCapabilities.some(x => typeof x !== "string" || !CAP.test(x))) {
    throw new TypeError("allowedCapabilities must be a list of namespaced capability names");
  }
  const allowed = new Set(allowedCapabilities);
  const providers = new Map();

  function register({ id, version = "1.0.0", handlers, dispose } = {}) {
    if (typeof id !== "string" || !ID.test(id)) throw new TypeError("invalid provider id");
    if (typeof version !== "string" || !VERSION.test(version)) throw new TypeError("invalid version");
    if (!handlers || typeof handlers !== "object" || Array.isArray(handlers)) throw new TypeError("handlers object required");
    if (dispose !== undefined && typeof dispose !== "function") throw new TypeError("dispose must be function");
    if (providers.has(id)) throw new Error("provider already registered: " + id);
    const entries = Object.entries(handlers);
    if (!entries.length) throw new TypeError("at least one capability required");
    const normalized = new Map();
    for (const [capability, raw] of entries) {
      const descriptor = typeof raw === "function" ? { run: raw } : raw;
      if (!CAP.test(capability) || !descriptor || typeof descriptor.run !== "function") throw new TypeError("invalid capability handler: " + capability);
      if (descriptor.validateInput !== undefined && typeof descriptor.validateInput !== "function") throw new TypeError("invalid input validator");
      if (descriptor.validateOutput !== undefined && typeof descriptor.validateOutput !== "function") throw new TypeError("invalid output validator");
      normalized.set(capability, Object.freeze({
        run: descriptor.run, validateInput: descriptor.validateInput, validateOutput: descriptor.validateOutput,
      }));
    }
    providers.set(id, { id, version, handlers: normalized, dispose, active: new Set() });
    return id;
  }
  function list() {
    return Object.freeze([...providers.values()].map(p => Object.freeze({
      id: p.id, version: p.version, capabilities: Object.freeze([...p.handlers.keys()].sort()),
    })).sort((a,b) => a.id.localeCompare(b.id)));
  }
  function providersFor(capability) {
    if (typeof capability !== "string" || !CAP.test(capability)) throw new TypeError("invalid capability");
    return Object.freeze([...providers.values()].filter(p => p.handlers.has(capability)).map(p => p.id).sort());
  }
  async function call({ id, capability, input, signal, timeoutMs = 10000, requiredMajorVersion } = {}) {
    if (typeof capability !== "string" || !CAP.test(capability)) throw new TypeError("invalid capability");
    if (!allowed.has(capability)) throw new Error("capability not allowed by host policy: " + capability);
    const provider = providers.get(id);
    if (!provider) throw new Error("provider not connected: " + String(id));
    const handler = provider.handlers.get(capability);
    if (!handler) throw new Error("provider does not implement: " + capability);
    if (requiredMajorVersion !== undefined && (!Number.isInteger(requiredMajorVersion) || requiredMajorVersion < 0 || Number(provider.version.split(".")[0]) !== requiredMajorVersion)) {
      throw new Error("incompatible adapter major version");
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new RangeError("timeoutMs must be 1..60000");
    if (signal !== undefined && (typeof signal?.addEventListener !== "function" || typeof signal?.removeEventListener !== "function")) throw new TypeError("invalid AbortSignal");
    if (signal?.aborted) throw errorNamed("AbortError", "tool call already aborted");
    if (handler.validateInput && handler.validateInput(input) !== true) throw new TypeError("invalid tool input");
    const controller = new AbortController();
    provider.active.add(controller);
    let timer, onAbort;
    const interrupted = new Promise((_, reject) => {
      onAbort = () => { controller.abort(); reject(errorNamed("AbortError", "tool call aborted")); };
      signal?.addEventListener("abort", onAbort, { once: true });
      timer = setTimeout(() => {
        controller.abort();
        reject(errorNamed("TimeoutError", "tool call timed out"));
      }, timeoutMs);
    });
    try {
      if (signal?.aborted) throw errorNamed("AbortError", "tool call aborted");
      const work = Promise.resolve().then(async () => {
        if (controller.signal.aborted) throw errorNamed("AbortError", "tool call aborted");
        const output = await handler.run(input, { signal: controller.signal });
        if (handler.validateOutput && handler.validateOutput(output) !== true) throw new TypeError("invalid tool output");
        return output;
      });
      return await Promise.race([work, interrupted]);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      provider.active.delete(controller);
    }
  }
  async function unregister(id) {
    const provider = providers.get(id);
    if (!provider) return false;
    providers.delete(id); // revoke new calls before cleanup
    for (const controller of provider.active) controller.abort();
    if (provider.dispose) await provider.dispose();
    return true;
  }
  return Object.freeze({ register, list, providersFor, call, unregister });
}
