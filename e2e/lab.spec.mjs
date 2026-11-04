import { test, expect } from "@playwright/test";

test("built project home remains reachable at GitHub project subpath", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("./");
  await expect(page.getByRole("heading", { name: /未定義的世界/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test("Three.js lab renders on WebGL2-capable browser, or explains actual GPU unavailability", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("./lab/");
  await expect(page.getByRole("heading", { name: /光影與像素/ })).toBeVisible();
  await expect(page.locator("#stage")).toBeVisible();
  await page.waitForFunction(
    () => ["ready","unsupported","failed"].includes(window.__pixelLab?.read().status),
    null, { timeout: 18000 },
  );
  const diagnostics = await page.evaluate(() => window.__pixelLab.read());
  const supported = await page.evaluate(() => !!document.createElement("canvas").getContext("webgl2"));
  console.log("WebGL2 hardware/software availability:", supported, "Lab diagnostics:", JSON.stringify(diagnostics));
  if (supported) {
    expect(diagnostics.status).toBe("ready");
    await expect.poll(async () => (await page.evaluate(() => window.__pixelLab.read())).frames).toBeGreaterThan(0);
    await expect.poll(async () => (await page.evaluate(() => window.__pixelLab.read())).drawCalls).toBeGreaterThan(0);
    expect(diagnostics.bufferWidth).toBeGreaterThan(0);
    expect(diagnostics.bufferHeight).toBeGreaterThan(0);
    expect(diagnostics.bufferWidth * diagnostics.bufferHeight).toBeLessThanOrEqual(1_800_000);
  } else {
    await expect(page.locator("#fallback")).toBeVisible();
    expect(["unsupported","failed"]).toContain(diagnostics.status);
  }
  await page.locator("#quality").selectOption("basic");
  if(supported) {
    const after = await page.evaluate(() => window.__pixelLab.read());
    expect(after.bufferWidth * after.bufferHeight).toBeLessThanOrEqual(900_000);
  }
  expect(errors).toEqual([]);
});
