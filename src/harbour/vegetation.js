// Vegetation: procedural leaf / needle textures baked on the GPU, card-cluster trees (instanced, wind), shader-placed grass + wildflowers around the camera, rocks.
import * as THREE from "three";
import { patch, AU, csmify, SEASON_GLSL } from "./materials.js";
import { MeshBuilder } from "./mesh.js";
import { L, TNOISE_GLSL } from "./textures.js";
import { mulberry32, clamp, smoothstep, makeNoise } from "./util.js";
import { HRECT } from "./water.js";
import { MASK } from "./terrain.js";

// ------------------------------------------------------------------------------------------------ foliage textures
const FOL_FS = /* glsl */`
precision highp float; precision highp int; in vec2 vUv; out vec4 o; uniform int uKind;
uvec2 pcg2d(uvec2 v) { v = v * 1664525u + 1013904223u; v.x += v.y * 1664525u; v.y += v.x * 1664525u; v ^= v >> 16u; v.x += v.y * 1664525u; v.y += v.x * 1664525u; v ^= v >> 16u; return v; }
vec2 h22(vec2 p) { return vec2(pcg2d(uvec2(ivec2(p)))) * (1.0 / 4294967296.0); }
float segD(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
vec4 leafLayer(vec2 uv, float N, float seed, float size, float shade) {
  // one scatter layer of real single leaves: pointed ovate blade, midrib + side veins, lengthwise colour gradient, dark rim, per-leaf tilt-light, tiny nibbles
  vec2 p = uv * N; vec2 ip = floor(p); vec4 best = vec4(0.0); float bz = -1.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = ip + vec2(float(i), float(j)); vec2 h = h22(c + seed), h2 = h22(c + seed + 41.0), h3 = h22(c + seed + 77.0);
    vec2 ctr = c + 0.1 + h * 0.8; float ang = h2.x * 6.2831853, ls = size * (0.8 + 0.4 * h2.y);
    { vec2 cc = ctr / N * 2.0 - 1.0; float r = length(cc); if (h22(c + seed + 113.0).x > smoothstep(1.0, 0.45, r + 0.12 * (h.y - 0.5)) * 1.02) continue; }   // thin out toward the rim so the outline breaks up into single leaves
    vec2 d = p - ctr; float ca = cos(ang), sa = sin(ang); vec2 q = vec2(ca * d.x + sa * d.y, -sa * d.x + ca * d.y) / ls;   // leaf axis = x in [-1,1]
    float t = q.x * 0.5 + 0.5; if (t < 0.0 || t > 1.0) continue;
    float w = 0.42 * pow(sin(3.14159 * pow(t, 0.7)), 0.85) * (1.0 - 0.15 * t); w *= 1.0 + 0.06 * sin(t * 38.0 + h3.x * 6.0);
    float ay = abs(q.y); float a = smoothstep(w, w - 0.07, ay);
    if (a > 0.02 && h3.x > bz) {
      bz = h3.x;
      float rib = smoothstep(0.035, 0.0, ay) * (1.0 - t * 0.6);
      float sv = smoothstep(0.06, 0.0, abs(fract(t * 7.0 - ay * 2.6 + h3.y) - 0.5) - 0.42) * smoothstep(0.0, 0.5 * w, w - ay) * 0.5;
      vec3 lo = vec3(0.05, 0.13, 0.025), hi = mix(vec3(0.20, 0.36, 0.06), vec3(0.30, 0.40, 0.07), h3.y);
      vec3 col = mix(lo, hi, clamp(0.25 + 0.55 * h3.y + 0.35 * t, 0.0, 1.0));
      col = mix(col, vec3(0.34, 0.42, 0.14), rib * 0.55 + sv * 0.25);
      col *= mix(0.6, 1.0, smoothstep(0.0, 0.35 * w + 0.001, w - ay));        // dark rim
      float tilt = 0.7 + 0.6 * h2.y; col *= tilt * shade;
      col = mix(col, vec3(0.3, 0.27, 0.06) * shade, step(0.965, h3.x) * 0.7);   // the odd yellowing leaf
      best = vec4(col, a);
    }
  }
  return best;
}
void main() {
  vec2 uv = vUv; vec4 res = vec4(0.0);
  if (uKind == 0) {            // broadleaf cluster: four layers of real leaves, deepest darkest (built-in self-shadow), irregular outline
    vec4 l0 = leafLayer(uv + 0.13, 15.0, 7.0, 1.05, 0.45), l1 = leafLayer(uv, 19.0, 3.0, 1.0, 0.7), l2 = leafLayer(uv + 0.31, 24.0, 19.0, 0.95, 0.95), l3 = leafLayer(uv + 0.57, 30.0, 51.0, 0.9, 1.2);
    res = l0; res = vec4(mix(res.rgb, l1.rgb, l1.a), max(res.a, l1.a)); res = vec4(mix(res.rgb, l2.rgb, l2.a), max(res.a, l2.a)); res = vec4(mix(res.rgb, l3.rgb, l3.a), max(res.a, l3.a));
    vec2 q0 = uv * 2.0 - 1.0; float rad = length(q0) + 0.16 * (h22(floor(uv * 7.0)).x - 0.5);
    res.a *= 1.0 - smoothstep(0.88, 1.0, rad);
  } else if (uKind == 1) {     // conifer bough: central stem, paired side twigs, each carrying dense short needles in a V
    vec2 p = uv * 2.0 - 1.0; float a = 0.0; vec3 col = vec3(0.02, 0.05, 0.025);
    float ds = segD(p, vec2(0.0, -0.98), vec2(0.0, 0.98)); float st = smoothstep(0.022, 0.01, ds); col = mix(col, vec3(0.16, 0.09, 0.05), st); a = max(a, st);
    for (int i = 0; i < 8; i++) {
      float f = (float(i) + 0.5) / 8.0, y = -0.88 + f * 1.7, len = 0.95 * (1.0 - f * 0.72) * (0.85 + 0.3 * h22(vec2(float(i), 9.0)).x);
      for (int s = -1; s <= 1; s += 2) {
        vec2 A = vec2(0.0, y), B = A + vec2(float(s) * len * 0.92, len * 0.42); vec2 td = normalize(B - A);
        float dt = segD(p, A, B); float tw = smoothstep(0.016, 0.006, dt); col = mix(col, vec3(0.14, 0.08, 0.045), tw); a = max(a, tw);
        if (dt > 0.2) continue;      // needles only reach 0.2 from their twig
        for (int j = 0; j < 10; j++) {
          float u = (float(j) + 0.5) / 10.0; vec2 bp = mix(A, B, u);
          for (int k = -1; k <= 1; k += 2) {
            float ca = cos(float(k) * 1.0), sa = sin(float(k) * 1.0); vec2 nd = vec2(ca * td.x - sa * td.y, sa * td.x + ca * td.y);
            float nl = 0.19 * (1.0 - 0.45 * u); vec2 E = bp + nd * nl; float d = segD(p, bp, E);
            float n = smoothstep(0.015, 0.005, d);
            if (n > 0.0) { float hh = h22(vec2(float(i * 20 + j * 2 + (k + 1) / 2), float(s) + 7.0)).x; vec3 nc = mix(vec3(0.03, 0.085, 0.04), vec3(0.075, 0.17, 0.06), hh) * (0.8 + 0.5 * u); col = mix(col, nc, n); a = max(a, n); }
          }
        }
      }
    }
    res = vec4(col, a * (1.0 - smoothstep(0.88, 1.0, length(p))));
  } else {                     // blossoming leaf cluster: leaves plus five-petal flowers
    vec4 l1 = leafLayer(uv, 13.0, 5.0, 1.0, 1.0), l2 = leafLayer(uv + 0.31, 17.0, 23.0, 0.95, 0.75);
    res = l1; res = vec4(mix(l2.rgb * 0.85, res.rgb, res.a), max(res.a, l2.a));
    vec2 p = uv * 8.0, ip = floor(p);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 c = ip + vec2(float(i), float(j)); vec2 h = h22(c + 61.0), h2 = h22(c + 97.0);
      if (h2.x < 0.45) continue; vec2 ctr = c + 0.2 + 0.6 * h; vec2 d = p - ctr; float ang = atan(d.y, d.x), r = length(d);
      float pet = 0.17 + 0.07 * cos(5.0 * ang + h2.y * 6.28); float a = smoothstep(pet, pet * 0.6, r);
      if (a > 0.02) { vec3 fc = mix(vec3(0.85, 0.35, 0.45), vec3(0.95, 0.92, 0.9), step(0.5, h2.y)); fc = mix(fc, vec3(0.9, 0.75, 0.1), step(0.9, h.x)); fc = mix(fc, vec3(0.95, 0.8, 0.2), smoothstep(0.06, 0.0, r)); res = vec4(mix(res.rgb, fc, a), max(res.a, a)); }
    }
    res.a *= 1.0 - smoothstep(0.62, 0.98, length(uv * 2.0 - 1.0));
  }
  o = res;
}`;

