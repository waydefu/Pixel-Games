// Textures are passed in, not created. Importing Three.js belongs to the renderer integration.
export function configurePixelTexture(THREE, texture, { kind = "color" } = {}) {
  if (!THREE || THREE.NearestFilter === undefined || THREE.ClampToEdgeWrapping === undefined || THREE.SRGBColorSpace === undefined || THREE.NoColorSpace === undefined) {
    throw new TypeError("A Three.js namespace with texture constants is required");
  }
  if (!texture || typeof texture !== "object") throw new TypeError("texture object required");
  if (!["color", "data"].includes(kind)) throw new RangeError("kind must be color or data");
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.colorSpace = kind === "color" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}
