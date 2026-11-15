// Procedural PBR material bake. Every layer is a tileable recipe (periodic gradient noise, fbm, voronoi) evaluated on the GPU once at start-up
// into two texture arrays: ALBEDO (sRGB) + roughness, and NORMAL(xy) + AO + height. No image files anywhere.
import * as THREE from "three";

export const LAYERS = [
  // name, metres per tile, antiTile
  ["grass", 4.0, 1], ["dirt", 3.0, 1], ["rock", 6.0, 1], ["cobble", 2.4, 0], ["gravel", 2.0, 1], ["sand", 3.0, 1], ["wood", 2.0, 0],
  ["plaster", 2.5, 1], ["clay", 1.6, 0], ["slate", 1.6, 0], ["thatch", 1.5, 0], ["ashlar", 2.4, 0], ["rubble", 3.0, 0], ["beam", 2.0, 0], ["bark", 1.2, 0],
  ["brick", 2.4, 0], ["tileRed2", 1.6, 0], ["birch", 1.2, 0], ["beechbark", 1.2, 0],   // 15 brick (North German Backstein, black-glazed headers), 16 older red roof tile
];
export const L = Object.fromEntries(LAYERS.map((l, i) => [l[0], i]));

const NOISE = /* glsl */`
uvec2 pcg2d(uvec2 v) { v = v * 1664525u + 1013904223u; v.x += v.y * 1664525u; v.y += v.x * 1664525u; v ^= v >> 16u; v.x += v.y * 1664525u; v.y += v.x * 1664525u; v ^= v >> 16u; return v; }
vec2 hash22(vec2 p) { return vec2(pcg2d(uvec2(ivec2(p)))) * (1.0 / 4294967296.0); }
float hash12(vec2 p) { return hash22(p).x; }
vec2 grad(vec2 c, vec2 P) { float a = hash22(mod(c, P)).x * 6.2831853; return vec2(cos(a), sin(a)); }
float gnoise(vec2 p, vec2 P) {
  vec2 i = floor(p), f = fract(p), u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(grad(i, P), f), b = dot(grad(i + vec2(1, 0), P), f - vec2(1, 0)), c = dot(grad(i + vec2(0, 1), P), f - vec2(0, 1)), d = dot(grad(i + vec2(1, 1), P), f - vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 1.41;
}
float fbm(vec2 uv, float P, int oct) { vec2 p = uv * P; float s = 0.0, a = 0.5; for (int i = 0; i < 8; i++) { if (i >= oct) break; s += a * gnoise(p, vec2(P)); p *= 2.0; P *= 2.0; a *= 0.5; } return s / (1.0 - exp2(-float(oct))) * 0.5; }
// periodic voronoi: x = F1, y = F2, z = cell hash
vec3 voro(vec2 uv, float P, float jit) {
  vec2 p = uv * P, ip = floor(p); float f1 = 9.0, f2 = 9.0, id = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = ip + vec2(float(i), float(j)); vec2 cm = mod(c, vec2(P)); vec2 h = hash22(cm);
    vec2 pt = c + 0.5 + (h - 0.5) * jit; float d = distance(p, pt);
    if (d < f1) { f2 = f1; f1 = d; id = hash12(cm + 17.0); } else if (d < f2) f2 = d;
  }
  return vec3(f1, f2, id);
}
vec2 warp(vec2 uv, float P, float amt) { return uv + amt * vec2(gnoise(uv * P + 3.1, vec2(P)), gnoise(uv * P + 11.7, vec2(P))); }
`;

