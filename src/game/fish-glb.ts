import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { FISH_GLB_FILES, FLAT_FISH, toFishFrame } from "./fish-glb-frame.js";
import { FISH_SPECS } from "./fish-model.js";

/**
 * World Fish models (codepawl/world-fish-glb, CC0 1.0; credits in docs/ASSET-CREDITS.md), the dataset's `engine/` tier: a plain
 * glTF with WebP textures and no meshopt, so the stock GLTFLoader reads it and no decoder enters the JS budget. Vite resolves the
 * files to hashed URLs at build time, but a model is only downloaded the first time that fish is caught. Any failure resolves to
 * null and the procedural fish stays on screen.
 */
const urls = import.meta.glob("../../assets/models/fish/*.glb", { query: "?url", import: "default", eager: true }) as Record<string, string>;

export interface FishGeometry {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  /** The rest pose in the fish frame (copy), for the swimming wiggle. */
  positions: Float32Array<ArrayBuffer>;
  length: number;
}

const jobs = new Map<string, Promise<FishGeometry | null>>();

export function loadFishGeometry(id: string): Promise<FishGeometry | null> {
  const file = (FISH_GLB_FILES as Record<string, string>)[id];
  const spec = (FISH_SPECS as Record<string, { length: number }>)[id];
  if (!file || !spec) return Promise.resolve(null);
  let job = jobs.get(id);
  if (!job) {
    job = build(file, spec.length, FLAT_FISH.has(id)).catch(() => null);
    jobs.set(id, job);
  }
  return job;
}

async function build(file: string, length: number, flat: boolean): Promise<FishGeometry> {
  const url = urls["../../" + file];
  if (!url) throw new Error("fish model is not bundled: " + file);
  const gltf = await new GLTFLoader().loadAsync(url);
  gltf.scene.updateMatrixWorld(true);
  let source: THREE.Mesh | null = null;
  gltf.scene.traverse(node => { if (!source && (node as THREE.Mesh).isMesh) source = node as THREE.Mesh; });
  if (!source) throw new Error("no mesh in " + file);
  const mesh: THREE.Mesh = source;

  // Read through the accessor (de-quantised floats) and bake the node transform, so no integer-normalised data leaks through.
  const position = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
  const world = new Float32Array(position.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    world[i * 3] = v.x; world[i * 3 + 1] = v.y; world[i * 3 + 2] = v.z;
  }
  const framed = toFishFrame(world, { length, flat });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(framed, 3));
  const uv = mesh.geometry.getAttribute("uv") as THREE.BufferAttribute | undefined;
  if (uv) {
    const coords = new Float32Array(uv.count * 2);
    for (let i = 0; i < uv.count; i++) { coords[i * 2] = uv.getX(i); coords[i * 2 + 1] = uv.getY(i); }
    geometry.setAttribute("uv", new THREE.BufferAttribute(coords, 2));
  }
  const index = mesh.geometry.getIndex();
  if (index) geometry.setIndex(new THREE.BufferAttribute(Uint32Array.from(index.array), 1));
  geometry.computeVertexNormals();

  const source0 = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
  // Keep the file's alpha mode: the fins are BLEND, and without transparency their transparent texels draw as black.
  const material = new THREE.MeshStandardMaterial({ map: source0.map ?? null, roughness: .55, metalness: .08, side: THREE.DoubleSide,
    transparent: source0.transparent, alphaTest: source0.alphaTest });
  const rest = new Float32Array(framed.length);
  rest.set(framed);
  return { geometry, material, positions: rest, length };
}
