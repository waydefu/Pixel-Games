import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/check-assets.mjs", import.meta.url));
const digest = content => createHash("sha256").update(content).digest("hex");
const record = (path, content) => ({
  id: path.split("/").pop().replace(/\./g,"-"),
  path, author: "Original test fixture", license: "CC0-1.0", source: "original",
  sha256: digest(content),
});
test("glTF companion dependencies and orphan assets are independently verified", () => {
  const root = mkdtempSync(join(tmpdir(), "pixel-assets-"));
  try {
    mkdirSync(join(root,"assets","scene"),{recursive:true});
    const base = JSON.stringify({buffers:[{uri:"mesh.bin"}],images:[{uri:"tex.ktx2"}]});
    const files = {
      "assets/scene/model.gltf":base,
      "assets/scene/mesh.bin":"test-binary",
      "assets/scene/tex.ktx2":"test-texture",
    };
    for (const [path, data] of Object.entries(files)) writeFileSync(join(root,path),data);
    const manifest = {version:1,assets:Object.entries(files).map(([p,c])=>record(p,c))};
    function writeManifest() { writeFileSync(join(root,"assets","manifest.json"),JSON.stringify(manifest)); }
    function run() {return spawnSync(process.execPath,[script],{cwd:root,encoding:"utf8"});}
    writeManifest();
    assert.equal(run().status,0,run().stderr);
    writeFileSync(join(root,"assets","orphan.png"),"bad");
    assert.notEqual(run().status,0);
    unlinkSync(join(root,"assets","orphan.png"));
    const bad=JSON.stringify({buffers:[{uri:"https://evil.test/data.bin"}]});
    writeFileSync(join(root,"assets","scene","model.gltf"),bad);
    manifest.assets.find(a=>a.path.endsWith(".gltf")).sha256=digest(bad);
    writeManifest();
    assert.notEqual(run().status,0);
  } finally { rmSync(root,{recursive:true,force:true}); }
});
