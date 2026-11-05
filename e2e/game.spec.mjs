import { test, expect } from "@playwright/test";

test("visiting root opens full-viewport scene with no landing page",async({page})=>{
  const errors=[];page.on("pageerror",err=>errors.push(err.message));
  const shaderErrors=[];
  page.on("console",msg=>{
    if(msg.type()==="error"&&/Shader Error|WebGLProgram|VALIDATE_STATUS|COMPILE_STATUS/i.test(msg.text()))
      shaderErrors.push(msg.text());
  });
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
    expect(diagnostics.camera).toBe("quarter");
    expect(diagnostics.scenery).toBe(4);
    expect(diagnostics.projection).toBe("perspective"); // diorama lens by default
    await expect.poll(async()=> (await page.evaluate(()=>window.__pixelGame.read())).drawCalls).toBeGreaterThan(0);
    await expect.poll(async()=> (await page.evaluate(()=>window.__pixelGame.read())).frames).toBeGreaterThan(2);
  }else{
    await expect(page.getByRole("alert")).toBeVisible();
  }
  expect(shaderErrors).toEqual([]);
  expect(errors).toEqual([]);
});
test("camera exploration, collision-safe movement and quality menu work",async({page})=>{
  const errors=[];page.on("pageerror",err=>errors.push(err.message));
  await page.goto("./");
  await page.waitForFunction(()=>["ready","unsupported","failed"].includes(window.__pixelGame?.read().status),null,{timeout:18000});
  const before=await page.evaluate(()=>window.__pixelGame.read());
  if(before.status==="ready"){
    // Hold until the player has really moved: software rendering may take longer than a fixed press per frame.
    await page.keyboard.down("d");
    try{
      await expect.poll(async()=>{
        const p=(await page.evaluate(()=>window.__pixelGame.read())).player;
        return Math.hypot(p.x-before.player.x,p.z-before.player.z);
      },{timeout:15000}).toBeGreaterThan(.2);
    }finally{await page.keyboard.up("d");}
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

test("three camera modes retain safe movement, perspective and settings",async({page})=>{
  const errors=[],shaderErrors=[];
  page.on("pageerror",err=>errors.push(err.message));
  page.on("console",msg=>{if(msg.type()==="error"&&/WebGLProgram|Shader Error|VALIDATE_STATUS|COMPILE_STATUS/i.test(msg.text()))shaderErrors.push(msg.text());});
  await page.goto("./");
  await page.waitForFunction(()=>["ready","unsupported","failed"].includes(window.__pixelGame?.read().status),null,{timeout:22000});
  if((await page.evaluate(()=>window.__pixelGame.read())).status!=="ready")return;
  await page.locator("#view-toggle").click();
  await expect(page.locator("#view-toggle")).toContainText("第一人稱");
  await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().projection)).toBe("perspective");
  let before=await page.evaluate(()=>window.__pixelGame.read());
  // Software rendering can take longer than a fixed key press per frame, so hold the key until the
  // player has genuinely moved instead of assuming a frame rate.
  await page.keyboard.down("w");
  try{
    await expect.poll(async()=>{
      const p=(await page.evaluate(()=>window.__pixelGame.read())).player;
      return Math.hypot(p.x-before.player.x,p.z-before.player.z);
    },{timeout:15000}).toBeGreaterThan(.2);
  }finally{await page.keyboard.up("w");}
  let after=await page.evaluate(()=>window.__pixelGame.read());
  // Look drag must affect the real camera, not just an inactive UI label.
  const box=await page.locator("#stage").boundingBox();
  await page.mouse.move(box.x+box.width*.77,box.y+box.height*.58);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width*.83,box.y+box.height*.58,{steps:3});
  await page.mouse.up();
  after=await page.evaluate(()=>window.__pixelGame.read());
  expect(after.camera).toBe("first");
  expect(after.yaw).not.toBe(before.yaw);
  // A real hit-test catches Canvas occluding the HUD after dragging, not just a synthetic click.
  const switchBounds=await page.locator("#view-toggle").boundingBox();
  expect(switchBounds).not.toBeNull();
  const topTarget=await page.evaluate(({x,y,width,height})=>
    document.elementFromPoint(x+width/2,y+height/2)?.closest("#view-toggle")?.id??null,
    switchBounds);
  expect(topTarget).toBe("view-toggle");
  await page.locator("#view-toggle").click();
  await expect(page.locator("#view-toggle")).toContainText("風景");
  await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().camera)).toBe("vista");
  before=await page.evaluate(()=>window.__pixelGame.read());
  await page.keyboard.down("w");await page.waitForTimeout(220);await page.keyboard.up("w");
  after=await page.evaluate(()=>window.__pixelGame.read());
  expect(after.player).toEqual(before.player);
  await page.keyboard.press("1");
  await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().projection)).toBe("perspective");
  await page.locator("#menu-toggle").click();
  await page.locator("#camera-mode").selectOption("first");
  await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().camera)).toBe("first");
  await page.locator("#menu-close").click();
  expect(shaderErrors).toEqual([]);
  expect(errors).toEqual([]);
});
