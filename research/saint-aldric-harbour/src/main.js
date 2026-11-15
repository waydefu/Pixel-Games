import * as THREE from "three";
import { CSM } from "three/examples/jsm/csm/CSM.js";
import { buildWorld } from "./world.js";
import { Sky } from "./sky.js";
import { Post } from "./post.js";
import { AU, csmify } from "./materials.js";
import { buildTerrain, buildMaskTexture } from "./terrain.js";
import { bakeTextures } from "./textures.js";
import { makeTerrainMaterial } from "./terrainmat.js";
import { makeTownMaterial, makeGlassMaterial } from "./townmat.js";
import { buildTown } from "./town.js";
import { makeWater, bakeHeightTexture } from "./water.js";
import { SpectralOcean } from "./ocean.js";
import { bakeFoliage, setWind, MSAA } from "./vegetation.js";
import { buildPlantLibrary, placePlants, buildPlantMeshesInst, buildPlantMeshesBatched, makeGrass2 } from "./plants.js";
import { Weather, Ambience } from "./weather.js";
import { createGame, bindOcean } from "./game.js";
import { smoothstep, clamp, lerp } from "./util.js";
import { TIERS, loadSettings } from "./settings.js";
import { readSave, writeSave, hasSave } from "./save.js";
import * as SAVE from "./save.js";
import { createMenu } from "./menu.js";
import { findFarmSite } from "./farm.js";
import { makeForestMap, fillForestMap, buildEcology, FOREST_RECT } from "./ecology.js";
import { buildExclusion, EXCL_RECT } from "./exclude.js";

const Q = new URLSearchParams(location.search);
const num = (k, d) => (Q.has(k) ? parseFloat(Q.get(k)) : d);
const log = (...a) => console.log("[town]", ...a);
const $ = id => document.getElementById(id);
const nextFrame = () => new Promise(r => setTimeout(r, 12));
const setBar = (p, msg) => { const b = $("bar"), l = $("ld"); if (b) b.style.width = Math.round(p * 100) + "%"; if (l && msg) l.textContent = msg; };

const SET = loadSettings();
const coarse = matchMedia("(pointer:coarse)").matches;
// a quality change reloads the page with the same URL, so an explicit ?q= must not override the tier chosen in the menu after that reload
const tierResume = (() => { try { return sessionStorage.getItem("aldric.resume") === "1"; } catch (e) { return false; } })();
const tierName = TIERS[Q.get("q")] && !tierResume ? Q.get("q") : SET.tier, TIER = { ...TIERS[tierName] };
if (Q.has("scale")) TIER.scale = num("scale", 1);
if (Q.has("tex")) TIER.tex = num("tex", 512);
if (Q.has("veg")) TIER.veg = num("veg", 1);
if (Q.has("msaa")) TIER.msaa = num("msaa", 4);

