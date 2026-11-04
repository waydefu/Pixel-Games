import { calculateRenderSize, getQualityPreset } from "./quality.js";

// Adapt WebGLRenderer without importing the package at repo root.
// A future approved lab/build can pass `import * as THREE from "three"`.
// Game loop, camera projection, resource ownership and fallback UI remain the caller's jobs.
export function createThreeRendererHost({ THREE, canvas, scene, camera, quality = "balanced", onStatus = () => {} }) {
  if (!THREE || typeof THREE.WebGLRenderer !== "function" || !canvas || typeof canvas.addEventListener !== "function" || typeof canvas.removeEventListener !== "function") {
    throw new TypeError("Three.js WebGLRenderer and an event-capable canvas are required");
  }
  if (!scene || !camera || typeof onStatus !== "function") throw new TypeError("scene, camera and onStatus callback are required");
  const preset = getQualityPreset(quality);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  } catch (cause) {
    throw new Error("Three.js WebGLRenderer initialization failed", { cause });
  }
  renderer.setPixelRatio(1); // Own the exact internal drawing-buffer dimensions.
  if (THREE.SRGBColorSpace !== undefined) renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (renderer.shadowMap) renderer.shadowMap.enabled = preset.shadows;

  let disposed = false;
  let contextLost = false;
  let size = null;
  const lost = event => {
    event.preventDefault?.();
    contextLost = true;
    onStatus("context-lost");
  };
  const restored = () => {
    if (!disposed) {
      contextLost = false;
      onStatus("context-restored");
    }
  };
  canvas.addEventListener("webglcontextlost", lost, false);
  canvas.addEventListener("webglcontextrestored", restored, false);

  function resize(cssWidth, cssHeight, devicePixelRatio = 1) {
    if (disposed) throw new Error("renderer already disposed");
    const next = calculateRenderSize({ cssWidth, cssHeight, devicePixelRatio, quality });
    if (!size || size.width !== next.width || size.height !== next.height) {
      renderer.setSize(next.width, next.height, false);
    }
    size = next;
    return size;
  }

  function render() {
    if (disposed || contextLost) return false;
    renderer.render(scene, camera);
    return true;
  }

  function stats() {
    const info = renderer.info;
    return Object.freeze({
      calls: info?.render?.calls ?? null,
      triangles: info?.render?.triangles ?? null,
      geometries: info?.memory?.geometries ?? null,
      textures: info?.memory?.textures ?? null,
    });
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    canvas.removeEventListener("webglcontextlost", lost, false);
    canvas.removeEventListener("webglcontextrestored", restored, false);
    renderer.dispose();
    onStatus("disposed");
  }

  return Object.freeze({
    resize, render, stats, dispose,
    get state() { return disposed ? "disposed" : contextLost ? "context-lost" : "ready"; },
    get size() { return size; },
  });
}
