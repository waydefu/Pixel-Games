import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import { spawnSync } from "node:child_process";
const required=[
 "README.md","AGENTS.md","index.html","styles.css","package.json",
 "docs/INDEX.md","docs/ARCHITECTURE.md","docs/RESEARCH-ADOPTION.md",
 "docs/TOOL-INTEGRATIONS.md","docs/TOOLING.md","src/integrations/tool-registry.js","assets/manifest.json",
 "package-lock.json","vite.config.mjs","tsconfig.json","playwright.config.mjs",
 "src/game/main.ts","src/game/world.ts","src/game/input.ts","src/game/navigation.js",
 ".github/workflows/ci.yml",".github/workflows/deploy-pages.yml",".github/pull_request_template.md"
];
let failures=0;
function fail(message){console.error("FAIL:",message);failures++;}
for(const path of required)if(!existsSync(path))fail("missing "+path);
function walk(dir){
 if(!existsSync(dir))return[];
 return readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
  const path=join(dir,e.name);
  return e.isDirectory()?walk(path):[path];
 });
}
for(const path of [...walk("src"),...walk("scripts"),...walk("tests"),...walk("e2e")]){
 if(![".js",".mjs"].includes(extname(path)))continue;
 const r=spawnSync(process.execPath,["--check",path],{encoding:"utf8"});
 if(r.status!==0)fail("syntax "+path+" "+(r.stderr||"").trim());
}
const html=readFileSync("index.html","utf8");
for(const path of ["./styles.css","./src/game/main.ts"]){
 if(!html.includes(path))fail("entry does not reference "+path);
 if(!existsSync(path))fail("missing entry asset "+path);
}
if(html.includes("game-count")||html.includes("hero-title"))fail("old landing page still active");
if(existsSync("lab/index.html"))fail("legacy secondary page is still present");
if(failures)process.exitCode=1;
else console.log("PASS: game root, required files, JS syntax and single entry.");
