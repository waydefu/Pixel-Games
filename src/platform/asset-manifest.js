// Asset metadata contract; binary byte/hash verification runs in scripts/check-assets.mjs.
const FILE_PATH = /^assets\/(?:[a-z0-9][a-z0-9._-]*\/)*[a-z0-9][a-z0-9._-]*\.(?:png|webp|jpg|jpeg|ogg|mp3|wav|glb|gltf|json)$/i;
const IDENTIFIER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DIGEST = /^[a-f0-9]{64}$/;

export function validateAssetManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || manifest.version !== 1 || !Array.isArray(manifest.assets)) {
    throw new TypeError("manifest must have version 1 and an assets array");
  }
  const ids = new Set();
  const paths = new Set();
  for (const asset of manifest.assets) {
    if (!asset || typeof asset !== "object" || typeof asset.id !== "string" || !IDENTIFIER.test(asset.id)) throw new TypeError("invalid asset id");
    if (typeof asset.path !== "string" || !FILE_PATH.test(asset.path) || asset.path.includes("..")) throw new TypeError("invalid asset path: " + String(asset.path));
    if (ids.has(asset.id) || paths.has(asset.path)) throw new Error("duplicate asset id or path");
    for (const key of ["author", "license", "source"]) {
      if (typeof asset[key] !== "string" || !asset[key].trim()) throw new TypeError("missing asset " + key);
    }
    if (asset.source !== "original" && !/^https:\/\/[^\s]+$/i.test(asset.source)) throw new TypeError("asset source must be 'original' or https URL");
    if (typeof asset.sha256 !== "string" || !DIGEST.test(asset.sha256)) throw new TypeError("asset sha256 must be 64 lowercase hex chars");
    ids.add(asset.id);
    paths.add(asset.path);
  }
  return manifest.assets;
}