export function bakeFoliage(renderer, size = 1024) {
  const mk = () => new THREE.WebGLRenderTarget(size, size, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, depthBuffer: false });
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const mat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: "out vec2 vUv; void main(){ vUv = position.xy*0.5+0.5; gl_Position = vec4(position.xy,0.,1.); }", fragmentShader: FOL_FS, depthTest: false, depthWrite: false, uniforms: { uKind: { value: 0 } } });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; const scene = new THREE.Scene(); scene.add(mesh); const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const prev = renderer.getRenderTarget(), out = [];
  for (let k = 0; k < 3; k++) {
    const rt = mk(); rt.texture.colorSpace = THREE.SRGBColorSpace; rt.texture.anisotropy = 4; mat.uniforms.uKind.value = k;
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam); out.push(rt);
  }
  renderer.setRenderTarget(prev); geo.dispose(); mat.dispose();
  return { leaf: out[0].texture, needle: out[1].texture, blossom: out[2].texture, rts: out };
}

// ------------------------------------------------------------------------------------------------ tree geometry
export function foliageCards(rnd, centre, R, count, sizeMin, sizeMax, tintBase, shape = "ellipsoid", out) {
  count = Math.round(count * 1.6); sizeMin *= 0.78; sizeMax *= 0.78;   // more, smaller cards: the crown outline stops reading as stacked plates
  for (let i = 0; i < count; i++) {
    // points biased to the surface of an ellipsoid
    const u = rnd(), v = rnd() * 2 - 1, th = u * Math.PI * 2, r = Math.sqrt(1 - v * v), rr = 0.55 + 0.45 * Math.cbrt(rnd());
    const dir = [Math.cos(th) * r, v * (shape === "tall" ? 1.4 : 0.85), Math.sin(th) * r];
    const pos = [centre[0] + dir[0] * R * rr, centre[1] + dir[1] * R * rr, centre[2] + dir[2] * R * rr];
    const n = (() => { const l = Math.hypot(dir[0], dir[1] + 0.25, dir[2]); return [dir[0] / l, (dir[1] + 0.25) / l, dir[2] / l]; })();
    const size = sizeMin + rnd() * (sizeMax - sizeMin);
    // card basis: tangent plane to the normal with random roll
    let t = [-n[2], 0, n[0]]; const tl = Math.hypot(t[0], t[2]) || 1; t = [t[0] / tl, 0, t[2] / tl];
    const b = [n[1] * t[2] - n[2] * t[1], n[2] * t[0] - n[0] * t[2], n[0] * t[1] - n[1] * t[0]];
    const roll = rnd() * Math.PI * 2, c = Math.cos(roll), s = Math.sin(roll);
    const e1 = [t[0] * c + b[0] * s, t[1] * c + b[1] * s, t[2] * c + b[2] * s], e2 = [-t[0] * s + b[0] * c, -t[1] * s + b[1] * c, -t[2] * s + b[2] * c];
    const ao = 0.58 + 0.42 * clamp(rr * 1.05, 0, 1) * (0.7 + 0.3 * (v * 0.5 + 0.5));
    const tint = [tintBase[0] * (0.9 + rnd() * 0.2) * ao, tintBase[1] * (0.9 + rnd() * 0.2) * ao, tintBase[2] * (0.9 + rnd() * 0.2) * ao];
    const base = out.pos.length / 3;
    for (const [su, sv, uu, vv] of [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]]) {
      out.pos.push(pos[0] + (e1[0] * su + e2[0] * sv) * size * 0.5, pos[1] + (e1[1] * su + e2[1] * sv) * size * 0.5, pos[2] + (e1[2] * su + e2[2] * sv) * size * 0.5);
      out.nor.push(n[0], n[1], n[2]); out.uv.push(uu, vv); out.col.push(tint[0], tint[1], tint[2]);
    }
    out.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}
