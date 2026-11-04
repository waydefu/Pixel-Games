// Pure fixed-step clock. The host schedules animation frames; this module does not.
export function createFixedStepClock({ hz = 60, maxFrameMs = 100, maxSteps = 5 } = {}) {
  if (![hz, maxFrameMs, maxSteps].every(Number.isFinite) || hz <= 0 || maxFrameMs <= 0 || !Number.isInteger(maxSteps) || maxSteps < 1) {
    throw new RangeError("invalid clock options");
  }
  const stepMs = 1000 / hz;
  let previous = null;
  let accumulator = 0;
  function frame(now, update, render) {
    if (!Number.isFinite(now)) throw new TypeError("timestamp must be finite");
    if (typeof update !== "function" || typeof render !== "function") throw new TypeError("callbacks required");
    if (previous === null) {
      previous = now;
      render(0);
      return { steps: 0, alpha: 0 };
    }
    const delta = Math.min(Math.max(now - previous, 0), maxFrameMs);
    previous = now;
    accumulator += delta;
    let steps = 0;
    while (accumulator + 1e-9 >= stepMs && steps < maxSteps) {
      update(1 / hz);
      accumulator -= stepMs;
      steps++;
    }
    if (steps === maxSteps && accumulator >= stepMs) accumulator %= stepMs;
    const alpha = Math.max(0, Math.min(1, accumulator / stepMs));
    render(alpha);
    return { steps, alpha };
  }
  function reset() {
    previous = null;
    accumulator = 0;
  }
  return Object.freeze({ frame, reset, stepMs });
}
