import {readFileSync,appendFileSync,existsSync} from "node:fs";
import {analyzeCollaboration,LEGACY_PR_MAX} from "./pr-governance-core.mjs";
if(process.env.GITHUB_EVENT_NAME!=="pull_request"){
  console.log("SKIP: GitHub overlap scan is only for pull requests.");
}else{
  const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,"utf8"));
  const current=event.pull_request,repo=process.env.GITHUB_REPOSITORY,token=process.env.GITHUB_TOKEN;
  if(!current?.number||!repo||!token)throw Error("Missing read-only GitHub PR context");
  const root="https://api.github.com/repos/"+repo;
  const headers={"Accept":"application/vnd.github+json","Authorization":"Bearer "+token,
    "X-GitHub-Api-Version":"2022-11-28"};
  async function request(path){
    for(let retry=0;retry<3;retry++){
      const response=await fetch(root+path,{headers,signal:AbortSignal.timeout(20000)});
      if(response.ok)return response.json();
      if(retry<2&&[429,500,502,503,504].includes(response.status))continue;
      throw Error("GitHub API "+response.status+" while checking "+path);
    }
    throw Error("unreachable API path");
  }
  async function all(path){
    const items=[];
    for(let page=1;page<=10;page++){
      const chunk=await request(path+(path.includes("?")?"&":"?")+"per_page=100&page="+page);
      if(!Array.isArray(chunk))throw Error("Unexpected list payload");
      items.push(...chunk);
      if(chunk.length<100)return items;
    }
    throw Error("PR pagination limit exceeded; cannot validate overlaps safely");
  }
  const peers=(await all("/pulls?state=open")).filter(p=>p.number!==current.number);
  const paths=new Map();
  for(const p of [current,...peers])
    paths.set(p.number,(await all("/pulls/"+p.number+"/files")).map(f=>f.filename));
  const report=analyzeCollaboration(current,peers,paths.get(current.number),paths);
  const lines=["### PR 協作治理／重複任務與檔案交集",
    "- PR #"+current.number+"；自 #"+(LEGACY_PR_MAX+1)+" 開始強制協作格式",
    "- 任務："+(report.claim.task||"未填")+"／執行端："+(report.claim.agent||"未填"),
    ...report.overlaps.map(x=>"- 與 #"+x.number+" 共有："+x.files.join(", ")),
    ...report.warnings.map(w=>"- WARNING: "+w),
    ...report.errors.map(e=>"- ERROR: "+e),
    "- 只讀 GitHub API；未修改他人的 PR／Issue。"];
  const summary=lines.join("\n")+"\n";
  console.log(summary);
  if(process.env.GITHUB_STEP_SUMMARY&&existsSync(process.env.GITHUB_STEP_SUMMARY))
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
  for(const w of report.warnings)console.log("::warning::"+w.replace(/[\r\n]/g," "));
  for(const e of report.errors)console.error("::error::"+e.replace(/[\r\n]/g," "));
  if(report.errors.length)process.exitCode=1;
}
