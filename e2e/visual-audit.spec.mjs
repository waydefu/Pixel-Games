import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { VISUAL_SHOTS } from "../src/game/visual-audit.js";

// The smoke runs in normal CI. Full screenshot capture is explicitly opt-in:
// VISUAL_AUDIT=1 npx playwright test e2e/visual-audit.spec.mjs
test("canonical visual audit URL uses the real game and a fixed camera pose",async({page})=>{
  const shaderErrors=[];
  page.on("console",msg=>{
    if(msg.type()==="error"&&/Shader Error|WebGLProgram|VALIDATE_STATUS|COMPILE_STATUS/i.test(msg.text()))
      shaderErrors.push(msg.text());
  });
  await page.goto("./?visualShot=shot-02-first-wall");
  await page.waitForFunction(()=>["ready","unsupported","failed"].includes(window.__pixelGame?.read().status),null,{timeout:22000});
  const d=await page.evaluate(()=>window.__pixelGame.read());
  if(d.status==="unsupported")return; // Headless WebGL2 might be unavailable.
  expect(d.status).toBe("ready");
  expect(d.visualShot).toBe("shot-02-first-wall");
  expect(d.camera).toBe("first");
  expect(d.projection).toBe("perspective");
  expect(d.player.x).toBe(-12);
  expect(d.player.z).toBe(-4.9);
  await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().frames)).toBeGreaterThan(2);
  expect(shaderErrors).toEqual([]);
});

for(const shot of VISUAL_SHOTS){
  test("capture "+shot.id,async({page},testInfo)=>{
    test.skip(process.env.VISUAL_AUDIT!=="1","Full PNG capture requires explicit opt-in");
    test.skip(shot.status!=="supported",shot.reason??"not available in current game");
    test.skip(shot.viewport==="mobile" ? testInfo.project.name!=="mobile-chromium" :
      testInfo.project.name!=="desktop-chromium","Shot belongs to the other viewport");

    await page.goto("./?visualShot="+encodeURIComponent(shot.id));
    await page.waitForFunction(()=>["ready","unsupported","failed"].includes(window.__pixelGame?.read().status),null,{timeout:22000});
    const diag=await page.evaluate(()=>window.__pixelGame.read());
    expect(diag.status).toBe("ready");
    expect(diag.visualShot).toBe(shot.id);
    await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().frames)).toBeGreaterThan(3);
    const output=resolve(process.env.VISUAL_AUDIT_DIR??"visual-audit-output",testInfo.project.name);
    await mkdir(output,{recursive:true});
    const quality=process.env.VISUAL_AUDIT_QUALITY??"balanced";
    if(!["basic","balanced","high"].includes(quality))throw new Error("Unsupported visual audit quality");
    if(quality!=="balanced"){
      await page.locator("#menu-toggle").click();
      await page.locator("#quality").selectOption(quality);
      await page.locator("#menu-close").click();
      await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().frames)).toBeGreaterThan(diag.frames+2);
    }
    const png=join(output,shot.id+".png");
    await page.locator("#stage").screenshot({path:png,animations:"disabled"});
    const measurements=await page.evaluate(()=>({
      state:window.__pixelGame.read(),
      viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},
      userAgent:navigator.userAgent,
    }));
    const metadata={
      id:shot.id,shot,project:testInfo.project.name,quality,
      commit:process.env.GITHUB_SHA??"NOT_RECORDED",
      capturedAt:new Date().toISOString(),
      ...measurements,
      gpuTime:"NOT MEASURED",phoneThermals:"NOT RUN",humanVisualReview:"NOT RUN",
    };
    await writeFile(join(output,shot.id+".json"),JSON.stringify(metadata,null,2)+"\n");
    await testInfo.attach(shot.id,{path:png,contentType:"image/png"});
  });
}
