import { calculateRenderSize, getQualityPreset } from "./quality.js";

// Renderer-neutral lifecycle and drawing-buffer contract. Works with sync WebGL
// or asynchronously initialized backends. Does not own scene resources or browser loop.
/**
 * Renderer-neutral host. The renderer is provided by an authorized adapter.
 * @param {{
 *   renderer: any, canvas: any, scene: any, camera: any,
 *   quality?: string,
 *   onStatus?: (status: string) => void,
 *   resizeCamera?: (width: number, height: number) => void,
 *   restoreResources?: () => Promise<void>,
 *   effects?: any
 * }} options
 */
export function createRendererPort({
  renderer, canvas, scene, camera, quality = "balanced", onStatus = () => {},
  resizeCamera = () => {}, restoreResources = async () => {}, effects = null,
} = {}) {
  if (!renderer || typeof renderer.render !== "function" && typeof renderer.renderAsync !== "function") {
    throw new TypeError("renderer must expose render() or renderAsync()");
  }
  if (typeof renderer.setSize !== "function" || typeof renderer.setPixelRatio !== "function" || typeof renderer.dispose !== "function") {
    throw new TypeError("renderer must expose size, pixel ratio and disposal methods");
  }
  if (!canvas || typeof canvas.addEventListener !== "function" || typeof canvas.removeEventListener !== "function" || !scene || !camera) {
    throw new TypeError("canvas, scene and camera are required");
  }
  if ([onStatus, resizeCamera, restoreResources].some(fn => typeof fn !== "function")) throw new TypeError("callbacks must be functions");
  getQualityPreset(quality);
  let state = "new";
  let currentQuality = quality;
  let activeCamera = camera;
  let renderScale = 1;
  let postFailed = false;
  let currentSize = null;
  let initialPromise = null;
  let generation = 0;
  function report(next) { state = next; onStatus(next); }

  async function initialize() {
    if (state === "disposed") throw new Error("renderer already disposed");
    if (state === "ready") return;
    if (initialPromise) return initialPromise;
    report("initializing");
    const token = generation;
    initialPromise = (async () => {
      try {
        if (typeof renderer.init === "function") await renderer.init();
        if (state === "disposed" || generation !== token) return;
        renderer.setPixelRatio(1); // setSize receives exact internal pixel dimensions.
        report("ready");
      } catch (error) {
        if (state !== "disposed") report("failed");
        throw error;
      } finally {
        initialPromise = null;
      }
    })();
    return initialPromise;
  }

  function resize(cssWidth, cssHeight, devicePixelRatio = 1) {
    if (state === "disposed") throw new Error("renderer already disposed");
    const next = calculateRenderSize({ cssWidth, cssHeight, devicePixelRatio, quality: currentQuality, renderScale });
    if (!currentSize || next.width !== currentSize.width || next.height !== currentSize.height) {
      renderer.setSize(next.width, next.height, false);
      if (effects && !postFailed) {
        try { effects.setSize(next.width, next.height); }
        catch (error) { failPost("resize", error); }
      }
    }
    resizeCamera(cssWidth, cssHeight); // Camera uses CSS aspect, not drawing buffer aspect.
    currentSize = next;
    return next;
  }

  function setQuality(next) {
    getQualityPreset(next);
    if (state === "disposed") throw new Error("renderer already disposed");
    currentQuality = next;
    if (effects && !postFailed) {
      try { effects.setQuality(next); } catch (error) { failPost("quality", error); }
    }
    if (renderer.shadowMap) renderer.shadowMap.enabled = getQualityPreset(next).shadows;
    return currentQuality;
  }
  function setRenderScale(next) {
    if (!Number.isFinite(next) || next < 0.45 || next > 1) throw new RangeError("render scale must be in [0.45, 1]");
    if (state === "disposed") throw new Error("renderer already disposed");
    renderScale = next;
  }

  function setCamera(next) {
    if(state==="disposed")throw new Error("renderer already disposed");
    if(!next || typeof next.updateProjectionMatrix!=="function")throw new TypeError("camera must support updateProjectionMatrix");
    activeCamera=next;
    if (effects && !postFailed) effects.setCamera(next);
  }
  function failPost(stage, error) {
    postFailed = true;
    console.warn("HD-2D pipeline failed during " + stage + "; falling back to the direct renderer", error);
    try { effects?.onFailure?.(); } catch { /* fallback must never throw */ }
  }
  async function draw(time = 0) {
    if (state !== "ready") return false;
    if (effects && !postFailed) {
      try { if (effects.render(time)) return true; }
      catch (error) { failPost("render", error); }
    }
    if (typeof renderer.renderAsync === "function") await renderer.renderAsync(scene, activeCamera);
    else await renderer.render(scene, activeCamera);
    return true;
  }

  function stats() {
    return Object.freeze({
      calls: renderer.info?.render?.calls ?? null,
      triangles: renderer.info?.render?.triangles ?? null,
      geometries: renderer.info?.memory?.geometries ?? null,
      textures: renderer.info?.memory?.textures ?? null,
    });
  }

  const lost = event => {
    event.preventDefault?.();
    if (state !== "disposed") { generation++; report("lost"); }
  };
  const restored = () => {
    if (state === "disposed") return;
    const token = ++generation;
    report("restoring");
    Promise.resolve().then(() => restoreResources()).then(() => {
      if (state === "restoring" && token === generation) report("ready");
    }).catch(() => {
      if (state !== "disposed" && token === generation) report("failed");
    });
  };
  canvas.addEventListener("webglcontextlost", lost);
  canvas.addEventListener("webglcontextrestored", restored);

  async function dispose() {
    if (state === "disposed") return;
    generation++;
    report("disposed");
    canvas.removeEventListener("webglcontextlost", lost);
    canvas.removeEventListener("webglcontextrestored", restored);
    try { effects?.dispose?.(); } finally { await renderer.dispose(); }
  }

  return Object.freeze({
    initialize, resize, setQuality, setRenderScale, setCamera, draw, stats, dispose,
    setSun(direction) { if (effects && !postFailed) effects.setSun?.(direction); },
    setRayScale(value) { if (effects && !postFailed) effects.setRayScale?.(value); },
    setGrade(values) { if (effects && !postFailed) effects.setGrade?.(values); },
    get state() { return state; },
    get size() { return currentSize; },
    get quality() { return currentQuality; },
    get scale() { return renderScale; },
    get effects() { return !effects ? "off" : postFailed ? "fallback" : "on"; },
  });
}
