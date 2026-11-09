undefined

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
  expect(saved.version).toBe(1);
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
