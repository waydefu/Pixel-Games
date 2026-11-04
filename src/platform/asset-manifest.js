// Side-effect-free manifest metadata validation. Content hash and glTF links
// are verified by scripts/check-assets.mjs on real files.
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DIGEST = /^[0-9a-f]{64}$/;
const EXT = /\.(png|webp|jpg|jpeg|avif|ogg|mp3|wav|glb|gltf|bin|ktx2|basis|hdr|exr|json)$/i;
export function isSafeAssetPath(path) {
  if (typeof path !== "string" || !path.startsWith("assets/") || !EXT.test(path)) return false;
  const segments = path.split("/");
  return segments.length >= 2 && segments.every(segment => segment !== "." && segment !== ".." &&
    /^[a-z0-9][a-z0-9._-]*$/i.test(segment) && !segment.startsWith(".") && !segment.includes(".."));
}
export function validateAssetManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || manifest.version !== 1 || !Array.isArray(manifest.assets)) {
    throw new TypeError("manifest must have version 1 and assets array");
  }
  const ids = new Set(), paths = new Set();
  for (const asset of manifest.assets) {
    if (!asset || typeof asset !== "object" || typeof asset.id !== "string" || !ID.test(asset.id)) throw new TypeError("invalid asset id");
    if (!isSafeAssetPath(asset.path)) throw new TypeError("invalid asset path: " + String(asset.path));
    if (ids.has(asset.id) || paths.has(asset.path)) throw new Error("duplicate asset id or path");
    for (const key of ["author", "license", "source"]) {
      if (typeof asset[key] !== "string" || !asset[key].trim()) throw new TypeError("missing asset " + key);
    }
    if (asset.source !== "original" && !/^https:\/\/[^\s]+$/i.test(asset.source)) throw new TypeError("asset source must be original or HTTPS");
    if (typeof asset.sha256 !== "string" || !DIGEST.test(asset.sha256)) throw new TypeError("asset sha256 must be lowercase 64-character hex");
    ids.add(asset.id); paths.add(asset.path);
  }
  return manifest.assets;
}
