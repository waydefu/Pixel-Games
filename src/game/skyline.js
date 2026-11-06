/**
 * Skyline table for the sea's mountain reflection. For every azimuth around a centre point it stores the tangent
 * of the highest terrain elevation angle (height above the waterline / distance). The water shader compares the
 * reflected ray against this table to decide whether the surface mirrors land or sky, without a reflection pass.
 */
export const SKYLINE_BINS = 256;
export const SKYLINE_MAX_TANGENT = 0.8; // table values are normalised by this

export function skylineTangents(heightAt, cx, cz, { bins = SKYLINE_BINS, waterline = 0, maxDistance = 300, step = 1.5 } = {}) {
  if (typeof heightAt !== "function") throw new TypeError("heightAt must be a function");
  const out = new Float32Array(bins);
  for (let i = 0; i < bins; i++) {
    const a = (i / bins) * Math.PI * 2;
    const dx = Math.cos(a), dz = Math.sin(a);
    let tangent = 0;
    for (let d = 4; d <= maxDistance; d += step) {
      const h = heightAt(cx + dx * d, cz + dz * d) - waterline;
      if (h > 0) tangent = Math.max(tangent, h / d);
    }
    out[i] = Math.min(SKYLINE_MAX_TANGENT, tangent);
  }
  return out;
}

/** RGBA8 bytes (red channel carries the normalised tangent) for a 256x1 DataTexture. */
export function skylineBytes(tangents) {
  const bytes = new Uint8Array(tangents.length * 4);
  for (let i = 0; i < tangents.length; i++) {
    bytes[i * 4] = Math.round((tangents[i] / SKYLINE_MAX_TANGENT) * 255);
    bytes[i * 4 + 3] = 255;
  }
  return bytes;
}
