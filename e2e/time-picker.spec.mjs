import { test, expect } from "@playwright/test";

test("time wheels adjust the world and keep automatic time in sync", async ({ page }) => {
  await page.goto("./?hour=23.983333333333334");
  await page.waitForFunction(() => ["ready", "unsupported", "failed"].includes(window.__pixelGame?.read().status), null, { timeout: 45000 });
  await page.locator("#menu-toggle").click();
  const label = page.locator("#time-label");
  const hours = page.getByRole("spinbutton", { name: "小時" });
  const minutes = page.getByRole("spinbutton", { name: "分鐘" });
  const auto = page.locator("#time-auto");
  await expect(label).toContainText("23:59");
  await page.getByRole("button", { name: "增加一分鐘" }).click();
  await expect(label).toContainText("00:00");
  await expect(auto).not.toBeChecked();
  await hours.focus();
  await page.keyboard.press("ArrowDown");
  await expect(label).toContainText("23:00");
  await minutes.hover();
  await page.mouse.wheel(0, -100);
  await expect(label).toContainText("23:01");
  // Dispatch real browser touch input so pointer capture and gesture handling are exercised.
  const bounds = await minutes.boundingBox();
  const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y - 48 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await expect(label).toContainText("23:03");
  await expect(minutes).toHaveAttribute("aria-valuenow", "3");
  await auto.check();
  await expect(auto).toBeChecked();
  if ((await page.evaluate(() => window.__pixelGame.read().status)) === "ready") {
    // A raw hour > 23.05 is already true at 23:03; require an actual minute boundary.
    // The UI refreshes less often than world time, especially with SwiftShader.
    await expect.poll(async () => page.evaluate(() => window.__pixelGame.read().hour), { timeout: 30000 }).toBeGreaterThan(23 + 4 / 60);
    await expect(label).not.toContainText("23:03", { timeout: 30000 });
    const hh = String(await hours.getAttribute("aria-valuenow")).padStart(2, "0");
    const mm = String(await minutes.getAttribute("aria-valuenow")).padStart(2, "0");
    await expect(label).toContainText(hh + ":" + mm);
  }
});
