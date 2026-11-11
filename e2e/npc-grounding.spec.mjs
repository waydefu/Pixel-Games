import {test,expect} from "@playwright/test";

/** Run against the actual shipped scene, not a mocked movement controller. */
test("NPC crowd does not stack at startup, and every visible sprite foot anchors above its walk plane",async({page})=>{
  const browserErrors=[];
  page.on("pageerror",e=>browserErrors.push(e.message));
  await page.goto("./?visualShot=shot-06-mobile-portrait&weather=clear");
  await page.waitForFunction(()=>["ready","unsupported","failed"].includes(window.__pixelGame?.read().status),null,{timeout:30000});
  const diagnostics=await page.evaluate(()=>window.__pixelGame.read());
  if(diagnostics.status==="unsupported")return;
  expect(diagnostics.status).toBe("ready");
  await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().frames),{timeout:60000}).toBeGreaterThan(2);
  const state=await page.evaluate(()=>window.__pixelGame.read());
  expect(state.npc).toHaveLength(10);
  const {npc,player}=state;
  for(let i=0;i<npc.length;i++){
    const a=npc[i];
    expect(Math.abs(a.footY-(a.groundY+.015))).toBeLessThan(.005);
    expect(Math.hypot(a.x-player.x,a.z-player.z)).toBeGreaterThanOrEqual(a.radius+.5-.004);
    for(let j=i+1;j<npc.length;j++){
      const b=npc[j];
      expect(Math.hypot(a.x-b.x,a.z-b.z)).toBeGreaterThanOrEqual(a.radius+b.radius-.004);
    }
  }
  expect(browserErrors).toEqual([]);
});
