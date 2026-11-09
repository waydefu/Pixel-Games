import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CLOUD_COMMON, CLOUD_FRAG, CLOUD_SHADOW_FRAG, CLOUD_VERT, CLOUD_SHADOW_VERT } from "../src/game/cloud-shader.ts";
import { GENERA } from "../src/game/cloud-genera.js";

const read = p => readFileSync(new URL("../src/game/" + p, import.meta.url), "utf8");
const balanced = (text, open, close) => { let d = 0; for (const c of text) { if (c === open) d++; if (c === close) d--; if (d < 0) return false; } return d === 0; };
const arrayOf = name => { const m = CLOUD_COMMON.match(new RegExp("const (?:float|int) " + name + "\\[10\\]=(?:float|int)\\[10\\]\\(([^)]*)\\)")); assert.ok(m, name); return m[1].split(",").map(Number); };

test("both shaders are balanced and use no reserved GLSL identifiers", () => {
  for (const [name, src] of [["sky", CLOUD_FRAG], ["shadow", CLOUD_SHADOW_FRAG], ["vert", CLOUD_VERT], ["shadow vert", CLOUD_SHADOW_VERT]]) {
    assert.ok(balanced(src, "{", "}"), name + " braces");
    assert.ok(balanced(src, "(", ")"), name + " parens");
    assert.ok(balanced(src, "[", "]"), name + " brackets");
  }
  // 'patch' once stopped the whole sky compiling; keep the other reserved words out as identifiers too
  for (const word of ["patch", "sample", "common", "partition", "active", "filter", "input", "output", "superp", "noinline"]) {
    assert.doesNotMatch(CLOUD_COMMON + CLOUD_FRAG, new RegExp("\\b(?:float|vec[234]|int|bool)\\s+" + word + "\\b"), word);
  }
});