async function boot() {
  const canvas = $("view");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", stencil: false });
  if (!renderer.capabilities.isWebGL2) { $("ld").textContent = "此瀏覽器不支援 WebGL2，無法執行。"; window.__failed = true; return; }
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const T0 = performance.now();

  setBar(0.04, "生成地形與街道…"); await nextFrame();
  const W = buildWorld(7);
  log("world", W.buildings.length, "buildings", ((performance.now() - T0) | 0) + "ms");

  const sky = new Sky(renderer), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(Q.has("fov") ? num("fov", 70) : 72, 1, 0.12, 16000);
  scene.add(sky.dome); AU.uSkyLUT.value = sky.skyRT.texture;
  const csm = new CSM({ maxFar: TIER.sfar, cascades: TIER.casc, mode: "practical", parent: scene, shadowMapSize: TIER.smap, lightDirection: new THREE.Vector3(-0.3, -1, -0.2).normalize(), camera, lightIntensity: 1 });
  csm.fade = true; for (const l of csm.lights) { l.shadow.bias = -0.0003; l.shadow.normalBias = 0.04; }

  setBar(0.12, "烘焙程序化材質…"); await nextFrame();
  const TEX = bakeTextures(renderer, TIER.tex);
  const MASKT = buildMaskTexture(W); setBar(0.2, "建造地形…"); await nextFrame();
  const FOREST = makeForestMap();   // broadleaf cover texture, filled once the forest is placed; read by terrain and grass
  const terrain = buildTerrain(W, csmify(csm, makeTerrainMaterial(TEX, MASKT, FOREST, FOREST_RECT))); scene.add(terrain);
  const HT = bakeHeightTexture(W);
  const townMat = csmify(csm, makeTownMaterial(TEX)), glassMat = csmify(csm, makeGlassMaterial());
  setBar(0.32, "建造房屋、教堂與城牆…"); await nextFrame();
  const TOWN = buildTown(W, { detail: TIER.detail }); scene.add(TOWN.chunks.meshes(townMat, glassMat));
  log("town", Math.round(TOWN.stats.tris), "tris");
  setBar(0.5, "種植樹木與草地…"); await nextFrame();
  MSAA.on = TIER.msaa > 0;
  const FOL = bakeFoliage(renderer, TIER.tex >= 512 ? 1024 : 512), FARM_SITE = findFarmSite(W);
  const PLACED = placePlants(W, { quality: TIER.veg, keepOut: { x: FARM_SITE.x, z: FARM_SITE.z, r: 11 } });
  PLACED.trees = PLACED.trees; const LIB = buildPlantLibrary(TIER.veg);
  const TREES = Q.has("inst") ? buildPlantMeshesInst(scene, PLACED, LIB, FOL, townMat, csm) : buildPlantMeshesBatched(scene, PLACED, LIB, FOL, townMat, csm, { vegShadow: TIER.vegShadow });
  log("plant batches", TREES.vis ? TREES.vis.count : "inst"); log("plants", TREES.count, "trees", PLACED.trees.length, "forest", PLACED.forest.length, "shrubs", PLACED.shrubs.length, "beds", PLACED.beds.length);
  fillForestMap(FOREST, PLACED.forest);
  const ECO = buildEcology(scene, W, PLACED, { csm, LIB, mats: TREES.mats, townMat, quality: TIER.veg, keepOut: { x: FARM_SITE.x, z: FARM_SITE.z, r: 11 } });
  log("ecology", JSON.stringify(ECO.built));
  const EXCL = buildExclusion(W, TOWN, W.landmarkSites.CASTLE);
  const GRASS = makeGrass2(HT, MASKT, csm, { side: TIER.grass, cell: TIER.gcell, forestTex: FOREST, forestRect: FOREST_RECT, exclTex: EXCL, exclRect: EXCL_RECT }); scene.add(GRASS.mesh);
  setBar(0.7, "海水與天氣…"); await nextFrame();
  // spectral ocean: FFT cascades per quality tier; the same damping as the shader (shallow water, harbour calm)
  const OCEAN = new SpectralOcean(tierName, { damp: (x, z) => { const d = Math.max(-W.H(x, z), 0); const t = Math.min(1, Math.max(0, (d - 0.1) / 2.4)); const u = Math.min(1, Math.max(0, (Math.hypot(x - 80, z - 125) - 55) / 115)); return t * t * (3 - 2 * t) * (0.5 + 0.5 * u * u * (3 - 2 * u)); } });
  log("ocean", tierName, OCEAN.cascades.map(c => c.n + "^2/" + c.L + "m").join(" + "));
  const WATER = makeWater(W, HT, OCEAN); csmify(csm, WATER.mat); scene.add(WATER.mesh);
  const weather = new Weather(scene, csm.lights), ambience = new Ambience();
  // night lamps: a small pool of real point lights that follows the player to the nearest lanterns
  const hemi = new THREE.HemisphereLight(new THREE.Color().setRGB(0.42, 0.52, 0.9), new THREE.Color().setRGB(0.08, 0.09, 0.12), 0); scene.add(hemi);   // night fill: moonlit sky bounce so walls facing away from the moon are not pure black
  const lampPool = Array.from({ length: 6 }, () => { const l = new THREE.PointLight(0xffa24a, 0, 16, 2); scene.add(l); return l; });
  const post = new Post(renderer, { msaa: TIER.msaa, bloom: TIER.bloom });
  post.expo.uniforms.uMinMax.value.set(0.02, 5.0);
  // Resolution policy per tier (short side, px): low 720-1080, others 1080-1440. Dynamic resolution moves between the tier's floor and its ceiling.
  const MINSIDE = Q.has("rs") ? num("rs", 720) : TIER.minSide, MAXSIDE = Q.has("rs") ? num("rs", 720) : TIER.maxSide;
  let renderScale = 1, minScale = 1;
  const resize = () => {
    const cssShort = Math.min(innerWidth, innerHeight), native = cssShort * (devicePixelRatio || 1), target = clamp(native, MINSIDE, MAXSIDE), pr = target / cssShort;
    renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false);
    minScale = Math.min(1, MINSIDE / target); renderScale = clamp(renderScale, minScale, 1);
    const w = Math.floor(innerWidth * pr), h = Math.floor(innerHeight * pr); camera.aspect = w / h; camera.updateProjectionMatrix(); post.setSize(w, h, renderScale);
  };
  addEventListener("resize", resize); resize();

  const boatMat = csmify(csm, makeTownMaterial(TEX)); boatMat.side = THREE.DoubleSide; boatMat.userData.key = "boat";
  const ctx = { W, camera, scene, townMat, boatMat, csm, TOWN, PLACED, weather, ambience, sky, renderer, canvas };
  const game = createGame(ctx); bindOcean(OCEAN);
  // ?doy= sets the GAME calendar (HUD, season, shaders, sky all read game.calendar()): day-of-year 80 = spring equinox, 365 days over 32 game days
  if (Q.has("doy")) { const d = ((num("doy", 182) - 80) % 365 + 365) % 365; const h0 = Q.has("hour") ? num("hour", 17.4) : (Q.has("t") ? num("t", 17.4) : game.G.hour); game.G.yd0 = d / 365 * 32 - h0 / 24; game.G.dayCount = 0; }
  { const f = game.G.farm.site; if (f) GRASS.uniforms.uFarm.value.set(f.x - 6.5, f.z - 6.5, f.x + 6.5, f.z + 6.5); }   // keep the farm field clear of grass
  const pier = TOWN.hb.piers[0];
  if (pier) { game.P.x = pier.x - pier.dx * 3.5; game.P.z = pier.z - pier.dz * 3.5; game.G.yaw = Math.atan2(-pier.dx, -pier.dz); game.G.pitch = -0.08; }
  game.P.y = game.groundY(game.P.x, game.P.z);
  if (Q.has("hour")) game.G.hour = num("hour", 17.4); else if (Q.has("t")) game.G.hour = num("t", 17.4);
  if (Q.has("wx")) { weather.set(Q.get("wx")); Object.assign(weather.s, weather.target); }
  if (Q.has("still")) game.G.tspeed = 0;

  const toast = (m) => { const t = $("toast"); if (!t) return; t.textContent = m; t.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("on"), 2600); };
  const applySave = (sv) => { game.restore(sv); };
  const menu = createMenu({ settings: SET, tierName, game, collect: () => game.collect(), restore: applySave, getRes: () => "目前內部解析度約 " + Math.round(renderer.domElement.height * renderScale) + "p・畫質：" + TIERS[tierName].label, onToast: toast });
  const debugShot = Q.has("cx") || Q.has("cam") || Q.has("autostart") || Q.has("fresh");
  let resume = false; try { resume = sessionStorage.getItem("aldric.resume") === "1"; sessionStorage.removeItem("aldric.resume"); } catch (e) { /* ignore */ }
  const startGame = (fromSave) => { intro = false; const el = $("intro"); if (el) { el.style.opacity = 0; setTimeout(() => el.remove(), 700); } if (fromSave) { const sv = readSave(); if (sv) applySave(sv); } game.setStarted(true); ambience.start(); if (!coarse) canvas.requestPointerLock?.(); };
  let intro = !debugShot && !resume;
  $("go").onclick = () => startGame(false);
  if (hasSave()) { const c = $("cont"); if (c) { c.style.display = "inline-block"; c.onclick = () => startGame(true); } }
  if (resume && hasSave()) { applySave(readSave()); $("intro")?.remove(); game.setStarted(true); }
  else if (!intro) { $("intro")?.remove(); game.setStarted(true); }
  // autosave every 30 s while playing, and when the tab is hidden / closed
  const autosave = () => { if (game.G.started && !debugShot) { if (writeSave(game.collect())) ctx.tip?.("save"); } };
  setInterval(autosave, 30000); addEventListener("pagehide", autosave); document.addEventListener("visibilitychange", () => { if (document.hidden) autosave(); });
  if (Q.has("cx")) { camera.position.set(num("cx", 0), num("cy", 5), num("cz", 0)); camera.lookAt(num("tx", 0), num("ty", 3), num("tz", 0)); game.G.started = false; game.setStarted(false); }
  const CAMS = [[60, 30, 20, -10, 6, -30], [-6, 6.5, 30, -6, 6, -10], [250, 40, 230, 0, 5, 0], [16, 6.5, 18, -12, 7, -4]];
  if (Q.has("cam")) { const c = CAMS[num("cam", 0)] || CAMS[0]; camera.position.set(c[0], c[1], c[2]); camera.lookAt(c[3], c[4], c[5]); game.setStarted(false); }
  setBar(1, "準備就緒"); setTimeout(() => { const b = $("bar"); if (b) b.style.opacity = 0; }, 400);

  // ------------------------------------------------------------------ main loop
  let time = 0, last = performance.now(), frameN = 0, ema = 16, lastScaleChange = 0, lampT = 0, advise = 0, advised = false;
  const lampPos = TOWN.lamps;
  const fixedCam = Q.has("cx") || Q.has("cam");
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now; time += dt; ema = ema * 0.95 + dt * 1000 * 0.05;
    const hourBefore = game.G.hour;
    if (intro && !fixedCam) {
      const a = time * 0.05 + 0.6; camera.position.set(80 + Math.cos(a) * 95, 24 + Math.sin(time * 0.1) * 4, 70 + Math.sin(a) * 85); camera.lookAt(30, 8, 30); game.G.hour = Q.has("still") ? game.G.hour : (game.G.hour + dt * 0.01) % 24;
    }
    // weather → sky / world
    const cal = game.calendar(); if (!game.G.paused && !Q.has("wx") && game.G.started) weather.tickAuto(dt, cal.season);
    // season for shaders: from the game calendar, or from ?doy= when a screenshot pins the date (80 = spring equinox start)
    const SEASON = { season: cal.season, seasonT: cal.seasonT };   // the only source of the season for every shader and for weather
    weather.setSeason(SEASON.season); ECO.setSeason(SEASON.season); if (TREES.vis && frameN % 30 === 0) TREES.vis.update(camera.position.x, camera.position.z); AU.uSeason.value = SEASON.season; AU.uSeasonT.value = SEASON.seasonT;
    const ws = weather.update(dt, camera, time, smoothstep(-0.05, 0.4, sky.state.sunEl)); AU.uSnow.value = Math.max(ws.snowCover, cal.season === 3 ? 0.42 * smoothstep(0.03, 0.3, cal.seasonT) : (cal.season === 0 ? 0.3 * (1 - smoothstep(0.0, 0.3, cal.seasonT)) : 0));   // winter keeps a snow cover even on clear days; it melts in early spring
    OCEAN.update(time, ws.sea);
    { const sk = smoothstep(0.4, 1.0, ws.rain); post.comp.uniforms.uSat.value = 1.08 - 0.3 * sk; post.exposureBias = Math.pow(2, -0.5 * sk); }   // storm: -30% saturation, -0.5 EV
    if (!fixedCam) game.update(dt, time, ws.sea);
    const S = sky.update(game.G.hour, ws.cover, ws.over, time, camera, cal.dayOfYear);
    post.comp.uniforms.uDark.value = S.darkness;
    // sun / moon drive the cascaded light
    const dayW = smoothstep(-0.07, 0.03, S.sunEl), dir = dayW > 0.02 ? S.sunDir : S.moonDir;
    csm.lightDirection.copy(dir).negate();
    const I = S.sunIntensity * dayW + S.moonIntensity * 11 * (1 - dayW) * (dir.y > 0 ? 1 : 0);
    for (const l of csm.lights) { l.color.copy(S.sunColor).lerp(new THREE.Color(0.55, 0.65, 1.0), 1 - dayW); l.intensity = I * (1 - 0.15 * ws.rain); }
    hemi.intensity = 0.45 * Math.max(S.darkness, 0.5 * S.nightness) * (1 - 0.5 * ws.rain) + 0.2 * S.sunIntensity * dayW;   // night: moonlit sky bounce; day: sky-dome fill so shadowed ground and grass are not pure black
    csm.update();
    AU.uSunDirW.value.copy(S.sunDir); AU.uCamW.value.copy(camera.position); AU.uHaze.value = ws.haze; AU.uWet.value = ws.wet; AU.uNight.value = S.nightness; AU.uTime.value = time;
    WATER.uniforms.uSea.value = ws.sea; setWind(ws.wind); GRASS.uniforms.uGrassCam.value.copy(camera.position);
    WATER.mesh.position.set(Math.round(camera.position.x / 8) * 8, 0, Math.round(camera.position.z / 8) * 8);
    if (frameN % 240 === 0) scene.environment = sky.captureEnv(camera.position);
    scene.environmentIntensity = 1.0;
    // lamp pool
    if ((lampT -= dt) < 0) {
      lampT = 0.3; const cx = camera.position.x, cz = camera.position.z; const best = lampPos.map(l => ({ l, d: (l.x - cx) ** 2 + (l.z - cz) ** 2 })).sort((a, b) => a.d - b.d).slice(0, lampPool.length);
      best.forEach((b, i) => lampPool[i].position.set(b.l.x, b.l.y, b.l.z));
    }
    const night = smoothstep(0.1, 0.9, S.nightness) + 0.45 * smoothstep(0.0, 0.5, ws.over) * (1 - smoothstep(0.1, 0.9, S.nightness)) * (1 - dayW * 0);
    for (let i = 0; i < lampPool.length; i++) lampPool[i].intensity = clamp(night, 0, 1) * (22 + 4 * Math.sin(time * 7 + i * 3.1) + 2 * Math.sin(time * 13 + i));
    // rain sounds, ambience, thunder
    const shore = clamp(1 - Math.max(0, W.coastS(camera.position.x, camera.position.z) + 8) / 90, 0, 1);
    ambience.update(dt, { sea: ws.sea / 1.2, wind: ws.wind, rain: ws.rain, shore });
    if (weather.thunderIn !== undefined) { weather.thunderIn -= dt; if (weather.thunderIn < 0) { weather.thunderIn = undefined; ambience.thunder(); } }
    // render
    renderer.setRenderTarget(post.sceneRT); renderer.clear(); renderer.render(scene, camera);
    post.finish(dt, time);
    frameN++; window.__t = time;
    // dynamic resolution
    if (SET.auto && !Q.has("noscale") && frameN > 90 && now - lastScaleChange > 2500) {
      if (ema > 23 && renderScale > minScale + 0.001) { renderScale = Math.max(minScale, renderScale - 0.08); lastScaleChange = now; resize(); }
      else if (ema < 14.5 && renderScale < 0.999) { renderScale = Math.min(1, renderScale + 0.04); lastScaleChange = now; resize(); }
    }
    if (SET.auto && frameN > 240 && renderScale <= minScale + 0.001 && ema > 33) { advise = (advise || 0) + dt; if (advise > 12 && !advised && game.G.started) { advised = true; toast("效能不足：建議在選單（☰）把畫質調低一檔"); } } else advise = 0;
    if (frameN % 20 === 0) $("fps").textContent = (1000 / ema).toFixed(0) + " fps · " + Math.round(renderer.domElement.height * renderScale) + "p · " + tierName;
    if (frameN === 4 && !window.__ready) { window.__info = { hour: game.G.hour, weather: weather.key, calls: renderer.info.render.calls, tier: tierName, tris: TOWN.stats.tris | 0, ready: true }; window.__ready = true; }
    requestAnimationFrame(frame);
  }
  ctx.cycleQuality = () => { const order = [minScale, (minScale + 1) / 2, 1.0]; const i = order.findIndex(o => o > renderScale + 0.01); renderScale = order[i < 0 ? 0 : i]; lastScaleChange = performance.now(); resize(); };
  if (Q.has("debug")) Object.assign(window, { __game: game, __scene: scene, __renderer: renderer, __eco: ECO, __plants: TREES, __save: SAVE, __menu: menu, __sky: sky, __weather: weather, __ctx: ctx, __farm: game.farm, __ocean: OCEAN }); // debug hooks only with ?debug=1
  requestAnimationFrame(frame);
}
boot().catch(e => { console.error("[town] boot failed", e); window.__failed = String(e); const ld = $("ld"); if (ld) ld.textContent = "啟動失敗：" + e.message; });