const RECIPES = /* glsl */`
struct M { vec3 a; float r; float h; float ao; float b; };
vec3 srgb(vec3 c) { return pow(c, vec3(2.2)); }

M grass(vec2 uv) {
  M m; float macro = fbm(uv, 3.0, 4) + 0.5, lowv = fbm(uv + 13.1, 6.0, 3) + 0.5;
  float b1 = gnoise(uv * 96.0, vec2(96.0)), b2 = gnoise(uv * vec2(48.0, 192.0), vec2(48.0, 192.0)), b3 = gnoise(uv * 200.0, vec2(200.0));
  float bl = b1 * 0.4 + b2 * 0.35 + b3 * 0.25;
  vec3 g1 = vec3(0.050, 0.115, 0.022), g2 = vec3(0.115, 0.170, 0.040), dry = vec3(0.20, 0.165, 0.065);
  m.a = mix(g1, g2, smoothstep(0.3, 0.7, macro)); m.a = mix(m.a, dry, smoothstep(0.60, 0.85, lowv) * 0.65);
  vec3 cl = voro(uv, 18.0, 1.0); m.a = mix(m.a, vec3(0.06, 0.15, 0.04), step(0.82, cl.z) * smoothstep(0.42, 0.25, cl.x) * 0.8);
  m.a *= 0.62 + 0.75 * smoothstep(-0.35, 0.6, bl);
  m.h = clamp(0.5 + bl * 0.9, 0.0, 1.0); m.ao = mix(0.5, 1.0, smoothstep(-0.5, 0.55, bl)); m.r = 0.84; m.b = 0.55; return m;
}
M dirt(vec2 uv) {
  M m; float n = fbm(uv, 4.0, 5) + 0.5, n2 = fbm(uv + 5.3, 12.0, 3) + 0.5;
  vec3 pv = voro(uv, 30.0, 1.0); float peb = smoothstep(0.30, 0.14, pv.x) * step(0.62, pv.z);
  m.a = mix(vec3(0.115, 0.075, 0.045), vec3(0.20, 0.145, 0.09), n); m.a *= 0.8 + 0.4 * n2;
  m.a = mix(m.a, vec3(0.19, 0.16, 0.12) * (0.55 + 0.6 * pv.z), peb * 0.8);
  float crack = smoothstep(0.06, 0.0, voro(warp(uv, 4.0, 0.06), 6.0, 1.0).y - voro(warp(uv, 4.0, 0.06), 6.0, 1.0).x) * smoothstep(0.55, 0.3, n);
  m.a *= 1.0 - 0.35 * crack;
  m.h = n * 0.6 + peb * 0.35 - crack * 0.25 + n2 * 0.1; m.ao = 1.0 - crack * 0.5; m.r = mix(0.95, 0.8, peb); m.b = 1.2; return m;
}
M rock(vec2 uv) {
  M m; vec2 w = warp(uv, 3.0, 0.07);
  float strata = gnoise(vec2(w.x * 6.0, w.y * 22.0), vec2(6.0, 22.0)) * 0.5 + fbm(w, 5.0, 5);
  float rid = 1.0 - abs(gnoise(w * 7.0, vec2(7.0))); rid = rid * rid;
  vec3 v = voro(warp(uv, 5.0, 0.05), 7.0, 1.0); float joint = smoothstep(0.10, 0.0, v.y - v.x);
  float n = fbm(uv + 2.7, 8.0, 5);
  vec3 c0 = vec3(0.13, 0.12, 0.105), c1 = vec3(0.26, 0.235, 0.20), c2 = vec3(0.19, 0.15, 0.11);
  m.a = mix(c0, c1, smoothstep(-0.25, 0.3, strata + n * 0.7)); m.a = mix(m.a, c2, smoothstep(0.1, 0.5, fbm(uv + 8.1, 3.0, 3) + 0.2) * 0.45);
  m.a *= 1.0 - 0.55 * joint; m.a *= 0.75 + 0.5 * rid;
  m.h = rid * 0.6 + strata * 0.3 - joint * 0.5 + 0.35; m.ao = 1.0 - 0.6 * joint; m.r = 0.88; m.b = 2.6; return m;
}
M cobble(vec2 uv) {
  M m; vec2 w = warp(uv, 6.0, 0.012); vec3 v = voro(w, 14.0, 0.8);
  float edge = v.y - v.x; float stone = smoothstep(0.03, 0.2, edge);
  float dome = pow(clamp(edge * 2.4, 0.0, 1.0), 0.55);
  vec3 c = mix(vec3(0.26, 0.25, 0.23), vec3(0.34, 0.32, 0.29), v.z); c = mix(c, vec3(0.32, 0.25, 0.18), step(0.8, fract(v.z * 7.3)) * 0.4);
  float n = fbm(uv, 28.0, 3) + 0.5; c *= 0.86 + 0.26 * n; float chip = gnoise(uv * 90.0, vec2(90.0)); c *= 0.94 + 0.12 * chip;
  vec3 soil = vec3(0.075, 0.062, 0.045) * (0.7 + 0.6 * fbm(uv + 3.3, 40.0, 2));
  m.a = mix(soil, c, stone); m.h = stone * (0.45 + 0.5 * dome) + n * 0.05; m.ao = mix(0.35, 1.0, stone); m.r = mix(0.95, 0.62 + 0.2 * (1.0 - n), stone); m.b = 1.7; return m;
}
M gravel(vec2 uv) {
  M m; vec3 v = voro(uv, 22.0, 1.0), v2 = voro(uv + 0.3, 41.0, 1.0); float n = fbm(uv, 5.0, 4) + 0.5;
  float peb = smoothstep(0.03, 0.2, v.y - v.x), peb2 = smoothstep(0.03, 0.2, v2.y - v2.x);
  vec3 pc = mix(vec3(0.15, 0.135, 0.115), vec3(0.34, 0.30, 0.25), v.z), pc2 = mix(vec3(0.17, 0.15, 0.12), vec3(0.30, 0.26, 0.2), v2.z);
  m.a = mix(vec3(0.10, 0.08, 0.06), mix(pc2, pc, peb), max(peb, peb2) * 0.9 + 0.1) * (0.75 + 0.5 * n);
  m.h = 0.5 * peb + 0.3 * peb2 + 0.2 * n; m.ao = mix(0.5, 1.0, max(peb, peb2)); m.r = 0.85; m.b = 1.4; return m;
}
M sand(vec2 uv) {
  M m; vec2 w = warp(uv, 3.0, 0.1); float rip = gnoise(vec2(w.x * 9.0 + w.y * 3.0, w.y * 5.0), vec2(9.0, 5.0)); float n = fbm(uv, 16.0, 4) + 0.5;
  m.a = mix(vec3(0.34, 0.27, 0.17), vec3(0.48, 0.40, 0.27), n) * (0.92 + 0.12 * rip);
  float shell = step(0.985, hash12(floor(uv * 90.0))); m.a = mix(m.a, vec3(0.6, 0.55, 0.48), shell);
  m.h = n * 0.4 + rip * 0.3 + 0.3; m.ao = 1.0; m.r = 0.92; m.b = 0.7; return m;
}
M wood(vec2 uv) { // vertical weathered boards
  M m; float cols = 8.0; float bi = floor(uv.x * cols); float bx = fract(uv.x * cols); float hb = hash12(vec2(bi, 3.0));
  float off = hash12(vec2(bi, 9.0)); float y = uv.y + off; float seg = floor(y * 2.0); float hs = hash12(vec2(bi, seg + 20.0));
  vec2 gp = vec2(bi * 5.0 + bx * 0.9, y * 1.0);
  float grain = gnoise(vec2(uv.x * cols * 7.0, uv.y * 3.0 + hb * 10.0), vec2(cols * 7.0, 3.0)) * 0.5 + 0.5; float grain2 = gnoise(vec2(uv.x * cols * 16.0, uv.y * 40.0), vec2(cols * 16.0, 40.0)) * 0.5 + 0.5;
  float n = fbm(uv, 3.0, 4) + 0.5;
  vec3 base = mix(vec3(0.085, 0.052, 0.030), vec3(0.20, 0.135, 0.08), hb * 0.8 + hs * 0.2); base = mix(base, vec3(0.20, 0.18, 0.15), smoothstep(0.5, 0.9, n + hb * 0.3) * 0.5);   // weathered silver patches
  m.a = base * (0.6 + 0.55 * grain + 0.25 * grain2);
  float gap = smoothstep(0.045, 0.0, bx) + smoothstep(0.955, 1.0, bx); float knot = smoothstep(0.1, 0.0, length(vec2((bx - 0.5) * 2.0, fract(y * 2.0 + 0.2) * 2.0 - 1.0) * vec2(1.0, 0.35)) - 0.1) * step(0.7, hs);
  m.a *= 1.0 - 0.7 * gap - 0.45 * knot;
  m.h = 0.6 + 0.2 * grain + 0.15 * grain2 - gap * 0.6; m.ao = 1.0 - gap * 0.7; m.r = 0.78; m.b = 1.0; return m;
}
M beam(vec2 uv) {  // squared oak beam: grain runs along v
  M m; float g = gnoise(vec2(uv.x * 14.0, uv.y * 3.0), vec2(14.0, 3.0)) * 0.5 + 0.5, g2 = gnoise(vec2(uv.x * 40.0, uv.y * 12.0), vec2(40.0, 12.0)) * 0.5 + 0.5;
  float n = fbm(uv, 3.0, 3) + 0.5, crack = smoothstep(0.78, 0.9, gnoise(vec2(uv.x * 6.0, uv.y * 1.0), vec2(6.0, 1.0)) * 0.5 + 0.5);
  m.a = mix(vec3(0.09, 0.06, 0.04), vec3(0.24, 0.17, 0.11), g * 0.6 + g2 * 0.4) * (0.75 + 0.5 * n); m.a *= 1.0 - 0.6 * crack;
  m.h = 0.6 + 0.25 * g2 - crack * 0.4; m.ao = 1.0 - crack * 0.6; m.r = 0.72; m.b = 0.9; return m;
}
M plaster(vec2 uv) {
  M m; float n = fbm(uv, 3.0, 5) + 0.5, n2 = fbm(uv + 4.4, 14.0, 3) + 0.5, stain = smoothstep(0.55, 0.85, fbm(uv * vec2(1.0, 0.5) + 9.0, 2.0, 4) + 0.5);
  vec3 lime = vec3(0.60, 0.565, 0.49); m.a = lime * (0.88 + 0.22 * n) * (0.94 + 0.1 * n2);
  m.a = mix(m.a, vec3(0.30, 0.27, 0.21), stain * 0.55);
  vec3 cr = voro(warp(uv, 4.0, 0.05), 5.0, 1.0); float crack = smoothstep(0.035, 0.0, cr.y - cr.x) * smoothstep(0.45, 0.7, n2);
  m.a *= 1.0 - 0.45 * crack; float grit = gnoise(uv * 130.0, vec2(130.0));
  m.h = n * 0.45 + n2 * 0.3 + grit * 0.12 - crack * 0.35; m.ao = 1.0 - crack * 0.4; m.r = 0.92; m.b = 0.9; return m;
}
M clay(vec2 uv) {
  M m; float rows = 14.0, cols = 8.0; float ry = uv.y * rows; float ri = floor(ry); float fy = fract(ry);
  float xo = uv.x * cols + (mod(ri, 2.0) < 1.0 ? 0.0 : 0.5); float ci = floor(xo); float fx = fract(xo);
  float hs = hash12(vec2(ci, ri) + mod(ri, 2.0) * 0.0); float hs2 = hash12(vec2(ci + 31.0, ri + 7.0));
  float curve = 1.0 - pow(abs(fx - 0.5) * 2.0, 2.0) * 0.25; float shade = smoothstep(0.0, 0.14, fy) * (0.55 + 0.45 * smoothstep(0.15, 0.9, fy)); // under-lap darkening
  float gapx = smoothstep(0.06, 0.0, min(fx, 1.0 - fx)); float edge = smoothstep(0.0, 0.06, fy);
  vec3 c = mix(vec3(0.20, 0.050, 0.030), vec3(0.38, 0.115, 0.065), hs); c = mix(c, vec3(0.26, 0.16, 0.10), step(0.88, hs2) * 0.6);
  float n = fbm(uv, 6.0, 4) + 0.5; c = mix(c, vec3(0.10, 0.14, 0.05), smoothstep(0.62, 0.9, n + hs2 * 0.2) * 0.55);   // moss
  c *= 0.75 + 0.5 * fbm(uv + 2.0, 30.0, 2) + 0.2;
  m.a = c * shade * (1.0 - 0.6 * gapx); m.h = fy * 0.85 * curve * (1.0 - 0.5 * gapx) + hs * 0.08; m.ao = mix(0.25, 1.0, shade * (1.0 - gapx * 0.5)); m.r = 0.68; m.b = 2.2; return m;
}
M slate(vec2 uv) {
  M m; float rows = 11.0, cols = 7.0; float ry = uv.y * rows; float ri = floor(ry); float fy = fract(ry);
  float xo = uv.x * cols + hash12(vec2(ri, 4.0)) * 5.0; float ci = floor(xo); float fx = fract(xo);
  float hs = hash12(vec2(ci, ri + 40.0)); float gap = smoothstep(0.05, 0.0, min(fx, 1.0 - fx));
  float shade = smoothstep(0.0, 0.1, fy) * (0.6 + 0.4 * smoothstep(0.1, 0.8, fy));
  vec3 c = mix(vec3(0.045, 0.05, 0.06), vec3(0.11, 0.12, 0.135), hs); float n = fbm(uv, 7.0, 4) + 0.5; c *= 0.8 + 0.45 * n;
  c = mix(c, vec3(0.12, 0.15, 0.06), smoothstep(0.7, 0.95, n + hs * 0.25) * 0.5);
  float sheen = gnoise(vec2(uv.x * 60.0, uv.y * 8.0), vec2(60.0, 8.0));
  m.a = c * shade * (1.0 - 0.7 * gap) * (0.9 + 0.2 * sheen); m.h = fy * 0.6 * (1.0 - 0.5 * gap) + hs * 0.1; m.ao = mix(0.3, 1.0, shade * (1.0 - gap * 0.5)); m.r = 0.55 + 0.2 * hs; m.b = 1.8; return m;
}
M thatch(vec2 uv) {
  M m; float s1 = gnoise(vec2(uv.x * 70.0, uv.y * 7.0), vec2(70.0, 7.0)), s2 = gnoise(vec2(uv.x * 160.0, uv.y * 20.0), vec2(160.0, 20.0)), s3 = gnoise(vec2(uv.x * 36.0, uv.y * 4.0), vec2(36.0, 4.0));
  float layer = fract(uv.y * 6.0 + gnoise(vec2(uv.x * 5.0, 1.0), vec2(5.0, 1.0)) * 0.15); float lay = smoothstep(0.0, 0.25, layer);
  float n = fbm(uv, 4.0, 4) + 0.5;
  vec3 gold = vec3(0.30, 0.215, 0.095), brown = vec3(0.12, 0.075, 0.035); vec3 c = mix(brown, gold, smoothstep(-0.4, 0.7, s1 * 0.5 + s3 * 0.3 + n * 0.5));
  c = mix(c, vec3(0.09, 0.11, 0.045), smoothstep(0.7, 0.95, n) * 0.5); m.a = c * (0.6 + 0.6 * lay) * (0.85 + 0.3 * s2);
  m.h = 0.45 + 0.25 * s1 + 0.2 * s2 + lay * 0.25; m.ao = 0.55 + 0.45 * lay; m.r = 0.95; m.b = 1.1; return m;
}
M ashlar(vec2 uv) {
  M m; float rows = 6.0; float ry = uv.y * rows; float ri = floor(ry); float fy = fract(ry);
  float len = 2.0 + floor(hash12(vec2(ri, 1.0)) * 2.0); float xo = uv.x * 4.0 * (len / 3.0) + hash12(vec2(ri, 2.0)) * 7.0; float ci = floor(xo); float fx = fract(xo);
  // keep periodicity by snapping column count to an integer per row
  float cnt = len * 2.0; xo = uv.x * cnt + hash12(vec2(ri, 2.0)) * cnt; ci = floor(xo); fx = fract(xo);
  float hs = hash12(vec2(mod(ci, cnt), ri + 50.0)); float mort = smoothstep(0.035, 0.0, min(fx, 1.0 - fx) * 0.5) + smoothstep(0.05, 0.0, min(fy, 1.0 - fy));
  mort = clamp(mort, 0.0, 1.0);
  vec3 c = mix(vec3(0.20, 0.185, 0.16), vec3(0.40, 0.37, 0.32), hs); c = mix(c, vec3(0.36, 0.30, 0.22), step(0.85, hs) * 0.5);
  float n = fbm(uv, 8.0, 5) + 0.5, grit = gnoise(uv * 110.0, vec2(110.0)); c *= 0.75 + 0.5 * n; c *= 0.93 + 0.14 * grit;
  float weather = smoothstep(0.55, 0.9, fbm(uv + 6.0, 3.0, 4) + 0.5); c = mix(c, vec3(0.08, 0.10, 0.06), weather * 0.35 * (1.0 - fy));
  vec3 mc = vec3(0.30, 0.28, 0.24) * (0.7 + 0.4 * n); m.a = mix(c, mc * 0.7, mort);
  m.h = (1.0 - mort) * (0.6 + 0.2 * n + 0.1 * grit) + mort * 0.12; m.ao = 1.0 - 0.7 * mort; m.r = mix(0.86, 0.95, mort); m.b = 1.6; return m;
}
M rubble(vec2 uv) {
  M m; vec2 w = warp(uv, 4.0, 0.045); vec3 v = voro(w, 5.0, 0.9); float edge = v.y - v.x; float st = smoothstep(0.03, 0.2, edge);
  vec3 c = mix(vec3(0.15, 0.14, 0.125), vec3(0.37, 0.34, 0.29), v.z); c = mix(c, vec3(0.28, 0.2, 0.14), step(0.86, fract(v.z * 5.7)) * 0.5);
  float n = fbm(uv, 12.0, 4) + 0.5; c *= 0.7 + 0.55 * n; c = mix(c, vec3(0.08, 0.11, 0.05), smoothstep(0.65, 0.9, fbm(uv + 3.0, 4.0, 3) + 0.5) * 0.45);
  m.a = mix(vec3(0.12, 0.105, 0.085), c, st); m.h = st * (0.4 + 0.6 * pow(clamp(edge * 2.0, 0.0, 1.0), 0.5)) + n * 0.05; m.ao = mix(0.3, 1.0, st); m.r = 0.9; m.b = 2.3; return m;
}
M bark(vec2 uv) {  // vertical furrowed bark: ridged noise stretched along v, with plates and lichen
  M m; vec2 w = vec2(uv.x + 0.03 * gnoise(uv * vec2(4.0, 6.0), vec2(4.0, 6.0)), uv.y);
  float r1 = 1.0 - abs(gnoise(vec2(w.x * 12.0, w.y * 3.0), vec2(12.0, 3.0))), r2 = 1.0 - abs(gnoise(vec2(w.x * 26.0 + 3.0, w.y * 7.0), vec2(26.0, 7.0)));
  float rid = r1 * r1 * 0.65 + r2 * r2 * 0.35; float n = fbm(uv + 4.0, 5.0, 4) + 0.5;
  vec3 base = mix(vec3(0.085, 0.07, 0.056), vec3(0.24, 0.205, 0.17), smoothstep(0.25, 0.95, rid)); base *= 0.82 + 0.36 * n;
  float lichen = smoothstep(0.62, 0.85, fbm(uv * vec2(1.0, 0.6) + 9.0, 4.0, 3) + 0.5) * 0.6; base = mix(base, vec3(0.13, 0.16, 0.08), lichen * smoothstep(0.3, 0.8, rid));
  m.a = base; m.h = rid; m.ao = mix(0.35, 1.0, smoothstep(0.2, 0.9, rid)); m.r = 0.92; m.b = 3.0; return m;
}
// North German brick: running bond, 24 courses x 12 bricks per 2.4 m tile (brick ~0.2 m x 0.1 m), black-glazed headers, weathering, lime mortar.
M brickGen(vec2 uv, float rows, float cols, float tone, float glazeP, float wear) {
  M m; float ry = uv.y * rows; float ri = floor(ry); float fy = fract(ry); float rm = mod(ri, rows);
  float off = mod(ri, 2.0) * 0.5; float xo = uv.x * cols + off; float ci = floor(xo); float fx = fract(xo); float cm = mod(ci, cols);
  float hs = hash12(vec2(cm, rm) + 3.0), hs2 = hash12(vec2(cm + 9.0, rm + 21.0));
  float jx = smoothstep(0.0, 0.07, min(fx, 1.0 - fx)), jy = smoothstep(0.0, 0.1, min(fy, 1.0 - fy));
  float brick = jx * jy;
  // header courses: every 6th course gets black-glazed headers in a diamond pattern
  float glaze = step(1.0 - glazeP, hs2);
  float hdr = step(5.5, mod(rm, 6.0));   // every 6th course: black-glazed header bricks in a sparse diamond pattern
  glaze = max(glaze, hdr * step(0.9, hs2) * step(0.45, fx));
  float n = fbm(uv, 6.0, 4) + 0.5, g = gnoise(uv * 90.0, vec2(90.0));
  vec3 red = mix(vec3(0.34, 0.12, 0.07), vec3(0.50, 0.21, 0.12), hs * 0.8 + n * 0.25) * tone;   // fired-clay orange-brown, less saturated than before
  red *= 0.85 + 0.25 * g;
  vec3 blk = vec3(0.035, 0.03, 0.03) * (0.8 + 0.4 * hs2);
  vec3 c = mix(red, blk, glaze);
  // weathering: lighter efflorescence patches and darker soot/moss near the bottom of each course
  float eff = smoothstep(0.62, 0.9, fbm(uv + 13.0, 5.0, 3) + 0.5) * wear;
  c = mix(c, vec3(0.30, 0.28, 0.25), eff * 0.5 * (1.0 - glaze));
  c *= 1.0 - 0.25 * wear * smoothstep(0.7, 0.0, fy);
  vec3 mort = vec3(0.42, 0.39, 0.34) * (0.8 + 0.3 * n);
  m.a = mix(mort, c, brick); m.h = brick * (0.75 + 0.2 * hs + 0.05 * g) * (0.9 + 0.1 * smoothstep(0.0, 0.2, fx * (1.0 - fx))) + (1.0 - brick) * 0.1;
  m.ao = mix(0.45, 1.0, brick); m.r = mix(0.95, 0.5 + 0.3 * hs, brick); m.b = 2.0; return m;
}
M brick(vec2 uv) { return brickGen(uv, 24.0, 12.0, 1.0, 0.015, 0.35); }
M tileRed2(vec2 uv) {   // older red roof tile: fewer, more worn, more lichen and mottling; purplish brown
  M m; float rows = 11.0, cols = 6.0; float ry = uv.y * rows; float ri = floor(ry); float fy = fract(ry);
  float xo = uv.x * cols + (mod(ri, 2.0) < 1.0 ? 0.0 : 0.5); float ci = floor(xo); float fx = fract(xo);
  float cm = mod(ci, cols), hs = hash12(vec2(cm, ri) + 5.0), hs2 = hash12(vec2(cm + 31.0, ri + 7.0));
  float curve = 1.0 - pow(abs(fx - 0.5) * 2.0, 2.0) * 0.25; float shade = smoothstep(0.0, 0.14, fy) * (0.5 + 0.5 * smoothstep(0.15, 0.9, fy));
  float gapx = smoothstep(0.08, 0.0, min(fx, 1.0 - fx));
  vec3 c = mix(vec3(0.22, 0.055, 0.04), vec3(0.34, 0.09, 0.05), hs); c = mix(c, vec3(0.20, 0.13, 0.12), step(0.8, hs2) * 0.5);
  float n = fbm(uv, 5.0, 4) + 0.5; c = mix(c, vec3(0.13, 0.16, 0.07), smoothstep(0.55, 0.85, n + hs2 * 0.2) * 0.7);   // lichen patches
  c *= 0.7 + 0.5 * fbm(uv + 4.0, 24.0, 2) + 0.15;
  m.a = c * shade * (1.0 - 0.6 * gapx); m.h = fy * 0.8 * curve * (1.0 - 0.5 * gapx) + hs * 0.12; m.ao = mix(0.25, 1.0, shade * (1.0 - gapx * 0.5)); m.r = 0.8; m.b = 2.0; return m;
}
M birch(vec2 uv) {   // Betula: chalk-white papery bark, dark horizontal lenticels, peeling curls, black fissures at the base
  M m; float n = fbm(uv + 2.0, 5.0, 4) + 0.5, g = fbm(uv * vec2(1.0, 4.0) + 7.0, 6.0, 3) + 0.5;
  vec3 base = mix(vec3(0.55, 0.53, 0.48), vec3(0.78, 0.76, 0.71), smoothstep(0.25, 0.8, n)); base *= 0.9 + 0.2 * g;
  vec2 p = vec2(uv.x * 7.0, uv.y * 22.0 + 1.7 * gnoise(uv * 6.0, vec2(6.0))); vec2 ci = floor(p); vec2 f = fract(p);
  float hh = hash12(ci), hl = hash12(ci + 17.0);
  float len = mix(0.35, 0.9, hl), dash = smoothstep(0.5 - 0.2, 0.5 - 0.07, abs(f.y - 0.5)) * 0.0;
  float dy = smoothstep(0.17, 0.05, abs(f.y - 0.5)), dx = smoothstep(len * 0.5, len * 0.5 - 0.15, abs(f.x - 0.5)); float lent = dy * dx * step(0.35, hh);
  base = mix(base, vec3(0.045, 0.04, 0.035), lent * 0.92);
  float curl = smoothstep(0.7, 0.85, fbm(uv * vec2(1.5, 0.8) + 21.0, 5.0, 3) + 0.5); base = mix(base, vec3(0.62, 0.47, 0.33), curl * 0.5);
  m.a = base; m.h = 0.5 + 0.3 * lent + 0.15 * curl + 0.1 * n; m.ao = 1.0 - 0.45 * lent; m.r = mix(0.6, 0.9, lent); m.b = 1.2; return m;
}
M beechbark(vec2 uv) {   // Fagus: smooth pewter-grey bark with fine wrinkles, pale lichen mottling, faint horizontal eyebrow creases
  M m; float n = fbm(uv + 5.0, 3.0, 4) + 0.5, w = gnoise(vec2(uv.x * 5.0, uv.y * 30.0), vec2(5.0, 30.0)) * 0.5 + 0.5;
  vec3 base = mix(vec3(0.22, 0.215, 0.20), vec3(0.36, 0.35, 0.32), n); base *= 0.9 + 0.2 * w;
  float lich = smoothstep(0.55, 0.8, fbm(uv * 2.0 + 13.0, 6.0, 4) + 0.5); base = mix(base, vec3(0.46, 0.5, 0.4), lich * 0.45);
  float moss = smoothstep(0.7, 0.9, fbm(uv * vec2(1.0, 0.5) + 31.0, 3.0, 3) + 0.5); base = mix(base, vec3(0.14, 0.22, 0.08), moss * 0.5);
  m.a = base; m.h = 0.5 + 0.2 * w + 0.1 * n; m.ao = 0.7 + 0.3 * w; m.r = 0.8; m.b = 0.8; return m;
}
M evalLayer(int id, vec2 uv) {
  if (id == 0) return grass(uv); if (id == 1) return dirt(uv); if (id == 2) return rock(uv); if (id == 3) return cobble(uv); if (id == 4) return gravel(uv);
  if (id == 5) return sand(uv); if (id == 6) return wood(uv); if (id == 7) return plaster(uv); if (id == 8) return clay(uv); if (id == 9) return slate(uv);
  if (id == 10) return thatch(uv); if (id == 11) return ashlar(uv); if (id == 12) return rubble(uv); if (id == 13) return beam(uv); if (id == 14) return bark(uv); if (id == 15) return brick(uv); if (id == 17) return birch(uv); if (id == 18) return beechbark(uv); return tileRed2(uv);
}
`;

