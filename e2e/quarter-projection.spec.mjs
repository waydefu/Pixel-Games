import { test,expect } from "@playwright/test";

test("quarter view defaults to the diorama lens and keeps the classic orthographic option",async({page})=>{
  await page.goto("./");
  await page.waitForFunction(()=>["ready","unsupported","failed"].includes(window.__pixelGame?.read().status),null,{timeout:30000});
  if((await page.evaluate(()=>window.__pixelGame.read().status))==="unsupported")return;
  await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().projection)).toBe("perspective");
  await page.locator("#menu-toggle").click();
  await page.locator("#quarter-projection").selectOption("orthographic");
  await page.locator("#menu-close").click();
  await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().projection)).toBe("orthographic");
  const frames=await page.evaluate(()=>window.__pixelGame.read().frames);
  await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().frames)).toBeGreaterThan(frames+2);
  await page.locator("#menu-toggle").click();
  await page.locator("#quarter-projection").selectOption("perspective");
  await page.locator("#menu-close").click();
  await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().projection)).toBe("perspective");
  expect((await page.evaluate(()=>window.__pixelGame.read())).pipeline).toBe("on");
});
