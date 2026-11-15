// Wall geometry helpers built from W.wall.pts (closed 32-point polygon). The signed distance is negative inside the wall, positive outside.
// Everything that needs "inside / near the wall / outside the moat" goes through here, so no module keeps its own wall constants.
export function wallGeo(W) {
  if (W._geo) return W._geo;
  const P = W.wall.pts, n = P.length;
  let cx = 0, cz = 0, minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const p of P) { cx += p.x; cz += p.z; minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  cx /= n; cz /= n;
  const sd = (x, z) => {
    let d2 = 1e18, inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const a = P[i], b = P[j], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2)), ex = a.x + dx * t - x, ez = a.z + dz * t - z;
      d2 = Math.min(d2, ex * ex + ez * ez);
      if ((a.z > z) !== (b.z > z) && x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x) inside = !inside;
    }
    return inside ? -Math.sqrt(d2) : Math.sqrt(d2);
  };
  W._geo = { cx, cz, minX, maxX, minZ, maxZ, sd };
  return W._geo;
}
