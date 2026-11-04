// Use integer CSS scaling when the target fits, fractional fallback on small screens.
export function fitPixelViewport(width, height, logicalWidth, logicalHeight) {
  if (![width, height, logicalWidth, logicalHeight].every(v => Number.isFinite(v) && v > 0)) {
    throw new RangeError("all dimensions must be positive");
  }
  const fit = Math.min(width / logicalWidth, height / logicalHeight);
  const scale = fit >= 1 ? Math.max(1, Math.floor(fit)) : fit;
  const drawWidth = logicalWidth * scale;
  const drawHeight = logicalHeight * scale;
  return Object.freeze({
    x: (width - drawWidth) / 2,
    y: (height - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
    scale,
    logicalWidth,
    logicalHeight,
  });
}
export function screenToLogical(x, y, viewport) {
  if (![x, y].every(Number.isFinite)) return null;
  const nx = (x - viewport.x) / viewport.scale;
  const ny = (y - viewport.y) / viewport.scale;
  if (nx < 0 || ny < 0 || nx >= viewport.logicalWidth || ny >= viewport.logicalHeight) return null;
  return { x: nx, y: ny };
}
