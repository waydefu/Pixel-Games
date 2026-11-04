import {test,expect} from "@playwright/test";

test("TEMP visual audit captures actual coastal art in three camera modes",async({page},info)=>{
  const errors=[];
  page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
  await page.goto("./");
  await page.waitForFunction(()=>window.__pixelGame?.read().frames>8,null,{timeout:22000});
  for(const [name,mode] of [["quarter","quarter"],["first","first"],["vista","vista"]]){
    if(mode!=="quarter")await page.locator("#view-toggle").click();
    await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().camera)).toBe(mode);
    await page.waitForTimeout(480);
    const jpg=await page.screenshot({type:"jpeg",quality:58,animations:"disabled"});
    console.log("VISUAL_AUDIT_"+info.project.name+"_"+name+"_BEGIN_"+jpg.toString("base64")+"_END");
  }
  expect(errors.filter(e=>/shader|WebGLProgram|VALIDATE_STATUS|COMPILE_STATUS/i.test(e))).toEqual([]);
});
