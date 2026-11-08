// Pure policy, independently testable without GitHub or network.
export const LEGACY_PR_MAX=36; // PR #35/#36 predate this contract.
export const ACCEPTANCE_FIELD_FROM=50; // PRs numbered above this must also say where real-device acceptance is tracked.
const core=new Set(["src/game/main.ts","src/game/world.ts","src/game/camera.ts","src/game/input.ts",
  "src/rendering/renderer-port.js","src/rendering/hd2d-pipeline.js",
  "package.json","package-lock.json","docs/FEATURE-STATUS.json"]);
export const isCorePath=p=>core.has(p)||p.startsWith(".github/workflows/")||
  /^src\/game\/(?:save|inventory|persistence)(?:[-/.]|$)/.test(p);
export function parseClaim(body){
  const map=new Map();
  for(const line of String(body??"").split(/\r?\n/)){
    const match=line.match(/^\s*[-*]\s*(任務|執行端|影響模組|相依 PR|起始 main|交集處理|驗收 Issue)\s*[:：]\s*(.*?)\s*$/);
    if(match)map.set(match[1],match[2].trim());
  }
  return {task:map.get("任務")??"",agent:map.get("執行端")??"",
    module:map.get("影響模組")??"",dependencies:map.get("相依 PR")??"",
    base:map.get("起始 main")??"",integration:map.get("交集處理")??"",acceptance:map.get("驗收 Issue")??""};
}
export function validateClaim(c){
  const issues=[];
  if(!/^(?:#\d+|HOTFIX-\d{8}-[A-Za-z0-9-]+)$/.test(c.task))issues.push("任務必須是 #Issue 或 HOTFIX-YYYYMMDD-代號");
  if(!/^(A|B)$/.test(c.agent))issues.push("執行端必須填 A 或 B");
  if(!c.module||/^(例|待填|待確認|無|TODO)/i.test(c.module))issues.push("影響模組需填實際範圍");
  if(!/^(?:無|#\d+(?:\s*[,、]\s*#\d+)*)$/.test(c.dependencies))issues.push("相依 PR 必須是無或 #N 清單");
  if(!/^main@[a-f0-9]{7,40}$/i.test(c.base))issues.push("起始 main 必須是 main@SHA");
  return issues;
}
/** Where unfinished (NOT RUN) real-device or human acceptance is tracked: an Issue, or 不適用 for work that has none. */
export function validateAcceptance(c){
  return /^(?:不適用|#\d+(?:\s*[,、]\s*#\d+)*)$/.test(c.acceptance)?[]:
    ["驗收 Issue 必須是 #N 清單或「不適用」：真機／人工驗收尚未做（NOT RUN）時，要有 Issue 追蹤，否則會蒸發"];
}
/** Sections of an issue-form body: "### 標題" followed by its text. */
export function parseIssueForm(body){
  const sections=new Map();let key=null;
  for(const line of String(body??"").split(/\r?\n/)){
    const heading=line.match(/^###\s+(.+?)\s*$/);
    if(heading){key=heading[1];sections.set(key,"");continue;}
    if(key!==null)sections.set(key,sections.get(key)+line+"\n");
  }
  for(const [k,v] of sections)sections.set(k,v.trim());
  return sections;
}
export function issueExecutor(body){
  for(const [k,v] of parseIssueForm(body))if(k.startsWith("執行端"))return v.split(/\s+/)[0]||"";
  return null;
}
/** Does the PR's task Issue exist, is it an open Issue, and does it name the same executor? issue === null means 404. */
export function validateTaskIssue(issue,claim){
  const errors=[],warnings=[];
  if(!/^#\d+$/.test(claim.task))return {errors,warnings};      // HOTFIX tasks have no Issue
  if(!issue){errors.push("任務 "+claim.task+" 找不到：先建立並認領 Issue 再開 PR");return {errors,warnings};}
  if(issue.pull_request){errors.push("任務 "+claim.task+" 是 PR，不是 Issue");return {errors,warnings};}
  if(issue.state!=="open")errors.push("任務 "+claim.task+" 已關閉：重新開啟，或另開新 Issue");
  const executor=issueExecutor(issue.body);
  if(executor===null)warnings.push("任務 "+claim.task+" 沒有「執行端」欄位，無法確認誰認領");
  else if(executor==="未認領"||executor==="")warnings.push("任務 "+claim.task+" 仍是「未認領」：先把 Issue 的執行端改成 "+claim.agent+" 再動工");
  else if(/^(A|B)$/.test(executor)&&claim.agent&&executor!==claim.agent)
    errors.push("任務 "+claim.task+" 由執行端 "+executor+" 認領，這個 PR 填的是 "+claim.agent);
  return {errors,warnings};
}
/**
 * The required gate. A run that was cancelled because a newer commit replaced it is obsolete, not failed: it must not turn the
 * old commit red or raise a failure notice. Everything else still fails closed: a real failure, a cancelled run on the
 * newest commit, or a newest commit that cannot be determined.
 */
export function gateDecision({verify,collaboration,runSha,currentSha}){
  if(verify==="success"&&(collaboration==="success"||collaboration==="skipped"))return {ok:true,reason:"build and every browser shard passed"};
  const cancelled=verify==="cancelled"||collaboration==="cancelled";
  const failed=[verify,collaboration].some(r=>r==="failure");
  if(cancelled&&!failed&&runSha&&currentSha&&runSha!==currentSha)
    return {ok:true,superseded:true,reason:"run cancelled and superseded by newer commit "+String(currentSha).slice(0,7)+"; the newer run is the one that counts"};
  return {ok:false,reason:"verify="+verify+", collaboration="+collaboration+(cancelled&&!currentSha?" (newest commit unknown, failing closed)":"")};
}
export function sharedPaths(a,b){const x=new Set(b);return [...new Set(a)].filter(p=>x.has(p)).sort();}
export function integrationIsExplained(note,pr){
  return !!note&&!/待檢查|待確認|待處理|^無/.test(note)&&
    note.includes("#"+pr)&&/驗收|測試|回歸|test|e2e/i.test(note);
}
export function analyzeCollaboration(current,peers,changed,peerChanged,taskIssue=undefined){
  const warnings=[],errors=[],overlaps=[],claim=parseClaim(current.body);
  const enforced=current.number>LEGACY_PR_MAX;
  if(enforced)errors.push(...validateClaim(claim));
  else warnings.push("既有 PR #"+current.number+" 使用相容模式，不強制新範本");
  if(current.number>ACCEPTANCE_FIELD_FROM)errors.push(...validateAcceptance(claim));
  for(const peer of peers){
    if(peer.number===current.number)continue;
    const their=parseClaim(peer.body);
    if(enforced&&claim.task&&claim.task===their.task&&/^(?:#\d+|HOTFIX-\d{8}-[A-Za-z0-9-]+)$/.test(claim.task))
      errors.push("任務 "+claim.task+" 已由 PR #"+peer.number+" 認領");
    const files=sharedPaths(changed,peerChanged.get(peer.number)??[]);
    if(!files.length)continue;
    const critical=files.filter(isCorePath);
    overlaps.push({number:peer.number,files,critical});
    warnings.push("與 PR #"+peer.number+" 共用檔案："+files.join(", "));
    if(enforced&&critical.length&&!integrationIsExplained(claim.integration,peer.number))
      errors.push("與 PR #"+peer.number+" 共用核心 "+critical.join(", ")+"；交集處理需標記該 PR 與回歸驗收方案");
  }
  // taskIssue: undefined = not looked up (tests, legacy), null = looked up and missing
  if(enforced&&taskIssue!==undefined){const found=validateTaskIssue(taskIssue,claim);errors.push(...found.errors);warnings.push(...found.warnings);}
  return {claim,warnings,errors,overlaps};
}
