import {test,expect} from '@playwright/test';

test('inventory controls, pickup, reload and backup',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('./');
  await page.waitForFunction(()=>window.__pixelGame?.read().status==='ready',null,{timeout:22000});
  await page.keyboard.press('b');
  await expect(page.getByRole('dialog',{name:'海岸行囊'})).toBeVisible();
  await page.locator('#save-import').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:'關閉背包'})).toBeFocused();
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


test('corrupt local save stays intact until a raw backup is requested and reset is confirmed',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('pixel-games.save.v1','{broken-json'));
  await page.goto('./');
  await page.waitForFunction(()=>window.__pixelGame?.read().status==='ready',null,{timeout:22000});
  await page.locator('#inventory-toggle').click();
  await expect(page.locator('#save-recovery')).toBeVisible();
  await expect(page.locator('#save-reset')).toBeDisabled();
  expect(await page.evaluate(()=>localStorage.getItem('pixel-games.save.v1'))).toBe('{broken-json');
  const download=page.waitForEvent('download');
  await page.locator('#save-backup-raw').click();
  const backup=await download;
  expect(backup.suggestedFilename()).toBe('coastal-wander-unreadable-save.txt');
  await expect(page.locator('#save-reset')).toBeEnabled();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#save-reset').click();
  await expect(page.locator('#save-recovery')).toBeHidden();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('pixel-games.save.v1')));
  expect(saved.version).toBe(2);
  expect(saved.inventory).toEqual({});
});

test('storage failure during import does not change active game state',async({page})=>{
  await page.goto('./');
  await page.waitForFunction(()=>window.__pixelGame?.read().status==='ready',null,{timeout:22000});
  await page.locator('#inventory-toggle').click();
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('pixel-games.save.v1')),{timeout:15000}).not.toBeNull();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('pixel-games.save.v1')));
  const candidate={...before,hour:18,timeAuto:false};
  await page.evaluate(()=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key==='pixel-games.save.v1')throw Error('simulated quota error');
      return original.call(this,key,value);
    };
  });
  await page.locator('#save-file').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(candidate))});
  await expect(page.locator('#save-message')).toContainText('匯入失敗');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('pixel-games.save.v1')))).toEqual(before);
  expect(await page.locator('#time-auto').isChecked()).toBe(before.timeAuto);
});

test('fish inventory survives import, export and reload',async({page})=>{
  await page.goto('./');
  await page.waitForFunction(()=>window.__pixelGame?.read().status==='ready',null,{timeout:22000});
  await page.locator('#inventory-toggle').click();
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('pixel-games.save.v1')),{timeout:15000}).not.toBeNull();
  const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('pixel-games.save.v1')));
  save.inventory.mackerel=2;save.fishing={count:2,best:{name:'鯖魚',length:30}};
  await page.locator('#save-file').setInputFiles({name:'fish.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))});
  await expect(page.locator('#save-message')).toContainText('存檔已匯入');
  await expect(page.locator('#inventory-list')).toContainText('鯖魚');
  await expect(page.locator('#inventory-list')).toContainText('數量 × 2');
  const download=page.waitForEvent('download');await page.locator('#save-export').click();const backup=await download;
  await page.reload();await page.waitForFunction(()=>window.__pixelGame?.read().status==='ready',null,{timeout:22000});
  await page.locator('#inventory-toggle').click();await expect(page.locator('#inventory-list')).toContainText('鯖魚');
  await page.locator('#save-file').setInputFiles(await backup.path());
  await expect(page.locator('#save-message')).toContainText('存檔已匯入');
  await expect(page.locator('#inventory-list')).toContainText('數量 × 2');
});

test('settings export a diagnostic JSON with frame samples and active quality',async({page})=>{
  await page.goto('./');
  await page.waitForFunction(()=>window.__pixelGame?.read().status==='ready',null,{timeout:22000});
  await page.locator('#menu-toggle').click();
  await expect(page.locator('#metrics')).toContainText('p50');
  const download=page.waitForEvent('download');
  await page.locator('#perf-report').click();
  const file=await download;
  expect(file.suggestedFilename()).toContain('coastal-performance-balanced-');
  const {readFile}=await import('node:fs/promises');
  const json=JSON.parse(await readFile(await file.path(),'utf8'));
  expect(json.schemaVersion).toBe(1);
  expect(json.source).toContain('not a GPU timer');
  expect(json.run.reflect).toBe('default');
  expect(json.run.quality).toBe('balanced');
  expect(typeof json.frame.count).toBe('number');
  expect(json.device.viewportWidth).toBeGreaterThan(0);
  expect(json.validity.minimumFrames).toBe(10);
  expect(json.validity.minimumDurationMs).toBe(15000);
  expect(typeof json.validity.measuredDurationMs).toBe('number');
  expect(json.run.weatherActual).toBeTruthy();
  expect(typeof json.run.timeAuto).toBe('boolean');
  expect(typeof json.validity.usable).toBe('boolean'); // CI software GPU may need seconds per frame
});
