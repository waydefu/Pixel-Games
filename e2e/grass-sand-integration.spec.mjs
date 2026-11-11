import { test, expect } from "@playwright/test";

test("photographic grass and sand load locally and render together",async({page})=>{
  const responses=[],shaderErrors=[];
  page.on("response",response=>{
    if(/grass_medium_01_bleed_2k|ambientcg-sand-(?:albedo|normal-roughness)/.test(response.url()))
      responses.push({url:response.url(),status:response.status()});
  });
  page.on("console",message=>{
    if(message.type()==="error"&&/Shader Error|WebGLProgram|VALIDATE_STATUS|COMPILE_STATUS/i.test(message.text()))
      shaderErrors.push(message.text());
  });
  await page.goto("./?visualShot=shot-16-grass-coast&weather=clear");
  await page.waitForFunction(()=>["ready","unsupported","failed"].includes(window.__pixelGame?.read().status),null,{timeout:30000});
  if((await page.evaluate(()=>window.__pixelGame.read().status))==="unsupported")return;
  await expect.poll(()=>responses.filter(x=>x.status===200).length,{timeout:45000}).toBe(3);
  expect(responses.every(x=>new URL(x.url).origin===new URL(page.url()).origin)).toBe(true);
  const start=await page.evaluate(()=>window.__pixelGame.read().frames);
  await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().frames),{timeout:45000}).toBeGreaterThan(start+1);
  expect(shaderErrors).toEqual([]);
});
