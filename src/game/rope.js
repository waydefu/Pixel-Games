// A fishing line as a Verlet rope: pinned at the rod tip, free (or pinned) at the bobber, sagging under gravity and
// lying on the water where it touches the surface. Pure (no Three.js), deterministic, testable in Node.
export function createRope({ count = 22, gravity = -9.8, damping = .985, iterations = 10 } = {}) {
  if (!(count >= 3)) throw new RangeError("a rope needs at least 3 particles");
  const pos = new Float64Array(count * 3), prev = new Float64Array(count * 3);
  let length = 1;

  /** Lay the rope straight between two points (both positions are [x, y, z]). */
  /** @param {ArrayLike<number>} a @param {ArrayLike<number>} b @param {number|null} [ropeLength] */
  function reset(a, b, ropeLength = null) {
    for (let i = 0; i < count; i++) {
      const f = i / (count - 1);
      for (let c = 0; c < 3; c++) pos[i * 3 + c] = prev[i * 3 + c] = a[c] + (b[c] - a[c]) * f;
    }
    length = ropeLength ?? Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  }

  /**
   * Advance by `dt` seconds. `start` is pinned, `end` is pinned too when given. `ropeLength` is the paid-out line.
   * `floorY` (the water surface) keeps particles from sinking: the line floats and drags.
   */
  /**
   * @param {number} dt
   * @param {ArrayLike<number>} start
   * @param {ArrayLike<number>|null} end
   * @param {number} ropeLength
   * @param {number|null} [floorY]
   */
  function step(dt, start, end, ropeLength, floorY = null) {
    length = ropeLength;
    const sub = Math.max(1, Math.min(8, Math.ceil(dt / (1 / 60)))), h = dt / sub, rest = length / (count - 1);
    for (let s = 0; s < sub; s++) {
      for (let i = 1; i < count - (end ? 1 : 0); i++) {
        for (let c = 0; c < 3; c++) {
          const k = i * 3 + c, v = (pos[k] - prev[k]) * damping;
          prev[k] = pos[k];
          pos[k] += v + (c === 1 ? gravity * h * h : 0);
        }
      }
      for (let c = 0; c < 3; c++) pos[c] = prev[c] = start[c];
      if (end) for (let c = 0; c < 3; c++) pos[(count - 1) * 3 + c] = prev[(count - 1) * 3 + c] = end[c];
      for (let it = 0; it < iterations; it++) {
        for (let i = 0; i < count - 1; i++) {
          const a = i * 3, b = (i + 1) * 3;
          const dx = pos[b] - pos[a], dy = pos[b + 1] - pos[a + 1], dz = pos[b + 2] - pos[a + 2];
          const d = Math.hypot(dx, dy, dz);
          if (d <= rest || d < 1e-9) continue;               // slack is allowed: a rope only resists stretching
          const diff = (d - rest) / d;
          const wa = i === 0 ? 0 : (end || i + 1 < count - 1 ? .5 : .5), wb = i + 1 === count - 1 && end ? 0 : .5;
          const total = wa + wb || 1;
          for (let c = 0; c < 3; c++) {
            const delta = (pos[b + c] - pos[a + c]) * diff;
            pos[a + c] += delta * (wa / total);
            pos[b + c] -= delta * (wb / total);
          }
        }
        for (let c = 0; c < 3; c++) pos[c] = start[c];
        if (end) for (let c = 0; c < 3; c++) pos[(count - 1) * 3 + c] = end[c];
      }
      if (floorY !== null) {
        for (let i = 1; i < count; i++) if (pos[i * 3 + 1] < floorY) {
          pos[i * 3 + 1] = floorY;
          prev[i * 3] = pos[i * 3] - (pos[i * 3] - prev[i * 3]) * .5;      // drag along the water
          prev[i * 3 + 2] = pos[i * 3 + 2] - (pos[i * 3 + 2] - prev[i * 3 + 2]) * .5;
          prev[i * 3 + 1] = pos[i * 3 + 1];
        }
      }
    }
  }

  /** How taut the line is: 0 when slack, growing as the ends are pulled apart past the paid-out length. */
  function tension() {
    const e = (count - 1) * 3;
    const d = Math.hypot(pos[e] - pos[0], pos[e + 1] - pos[1], pos[e + 2] - pos[2]);
    return Math.max(0, (d - length * .98) / Math.max(length, 1e-6));
  }
  const point = (i, out = [0, 0, 0]) => { out[0] = pos[i * 3]; out[1] = pos[i * 3 + 1]; out[2] = pos[i * 3 + 2]; return out; };
  return { count, reset, step, tension, point, positions: pos };
}
