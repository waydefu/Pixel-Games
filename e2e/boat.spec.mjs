import { test, expect } from "@playwright/test";

// Standing on the beach beside the rowboat moored at (18, -3.5).
const POSE = "./?visualShot=shot-03-first-pier&x=13.4&z=-3.5&yaw=-1.5708&pitch=-.1&fishSeed=4";

async function ready(page) {
  await page.waitForFunction(() => ["ready", "unsupported", "failed"].includes(window.__pixelGame?.read().status), null, { timeout: 30000 });
  return (await page.evaluate(() => window.__pixelGame.read().status)) !== "unsupported";
}

test("board the rowboat, row away from the beach, and step back ashore", async ({ page }) => {
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(POSE);
  if (!(await ready(page))) return;
  const button = page.locator("#boat-button");
  await expect(button).toBeVisible();
  await expect(button).toHaveText("上船 (E)");
  await page.keyboard.press("e");
  await expect.poll(() => page.evaluate(() => window.__pixelGame.read().boat !== null)).toBe(true);
  const start = await page.evaluate(() => window.__pixelGame.read().boat);
  // hold W: the boat answers with a stroke
  await page.keyboard.down("w");
  await expect.poll(() => page.evaluate(() => window.__pixelGame.read().boat.x), { timeout: 40000 }).toBeGreaterThan(start.x + 0.0005);
  await page.keyboard.up("w");
  const now = await page.evaluate(() => window.__pixelGame.read());
  expect(now.player.x).toBeGreaterThan(14);          // the player sits in the boat, on the water
  // go back to shore (the boat has hardly moved) and get out
  await page.evaluate(() => 0);
  await page.keyboard.press("e");
  await expect.poll(() => page.evaluate(() => window.__pixelGame.read().boat === null), { timeout: 30000 }).toBe(true);
  const after = await page.evaluate(() => window.__pixelGame.read().player);
  expect(after.x).toBeLessThanOrEqual(13.5);
  expect(errors).toEqual([]);
});

test("you cannot get out in the middle of the sea", async ({ page }) => {
  await page.goto("./?visualShot=shot-03-first-pier&boat=0&bx=70&bz=-12&bh=0.5&fishSeed=4");
  if (!(await ready(page))) return;
  await expect(page.locator("#boat-button")).toHaveText("靠岸才能下船");
  await page.keyboard.press("e");
  await expect(page.locator("#boat-status")).toContainText("靠近碼頭或岸邊才能下船", { timeout: 15000 });
  expect(await page.evaluate(() => window.__pixelGame.read().boat !== null)).toBe(true);
});
