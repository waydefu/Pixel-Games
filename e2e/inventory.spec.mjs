import {test,expect} from '@playwright/test';

test('inventory controls, pickup, reload and backup',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./');
  await page.waitForFunction(()=>window.__pixelGame?.read().status==='ready',null,{timeout:22000});
  await page.keyboard.press('b');
  await expect(page.getByRole('dialog',{name:'海岸行囊'})).toBeVisible();
  const before=await page.evaluate(()=>window.__pixelGame.read().player);
  await page.keyboard.down('d');await page.waitForTimeout(400);await page.keyboard.up('d');
  expect(await page.evaluate(()=>window.__pixelGame.read().player)).toEqual(before);
  await page.getByRole('button',{name:'關閉背包'}).click();
  // Approach the nearest authored pickup from the ordinary spawn.
  await page.keyboard.down('d');
  try{await expect(page.locator('#pickup-button')).toBeVisible({timeout:20000});}finally{await page.keyboard.up('d');}
  await page.locator('#pickup-button').click();
  await page.locator('#inventory-toggle').click();
  await expect(page.locator('#inventory-list')).toContainText('貝殼');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'匯出存檔'}).click();const backup=await download;
  await page.screenshot({path:testInfo.outputPath('inventory.png')});
  await page.reload();await page.waitForFunction(()=>window.__pixelGame?.read().status==='ready',null,{timeout:22000});
  await page.locator('#inventory-toggle').click();await expect(page.locator('#inventory-list')).toContainText('貝殼');
  await page.locator('#save-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{bad')});
  await expect(page.locator('#save-message')).toContainText('匯入失敗');
  await expect(page.locator('#inventory-list')).toContainText('貝殼');
  await page.locator('#save-file').setInputFiles(await backup.path());
  await expect(page.locator('#save-message')).toContainText('存檔已匯入');
  expect(errors).toEqual([]);
});


test('legacy fishing tally survives first save and phone landscape layout',async({page},testInfo)=>{
  await page.addInitScript(()=>localStorage.setItem('pixel-games.fishing.v1',JSON.stringify({count:4,best:{name:'鱸魚',length:27}})));
  if(testInfo.project.name==='mobile-chromium') await page.setViewportSize({width:700,height:360});
  await page.goto('./');await page.waitForFunction(()=>window.__pixelGame?.read().status==='ready',null,{timeout:22000});
  await page.locator('#inventory-toggle').click();
  const dialog=page.getByRole('dialog',{name:'海岸行囊'});await expect(dialog).toBeVisible();
  const bounds=await dialog.boundingBox(),viewport=page.viewportSize();
  expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds.y).toBeGreaterThanOrEqual(0);expect(bounds.y+bounds.height).toBeLessThanOrEqual(viewport.height);
  await page.screenshot({path:testInfo.outputPath('inventory-landscape.png')});
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('pixel-games.save.v1')||'null')?.fishing.count),{timeout:15000}).toBe(4);
});

test('restores an imported position aboard a boat',async({page})=>{
  await page.goto('./');await page.waitForFunction(()=>window.__pixelGame?.read().status==='ready',null,{timeout:22000});
  await page.locator('#inventory-toggle').click();
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('pixel-games.save.v1')),{timeout:15000}).not.toBeNull();
  const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('pixel-games.save.v1')));
  save.aboard=0;save.player={x:save.boats[0].x,z:save.boats[0].z};
  await page.locator('#save-file').setInputFiles({name:'boat.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))});
  await expect(page.locator('#save-message')).toContainText('存檔已匯入');
  await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().boat)).not.toBeNull();
  await page.reload();await page.waitForFunction(()=>window.__pixelGame?.read().status==='ready',null,{timeout:22000});
  await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().boat)).not.toBeNull();
});
