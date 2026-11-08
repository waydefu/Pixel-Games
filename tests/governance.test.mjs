import test from "node:test";
import assert from "node:assert/strict";
import {parseClaim,validateClaim,sharedPaths,isCorePath,analyzeCollaboration} from "../scripts/pr-governance-core.mjs";
const body=(task="#37",integration="無")=>"- 任務: "+task+"\n- 執行端: A\n- 影響模組: governance\n"+
  "- 相依 PR: 無\n- 起始 main: main@6056e6c\n- 交集處理: "+integration+"\n";
test("valid claim requires a real task and independent agent ID",()=>{
  assert.deepEqual(validateClaim(parseClaim(body())),[]);
  assert.ok(validateClaim(parseClaim("- 任務: #<Issue>\n- 執行端: A / B")).length>0);
});
test("duplicate Issue claims are blocked even when PR author is the same account",()=>{
  const result=analyzeCollaboration({number:38,body:body()},[{number:39,body:body()}],
    ["README.md"],new Map([[39,["docs/HANDOFF.md"]]]));
  assert.ok(result.errors.some(x=>x.includes("已由 PR")));
});
test("shared entrypoint requires explicit tested integration",()=>{
  const other=[{number:35,body:"legacy"}],files=["src/game/main.ts"];
  assert.deepEqual(sharedPaths(files,files),files);
  assert.equal(isCorePath(files[0]),true);
  assert.ok(analyzeCollaboration({number:38,body:body()},other,files,new Map([[35,files]])).errors.length>0);
  const good={number:38,body:body("#37","#35 合併後重跑第一人稱及時間控制 E2E 回歸測試")};
  assert.deepEqual(analyzeCollaboration(good,other,files,new Map([[35,files]])).errors,[]);
});
test("non-core overlap warns without failing",()=>{
  const result=analyzeCollaboration({number:38,body:body()},[{number:36,body:"other"}],
    ["README.md"],new Map([[36,["README.md"]]]));
  assert.equal(result.errors.length,0);
  assert.equal(result.warnings.length,1);
});
test("pre-policy PRs remain compatible",()=>{
  assert.deepEqual(analyzeCollaboration({number:35,body:"old" },[],[],new Map()).errors,[]);
});
