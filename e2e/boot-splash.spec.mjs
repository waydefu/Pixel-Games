import { test, expect } from "@playwright/test";

// The boot splash (index.html) shows a game log and a harbor entry permit, then a light ring until the world is ready.
// These tests block the game bundle and drive the splash through `window.__bootSplash.done(state)` exactly as main.ts does,
// so they do not depend on WebGL and stay fast under the software renderer.
const blockGame = (page) => page.route("**/assets/index-*.js", (route) => route.abort());
const splash = (page) => page.locator("#boot-splash");

test("automated browsers skip the boot splash so the other suites are unaffected", async ({ page }) => {
  await page.goto("./");
  await expect(splash(page)).toHaveCount(0);
  await expect(page.locator("#game-status")).toBeAttached();
});

test("the log runs to the entry permit, the light ring loops, and a ready world fades it out", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await blockGame(page);
  await page.goto("./?splash=full");
  await expect(splash(page)).toBeVisible();
  await expect(page.locator("#boot-splash .bs-ln").first()).toContainText("[海岸漫遊]");
  await expect(page.locator("#boot-splash .bs-win")).toHaveClass(/show/, { timeout: 8000 });
  await expect(page.locator("#boot-splash .bs-wt")).toContainText("HARBOR ENTRY PERMIT");
  await expect(splash(page)).toHaveClass(/bs-intro-done/, { timeout: 12000 });
  const workerSupported = await page.evaluate(() => !!window.Worker && !!HTMLCanvasElement.prototype.transferControlToOffscreen);
  if (workerSupported) await expect(splash(page)).toHaveClass(/bs-ph-halo/, { timeout: 12000 });
  await page.evaluate(() => window.__bootSplash.done("ready"));
  await expect(splash(page)).toHaveClass(/bs-out/);
  await expect(splash(page)).toHaveCount(0, { timeout: 8000 });
  expect(errors).toEqual([]);
});

test("a failed or unsupported world removes the splash at once so the error stays readable", async ({ page }) => {
  await blockGame(page);
  await page.goto("./?splash=full");
  await expect(splash(page)).toBeVisible();
  await page.evaluate(() => window.__bootSplash.done("unsupported"));
  await expect(splash(page)).toHaveCount(0, { timeout: 5000 });
});

test("a tap skips the log and ?splash=hold ignores the game until it is tapped", async ({ page }) => {
  await blockGame(page);
  await page.goto("./?splash=hold");
  await expect(splash(page)).toBeVisible();
  await page.mouse.click(20, 200);
  await expect(splash(page)).toHaveClass(/bs-intro-done/, { timeout: 3000 });
  await page.evaluate(() => window.__bootSplash.done("ready"));
  await page.waitForTimeout(1500);
  await expect(splash(page)).toBeVisible();          // hold mode: the game state does not end it
  await page.mouse.click(20, 200);
  await expect(splash(page)).toHaveCount(0, { timeout: 8000 });
});

test("reduced motion shows the whole log at once, without the permit window or the light ring", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await blockGame(page);
  await page.goto("./?splash=full");
  await expect(page.locator("#boot-splash .bs-ln").nth(10)).toBeAttached({ timeout: 3000 });
  await expect(page.locator("#boot-splash .bs-win")).not.toHaveClass(/show/);
  await expect(page.locator("#boot-splash canvas")).toHaveCount(0);
  await page.evaluate(() => window.__bootSplash.done("ready"));
  await expect(splash(page)).toHaveCount(0, { timeout: 8000 });
});
