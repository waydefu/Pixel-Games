// Decides whether verify.yml runs the browser suites (see e2eDecision in pr-governance-core.mjs) and writes `e2e=true|false`
// to the step output. Any doubt means "run".
import {execFileSync} from "node:child_process";
import {appendFileSync} from "node:fs";
import {e2eDecision} from "./pr-governance-core.mjs";
const git=(...args)=>execFileSync("git",args,{encoding:"utf8"}).trim();
const event=process.env.GITHUB_EVENT_NAME??"";
let files=null;
if(event==="pull_request"){
  try{
    // A pull request is checked out as GitHub's merge commit, whose first parent is the tip of the base branch: the diff
    // against it is exactly what the pull request changes. --no-renames lists both sides of a move out of docs/.
    if(git("rev-list","--parents","-n","1","HEAD").split(/\s+/).length===3)
      files=git("diff","--name-only","--no-renames","HEAD^1","HEAD").split("\n").filter(Boolean);
  }catch(error){console.error("could not list the changed files: "+error.message);}
}
const decision=e2eDecision({requested:process.env.E2E_REQUESTED!=="false",event,files});
const line="Browser suites: "+(decision.run?"run":"SKIPPED")+" ("+decision.reason+")";
console.log(line);
if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,"e2e="+decision.run+"\n");
if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,line+"\n");
