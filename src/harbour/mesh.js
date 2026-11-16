// Procedural mesh builder: flat-shaded planar faces with metric UVs, per-vertex material layer / tint / AO. A local frame places whole buildings.
import * as THREE from "three";

const v3 = (x = 0, y = 0, z = 0) => [x, y, z];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = a => Math.hypot(a[0], a[1], a[2]);
export const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export class MeshBuilder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.mat = []; this.col = []; this.setFrame(0, 0, 1, 0, 0, 1, 0); this.emissive = false; }
  /** local x -> (ax, az) (flipped if the frame would mirror), local z -> (fx, fz), origin at (cx, y0, cz) */
  setFrame(cx, cz, ax, az, fx, fz, y0) {
    const det = ax * fz - az * fx, s = det < 0 ? -1 : 1;
    this.F = { cx, cz, y0, xx: ax * s, xz: az * s, zx: fx, zz: fz };
  }
  resetFrame() { this.setFrame(0, 0, 1, 0, 0, 1, 0); }
  P(p) { const F = this.F; return [F.cx + p[0] * F.xx + p[2] * F.zx, F.y0 + p[1], F.cz + p[0] * F.xz + p[2] * F.zz]; }
  Nv(n) { const F = this.F; return [n[0] * F.xx + n[2] * F.zx, n[1], n[0] * F.xz + n[2] * F.zz]; }
  get count() { return this.pos.length / 3; }
  /** one triangle with explicit normal and per-vertex (u, v, ao) */
  tri(a, b, c, n, mat, ua, ub, uc, tint, ao) {
    for (const [p, u, o] of [[a, ua, ao[0]], [b, ub, ao[1]], [c, uc, ao[2]]]) {
      const w = this.P(p); this.pos.push(w[0], w[1], w[2]); const nn = this.Nv(n); this.nor.push(nn[0], nn[1], nn[2]);
      this.uv.push(u[0], u[1]); this.mat.push(mat); this.col.push(tint[0], tint[1], tint[2], o);
    }
  }
  /** triangle with per-vertex normals (smooth shading) and explicit uvs: pts[3], nors[3], uvs[3] */
  triN(pts, nors, uvs, mat, tint, ao) {
    for (let i = 0; i < 3; i++) { const w = this.P(pts[i]), nn = this.Nv(nors[i]); this.pos.push(w[0], w[1], w[2]); this.nor.push(nn[0], nn[1], nn[2]); this.uv.push(uvs[i][0], uvs[i][1]); this.mat.push(mat); this.col.push(tint[0], tint[1], tint[2], ao); }
  }
  /** quad p0,p1,p2,p3 counter-clockwise seen from outside. opt: { mat, tint, ao | aoB/aoT, uo, vo, uvs:'wall'|'free', us, vs, flipV } */
  quad(p0, p1, p2, p3, o) {
    const e1 = sub(p1, p0), e2 = sub(p3, p0), n = norm(cross(e1, e2));
    const w = len(e1), h = len(e2);
    const u1 = norm(e1); const vdir = norm(sub(e2, mul(u1, dot(e2, u1))));
    const uo = o.uo || 0, vo = o.vo || 0, us = o.us || 1, vs = o.vs || 1;
    const uv = o.uvFn || (p => [(dot(sub(p, p0), u1) + uo) * us, (dot(sub(p, p0), vdir) + vo) * vs]);
    const t = o.tint || [1, 1, 1], aB = o.aoB ?? o.ao ?? 1, aT = o.aoT ?? o.ao ?? 1;
    this.tri(p0, p1, p2, n, o.mat, uv(p0), uv(p1), uv(p2), t, [aB, aB, aT]);
    this.tri(p0, p2, p3, n, o.mat, uv(p0), uv(p2), uv(p3), t, [aB, aT, aT]);
    void w; void h;
  }
  /** upright quad from the two bottom corner points (ground plane) and height: (a -> b) seen from the side where the normal points */
  wall(a, b, y0, y1, o) { this.quad([a[0], y0, a[2]], [b[0], y0, b[2]], [b[0], y1, b[2]], [a[0], y1, a[2]], o); }
  triFace(a, b, c, o) {
    const n = norm(cross(sub(b, a), sub(c, a))); const e1 = norm(sub(b, a)); const vdir = norm(sub(c, add(a, mul(e1, dot(sub(c, a), e1)))));
    const uo = o.uo || 0, vo = o.vo || 0;
    const uv = o.uvFn || (p => [dot(sub(p, a), e1) + uo, dot(sub(p, a), vdir) + vo]);
    this.tri(a, b, c, n, o.mat, uv(a), uv(b), uv(c), o.tint || [1, 1, 1], [o.ao ?? 1, o.ao ?? 1, o.ao ?? 1]);
  }
  /** axis-aligned (in the local frame) box, faces: +x -x +y -y +z -z. o.faces = string of faces to emit e.g. "+x-x+y+z" */
  box(cx, cy, cz, sx, sy, sz, o) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2, f = o.faces || "+x-x+y-y+z-z";
    const m = (k, oo) => ({ ...o, ...oo });
    if (f.includes("+z")) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], m(0, { aoB: o.aoB ?? o.ao ?? 1, aoT: o.aoT ?? o.ao ?? 1 }));
    if (f.includes("-z")) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], o);
    if (f.includes("+x")) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], o);
    if (f.includes("-x")) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], o);
    if (f.includes("+y")) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], { ...o, aoB: o.ao ?? 1, aoT: o.ao ?? 1 });
    if (f.includes("-y")) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], o);
  }
  /** Oriented beam between two points with square-ish section (w x h), `up` hint. Faces with grain along the beam. */
  beam(a, b, w, h, o) {
    const d = sub(b, a), l = len(d), dir = norm(d);
    let up = o.up || [0, 1, 0]; if (Math.abs(dot(up, dir)) > 0.95) up = [1, 0, 0];
    const side = norm(cross(dir, up)), top = norm(cross(side, dir));
    const hw = w / 2, hh = h / 2;
    const c = (s, t) => add(add(a, mul(side, s * hw)), mul(top, t * hh)), c2 = (s, t) => add(c(s, t), d);
    // faces: four long faces, with u across the face and v along the beam (v = rows -> use quad with p3 along beam)
    const mk = (s0, t0, s1, t1) => this.quad(c(s0, t0), c(s1, t1), c2(s1, t1), c2(s0, t0), { ...o, uo: o.uo || 0, vo: o.vo || 0 });
    const faces = o.faces || "ABCD";
    if (faces.includes("A")) mk(-1, 1, 1, 1);      // top
    if (faces.includes("B")) mk(1, 1, 1, -1);       // side +
    if (faces.includes("C")) mk(1, -1, -1, -1);     // bottom
    if (faces.includes("D")) mk(-1, -1, -1, 1);     // side -
    void l;
  }
  /** vertical cylinder-ish prism with n sides (smooth normals not needed: flat is fine at this size) */
  cyl(cx, y0, cz, r0, r1, h, n, o) {
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
      const p0 = [cx + Math.cos(a0) * r0, y0, cz + Math.sin(a0) * r0], p1 = [cx + Math.cos(a1) * r0, y0, cz + Math.sin(a1) * r0];
      const p2 = [cx + Math.cos(a1) * r1, y0 + h, cz + Math.sin(a1) * r1], p3 = [cx + Math.cos(a0) * r1, y0 + h, cz + Math.sin(a0) * r1];
      this.quad(p1, p0, p3, p2, o);   // outward: wound clockwise in angle so normals point out
    }
    if (o.cap) { const top = [cx, y0 + h, cz]; for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2; this.triFace(top, [cx + Math.cos(a0) * r1, y0 + h, cz + Math.sin(a0) * r1], [cx + Math.cos(a1) * r1, y0 + h, cz + Math.sin(a1) * r1], { ...o, mat: o.capMat ?? o.mat }); } }
  }
  toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("aUv", new THREE.Float32BufferAttribute(this.uv, 2)); g.setAttribute("aMat", new THREE.Float32BufferAttribute(this.mat, 1));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 4));
    g.computeBoundingSphere(); g.computeBoundingBox(); return g;
  }
}
export { v3 };
