import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const read=p=>readFileSync(new URL("../"+p,import.meta.url));
// Vendored third-party skill (DietrichGebert/ponytail v5.3.3, commit 7801d06, MIT). It is copied verbatim: an edit would silently
// change how every agent works, so the bytes are pinned. To upgrade, update the file and this hash in one reviewed PR (Issue #81).
const PINNED_SHA256="9badd22a32e19cb884e46dfa8d3aae82bb81dfa5484105b8b4f0262df823a509";
test("the vendored ponytail skill is exactly the pinned upstream version",()=>{
  assert.equal(createHash("sha256").update(read(".claude/skills/ponytail/SKILL.md")).digest("hex"),PINNED_SHA256);
});
test("the vendored skill keeps its licence and carries no code or links to run",()=>{
  const licence=String(read(".claude/skills/ponytail/LICENSE"));
  assert.match(licence,/^MIT License/);
  assert.match(licence,/DietrichGebert/);
  const skill=String(read(".claude/skills/ponytail/SKILL.md"));
  assert.match(skill,/^---\nname: ponytail\n/);
  assert.match(skill,/\nlicense: MIT\n/);
  assert.doesNotMatch(skill,/https?:\/\//,"a skill that links out is a skill that can change after review");
  assert.doesNotMatch(skill,/```/,"no code blocks to execute");
});
test("the tooling doc records the source, the pin and how to turn it off",()=>{
  const doc=String(read("docs/TOOLING.md"));
  assert.match(doc,/Ponytail skill/);
  assert.match(doc,/7801d06/);
  assert.match(doc,/\.claude\/skills\/ponytail\//);
});
