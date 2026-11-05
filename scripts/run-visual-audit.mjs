import { spawn } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { VISUAL_SHOTS } from "../src/game/visual-audit.js";

// One command for all operating systems, with Playwright's existing preview server.
const out=resolve(process.env.VISUAL_AUDIT_DIR??"visual-audit-output");
await mkdir(out,{recursive:true});
await writeFile(join(out,"catalog.json"),JSON.stringify({
  createdAt:new Date().toISOString(),
  source:"Pixel-Games; opt-in URL visualShot, fixed scene time",
  shots:VISUAL_SHOTS,
  warning:"Playwright SwiftShader is NOT phone GPU/performance evidence. Dusk/night unsupported.",
},null,2)+"\n");
const child=spawn(process.execPath,["node_modules/playwright/cli.js","test","e2e/visual-audit.spec.mjs"],{
  env:{...process.env,VISUAL_AUDIT:"1",VISUAL_AUDIT_DIR:out},
  stdio:"inherit",
});
child.on("error",error=>{console.error(error);process.exitCode=1;});
child.on("exit",(code,signal)=>{process.exitCode=code??(signal?1:0);});
