import { test, expect } from "@playwright/test";

// Seed 4 gives a bite about 7.4 s after the cast, long enough that slow software rendering cannot miss the wait.
const POSE = "./?visualShot=shot-03-first-pier&x=27&z=8&yaw=-1.5708&pitch=-.12&fishSeed=4";

test("fishing from the pier: cast, wait, and reeling in too early lets the fish go", async ({ page }) => {
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(POSE);
  await page.waitForFunction(() => ["ready", "unsupported", "failed"].includes(window.__pixelGame?.read().status), null, { timeout: 30000 });
  if ((await page.evaluate(() => window.__pixelGame.read().status)) === "unsupported") return;
  const button = page.locator("#fish-button");
  await expect(button).toBeVisible();
  await expect(button).toHaveText("拋竿 (F)");
  await page.keyboard.press("f");
  await expect(button).toHaveText("收竿 (F)", { timeout: 15000 });
  await expect(page.locator("#fish-status")).toContainText("等待魚上鉤");
  await button.click();
  await expect(page.locator("#fish-status")).toContainText("收太早");
  await expect(button).toHaveText("繼續 (F)");
  await button.click();
  await expect(button).toHaveText("拋竿 (F)");
  expect(errors).toEqual([]);
});

test("fishing refuses to cast away from the sea", async ({ page }) => {
  await page.goto("./?visualShot=shot-03-first-pier&x=27&z=8&yaw=1.5708&pitch=-.05&fishSeed=4"); // looking back at the land
  await page.waitForFunction(() => ["ready", "unsupported", "failed"].includes(window.__pixelGame?.read().status), null, { timeout: 30000 });
  if ((await page.evaluate(() => window.__pixelGame.read().status)) === "unsupported") return;
  await page.keyboard.press("f");
  await expect(page.locator("#fish-status")).toContainText("對準海面");
  await expect(page.locator("#fish-button")).toHaveText("拋竿 (F)");
});
