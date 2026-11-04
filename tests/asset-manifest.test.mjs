import test from "node:test";
import assert from "node:assert/strict";
import { validateAssetManifest, isSafeAssetPath } from "../src/platform/asset-manifest.js";
const item={id:"hero-sprite",path:"assets/sprites/hero.png",author:"Original",license:"CC0-1.0",source:"original",sha256:"a".repeat(64)};
test("empty manifest valid, extended glTF companions supported",()=> {
  assert.deepEqual(validateAssetManifest({version:1,assets:[]}),[]);
  assert.equal(validateAssetManifest({version:1,assets:[item]})[0],item);
  for(const ext of ["bin","ktx2","gltf","glb","hdr"]) assert.equal(isSafeAssetPath("assets/scene/model."+ext),true);
});
test("invalid paths, duplicate IDs and missing provenance rejected",()=> {
  for(const path of ["../hero.png","assets/../hero.png","assets/.secret.png","assets/a/..hidden.png","https://x/x.png","assets/a/../../x.bin"]) {
    assert.throws(()=>validateAssetManifest({version:1,assets:[{...item,path}]}));
  }
  assert.throws(()=>validateAssetManifest({version:1,assets:[item,item]}),/duplicate/);
  assert.throws(()=>validateAssetManifest({version:1,assets:[{...item,source:"http://x"}]}),/source/);
  assert.throws(()=>validateAssetManifest({version:1,assets:[{...item,sha256:"x"}]}),/sha256/);
});
