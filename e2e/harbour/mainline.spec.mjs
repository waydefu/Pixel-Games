import { test, expect } from '@playwright/test';

// Real mainline, full low preset at its specified 720-1080 short-side resolution.
// No rs/tex/veg overrides, no hidden scene, no mocked WebGL or storage.
test('standalone mainline: offline shaders, controls, inventory, save and reload', async ({ page, context, browserName, isMobile }, testInfo) => {
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const origin = new URL(testInfo.project.use.baseURL).origin;
  await context.route('**/*', async route => {
    const url = route.request().url(); requests.push(url);
    if (new URL(url).origin === origin && new URL(url).pathname === '/') return route.continue();
    errors.push(`Unexpected asset/network request: ${url}`); return route.abort();
  });
  // Same origin data belonging to the previous game must remain untouched.
  await context.addInitScript(() => {
    if (!localStorage.getItem('pixel-games.legacy.migration-sentinel')) localStorage.setItem('pixel-games.legacy.migration-sentinel', 'preserve');
  });
  await page.goto('?q=low&debug=1&hour=12', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ready === true || window.__failed === true, null, { timeout: 150_000 });
  expect(await page.evaluate(() => window.__failed)).not.toBe(true);
  await expect(page.locator('meta[name="pixel-games-mainline"]')).toHaveAttribute('content', 'saint-aldric');
  const shaderState = await page.evaluate(() => {
    const r = window.__renderer, gl = r.getContext();
    return { programs: r.info.programs.length, linked: r.info.programs.map(p => gl.getProgramParameter(p.program, gl.LINK_STATUS)), width: r.domElement.width, height: r.domElement.height, info: window.__info };
  });
  expect(shaderState.programs).toBeGreaterThan(0);
  expect(shaderState.linked.every(Boolean)).toBe(true);
  expect(Math.min(shaderState.width, shaderState.height)).toBeGreaterThanOrEqual(720);
  expect(Math.min(shaderState.width, shaderState.height)).toBeLessThanOrEqual(1080);
  await page.locator('#go').click();
  await page.waitForFunction(() => window.__game.G.started === true);
  await page.evaluate(() => document.exitPointerLock?.());
  const initial = await page.evaluate(() => window.__game.collect());
  // Desktop keyboard is an actual input path; mobile uses the floating touch stick.
  if (isMobile) {
    await page.locator('#bInv').tap();
  } else {
    await page.keyboard.press('i');
  }
  await expect(page.locator('#inv')).toHaveClass('on');
  await page.locator('#invX').click();
  if (!isMobile) {
    await page.keyboard.down('w');
    await page.waitForFunction(([x,z]) => Math.hypot(window.__game.P.x-x, window.__game.P.z-z) > 0.1, [initial.player.x, initial.player.z], { timeout: 30_000 });
    await page.keyboard.up('w');
  } else {
    // CDP sends genuine touch events through the existing joystick listeners.
    const session = await context.newCDPSession(page);
    const v = page.viewportSize(), x = Math.round(v.width * .18), y = Math.round(v.height * .72);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{x,y}] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{x,y:y-45}] });
    await page.waitForFunction(([a,b]) => Math.hypot(window.__game.P.x-a, window.__game.P.z-b) > 0.1, [initial.player.x, initial.player.z], { timeout: 30_000 });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
  }
  await page.locator('#menuBtn').click();
  await expect(page.locator('#menu')).toHaveClass('on');
  await expect(page.locator('#tiers button')).toHaveCount(4);
  await page.locator('[data-k="save"]').click();
  await page.locator('#sv').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('aldric.save')));
  expect(saved.v).toBe(1);
  expect(saved.player).toBeTruthy();
  await testInfo.attach('render-observations.json', { body: JSON.stringify({ browserName, isMobile, shaderState, saved, scope: 'SwiftShader functional evidence, NOT phone FPS or visual approval' }, null, 2), contentType: 'application/json' });
  if (!isMobile) {
    await page.locator('#mx').click();
    await page.screenshot({ path: testInfo.outputPath('mainline.png') });
  }
  // shortcut: mobile/high PNG capture stalls SwiftShader (mobile trace: 105 s).
  // Keep all functional/shader/resolution checks; add image acceptance on a real GPU.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ready === true || window.__failed === true, null, { timeout: 150_000 });
  await page.locator('#cont').click();
  const restored = await page.evaluate(() => window.__game.collect());
  expect(Math.abs(restored.player.x - saved.player.x)).toBeLessThan(.1);
  expect(Math.abs(restored.player.z - saved.player.z)).toBeLessThan(.1);
  expect(restored.inv).toEqual(saved.inv);
  expect(await page.evaluate(() => localStorage.getItem('pixel-games.legacy.migration-sentinel'))).toBe('preserve');
  expect(errors).toEqual([]);
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.every(u => new URL(u).origin === origin && new URL(u).pathname === '/')).toBe(true);
});

// file:// is part of the deliverable, not inferred from a localhost pass.
test('downloaded HTML boots without a server or network', async ({ page, context, isMobile }, testInfo) => {
  test.skip(isMobile, 'Desktop file:// scope; mobile file manager remains manual acceptance');
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await context.route('**/*', async route => { const url = new URL(route.request().url()); if (url.protocol === 'file:' && url.pathname.endsWith('/index.html')) return route.continue(); requests.push(url.href); await route.abort(); });
  const { pathToFileURL } = await import('node:url');
  const { resolve } = await import('node:path');
  const url = pathToFileURL(resolve('dist/index.html'));
  url.search = '?debug=1'; // No preset override: cover the shipping default high path, including AO/bloom/MSAA.
  await page.goto(url.href);
  await page.waitForFunction(() => window.__ready === true || window.__failed === true, null, { timeout: 150_000 });
  expect(await page.evaluate(() => window.__ready)).toBe(true);
  const state = await page.evaluate(() => {
    const r=window.__renderer, gl=r.getContext();
    return { tier: window.__info.tier, shortSide: Math.min(r.domElement.width,r.domElement.height), linked:r.info.programs.map(p=>gl.getProgramParameter(p.program,gl.LINK_STATUS)) };
  });
  expect(state.tier).toBe('high');
  expect(state.shortSide).toBeGreaterThanOrEqual(1080);
  expect(state.shortSide).toBeLessThanOrEqual(1440);
  expect(state.linked.length).toBeGreaterThan(0);
  expect(state.linked.every(Boolean)).toBe(true);
  await testInfo.attach('default-high-offline.json', {body:JSON.stringify(state),contentType:'application/json'});
  expect(errors).toEqual([]);
  expect(requests).toEqual([]);
  // Default-high shader/state evidence above is retained; visual approval remains #120.
});
