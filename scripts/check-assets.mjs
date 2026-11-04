import { readFileSync, realpathSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { relative, posix, isAbsolute } from "node:path";
import { validateAssetManifest, isSafeAssetPath } from "../src/platform/asset-manifest.js";

const root = realpathSync(".");
const assets = validateAssetManifest(JSON.parse(readFileSync("assets/manifest.json", "utf8")));
const listed = new Set(assets.map(a => a.path));
function ensureRepoFile(assetPath) {
  if (!isSafeAssetPath(assetPath) || !existsSync(assetPath)) throw new Error("asset missing or unsafe: " + assetPath);
  const absolute = realpathSync(assetPath);
  const diff = relative(root, absolute);
  if (diff.startsWith("..") || isAbsolute(diff) || diff === "") throw new Error("asset escapes repository: " + assetPath);
  return absolute;
}
for (const asset of assets) {
  const file = ensureRepoFile(asset.path);
  const digest = createHash("sha256").update(readFileSync(file)).digest("hex");
  if (digest !== asset.sha256) throw new Error("asset SHA256 mismatch: " + asset.path);
  if (asset.path.endsWith(".gltf")) {
    const gltf = JSON.parse(readFileSync(file, "utf8"));
    const uris = [
      ...(gltf.buffers ?? []).map(b => b.uri),
      ...(gltf.images ?? []).map(i => i.uri),
    ].filter(uri => typeof uri === "string");
    for (const uri of uris) {
      if (uri.startsWith("data:")) continue;
      if (/^(?:[a-z]+:|\/|\\)/i.test(uri) || uri.includes("?") || uri.includes("#") || uri.includes("%")) {
        throw new Error("remote or absolute glTF reference prohibited: " + uri);
      }
      const ref = posix.normalize(posix.join(posix.dirname(asset.path), uri));
      if (!isSafeAssetPath(ref) || !listed.has(ref)) throw new Error("unregistered glTF resource: " + ref);
      ensureRepoFile(ref);
    }
  }
}
function assertRegistered(directory = "assets") {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = posix.join(directory.replaceAll("\\", "/"), entry.name);
    if (path === "assets/manifest.json") continue;
    if (entry.isDirectory()) assertRegistered(path);
    else if (!listed.has(path)) throw new Error("unregistered asset file: " + path);
  }
}
assertRegistered();
console.log("PASS: " + assets.length + " asset(s) validated with SHA256, glTF references and no orphan files.");
