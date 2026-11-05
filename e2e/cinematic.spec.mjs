import { test,expect } from "@playwright/test";

test("high quality exposes real cinematic effects without breaking camera switching",async({page})=>{
  const errors=[];
  page.on("console",msg=>{
    if(msg.type()==="error"&&/Shader Error|WebGLProgram|VALIDATE_STATUS|COMPILE_STATUS/i.test(msg.text()))
      errors.push(msg.text());
  });
  await page.goto("./?visualShot=shot-01-quarter-street");
  await page.waitForFunction(()=>["ready","unsupported","failed"].includes(window.__pixelGame?.read().status),null,{timeout:30000});
  if((await page.evaluate(()=>window.__pixelGame.read().status))==="unsupported")return;
  await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().frames)).toBeGreaterThan(2);
  let diag=await page.evaluate(()=>window.__pixelGame.read());
  expect(diag.status).toBe("ready");
  expect(diag.cinematic).toBe("bypassed");
  const before=diag.frames;
  await page.locator("#menu-toggle").click();
  await page.locator("#quality").selectOption("high");
  await page.locator("#menu-close").click();
  await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().frames)).toBeGreaterThan(before+2);
  diag=await page.evaluate(()=>window.__pixelGame.read());
  expect(diag.status).toBe("ready");
  expect(diag.cinematic).toBe("on");
  expect(errors).toEqual([]);
  await page.locator("#view-toggle").click();
  await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().camera)).toBe("first");
  await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().frames)).toBeGreaterThan(diag.frames+2);
  expect((await page.evaluate(()=>window.__pixelGame.read())).status).toBe("ready");
  await page.locator("#menu-toggle").click();
  await page.locator("#quality").selectOption("basic");
  await page.locator("#menu-close").click();
  await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().cinematic)).toBe("bypassed");
  expect(errors).toEqual([]);
});
