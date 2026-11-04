// Pure drawing buffer constraints. Not a device benchmark or GPU capability detector.
export const QUALITY_PRESETS = Object.freeze({
  basic: Object.freeze({ maxDpr: 1, maxPixels: 900_000, shadows: false, postprocess: false }),
  balanced: Object.freeze({ maxDpr: 1.5, maxPixels: 1_800_000, shadows: true, postprocess: false }),
  high: Object.freeze({ maxDpr: 2, maxPixels: 3_000_000, shadows: true, postprocess: true }),
});
export function getQualityPreset(quality = "balanced") {
  const preset = Object.hasOwn(QUALITY_PRESETS, quality) ? QUALITY_PRESETS[quality] : null;
  if (!preset) throw new RangeError("Unknown quality profile: " + String(quality));
  return preset;
}
export function calculateRenderSize({ cssWidth, cssHeight, devicePixelRatio = 1, quality = "balanced", renderScale = 1 }) {
  if (![cssWidth, cssHeight, devicePixelRatio, renderScale].every(x => Number.isFinite(x) && x > 0) || renderScale > 1) {
    throw new RangeError("CSS dimensions, DPR and renderScale must be finite positive values; scale <= 1");
  }
  const preset = getQualityPreset(quality);
  const pixelRatio = Math.min(devicePixelRatio, preset.maxDpr) * renderScale;
  const requestedWidth = cssWidth * pixelRatio, requestedHeight = cssHeight * pixelRatio;
  const ratio = Math.min(1, Math.sqrt(preset.maxPixels / (requestedWidth * requestedHeight)));
  const width = Math.max(1, Math.floor(requestedWidth * ratio));
  const height = Math.max(1, Math.floor(requestedHeight * ratio));
  return Object.freeze({ width, height, quality, renderScale, pixelRatio, maxPixels: preset.maxPixels, shadows: preset.shadows, postprocess: preset.postprocess });
}

// Opt-in, conservative moving-window controller. Caller decides when to apply.
export function createAdaptiveResolutionController({
  targetMs = 16.67, minScale = 0.6, maxScale = 1, step = 0.1,
  windowSize = 90, cooldownWindows = 2,
} = {}) {
  if (![targetMs, minScale, maxScale, step, windowSize, cooldownWindows].every(Number.isFinite) ||
      targetMs <= 0 || minScale < 0.45 || maxScale > 1 || maxScale < minScale ||
      step <= 0 || step > 0.5 || !Number.isInteger(windowSize) || windowSize < 5 ||
      !Number.isInteger(cooldownWindows) || cooldownWindows < 0) throw new RangeError("invalid adaptive quality options");
  let scale = maxScale, frames = [], cooldown = 0;
  function observe(frameMs) {
    if (!Number.isFinite(frameMs) || frameMs <= 0) throw new RangeError("invalid frame interval");
    frames.push(frameMs);
    if (frames.length < windowSize) return scale;
    const sorted = frames.sort((a, b) => a - b);
    const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
    frames = [];
    if (cooldown > 0) { cooldown--; return scale; }
    if (p95 > targetMs * 1.2) scale = Math.max(minScale, +(scale - step).toFixed(3));
    else if (p95 < targetMs * 0.82) scale = Math.min(maxScale, +(scale + step).toFixed(3));
    cooldown = cooldownWindows;
    return scale;
  }
  function reset() { frames = []; cooldown = 0; }
  return Object.freeze({ observe, reset, get scale() { return scale; } });
}
