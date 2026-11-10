/**
 * Refresh Three.js shadow maps only once for the scene renders in a single game
 * frame. A planar water reflection may render the lit world before the main
 * scene. With WebGLShadowMap.autoUpdate=true, that would redraw the same light
 * shadow map in both renders. The first lit render consumes needsUpdate; later
 * renders reuse the identical map, without changing its resolution or sampling.
 *
 * A cloud-shadow fullscreen pass has no shadow-casting lights, so it will not
 * consume the update before the reflection/scene. Preserve an explicitly
 * managed shadowMap (autoUpdate=false) and the renderer's original setting on
 * errors; this helper must wrap synchronous scene draws only.
 */
export function renderWithSingleShadowUpdate(renderer, draw) {
  const shadowMap = renderer?.shadowMap;
  if (!shadowMap?.enabled || shadowMap.autoUpdate !== true) return draw();
  shadowMap.autoUpdate = false;
  shadowMap.needsUpdate = true;
  try {
    return draw();
  } finally {
    shadowMap.autoUpdate = true;
  }
}
