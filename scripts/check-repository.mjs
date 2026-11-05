import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import { spawnSync } from "node:child_process";
const required=[
 "README.md","AGENTS.md","index.html","styles.css","package.json","package-lock.json",
 "docs/ART-DIRECTION.md","docs/ARCHITECTURE.md","docs/QUALITY-GATES.md",
 "docs/INDEX.md","docs/RESEARCH-ADOPTION.md",
 "docs/research/THREEJS-ENGINEERING-2026-11-04.md",
 "docs/TOOL-INTEGRATIONS.md","docs/governance/PAGES-DEPLOYMENT.md",
 "assets/manifest.json","src/platform/asset-manifest.js",
 "src/game/main.ts","src/game/world.ts","src/game/art.ts","src/game/kit.ts",
 "src/game/architecture.ts","src/game/environment.ts","src/game/input.ts","src/game/navigation.js",
 "src/game/facade-geometry.js","src/game/ocean.ts","src/game/coastal-outline.js","src/game/coastline.ts",
 "src/rendering/renderer-port.js","src/rendering/quality.js","src/rendering/resource-scope.js",
 "vite.config.mjs","tsconfig.json","playwright.config.mjs",
 ".github/workflows/ci.yml",".github/workflows/deploy-pages.yml"
];
let failures=0;
function fail(message){console.error("FAIL:",message);failures++;}
for(const path of required)if(!existsSync(path))fail("missing "+path);
function walk(directory){
 if(!existsSync(directory))return[];
 return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
  const path=join(directory,entry.name);
  return entry.isDirectory()?walk(path):[path];
 });
}
for(const path of [...walk("src"),...walk("scripts"),...walk("tests"),...walk("e2e")]){
 if(![".js",".mjs"].includes(extname(path)))continue;
 const result=spawnSync(process.execPath,["--check",path],{encoding:"utf8"});
 if(result.status!==0)fail("syntax "+path+" "+(result.stderr||"").trim());
}
const obsolete=[
 "src/app.js", "lab/index.html", "lab/main.ts", "lab/lab.css",
 "e2e/lab.spec.mjs", "e2e/visual-art-temporary.spec.mjs", "e2e/visual-audit-temporary.spec.mjs",
];
for(const path of obsolete)if(existsSync(path))fail("obsolete file remains "+path);
const html=readFileSync("index.html","utf8");
for(const path of ["./styles.css","./src/game/main.ts"]){
 if(!html.includes(path))fail("entry does not reference "+path);
}
if(html.includes("game-count")||html.includes("hero-title"))fail("old landing page still present");
const world=readFileSync("src/game/world.ts","utf8");
if(/function lantern\s*\(|modern\s+street\s+lamp/i.test(world))fail("obsolete street lamps remain");
if(failures)process.exitCode=1;
else console.log("PASS: clean single game entry, preserved research/tools, and current docs.");
