import { test, expect } from "@playwright/test";

const POSE = "./?visualShot=shot-03-first-pier&x=27&z=8&yaw=-1.5708&pitch=-.12&fishSeed=4";

async function ready(page) {
  await page.waitForFunction(() => ["ready", "unsupported", "failed"].includes(window.__pixelGame?.read().status), null, { timeout: 30000 });
  return (await page.evaluate(() => window.__pixelGame.read().status)) !== "unsupported";
}

test("lure fishing from the pier: hold to charge, release to cast, then the lure is retrieved", async ({ page }) => {
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(POSE);
  if (!(await ready(page))) return;
  const button = page.locator("#fish-button");
  await expect(button).toBeVisible();
  await expect(button).toHaveText("按住蓄力 (F)");
  await page.keyboard.down("f");
  await expect(page.locator("#fish-meter")).toBeVisible();
  await expect(button).toHaveText("放開拋竿！");
  await page.keyboard.up("f");
  await expect(button).toHaveText("按住收線 (F)", { timeout: 20000 });
  await expect(page.locator("#fish-distance")).toContainText("路亞距離");
  const distance = async () => Number.parseFloat((await page.locator("#fish-distance").textContent()).match(/([\d.]+) 公尺/)[1]);
  const before = await distance();
  await page.keyboard.down("f");
  await page.waitForTimeout(3000);
  await page.keyboard.up("f");
  const after = await distance().catch(() => before);
  expect(after).toBeLessThan(before);
  expect(errors).toEqual([]);
});

test("fishing refuses to cast away from the sea", async ({ page }) => {
  await page.goto("./?visualShot=shot-03-first-pier&x=27&z=8&yaw=1.5708&pitch=-.05&fishSeed=4"); // looking back at the land
  if (!(await ready(page))) return;
  await page.keyboard.down("f");
  await expect(page.locator("#fish-meter")).toBeVisible();
  await page.keyboard.up("f");
  await expect(page.locator("#fish-status")).toContainText("對準海面", { timeout: 15000 });
  await expect(page.locator("#fish-button")).toHaveText("按住蓄力 (F)");
});
