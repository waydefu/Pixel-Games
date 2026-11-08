// Pure policy, independently testable without GitHub or network.
export const LEGACY_PR_MAX=36; // PR #35/#36 predate this contract.
const core=new Set(["src/game/main.ts","src/game/world.ts","src/game/camera.ts","src/game/input.ts",
  "src/rendering/renderer-port.js","src/rendering/hd2d-pipeline.js",
  "package.json","package-lock.json","docs/FEATURE-STATUS.json"]);
export const isCorePath=p=>core.has(p)||p.startsWith(".github/workflows/")||
  /^src\/game\/(?:save|inventory|persistence)(?:[-/.]|$)/.test(p);
export function parseClaim(body){
  const map=new Map();
  for(const line of String(body??"").split(/\r?\n/)){
    const match=line.match(/^\s*[-*]\s*(任務|執行端|影響模組|相依 PR|起始 main|交集處理)\s*[:：]\s*(.*?)\s*$/);
    if(match)map.set(match[1],match[2].trim());
  }
  return {task:map.get("任務")??"",agent:map.get("執行端")??"",
    module:map.get("影響模組")??"",dependencies:map.get("相依 PR")??"",
    base:map.get("起始 main")??"",integration:map.get("交集處理")??""};
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
export function sharedPaths(a,b){const x=new Set(b);return [...new Set(a)].filter(p=>x.has(p)).sort();}
export function integrationIsExplained(note,pr){
  return !!note&&!/待檢查|待確認|待處理|^無/.test(note)&&
    note.includes("#"+pr)&&/驗收|測試|回歸|test|e2e/i.test(note);
}
export function analyzeCollaboration(current,peers,changed,peerChanged){
  const warnings=[],errors=[],overlaps=[],claim=parseClaim(current.body);
  const enforced=current.number>LEGACY_PR_MAX;
  if(enforced)errors.push(...validateClaim(claim));
  else warnings.push("既有 PR #"+current.number+" 使用相容模式，不強制新範本");
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
  return {claim,warnings,errors,overlaps};
}