export const FOLIAGE_WIND_BOUNDS = 0.25; // shortcut: 0.25 m covers current shader wind displacement for uWind <= 1; increase if weather exceeds 1.
export function foliageGeometry(out) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(out.pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(out.nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(out.uv, 2)); g.setAttribute("color", new THREE.Float32BufferAttribute(out.col, 3)); g.setIndex(out.idx);
  g.computeBoundingBox(); g.boundingBox.expandByScalar(FOLIAGE_WIND_BOUNDS); g.computeBoundingSphere(); g.boundingSphere.radius += FOLIAGE_WIND_BOUNDS;
  return g;
}
export const newFol = () => ({ pos: [], nor: [], uv: [], col: [], idx: [] });

function trunkMesh(T, rnd, h, r0, branches, crownY, crownR) {
  T.cyl(0, 0, 0, r0, r0 * 0.55, h * 0.8, 8, { mat: L.beam, tint: [0.75, 0.68, 0.6], ao: 1, us: 1, vs: 1 });
  T.cyl(0, 0, 0, r0 * 1.5, r0, 0.5, 8, { mat: L.beam, tint: [0.7, 0.62, 0.55], ao: 0.7 });
  for (let i = 0; i < branches; i++) {
    const a = rnd() * Math.PI * 2 + i * 1.7, l = crownR * (0.55 + rnd() * 0.35), y0 = h * (0.45 + rnd() * 0.3);
    T.beam([0, y0, 0], [Math.cos(a) * l, crownY + (rnd() - 0.3) * crownR * 0.6, Math.sin(a) * l], r0 * 0.55, r0 * 0.55, { mat: L.beam, tint: [0.7, 0.62, 0.55], up: [0, 1, 0], faces: "ABCD", ao: 1 });
  }
}

