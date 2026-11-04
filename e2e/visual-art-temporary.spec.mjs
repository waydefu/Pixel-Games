import { test, expect } from "@playwright/test";

test("TEMP visual art verification capture", async ({ page }, info) => {
  const gpuErrors=[];
  page.on("console",msg=>{if(msg.type()==="error")gpuErrors.push(msg.text());});
  await page.goto("./");
  await page.waitForFunction(() => window.__pixelGame?.read().frames > 12, null, { timeout: 20000 });
  const d = await page.evaluate(() => window.__pixelGame.read());
  expect(d.status).toBe("ready");
  const jpg = await page.screenshot({type:"jpeg", quality:57, animations:"disabled"});
  console.log("ART_GPU_ERRORS_"+info.project.name+"_"+JSON.stringify(gpuErrors.slice(0,8)));
  const sample=await page.evaluate(async b64=>{
    const image=new Image();image.src="data:image/jpeg;base64,"+b64;await image.decode();
    const c=document.createElement("canvas");c.width=image.width;c.height=image.height;
    const ctx=c.getContext("2d");ctx.drawImage(image,0,0);
    return [[.88,.72],[.93,.58],[.95,.87]].map(([x,y])=>
      [...ctx.getImageData(Math.floor(x*image.width),Math.floor(y*image.height),1,1).data].slice(0,3));
  },jpg.toString("base64"));
  console.log("ART_RGB_"+info.project.name+"_"+JSON.stringify(sample));
  console.log("ART_CAPTURE_BEGIN_" + info.project.name + "_" + jpg.toString("base64") + "_ART_CAPTURE_END");
});
