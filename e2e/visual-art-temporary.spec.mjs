import { test, expect } from "@playwright/test";

test("TEMP visual art verification capture", async ({ page }, info) => {
  await page.goto("./");
  await page.waitForFunction(() => window.__pixelGame?.read().frames > 12, null, { timeout: 20000 });
  const d = await page.evaluate(() => window.__pixelGame.read());
  expect(d.status).toBe("ready");
  const jpg = await page.screenshot({type:"jpeg", quality:57, animations:"disabled"});
  console.log("ART_CAPTURE_BEGIN_" + info.project.name + "_" + jpg.toString("base64") + "_ART_CAPTURE_END");
});