test("the sky and the ground shadow draw the same layers: one shared block, one layer evaluator", () => {
  assert.ok(CLOUD_FRAG.includes(CLOUD_COMMON), "the sky includes the shared block");
  assert.ok(CLOUD_SHADOW_FRAG.includes(CLOUD_COMMON), "the shadow includes the shared block");
  assert.match(CLOUD_COMMON, /vec2 evalLayer\(int id,vec2 P,vec2 ldir,int Q,out float alpha\)/);
  assert.match(CLOUD_FRAG, /evalLayer\(ID,cameraPosition\.xz\+layerPlane\*LH\[ID\]/);
  assert.match(CLOUD_SHADOW_FRAG, /evalLayer\(ID,ground\+layerOff\*LH\[ID\]/);
  // the shadow has no lighting and no sky uniforms
  assert.match(CLOUD_SHADOW_FRAG, /gNeedLit=false/);
  assert.doesNotMatch(CLOUD_SHADOW_FRAG, /uTwilight|uWeatherDark|paintCloud\(/);
});

test("the layer tables cover all ten genera, in cloud-genera order, with sensible heights and cell sizes", () => {
  // both shaders draw every genus once, unrolled with constant ids, lowest layer first
  const unrolled = (src, macro) => [...src.matchAll(new RegExp("\\b" + macro + "\\((\\d)\\)", "g"))].map(m => Number(m[1])).filter((_, i, a) => i >= a.length - 10);
  const order = unrolled(CLOUD_FRAG, "SKY_LAYER");
  assert.deepEqual(order, unrolled(CLOUD_SHADOW_FRAG, "SHADOW_LAYER"), "sky and shadow draw the same order");
  assert.deepEqual([...order].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], "every genus is drawn once");
  const H = arrayOf("LH"), S = arrayOf("LS"), W = arrayOf("LW"), A = arrayOf("LALT"), R = arrayOf("LRIM");
  for (const t of [H, S, W, A, R]) assert.equal(t.length, 10);
  GENERA.forEach((g, i) => {
    assert.ok(H[i] > 0 && S[i] > 0, g.id);
    assert.ok(A[i] >= 0 && A[i] <= 1 && R[i] >= 0 && R[i] <= 1, g.id);
  });
  // the high band is above the middle band, which is above the low one
  const byLevel = level => GENERA.map((g, i) => [g, i]).filter(([g]) => g.level === level).map(([, i]) => H[i]);
  assert.ok(Math.min(...byLevel("high")) > Math.max(...byLevel("mid")), "high above middle");
  assert.ok(Math.min(...byLevel("mid")) > Math.max(...byLevel("low")), "middle above low");
  // drawn from the lowest (nearest) layer to the highest
  const drawnHeights = order.map(i => H[i]);
  for (let i = 1; i < drawnHeights.length; i++) assert.ok(drawnHeights[i] >= drawnHeights[i - 1] * 0.6, "low to high: " + drawnHeights);
  // the lump scale of the low clouds is small against the island (about 100 across) so their shadows are patches to walk through
  for (const id of [6, 7, 8]) assert.ok(S[id] <= 100, "cell size of genus " + id);
});

test("clouds are built the way the failure modes taught: separate lumps, rotated lattices, footprint-faded octaves", () => {
  assert.match(CLOUD_COMMON, /float vn\(vec2 p\)/);
  assert.match(CLOUD_COMMON, /float cuLump|0\.28\+smoothstep\(0\.35,0\.80,vn\(/, "cumulus is part separate lumps");
  assert.match(CLOUD_COMMON, /const mat2 R15/);
  assert.match(CLOUD_COMMON, /const mat2 R60/);
  assert.match(CLOUD_COMMON, /smoothstep\(0\.25,0\.8,fq\)/, "an octave finer than the pixel fades to its mean");
  assert.match(CLOUD_COMMON, /fwidth\(uv\)/);
  assert.doesNotMatch(CLOUD_COMMON, /worley|cellular|voronoi/i, "no grids of cells");
  for (const form of ["cumulusForm", "granularForm", "flockForm", "stratiform", "filament"]) assert.match(CLOUD_COMMON, new RegExp(form + "\\("));
});

test("Cu cloud base uses the same bounded horizon ray-plane projection in sky and sun shadow", () => {
  assert.match(CLOUD_COMMON, /vec2 cuPlane\(vec2 dirXZ,float elevation\)\{return dirXZ\/max\(elevation,mix\(0\.10,0\.03,uCuHorizon\)\);\}/);
  assert.match(CLOUD_FRAG, /ID==8&&uCuProjection>0\.5&&Q>=2\?cuPlane\(ray\.xz,ray\.y\):plane/);
  assert.match(CLOUD_SHADOW_FRAG, /ID==8&&uCuProjection>0\.5&&uCloudDetailLevel>1\.5\?cuPlane\(s\.xz,s\.y\):off/);
  const fjord=read("fjord.ts");
  assert.match(fjord, /const cuProjection=auditQuery\.get\("cuProjection"\)==="slab"\?1:0;/);
  assert.match(fjord, /uCuProjection:cloudUniforms\.uCuProjection/,"sky and ground shadow use same A/B switch");
  // As in a ray/flat-plane intersection, low view angles intersect the
  // cloud base farther away; the numeric near-zero bound avoids singularities.
  const plane = elevation => 1 / Math.max(elevation,0.10);
  const legacy = elevation => 1 / (0.28+0.72*Math.max(elevation,0));
  assert.ok(plane(.10)>2*legacy(.10),"cloud bank becomes shallower and more distant");
  assert.equal(plane(.01),plane(.08),"horizon safety band remains bounded");
  assert.ok(plane(.5)>legacy(.5));
  assert.equal(plane(1),legacy(1));
  assert.match(CLOUD_FRAG, /float mask=smoothstep\(0\.0,0\.20,ray\.y\)/,"horizon haze masks the capped band");
});

test("Cu horizon repair pairs a 0.03 ray-plane floor with a 0.03-0.12 fade and aerial color", () => {
  const fjord=read("fjord.ts");
  assert.match(fjord,/const cuHorizon=auditQuery\.get\("cuHorizon"\)==="legacy"\?0:1;/);
  assert.match(fjord,/uCuHorizon:\{value:cuHorizon\}/);
  assert.match(fjord,/uCuHorizon:cloudUniforms\.uCuHorizon/,"ground shadow and sky share the projection switch");
  assert.match(CLOUD_COMMON,/mix\(0\.10,0\.03,uCuHorizon\)/);
  assert.match(CLOUD_FRAG,/ID==8&&uCuProjection>0\.5&&Q>=2&&uCuHorizon>0\.5\)cloudMask=smoothstep\(0\.03,0\.12,ray\.y\)/);
  assert.match(CLOUD_FRAG,/float cuAir=1\.0-exp\(-0\.35\*0\.05\/max\(ray\.y,0\.03\)\)/);
  assert.match(CLOUD_FRAG,/layerColor=mix\(layerColor,uHorizon,cuAir\)/);
  assert.match(CLOUD_SHADOW_FRAG,/cuPlane\(s\.xz,s\.y\)/,"both passes use the same Cu plane");
  const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  for(const y of [-.01,0,.01,.029])assert.equal(smooth(.03,.12,y),0,"the capped texture region must be invisible");
  assert.equal(smooth(.03,.12,.12),1,"clouds become fully opaque above the fade band");
  const haze=y=>1-Math.exp(-.35*.05/Math.max(y,.03));
  assert.ok(haze(.03)>haze(.12),"distant Cu merges into horizon color more strongly");
  assert.ok(haze(.12)>haze(.5),"high-elevation Cu keeps its contrast");
  assert.equal(1/Math.max(.01,.10),10,"legacy A/B remains bounded");
  assert.ok(1/Math.max(.01,.03)>30,"new bound applies only in opt-in slab path");
});

test("High Cu slab uses one four-height envelope, not two overlaid cloud pictures", () => {
  const s=CLOUD_COMMON;
  assert.match(s,/vec4 cuField\(vec2 uv,float fw,float cov,vec2 ldir,int Q,out vec2 q\)/);
  assert.match(s,/vec3 cumulusSlab\(vec2 uv,float fw,float cov,vec2 ldir,int Q,vec2 span\)/);
  assert.match(s,/vec4 bottom=cuField\(uv,fw,cov,ldir,Q,q0\)/);
  assert.match(s,/vec4 crown=cuField\(uv\+span,fw,cov,ldir,Q,q1\)/);
  assert.match(s,/for\(int k=1;k<4;k\+\+\)/);
  assert.match(s,/float u=float\(k\)\/3\.0;/);
  assert.match(s,/hmax=max\(hmax,h\)/);
  assert.match(s,/float uHit=clamp\(-h0\/max\(hmax-h0,0\.02\),0\.0,1\.0\)/);
  assert.match(s,/uCuProjection>0\.5&&gNeedLit&&Q>=2\?cumulusSlab/);
  assert.match(CLOUD_FRAG,/gCuSpan=nearPlane\*\(LH\[8\]\/LS\[8\]\)\*rise/);
  assert.match(CLOUD_FRAG,/float rise=min\(0\.38,0\.72\/max\(length\(nearPlane\),0\.001\)\)/);
  assert.match(CLOUD_SHADOW_FRAG,/gNeedLit=false;/);
  assert.match(CLOUD_COMMON,/uCuProjection>0\.5&&gNeedLit&&Q>=2\?cumulusSlab/,"shadow pass has gNeedLit=false so it takes the legacy Cu footprint");
  const spanRatio = len=>len*Math.min(.38,.72/Math.max(len,.001));
  for(const len of [.01,.1,1,3,10,100]) assert.ok(spanRatio(len)<=.7200001);
  // Preserve the existing Cu/Cb field sampling when the explicit PoC flag is off.
  assert.match(s,/vec3 cumulusForm\(vec2 uv,float fw,float cov,vec2 ldir,int Q\)/);
  assert.match(s,/float den=smoothstep\(edge-0\.16,edge\+0\.22,d\)/);
});

test("cirrus strands have a coherent head and trailing tuft instead of an unbroken streak", () => {
  const src = CLOUD_COMMON.slice(CLOUD_COMMON.indexOf("float filament("), CLOUD_COMMON.indexOf("vec2 skyPlane("));
  assert.match(src, /float head=smoothstep\(0\.56,0\.74,vn\(headUv\)\);/);
  assert.match(src, /float tail=smoothstep\(0\.42,0\.64,vn\(headUv\+R15\*vec2\(0\.462,0\.0\)\)\);/);
  assert.match(src, /float strands=f\*sparse\*\(0\.30\+0\.70\*max\(head,tail\*0\.8\)\);/);
  assert.match(src, /return min\(strands\+head\*sparse\*\(0\.45\+0\.35\*f\),1\.0\);/);
  assert.doesNotMatch(src, /return f\*sparse;/, "uncapped full-length strands must not return directly");
  // A fibre unsupported by a tuft carries at most 30% of its previous coverage.
  const alpha = (f,sparse,head,tail) =>
    Math.min(f*sparse*(0.30+0.70*Math.max(head,tail*0.8))+head*sparse*(0.45+0.35*f),1);
  assert.equal(alpha(1,1,0,0),0.30);
  assert.ok(alpha(1,1,1,0)>0.95, "visible tuft stays opaque");
  assert.ok(alpha(1,1,0,1)>alpha(1,1,0,0), "trailing tuft supports a fibre");
  // Keep every cloud genus on the existing shared evaluator: no new sky-only layer.
  assert.match(CLOUD_COMMON, /float f=filament\(uv,fw\);alpha=/);
  assert.match(CLOUD_SHADOW_FRAG, /evalLayer\(ID,ground\+layerOff\*LH\[ID\]/);
});

test("light: the sun's own colour on the lit side, sky light in shade, high layers keep the sun longest, with an afterglow", () => {
  assert.match(CLOUD_FRAG, /smoothstep\(-0\.035-0\.07\*alt01,0\.015-0\.015\*alt01,gSunEl\)/);
  assert.match(CLOUD_FRAG, /vec3 shadeCol=/);
  assert.match(CLOUD_FRAG, /vec3 glow=/);
  assert.match(CLOUD_FRAG, /gDirect=mix\(uSunColor\*2\.2,fiery/);
  assert.match(CLOUD_FRAG, /uGen\[3\]\+uGen\[5\]/, "overcast decks flatten the light");
  assert.match(CLOUD_FRAG, /#include <tonemapping_fragment>/);
  assert.match(CLOUD_FRAG, /#include <colorspace_fragment>/);
});

test("the sky shader is wired to the mix, the noise and the audit switches", () => {
  const fjord = read("fjord.ts"), world = read("world.ts");
  assert.match(fjord, /uGen:\{value:new Array\(10\)\.fill\(0\)\}/);
  assert.match(fjord, /function setCloudMix\(/);
  assert.match(fjord, /cloudOnly/);
  assert.match(fjord, /forcedMix/);
  assert.match(fjord, /uHalo/);
  assert.match(world, /fjord\.setCloudMix\(cloudMix\(weatherToCloudInputs\(W\)\)\)/);
  // the 22-degree halo is 21.7 degrees out and only while an ice veil is up
  assert.match(fjord, /acos\(clamp\(s,0\.0,1\.0\)\)-0\.379/);
});

test("High draws a sky the Balanced tier does not: a billow octave and a second sun-ward tap", () => {
  assert.match(CLOUD_COMMON, /Q>=2\?\(fbmF\(q\*11\.0\+5\.0,3,fw\*11\.0\)-0\.5\)\*0\.30:0\.0/);
  assert.equal((CLOUD_COMMON.match(/if\(Q>=2\)\{/g) ?? []).length >= 2, true);
  // the shadow pass never runs the High-only work (its Q stops at 1)
  assert.match(CLOUD_SHADOW_FRAG, /int Q=uCloudDetailLevel>0\.5\?1:0;/);
});

test("passes that draw into their own target run before the scene pass, never inside it (blank frames on phone GPUs)", () => {
  const pipeline = readFileSync(new URL("../src/rendering/hd2d-pipeline.js", import.meta.url), "utf8");
  const at = (s, re) => { const i = s.search(re); assert.ok(i >= 0, String(re)); return i; };
  assert.ok(at(pipeline, /prePass\(renderer, scene, activeCamera\)/) < at(pipeline, /renderer\.setRenderTarget\(sceneTarget\)/));
  assert.match(read("main.ts"), /prePass:\(r:THREE\.WebGLRenderer,_s:THREE\.Scene,c:THREE\.Camera\)=>world\.prePass\(r,c,/);
  const world = read("world.ts");
  assert.match(world, /fjord\.runShadowPass\(renderer\)/);
  assert.match(world, /environment\.mirrorPass\(renderer,scene,camera,/);
  // the hook / onBeforeRender paths stay only as the fallback for a renderer without that pipeline
  assert.match(read("ocean.ts"), /if\(prepared\)\{prepared=false;return;\}/);
});

test("clouds are soft (wide density ramp, gathered when sparse) and the sunset is redder", () => {
  assert.match(CLOUD_COMMON, /smoothstep\(edge-0\.16,edge\+0\.22,d\)/, "cumulus margin is a long misty fall-off");
  assert.match(CLOUD_COMMON, /float grp=fbmF\(uv\*0\.30\+41\.0,2,fw\*0\.30\);/, "a sparse sky gathers into a few big masses");
  assert.match(CLOUD_FRAG, /vec3\(1\.0,0\.46,0\.12\),vec3\(1\.0,0\.09,0\.02\)/, "fiery sunset base colours");
  // light shafts only at sunrise and sunset: by day they smeared bright clouds into radial smoke
  assert.match(read("main.ts"), /setRayScale\(Math\.min\(1,liveSky\.sunRays\*liveSky\.twilight\.value\*1\.6\)\)/);
});

test("sky and ground shadows drift together, downwind, at a visible pace; the sun disc reddens as it sinks", () => {
  // one line moves every layer, and the sky and the shadow pass both read it through evalLayer
  assert.match(CLOUD_COMMON, /vec2 uv=\(P-uCloudWind\*LW\[id\]\)\/LS\[id\];/);
  assert.match(CLOUD_FRAG, /evalLayer\(ID,cameraPosition\.xz\+layerPlane\*LH\[ID\],ldir,Q,al\)/);
  assert.match(CLOUD_SHADOW_FRAG, /evalLayer\(ID,ground\+layerOff\*LH\[ID\],vec2\(0\.0\),Q,al\)/);
  // angular speed of a layer at the default wind (0.48 drift units a second): low layers about a degree a second
  const H = arrayOf("LH"), W = arrayOf("LW");
  const degPerSecond = i => (W[i] * 0.48 / H[i]) * 180 / Math.PI;
  for (const id of [6, 7, 8, 9]) assert.ok(degPerSecond(id) > 0.6, "low layer " + id + " moves visibly: " + degPerSecond(id).toFixed(2));
  for (let i = 0; i < 10; i++) assert.ok(degPerSecond(i) > 0.2 && degPerSecond(i) < 1.6, "layer " + i + " is neither frozen nor racing: " + degPerSecond(i).toFixed(2));
  const fjord = read("fjord.ts");
  assert.match(fjord, /vec3 discHue=mix\(vec3\(1\.0,\.88,\.66\),vec3\(1\.0,\.42,\.10\),\(1\.0-smoothstep\(\.20,\.60,sunSin\)\)\);/);
  assert.match(fjord, /discHue=mix\(discHue,vec3\(1\.0,\.10,\.02\),\(1\.0-smoothstep\(\.015,\.16,sunSin\)\)\);/);
});

// Regression from POCO F8 Ultra real-device screenshots: PR #36 introduced a
// 2.4 HDR sunset disc multiplied by two broad horizon fades, which made the disc
// appear darker than the surrounding orange sky. Keep solar red, restore light.
test("low sun has a bright fiery disc with a separate core and a tight horizon fade", () => {
  const fjord = read("fjord.ts");
  assert.doesNotMatch(fjord, /mix\(18\.0,2\.4,/,"do not restore the old dim sunset HDR coefficient");
  assert.match(fjord, /float discRadiance=mix\(18\.0,5\.6,\(1\.0-smoothstep\(\.04,\.55,sunSin\)\)\);/);
  assert.match(fjord, /float discVisible=smoothstep\(-\.003,\.001,ray\.y\)/);
  assert.match(fjord, /float discMask=smoothstep\(\.99957,\.99972,s\)\*discVisible;/);
  assert.match(fjord, /float hotCore=smoothstep\(\.99986,\.999965,s\);/);
  assert.match(fjord, /vec3 coreHue=mix\(discHue,vec3\(1\.0,\.43,\.12\),hotCore\*sunsetRed\*\.57\);/);
  assert.match(fjord, /col=mix\(col,coreHue\*discRadiance\*\(1\.0\+\.18\*hotCore\),discMask\);/);
  // The HDR core can be hotter without losing its distinctive red outer rim.
  const emberGreen=.10+(.43-.10)*.57;
  const emberBlue=.02+(.12-.02)*.57;
  assert.ok(emberGreen<.30 && emberBlue<.08,"hot core preserves a red-dominant hue before tone mapping");
  assert.doesNotMatch(fjord, /discMask[^\n]*sunUp/,"atmospheric sunUp should only gate corona, not a visible disc");
  const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  const power=y=>18+(5.6-18)*(1-smooth(.04,.55,y));
  const discVisible=rayY=>smooth(-.003,.001,rayY);
  for(const y of [.002,.01,.05,.15]){
    assert.ok(power(y)>=5.6,"near-horizon HDR stays luminous at "+y);
    assert.ok(discVisible(y)>.99,"above-horizon solar pixels remain visible at "+y);
  }
  // Angular rim defined by the dot threshold: a centre just BELOW the horizon
  // still has a visible upper edge, rather than disappearing all at once.
  const rimAngle=Math.acos(.99957);
  assert.ok(-.012+Math.sin(rimAngle)>0,"sun upper limb above horizon");
  assert.ok(discVisible(-.012+Math.sin(rimAngle))>.99,"upper sun limb survives when centre is below horizon");
  assert.equal(discVisible(-.02),0,"pixels below the horizon are hidden");
  assert.ok(-.04+Math.sin(rimAngle)<0,"whole disc sinks when the centre is far enough below horizon");
  assert.ok(power(.6)>17,"high sun retains its white-yellow HDR brightness");
});

// GLSL requires edge0 < edge1. Descending solar-height transitions must invert a
// conventional smoothstep: reversed parameters produce undefined GPU-specific output.
test("sunset shader transitions use defined smoothstep order", () => {
  const fjord = read("fjord.ts");
  for (const fragment of [
    "(1.0-smoothstep(.20,.60,sunSin))",
    "(1.0-smoothstep(.015,.16,sunSin))",
    "(1.0-smoothstep(.0,.25,sunSin))",
    "(1.0-smoothstep(.04,.55,sunSin))",
  ]) assert.ok(fjord.includes(fragment), "fjord must use ordered GLSL smoothstep: " + fragment);
  for (const fragment of [
    "(1.0-smoothstep(0.01,0.20,sy))",
    "(1.0-smoothstep(-0.09,-0.03,sy))",
    "(1.0-smoothstep(-0.16,-0.09,sy))",
  ]) assert.ok(CLOUD_FRAG.includes(fragment), "clouds must use ordered GLSL smoothstep: " + fragment);
  function smooth(low,high,x){ const t=Math.max(0,Math.min(1,(x-low)/(high-low))); return t*t*(3-2*t); }
  const fade=(low,high,x)=>1-smooth(low,high,x);
  assert.equal(fade(.2,.6,.7),0);
  assert.equal(fade(.2,.6,.1),1);
  assert.ok(fade(.2,.6,.4)>0&&fade(.2,.6,.4)<1);
});

// GLSL leaves smoothstep undefined when edge0 >= edge1. Guard the whole project, not only the sunset: scan every shader string
// in src for a smoothstep whose literal edges run downhill.
test("no GLSL smoothstep in src has descending literal edges", async () => {
  const { readdirSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const root = new URL("../src/", import.meta.url);
  const walk = dir => readdirSync(new URL(dir, root)).flatMap(name => {
    const rel = dir + name;
    return statSync(new URL(rel, root)).isDirectory() ? walk(rel + "/") : [rel];
  });
  const num = "(-?\\d*\\.?\\d+)";
  const re = new RegExp("smoothstep\\(\\s*" + num + "\\s*,\\s*" + num + "\\s*,", "g");
  const bad = [];
  for (const rel of walk("").filter(f => /\.(ts|js)$/.test(f) && !f.includes("pixel/textures"))) {   // textures.js is plain JS maths, not GLSL
    const text = readFileSync(new URL(rel, root), "utf8");
    for (const m of text.matchAll(re)) if (parseFloat(m[1]) >= parseFloat(m[2])) bad.push(rel + ": smoothstep(" + m[1] + "," + m[2] + ",...)");
  }
  assert.deepEqual(bad, []);
});