export function makeTreeVariants(count = 4, quality = 1) {
  const out = { broad: [], pine: [] };
  for (let v = 0; v < count; v++) {
    const rnd = mulberry32(100 + v * 17), h = 5.5 + rnd() * 2.0, R = 3.6 + rnd() * 1.2, crownY = h + R * 0.45;
    const T = new MeshBuilder(), F = newFol();
    trunkMesh(T, rnd, h, 0.26 + rnd() * 0.08, 4 + (v % 3), crownY, R);
    foliageCards(rnd, [0, crownY, 0], R, Math.round(150 * quality), 1.5, 2.6, [1.0 + v * 0.02, 1.0, 0.9 - v * 0.04], "ellipsoid", F);
    for (let i = 0; i < 3; i++) foliageCards(rnd, [Math.cos(i * 2.1 + v) * R * 0.6, crownY - R * 0.25, Math.sin(i * 2.1 + v) * R * 0.6], R * 0.5, Math.round(30 * quality), 1.4, 2.2, [1, 1, 0.9], "ellipsoid", F);
    out.broad.push({ trunk: T.toGeometry(), fol: foliageGeometry(F), h: crownY + R });
  }
  for (let v = 0; v < Math.max(2, count - 1); v++) {
    const rnd = mulberry32(900 + v * 13), h = 11 + rnd() * 5, R = 2.6 + rnd() * 0.5;
    const T = new MeshBuilder(), F = newFol();
    T.cyl(0, 0, 0, 0.28, 0.1, h * 0.95, 7, { mat: L.beam, tint: [0.7, 0.62, 0.55], ao: 1 });
    // layered conical crown
    const layers = Math.round(11 * quality + 3);
    for (let i = 0; i < layers; i++) {
      const t = i / (layers - 1), y = h * (0.22 + 0.74 * t), rad = R * (1 - t * 0.9) + 0.3;
      const per = Math.max(3, Math.round(9 * (1 - t * 0.6) * quality + 2));
      for (let k = 0; k < per; k++) {
        const a = (k / per) * Math.PI * 2 + i * 0.7 + rnd() * 0.3, sz = 2.2 * (1 - t * 0.55) + 0.8;
        const dir = [Math.cos(a), -0.35, Math.sin(a)], pos = [dir[0] * rad * 0.55, y, dir[2] * rad * 0.55];
        const n = (() => { const l = Math.hypot(dir[0], 0.6, dir[2]); return [dir[0] / l, 0.6 / l, dir[2] / l]; })();
        const e1 = [-dir[2], 0, dir[0]], e2 = [dir[0] * 0.94, 0.34, dir[2] * 0.94];
        const ao = 0.5 + 0.5 * (0.5 + 0.5 * t) * (0.6 + 0.4 * (1 - 0.0));
        const base = F.pos.length / 3;
        for (const [su, sv, uu, vv] of [[-1, 0, 0, 0], [1, 0, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]]) { F.pos.push(pos[0] + (e1[0] * su * 0.5 + e2[0] * sv) * sz, pos[1] + (e1[1] * su * 0.5 + e2[1] * sv) * sz, pos[2] + (e1[2] * su * 0.5 + e2[2] * sv) * sz); F.nor.push(n[0], n[1], n[2]); F.uv.push(uu, vv); F.col.push(ao, ao, ao); }
        F.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    out.pine.push({ trunk: T.toGeometry(), fol: foliageGeometry(F), h });
  }
  return out;
}

export function makeFoliageMaterial(tex, csm, kind = "leaf") {
  const mat = new THREE.MeshStandardMaterial({ map: kind === "leaf" ? tex.leaf : kind === "needle" ? tex.needle : tex.blossom, alphaTest: 0.45, alphaToCoverage: !!MSAA.on, side: THREE.DoubleSide, vertexColors: true, roughness: 0.78, metalness: 0 });
  const edit = function foliageEdit(sh) {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float uWind; uniform float uTime;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        { vec3 ip_ = vec3(0.0);
          #ifdef USE_INSTANCING
          ip_ = vec3(instanceMatrix[3].x, 0.0, instanceMatrix[3].z);
          #endif
          #ifdef USE_BATCHING
          ip_ = vec3(batchingMatrix[3].x, 0.0, batchingMatrix[3].z);   // BatchedMesh: the instance transform is batchingMatrix
          #endif
          float ph_ = ip_.x * 0.11 + ip_.z * 0.17; float fl_ = smoothstep(1.5, 9.0, position.y);
          float w1_ = sin(uTime * 1.3 + ph_ + position.y * 0.35) * 0.06, w2_ = sin(uTime * 2.7 + ph_ * 1.7 + position.x * 2.3 + position.z * 1.9) * 0.03;
          transformed.x += (w1_ + w2_) * fl_ * (0.35 + uWind * 1.8); transformed.z += (w1_ * 0.7 - w2_) * fl_ * (0.35 + uWind * 1.8); }`);
    sh.uniforms.uWind = WIND;
  };
  const evg = kind === "needle" ? "1.0" : "0.0";
  const seasonEdit = function foliageSeason(sh) {
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
${SEASON_GLSL}
// share of deciduous leaves still on the tree: bud burst in spring, full summer, shed through autumn, bare in winter
float leafAmt() { return uSeason < 0.5 ? mix(0.2, 1.0, smoothstep(0.0, 0.8, uSeasonT)) : uSeason < 1.5 ? 1.0 : uSeason < 2.5 ? 1.0 - 0.4 * smoothstep(0.0, 0.7, uSeasonT) - 0.6 * smoothstep(0.7, 1.0, uSeasonT) : 0.0; }
vec3 seasonLeafTint(float lr, float evg) {
  vec3 sp = mix(vec3(1.0), mix(vec3(1.3, 1.22, 0.7), vec3(1.0), uSeasonT), 1.0 - evg);
  vec3 au = mix(vec3(1.0), mix(vec3(1.25, 0.95, 0.42), vec3(1.3, 0.5, 0.18), lr), (1.0 - evg) * (0.45 + 0.55 * smoothstep(0.0, 0.5, uSeasonT)));   // colour from the first day of autumn: copper, yellow, brown
  vec3 wi = evg > 0.5 ? vec3(0.5, 0.6, 0.56) : vec3(1.0);   // evergreens dull and blue-grey in winter
  return uSeason < 0.5 ? sp : uSeason < 1.5 ? vec3(1.0) : uSeason < 2.5 ? au : wi;
}`)
      .replace("#include <map_fragment>", `#include <map_fragment>
      { float lr_ = fract(sin(dot(floor(vWPos * 1.2), vec3(12.9898, 78.233, 37.719))) * 43758.5453);   // per leaf clump (~1 m), stable in time
        float evg_ = ${evg};
        if (evg_ < 0.5 && lr_ > leafAmt()) discard;
        diffuseColor.rgb *= seasonLeafTint(lr_, evg_); }`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
      { // translucency: leaves glow yellow-green when the sun is behind them (view direction ~ sun direction); a little at night too
        vec3 Vd_ = normalize(vWPos - uCamW); float bl_ = pow(clamp(dot(Vd_, uSunDirW), 0.0, 1.0), 4.0);
        totalEmissiveRadiance += diffuseColor.rgb * vec3(0.55, 0.7, 0.2) * bl_ * (0.6 - 0.4 * uNight) * 0.7;
        // canopy scatter: light that bounced / passed through the crown fills shaded leaves (otherwise inner leaves go pure black); none at night
        totalEmissiveRadiance += diffuseColor.rgb * vec3(0.38, 0.5, 0.2) * 0.2 * (1.0 - uNight); }`)
      .replace("#include <common>", "#include <common>\nuniform float uNight;");
  };
  patch(mat, (sh) => { edit(sh); seasonEdit(sh); }, "fol" + kind);
  return csm ? csmify(csm, mat) : mat;
}
export const WIND = { value: 0.3 };
export const MSAA = { on: false };
export const setWind = v => { WIND.value = v; };

// ------------------------------------------------------------------------------------------------ placement
