import { test, expect } from "@playwright/test";

test.skip(({isMobile})=>isMobile,"Pointer lock is a desktop mouse interaction");

async function startFirstPerson(page){
  await page.goto("./");
  await page.waitForFunction(()=>window.__pixelGame?.read().status==="ready",null,{timeout:45000});
  await page.keyboard.press("2");
  await expect(page.locator("#hint")).toContainText("點擊畫面開始環視");
}

async function lockCanvas(page){
  await page.locator("#stage").click({position:{x:400,y:350}});
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id)).toBe("stage");
}

test("desktop mouse look responds to simulated lock transitions",async({page})=>{
  // Headless Chromium can reject the real API; this exercises application state, not browser locking.
  await page.addInitScript(()=>{
    let locked=null;
    Object.defineProperty(document,"pointerLockElement",{get:()=>locked});
    document.hasFocus=()=>true;
    document.exitPointerLock=()=>{locked=null;document.dispatchEvent(new Event("pointerlockchange"));};
    HTMLCanvasElement.prototype.requestPointerLock=function(){
      locked=this;document.dispatchEvent(new Event("pointerlockchange"));return Promise.resolve();
    };
    window.addEventListener("keydown",e=>{if(e.key==="Escape"&&locked)document.exitPointerLock();});
  });
  await startFirstPerson(page);
  await lockCanvas(page);
  await expect(page.locator("#hint")).toContainText("Esc 顯示游標");
  const before=await page.evaluate(()=>window.__pixelGame.read().yaw);
  await page.mouse.move(550,350,{steps:3});
  await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().yaw)).not.toBe(before);
  await page.keyboard.press("Escape");
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement)).toBeNull();
  await expect(page.locator("#hint")).toContainText("點擊畫面開始環視");
  await page.locator("#menu-toggle").click();
  await expect(page.locator("#settings")).toBeVisible();
  await page.locator("#menu-close").click();
  await lockCanvas(page);
  await page.keyboard.press("3");
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement)).toBeNull();
  await page.keyboard.press("2");
  await lockCanvas(page);
  await page.evaluate(()=>window.dispatchEvent(new Event("blur")));
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement)).toBeNull();
});

test("real browser pointer lock",async({page})=>{
  await page.addInitScript(()=>{
    const request=HTMLCanvasElement.prototype.requestPointerLock;
    HTMLCanvasElement.prototype.requestPointerLock=function(...args){
      const result=request.apply(this,args);
      if(result)result.catch(error=>{window.__lockError=error.name;});
      return result;
    };
  });
  await startFirstPerson(page);
  await page.locator("#stage").click({position:{x:400,y:350}});
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement?.id||window.__lockError)).toBeTruthy();
  const result=await page.evaluate(()=>({locked:document.pointerLockElement?.id,error:window.__lockError}));
  test.skip(result.error==="WrongDocumentError","Chromium test environment cannot acquire pointer lock");
  expect(result.locked).toBe("stage");
  await page.keyboard.press("Escape");
  await expect.poll(()=>page.evaluate(()=>document.pointerLockElement)).toBeNull();
  await lockCanvas(page);
});

test("unavailable pointer lock falls back to drag look",async({page})=>{
  await page.addInitScript(()=>{HTMLCanvasElement.prototype.requestPointerLock=undefined;});
  await startFirstPerson(page);
  const before=await page.evaluate(()=>window.__pixelGame.read().yaw);
  await page.mouse.move(400,350);await page.mouse.down();
  await expect(page.locator("#hint")).toContainText("拖曳環視");
  await page.mouse.move(500,350,{steps:3});await page.mouse.up();
  await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().yaw)).not.toBe(before);
});
