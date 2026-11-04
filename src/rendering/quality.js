// Three.js-independent pixel buffer sizing. No UA sniffing or inferred GPU scores.
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

export function calculateRenderSize({ cssWidth, cssHeight, devicePixelRatio = 1, quality = "balanced" }) {
  if (![cssWidth, cssHeight, devicePixelRatio].every(x => Number.isFinite(x) && x > 0)) {
    throw new RangeError("CSS size and DPR must be positive finite numbers");
  }
  const preset = getQualityPreset(quality);
  const pixelRatio = Math.min(devicePixelRatio, preset.maxDpr);
  const requestedWidth = cssWidth * pixelRatio;
  const requestedHeight = cssHeight * pixelRatio;
  const budgetRatio = Math.min(1, Math.sqrt(preset.maxPixels / (requestedWidth * requestedHeight)));
  const width = Math.max(1, Math.floor(requestedWidth * budgetRatio));
  const height = Math.max(1, Math.floor(requestedHeight * budgetRatio));
  return Object.freeze({ width, height, quality, pixelRatio, maxPixels: preset.maxPixels, shadows: preset.shadows, postprocess: preset.postprocess });
}