const BAKE_FS = /* glsl */`
precision highp float; precision highp int; in vec2 vUv; layout(location = 0) out vec4 o;
uniform int uLayer; uniform int uPass; uniform float uTexel;
${NOISE}
${RECIPES}
void main() {
  vec2 uv = vUv;
  M m = evalLayer(uLayer, uv);
  if (uPass == 0) { o = vec4(m.a, m.r); return; }
  float e = uTexel * 1.0;
  float hx = evalLayer(uLayer, uv + vec2(e, 0.0)).h, hy = evalLayer(uLayer, uv + vec2(0.0, e)).h;
  vec2 g = vec2(m.h - hx, m.h - hy) / e * (m.b / 512.0) * 3.0;
  vec3 n = normalize(vec3(g, 1.0));
  o = vec4(n.xy * 0.5 + 0.5, m.ao, m.h);
}`;

export function bakeTextures(renderer, size = 512) {
  const n = LAYERS.length;
  const mk = (srgb) => {
    const rt = new THREE.WebGLArrayRenderTarget(size, size, n, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, depthBuffer: false, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });
    rt.texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; rt.texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return rt;
  };
  const A = mk(true), Nn = mk(false);
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const mat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: "out vec2 vUv; void main(){ vUv = position.xy*0.5+0.5; gl_Position = vec4(position.xy,0.,1.); }", fragmentShader: BAKE_FS, depthTest: false, depthWrite: false, uniforms: { uLayer: { value: 0 }, uPass: { value: 0 }, uTexel: { value: 1 / size } } });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; const scene = new THREE.Scene(); scene.add(mesh); const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const prev = renderer.getRenderTarget();
  for (let i = 0; i < n; i++) {
    mat.uniforms.uLayer.value = i;
    mat.uniforms.uPass.value = 0; renderer.setRenderTarget(A, i); renderer.render(scene, cam);
    mat.uniforms.uPass.value = 1; renderer.setRenderTarget(Nn, i); renderer.render(scene, cam);
  }
  renderer.setRenderTarget(prev);
  geo.dispose(); mat.dispose();
  return { albedo: A.texture, normal: Nn.texture, scales: LAYERS.map(l => l[1]), anti: LAYERS.map(l => l[2]), rts: [A, Nn] };
}

