import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { validateAssetManifest } from "../src/platform/asset-manifest.js";

const assets = validateAssetManifest(JSON.parse(readFileSync("assets/manifest.json", "utf8")));
for (const asset of assets) {
  if (!existsSync(asset.path)) throw new Error("asset file missing: " + asset.path);
  const digest = createHash("sha256").update(readFileSync(asset.path)).digest("hex");
  if (digest !== asset.sha256) throw new Error("asset digest mismatch: " + asset.path);
}
console.log("PASS: " + assets.length + " registered asset(s), path and sha256 checked.");
