import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseClaim,validateClaim,validateAcceptance,validateTaskIssue,parseIssueForm,issueExecutor,gateDecision,e2eDecision,isDocsOnlyPath,sharedPaths,isCorePath,analyzeCollaboration,ACCEPTANCE_FIELD_FROM} from "../scripts/pr-governance-core.mjs";
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

const form=(executor)=>"### 優先級\nP1 - 主要功能／品質\n\n### 執行端（認領前維持未認領）\n"+executor+"\n\n### 預計影響模組／檔案\ngovernance\n";
const claim=(over={})=>({...parseClaim(body("#50")),...over});
test("an issue form body is read by heading, and the executor is found whatever the label says",()=>{
  assert.equal(parseIssueForm(form("A")).get("優先級"),"P1 - 主要功能／品質");
  assert.equal(issueExecutor(form("B")),"B");
  assert.equal(issueExecutor("### 執行端\nA\n"),"A");
  assert.equal(issueExecutor("no form at all"),null);
});
test("the task Issue must exist, be an open Issue, and name the same executor",()=>{
  const open={number:50,state:"open",body:form("A")};
  assert.deepEqual(validateTaskIssue(open,claim()),{errors:[],warnings:[]});
  assert.ok(validateTaskIssue(null,claim()).errors[0].includes("找不到"));
  assert.ok(validateTaskIssue({...open,pull_request:{}},claim()).errors[0].includes("是 PR"));
  assert.ok(validateTaskIssue({...open,state:"closed"},claim()).errors[0].includes("已關閉"));
  assert.ok(validateTaskIssue({...open,body:form("B")},claim()).errors[0].includes("由執行端 B 認領"));
  const unclaimed=validateTaskIssue({...open,body:form("未認領")},claim());
  assert.equal(unclaimed.errors.length,0);
  assert.ok(unclaimed.warnings[0].includes("未認領"));
  assert.ok(validateTaskIssue({...open,body:"free text"},claim()).warnings[0].includes("沒有「執行端」欄位"));
  assert.deepEqual(validateTaskIssue(null,claim({task:"HOTFIX-20261108-sky"})),{errors:[],warnings:[]});
});
test("the Issue check only applies to PRs under the new contract, and only when it was looked up",()=>{
  const pr={number:51,body:body("#50")+"- 驗收 Issue: 不適用\n"};
  assert.deepEqual(analyzeCollaboration(pr,[],[],new Map()).errors,[]);                          // not looked up
  assert.ok(analyzeCollaboration(pr,[],[],new Map(),null).errors.some(e=>e.includes("找不到")));    // looked up, missing
  assert.deepEqual(analyzeCollaboration({number:35,body:"old"},[],[],new Map(),null).errors,[]);   // legacy PR
});
test("unfinished real-device acceptance must be tracked by an Issue, for new PRs only",()=>{
  assert.deepEqual(validateAcceptance({acceptance:"不適用"}),[]);
  assert.deepEqual(validateAcceptance({acceptance:"#45"}),[]);
  assert.deepEqual(validateAcceptance({acceptance:"#45、#46"}),[]);
  assert.ok(validateAcceptance({acceptance:""}).length>0);
  assert.ok(validateAcceptance({acceptance:"待補"}).length>0);
  const missing={number:ACCEPTANCE_FIELD_FROM+1,body:body("#50")};
  assert.ok(analyzeCollaboration(missing,[],[],new Map()).errors.some(e=>e.includes("驗收 Issue")));
  const filled={number:ACCEPTANCE_FIELD_FROM+1,body:body("#50")+"- 驗收 Issue: #45\n"};
  assert.deepEqual(analyzeCollaboration(filled,[],[],new Map()).errors,[]);
  assert.deepEqual(analyzeCollaboration({number:ACCEPTANCE_FIELD_FROM,body:body("#50")},[],[],new Map()).errors,[]);
});
test("the required gate ignores a run a newer commit replaced, and nothing else",()=>{
  const ok={verify:"success",collaboration:"success",runSha:"a1",currentSha:"a1"};
  assert.equal(gateDecision(ok).ok,true);
  assert.equal(gateDecision({...ok,collaboration:"skipped"}).ok,true);
  // a real failure always fails, even on an old commit
  assert.equal(gateDecision({...ok,verify:"failure",runSha:"old",currentSha:"new"}).ok,false);
  assert.equal(gateDecision({...ok,verify:"cancelled",collaboration:"failure",runSha:"old",currentSha:"new"}).ok,false);
  // cancelled on the newest commit fails: nobody verified it
  assert.equal(gateDecision({...ok,verify:"cancelled"}).ok,false);
  // cancelled and replaced by a newer commit: obsolete, not failed
  const superseded=gateDecision({...ok,verify:"cancelled",collaboration:"cancelled",runSha:"old",currentSha:"new"});
  assert.equal(superseded.ok,true);assert.equal(superseded.superseded,true);
  assert.equal(gateDecision({...ok,verify:"success",collaboration:"cancelled",runSha:"old",currentSha:"new"}).ok,true);
  // the newest commit cannot be determined: fail closed
  assert.equal(gateDecision({verify:"cancelled",collaboration:"cancelled",runSha:"",currentSha:""}).ok,false);
  assert.equal(gateDecision({verify:"skipped",collaboration:"success",runSha:"old",currentSha:"new"}).ok,false);
});
test("browser suites are skipped only for an opted-out caller or a documentation-only pull request",()=>{
  const pr={requested:true,event:"pull_request"};
  assert.equal(e2eDecision({...pr,files:["docs/reviews/a.md","README.md","docs/FEATURE-STATUS.json"]}).run,false);
  assert.equal(e2eDecision({...pr,files:["docs/a.md","src/game/main.ts"]}).run,true);
  // a move out of docs/ lists both paths (the script diffs with --no-renames), so the new location keeps the suites on
  assert.equal(e2eDecision({...pr,files:["docs/notes.md","src/notes.md"]}).run,true);
  // nested Markdown, workflows, tests and anything else outside docs/ are not documentation for this purpose
  for(const path of [".github/workflows/ci.yml",".claude/skills/ponytail/SKILL.md","e2e/a.spec.mjs","docsx/a.md","package.json","public/docs/a.md"])
    assert.equal(isDocsOnlyPath(path),false,path);
  // anything undetermined runs them: unknown or empty file list, any event other than a pull request
  assert.equal(e2eDecision({...pr,files:null}).run,true);
  assert.equal(e2eDecision({...pr,files:[]}).run,true);
  assert.equal(e2eDecision({requested:true,event:"push",files:["docs/a.md"]}).run,true);
  assert.equal(e2eDecision({requested:true,event:"workflow_dispatch",files:null}).run,true);
  // the Pages deploy opts out explicitly
  assert.equal(e2eDecision({requested:false,event:"push",files:null}).run,false);
});
test("only the Pages deploy opts out of the browser suites, and main still runs them",()=>{
  const read=name=>readFileSync(new URL("../.github/workflows/"+name,import.meta.url),"utf8");
  const verify=read("verify.yml"),ci=read("ci.yml"),deploy=read("deploy-pages.yml");
  assert.match(verify,/e2e:\n\s+description:[^\n]+\n\s+type: boolean\n\s+default: true/);
  assert.match(verify,/if: \$\{\{ needs\.build\.outputs\.e2e == 'true' \}\}/);
  assert.match(verify,/run: node scripts\/ci-e2e-scope\.mjs/);
  assert.match(deploy,/e2e: false/);
  assert.doesNotMatch(ci,/e2e: false/);
  assert.match(ci,/push:\n\s+branches: \[main\]/);   // the post-merge browser run that the deploy no longer waits for
});
test("the required check keeps its name and runs the gate script",()=>{
  const ci=readFileSync(new URL("../.github/workflows/ci.yml",import.meta.url),"utf8");
  assert.match(ci,/name: Build, typecheck, unit and browser tests/);
  assert.match(ci,/run: node scripts\/check-gate\.mjs/);
  assert.doesNotMatch(ci,/test "\$VERIFY_RESULT" = "success"/);
});