// ---------------------------------------------------------------------------------------------------------------- shader-side sampling
export const TNOISE_GLSL = /* glsl */`
float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(tHash(i), tHash(i + vec2(1, 0)), f.x), mix(tHash(i + vec2(0, 1)), tHash(i + vec2(1, 1)), f.x), f.y); }
`;
export const SURF_GLSL = /* glsl */`
uniform highp sampler2DArray uTexA; uniform highp sampler2DArray uTexN; uniform float uTexScale[${LAYERS.length}]; uniform float uTexAnti[${LAYERS.length}];
struct Surf { vec3 alb; float rough; vec3 n; float ao; float h; };
${TNOISE_GLSL}
// uvm in metres. Anti-tiling: second tap rotated/scaled, blended by a low-frequency noise.
Surf sampleSurf(float id, vec2 uvm) {
  int ii = int(id + 0.5); vec2 uv = uvm / uTexScale[ii];
  vec4 a = texture(uTexA, vec3(uv, id)), n = texture(uTexN, vec3(uv, id));
  if (uTexAnti[ii] > 0.5) {
    vec2 uv2 = mat2(0.8, 0.6, -0.6, 0.8) * uv * 1.37 + vec2(0.37, 0.11);
    vec4 a2 = texture(uTexA, vec3(uv2, id)), n2 = texture(uTexN, vec3(uv2, id));
    float w = smoothstep(0.35, 0.65, tNoise(uvm * 0.21 + id * 7.0));
    // rotate the second normal back into the first frame (approximate: rotation of xy by the inverse angle)
    vec2 nn2 = n2.xy * 2.0 - 1.0; nn2 = mat2(0.8, -0.6, 0.6, 0.8) * nn2; n2.xy = nn2 * 0.5 + 0.5;
    a = mix(a, a2, w); n = mix(n, n2, w);
  }
  Surf s; s.alb = a.rgb; s.rough = a.a; s.n = vec3((n.xy * 2.0 - 1.0), 0.0); s.n.z = sqrt(max(0.0, 1.0 - dot(s.n.xy, s.n.xy))); s.ao = n.z; s.h = n.w; return s;
}
mat3 surfTBN(vec3 N, vec3 p, vec2 uv) {
  vec3 dp1 = dFdx(p), dp2 = dFdy(p); vec2 duv1 = dFdx(uv), duv2 = dFdy(uv);
  vec3 dp2perp = cross(dp2, N), dp1perp = cross(N, dp1);
  vec3 T = dp2perp * duv1.x + dp1perp * duv2.x, B = dp2perp * duv1.y + dp1perp * duv2.y;
  float inv = inversesqrt(max(max(dot(T, T), dot(B, B)), 1e-12)); return mat3(T * inv, B * inv, N);
}
`;

export function surfUniforms(tex) {
  return { uTexA: { value: tex.albedo }, uTexN: { value: tex.normal }, uTexScale: { value: tex.scales }, uTexAnti: { value: tex.anti } };
}
