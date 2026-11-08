import {existsSync,readFileSync} from "node:fs";
const text=p=>readFileSync(p,"utf8");
const required=["AGENTS.md","README.md",".github/copilot-instructions.md",
  ".github/pull_request_template.md",".github/ISSUE_TEMPLATE/development-task.yml",
  ".github/ISSUE_TEMPLATE/bug-report.yml","docs/CONTRIBUTING.md","docs/HANDOFF.md",
  "docs/ROADMAP.md","docs/FEATURE-STATUS.json","docs/decisions/DECISION-REGISTER.md",
  "scripts/pr-governance-core.mjs","scripts/check-pr-collaboration.mjs"];
const errors=[];
for(const path of required)if(!existsSync(path))errors.push("missing "+path);
if(!errors.length){
  const state=JSON.parse(text("docs/FEATURE-STATUS.json"));
  if(state.schemaVersion!==1||!Array.isArray(state.features))errors.push("feature ledger schema");
  const ids=new Set();
  for(const f of state.features){
    if(ids.has(f.id))errors.push("duplicate feature "+f.id);
    ids.add(f.id);
    if(!["implemented","in-progress","planned"].includes(f.status))errors.push("bad feature status "+f.id);
    if(f.status==="implemented"&&(!f.paths?.length||!f.pr?.length))errors.push("feature lacks evidence "+f.id);
    for(const p of f.paths??[])if(!existsSync(p))errors.push("stale evidence "+f.id+" -> "+p);
  }
  for(const id of ["fishing","rowing","clouds","weather","audio","inventory","save-export"])
    if(!ids.has(id))errors.push("missing capability "+id);
  for(const p of ["README.md","AGENTS.md","docs/ROADMAP.md","docs/HANDOFF.md"])
    if(!text(p).includes("FEATURE-STATUS"))errors.push("missing feature ledger link: "+p);
  if(/PR\s*#22.{0,80}(尚未合併|開啟中)|釣魚.{0,40}(尚未實作|尚不是已完成功能)/.test(text("docs/ROADMAP.md")))
    errors.push("ROADMAP contains superseded November 5 claims");
  const tpl=text(".github/pull_request_template.md");
  for(const part of ["任務:","執行端:","影響模組:","相依 PR:","起始 main:","交集處理:"])
    if(!tpl.includes(part))errors.push("PR template missing "+part);
  if(!text("docs/decisions/DECISION-REGISTER.md").includes("SUPERSEDED"))errors.push("missing decision lifecycle");
}
if(errors.length){for(const e of errors)console.error("FAIL governance: "+e);process.exitCode=1;}
else console.log("PASS: governance documentation and feature/source consistency");
