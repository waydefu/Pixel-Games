// Inlines the built JS into index.html so the game is ONE file that opens from disk.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
const dist = new URL("./dist/", import.meta.url);
let html = readFileSync(new URL("index.html", dist), "utf8");
const js = readdirSync(new URL("assets/", dist)).filter(f => f.endsWith(".js"));
let injected = "";
for (const f of js) injected += readFileSync(new URL("assets/" + f, dist), "utf8").replace(/<\/script/gi, "<\\/script");
html = html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, "");
const tag = `<script type="module">${injected}</script>\n`;
html = html.replace("</body>", () => tag + "</body>");
const out = process.argv[2] || "out/medieval-town.html";
writeFileSync(new URL(out, import.meta.url), html);
console.log("wrote", out, (html.length / 1024).toFixed(0) + " KB");
