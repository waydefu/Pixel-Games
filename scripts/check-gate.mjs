// The required check. It decides from the results of the build/browser run and the collaboration check, and it does NOT turn a
// commit red just because its run was cancelled by a newer push (see gateDecision in pr-governance-core.mjs).
import {readFileSync} from "node:fs";
import {gateDecision} from "./pr-governance-core.mjs";
const verify=process.env.VERIFY_RESULT??"",collaboration=process.env.COLLAB_RESULT??"";
const repo=process.env.GITHUB_REPOSITORY,token=process.env.GITHUB_TOKEN;
let runSha="",currentSha="";
async function api(path){
  const response=await fetch("https://api.github.com/repos/"+repo+path,{headers:{"Accept":"application/vnd.github+json",
    "Authorization":"Bearer "+token,"X-GitHub-Api-Version":"2022-11-28"},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error("GitHub API "+response.status+" for "+path);
  return response.json();
}
// Only a cancelled run needs the newest commit; a success or a real failure is decided without the network.
if([verify,collaboration].includes("cancelled")&&repo&&token){
  try{
    if(process.env.GITHUB_EVENT_NAME==="pull_request"){
      const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,"utf8"));
      runSha=event.pull_request.head.sha;
      currentSha=(await api("/pulls/"+event.pull_request.number)).head.sha;
    }else if(process.env.GITHUB_EVENT_NAME==="push"){
      runSha=process.env.GITHUB_SHA;
      currentSha=(await api("/git/ref/heads/"+process.env.GITHUB_REF_NAME)).object.sha;
    }
  }catch(error){console.error("could not read the newest commit: "+error.message);}   // fail closed below
}
const decision=gateDecision({verify,collaboration,runSha,currentSha});
console.log((decision.ok?"PASS: ":"FAIL: ")+decision.reason);
if(!decision.ok)process.exitCode=1;
