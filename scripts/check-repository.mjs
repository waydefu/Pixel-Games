import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import { spawnSync } from "node:child_process";
import { listGames } from "../src/platform/registry.js";

const required = [
  "README.md", "AGENTS.md", "index.html", "styles.css", "package.json",
  "docs/INDEX.md", "docs/ARCHITECTURE.md", "docs/RESEARCH-ADOPTION.md",
  "docs/TOOL-INTEGRATIONS.md", "docs/TOOLING.md", "src/integrations/tool-registry.js", "assets/manifest.json",
  "package-lock.json", "vite.config.mjs", "tsconfig.json", "playwright.config.mjs", "lab/index.html", "lab/main.ts",
  ".github/workflows/ci.yml", ".github/pull_request_template.md"
];
let failures = 0;
function fail(message) { console.error("FAIL:", message); failures++; }
for (const path of required) if (!existsSync(path)) fail("missing " + path);

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}
for (const path of [...walk("src"), ...walk("scripts"), ...walk("tests"), ...walk("e2e")]) {
  if (![".js", ".mjs"].includes(extname(path))) continue;
  const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
  if (result.status !== 0) fail("syntax " + path + " " + (result.stderr || "").trim());
}
if (existsSync("index.html")) {
  const html = readFileSync("index.html", "utf8");
  for (const path of ["./styles.css", "./src/app.js"]) {
    if (!html.includes(path)) fail("entry missing asset reference " + path);
    if (!existsSync(path)) fail("entry references missing asset " + path);
  }
}
const seen = new Set();
for (const game of listGames()) {
  if (seen.has(game.id)) fail("duplicate game id " + game.id);
  seen.add(game.id);
  if (!existsSync(game.entry)) fail("missing game entry " + game.entry);
}
if (failures) process.exitCode = 1;
else console.log("PASS: required files, JS syntax, entry references and game catalog.");
