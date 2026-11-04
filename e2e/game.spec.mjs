import { test, expect } from "@playwright/test";

test("visiting root opens full-viewport scene with no landing page",async({page})=>{
  const errors=[];page.on("pageerror",err=>errors.push(err.message));
  await page.goto("./");
  await expect(page.getByRole("main",{name:/海岸探索/})).toBeVisible();
  await expect(page.locator("#stage")).toBeVisible();
  await expect(page.locator(".hero")).toHaveCount(0);
  await expect(page.locator("#settings")).toBeHidden();
  const viewport=page.viewportSize();
  const bounds=await page.locator("#stage").boundingBox();
  expect(bounds.width).toBeGreaterThanOrEqual(viewport.width-2);
  expect(bounds.height).toBeGreaterThanOrEqual(viewport.height-2);
  await page.waitForFunction(()=>["ready","unsupported","failed"].includes(window.__pixelGame?.read().status),null,{timeout:18000});
  const supported=await page.evaluate(()=>!!document.createElement("canvas").getContext("webgl2"));
  const diagnostics=await page.evaluate(()=>window.__pixelGame.read());
  if(supported){
    expect(diagnostics.status).toBe("ready");
    expect(diagnostics.camera).toBe("quarter-view");
    expect(diagnostics.projection).toBe("orthographic");
    await expect.poll(async()=> (await page.evaluate(()=>window.__pixelGame.read())).drawCalls).toBeGreaterThan(0);
    await expect.poll(async()=> (await page.evaluate(()=>window.__pixelGame.read())).frames).toBeGreaterThan(2);
  }else{
    await expect(page.getByRole("alert")).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test("camera exploration, collision-safe movement and quality menu work",async({page})=>{
  const errors=[];page.on("pageerror",err=>errors.push(err.message));
  await page.goto("./");
  await page.waitForFunction(()=>["ready","unsupported","failed"].includes(window.__pixelGame?.read().status),null,{timeout:18000});
  const before=await page.evaluate(()=>window.__pixelGame.read());
  if(before.status==="ready"){
    await page.keyboard.down("d");
    await page.waitForTimeout(520);
    await page.keyboard.up("d");
    const after=await page.evaluate(()=>window.__pixelGame.read());
    const distance=Math.hypot(after.player.x-before.player.x,after.player.z-before.player.z);
    expect(distance).toBeGreaterThan(.2);
  }
  await page.locator("#menu-toggle").click();
  await expect(page.locator("#settings")).toBeVisible();
  await expect(page.locator("#menu-toggle")).toHaveAttribute("aria-expanded","true");
  await page.locator("#quality").selectOption("basic");
  if(before.status==="ready"){
    await expect.poll(async()=>{
      const d=await page.evaluate(()=>window.__pixelGame.read());
      return d.bufferWidth*d.bufferHeight;
    }).toBeLessThanOrEqual(900_000);
  }
  await page.locator("#menu-close").click();
  await expect(page.locator("#settings")).toBeHidden();
  expect(errors).toEqual([]);
});
