import { test, expect } from "@playwright/test";

test("sound starts only after a user gesture, is controllable, and never throws", async ({ page }) => {
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto("./?visualShot=shot-03-first-pier&x=22&z=8");
  await page.waitForFunction(() => ["ready", "unsupported", "failed"].includes(window.__pixelGame?.read().status), null, { timeout: 30000 });
  if ((await page.evaluate(() => window.__pixelGame.read().status)) === "unsupported") return;
  expect(await page.evaluate(() => window.__pixelGame.read().audio)).toBe("off");     // browsers forbid sound before a gesture
  await page.keyboard.press("w");
  await expect.poll(() => page.evaluate(() => window.__pixelGame.read().audio), { timeout: 20000 }).not.toBe("off");
  await page.locator("#menu-toggle").click();
  await expect(page.locator("#vol-master")).toBeVisible();
  await page.locator("#audio-mute").check();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pixel-games.audio.v1")).muted)).toBe(true);
  expect(errors).toEqual([]);
});
