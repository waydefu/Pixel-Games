import { test, expect } from "@playwright/test";

test("mobile joystick and look respond to separate fingers",async({page,isMobile})=>{
  test.skip(!isMobile,"Touch controls are tested on the mobile viewport");
  await page.goto("./");
  await page.waitForFunction(()=>window.__pixelGame?.read().status==="ready",null,{timeout:45000});
  await page.locator("#view-toggle").tap();
  await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().camera)).toBe("first");
  const joystick=await page.locator("#joystick").boundingBox();
  const viewport=page.viewportSize();
  const left={x:Math.round(joystick.x+joystick.width/2),y:Math.round(joystick.y+joystick.height/2),id:1};
  const right={x:Math.round(viewport.width*.75),y:Math.round(viewport.height*.5),id:2};
  const cdp=await page.context().newCDPSession(page);
  const before=await page.evaluate(()=>window.__pixelGame.read());
  try{
    await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[left]});
    await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[left,right]});
    await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{...left,y:left.y-30},{...right,x:right.x-50}]});
    await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().yaw)).not.toBe(before.yaw);
    await expect.poll(async()=>{
      const p=(await page.evaluate(()=>window.__pixelGame.read())).player;
      return Math.hypot(p.x-before.player.x,p.z-before.player.z);
    },{timeout:15000}).toBeGreaterThan(.1);
  }finally{
    await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
    await cdp.detach();
  }
});
