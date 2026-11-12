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
  await expect(page.locator("#boot-splash .bs-win")).toHaveClass(/show/, { timeout: 30000 }); // CI renders slower; the permit comes after the whole log
  await expect(page.locator("#boot-splash .bs-wt")).toContainText("HARBOR ENTRY PERMIT");
  await expect(splash(page)).toHaveClass(/bs-intro-done/, { timeout: 12000 });
  await expect(splash(page)).not.toHaveClass(/bs-ph-halo/);  // still waiting for actual game readiness
  await page.evaluate(() => window.__bootSplash.done("ready"));
  await expect(page.locator("#boot-splash .bs-pct")).toHaveText("100%", { timeout: 8000 });
  await expect(splash(page)).toHaveClass(/bs-ph-halo/, { timeout: 8000 });
  await expect(splash(page)).toHaveClass(/bs-out/, { timeout: 12000 });
  await expect(splash(page)).toHaveCount(0, { timeout: 20000 }); // CI renders slower; removal follows the fade within ~1.2 s locally
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
  // The fullscreen gesture is checked by its own test. Real fullscreen in
  // headless Chromium can hide/throttle its page and strand the boot timers.
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = function () { return Promise.resolve(); };
  });
  await page.goto("./?splash=hold");
  await expect(splash(page)).toBeVisible();
  await page.mouse.click(20, 200);
  await expect(splash(page)).toHaveClass(/bs-intro-done/, { timeout: 3000 });
  await page.evaluate(() => window.__bootSplash.done("ready"));
  await expect(page.locator("#boot-splash .bs-pct")).toHaveText("100%", { timeout: 8000 });
  await expect(splash(page)).toHaveClass(/bs-ph-halo/, { timeout: 8000 });
  await page.waitForTimeout(1500);
  await expect(splash(page)).toBeVisible();          // hold mode: the game state does not end it
  // Use the overlay as the click target after fullscreen may have resized the viewport.
  await splash(page).click({ position: { x: 20, y: 200 } });
  await expect(splash(page)).toHaveCount(0, { timeout: 14000 });
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

// Timestamps are recorded from the first script of the page, so a ring that appears early is never missed.
const stampTimes = () => {
  const stamp = () => {
    const el = document.getElementById("boot-splash");
    if (!el) return;
    if (el.classList.contains("bs-ph-halo") && window.__haloAt === undefined) {
      window.__haloAt = performance.now();
      window.__pctAtHalo = el.querySelector(".bs-pct")?.textContent;
      window.__fillAtHalo = el.querySelector(".bs-prog i")?.style.width;
    }
    if (el.classList.contains("bs-out") && window.__finishAt === undefined) window.__finishAt = performance.now();
  };
  new MutationObserver(stamp).observe(document, { subtree: true, attributes: true, attributeFilter: ["class"], childList: true });
};
const ringMs = (page) => page.evaluate(() => (window.__haloAt === undefined || window.__finishAt === undefined) ? -1 : window.__finishAt - window.__haloAt);

test("the light ring plays for at least five seconds before the game is entered", async ({ page }) => {
  await blockGame(page);
  await page.addInitScript(stampTimes);
  await page.goto("./?splash=full");
  await expect(splash(page)).toHaveClass(/bs-intro-done/, { timeout: 20000 });
  await expect(splash(page)).not.toHaveClass(/bs-ph-halo/);
  await page.evaluate(() => window.__bootSplash.done("ready"));
  // Software Chromium's requestAnimationFrame polling can starve while the
  // HALOFLUX worker renders. Poll browser state independently of RAF instead.
  await page.waitForFunction(() => window.__haloAt !== undefined, null, { timeout: 30000, polling: 100 });
  expect(await page.evaluate(() => [window.__pctAtHalo, window.__fillAtHalo])).toEqual(["100%", "100%"]);
  await page.waitForFunction(() => window.__finishAt !== undefined, null, { timeout: 30000, polling: 100 });
  expect(await ringMs(page)).toBeGreaterThanOrEqual(4900);
});

test("a world that is ready before the ring appears still gets a five second ring", async ({ page }) => {
  await blockGame(page);
  await page.addInitScript(stampTimes);
  await page.goto("./?splash=full");
  await expect(splash(page)).toBeVisible();
  await page.evaluate(() => window.__bootSplash.done("ready"));          // ready while the log is still typing
  await page.waitForFunction(() => window.__finishAt !== undefined, null, { timeout: 35000 });
  expect(await page.evaluate(() => [window.__pctAtHalo, window.__fillAtHalo])).toEqual(["100%", "100%"]);
  expect(await ringMs(page)).toBeGreaterThanOrEqual(4900);
});

test("the first user gesture requests fullscreen once, and later gestures do not", async ({ page }) => {
  await blockGame(page);
  await page.addInitScript(() => {
    window.__fsCalls = 0;
    Element.prototype.requestFullscreen = function () { window.__fsCalls++; return Promise.resolve(); };
  });
  await page.goto("./?splash=hold");
  await expect(splash(page)).toBeVisible();
  await page.mouse.click(40, 200);
  await page.mouse.click(40, 200);
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => window.__fsCalls)).toBe(1);
});

test("the light ring starts only after the game log has finished typing", async ({ page }) => {
  await blockGame(page);
  await page.addInitScript(stampTimes);
  await page.goto("./?splash=full");
  // ready arrives while the log is still typing; the ring must still wait for the whole log
  await page.evaluate(() => window.__bootSplash.done("ready"));
  await page.waitForFunction(() => window.__haloAt !== undefined, null, { timeout: 30000 });
  const logAtRingStart = await page.evaluate(() => {
    const lines = [...document.querySelectorAll("#boot-splash .bs-ln")].map((n) => n.textContent);
    return { last: lines[lines.length - 1] || "", permit: document.querySelector("#boot-splash .bs-wt")?.textContent || "" };
  });
  expect(logAtRingStart.last).toContain("正在載入世界");
  expect(logAtRingStart.permit).toContain("HARBOR ENTRY PERMIT");
  expect(await page.evaluate(() => [window.__pctAtHalo, window.__fillAtHalo])).toEqual(["100%", "100%"]);
});

test("without OffscreenCanvas the CSS ring still starts at 100% and stays for five seconds", async ({ page }) => {
  await blockGame(page);
  await page.addInitScript(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, "transferControlToOffscreen", { value: undefined, configurable: true });
  });
  await page.addInitScript(stampTimes);
  await page.goto("./?splash=1");
  await expect(splash(page)).toBeVisible();
  await page.evaluate(() => window.__bootSplash.done("ready"));
  await page.waitForFunction(() => window.__haloAt !== undefined, null, { timeout: 20000 });
  await expect(page.locator("#boot-splash .bs-fallback-ring")).toBeVisible();
  expect(await page.evaluate(() => [window.__pctAtHalo, window.__fillAtHalo])).toEqual(["100%", "100%"]);
  await page.waitForFunction(() => window.__finishAt !== undefined, null, { timeout: 15000 });
  expect(await ringMs(page)).toBeGreaterThanOrEqual(4900);
});

test("loading failure bypasses the ring and never reports a fake 100%", async ({ page }) => {
  await blockGame(page);
  await page.addInitScript(stampTimes);
  await page.goto("./?splash=1");
  await expect(splash(page)).toBeVisible();
  await page.evaluate(() => window.__bootSplash.done("failed"));
  await expect(splash(page)).toHaveCount(0, { timeout: 4000 });
  expect(await page.evaluate(() => [window.__haloAt, window.__pctAtHalo])).toEqual([undefined, undefined]);
});
