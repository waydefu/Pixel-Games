import { test, expect } from '@playwright/test';

test('first-person walking crosses the farm and stops at the visible fence', async ({ page }, testInfo) => {
  await page.goto('./?visualShot=shot-03-first-pier&x=-39&z=-25.7&yaw=1.57079632679&pitch=-.12&hour=12');
  await page.waitForFunction(() => window.__pixelGame?.read().status === 'ready', null, { timeout: 30000 });
  expect(await page.evaluate(() => window.__pixelGame.read().camera)).toBe('first');
  await page.keyboard.down('w');
  try {
    await expect.poll(() => page.evaluate(() => window.__pixelGame.read().player.x), { timeout: 45000 }).toBeLessThan(-48);
    await page.waitForTimeout(2000);
  } finally {
    await page.keyboard.up('w');
  }
  const player = await page.evaluate(() => window.__pixelGame.read().player);
  expect(player.x).toBeGreaterThan(-49);
  expect(player.z).toBeCloseTo(-25.7, 1);
  await page.screenshot({ path: testInfo.outputPath('farm-west-fence.png') });
});
