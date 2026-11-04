// CPU RAF interval collector, not GPU timing, thermal or device FPS certification.
export function createFrameMetrics({ capacity = 240 } = {}) {
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 10_000) throw new RangeError("capacity must be integer between 2 and 10000");
  const samples = [];
  function record(frameMs) {
    if (!Number.isFinite(frameMs) || frameMs <= 0) throw new RangeError("frameMs must be positive and finite");
    samples.push(frameMs);
    if (samples.length > capacity) samples.shift();
  }
  function summary() {
    if (!samples.length) return Object.freeze({ count: 0, p50Ms: null, p95Ms: null, meanMs: null });
    const sorted = [...samples].sort((a, b) => a - b);
    const percentile = p => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
    const meanMs = samples.reduce((sum, t) => sum + t, 0) / samples.length;
    return Object.freeze({ count: sorted.length, p50Ms: percentile(0.5), p95Ms: percentile(0.95), meanMs });
  }
  function reset() { samples.length = 0; }
  return Object.freeze({ record, summary, reset });
}
