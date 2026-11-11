import { test, expect } from "@playwright/test";

test("CC0 scanned sand atlases are served locally and render through the real WebGL2 material",async({page})=>{
  const photoResponses=[],shaderErrors=[];
  page.on("response",res=>{
    if(/ambientcg-sand-(?:albedo|normal-roughness)/.test(res.url()))
      photoResponses.push({url:res.url(),status:res.status()});
  });
  page.on("console",msg=>{
    if(msg.type()==="error"&&/Shader Error|WebGLProgram|VALIDATE_STATUS|COMPILE_STATUS/i.test(msg.text()))
      shaderErrors.push(msg.text());
  });
  await page.goto("./?visualShot=shot-02-first-wall");
  await page.waitForFunction(()=>["ready","unsupported","failed"].includes(window.__pixelGame?.read().status),null,{timeout:30000});
  if((await page.evaluate(()=>window.__pixelGame.read().status))==="unsupported")return;
  await expect.poll(()=>photoResponses.length,{timeout:30000}).toBe(2);
  expect(photoResponses.every(x=>x.status===200)).toBe(true);
  expect(photoResponses.every(x=>new URL(x.url).origin===new URL(page.url()).origin)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().frames),{timeout:45000}).toBeGreaterThan(2);
  expect(shaderErrors).toEqual([]);
});
