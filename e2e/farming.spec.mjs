import {test,expect} from '@playwright/test';

test('plant, grow offline, harvest into inventory and replant',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('./');await page.waitForFunction(()=>window.__pixelGame?.read().status==='ready',null,{timeout:22000});
 await page.locator('#inventory-toggle').click();
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('pixel-games.save.v1')),{timeout:15000}).not.toBeNull();
 const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('pixel-games.save.v1')));
 save.player={x:-33.6,z:-30.45};
 const upload=async data=>page.locator('#save-file').setInputFiles({name:'farm.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
 await upload(save);await expect(page.locator('#save-message')).toContainText('存檔已匯入');
 await page.locator('#inventory-close').click();await expect(page.locator('#pickup-button')).toContainText('農田');
 await page.locator('#pickup-button').click();await page.getByRole('button',{name:'南瓜'}).click();
 await expect(page.locator('#farm-status')).toContainText('生長中');
 await page.locator('#farm-close').click();
 let planted=await page.evaluate(()=>JSON.parse(localStorage.getItem('pixel-games.save.v1')));
 const index=planted.farm.findIndex(Boolean);expect(index).toBeGreaterThanOrEqual(0);expect(planted.farm[index].crop).toBe('pumpkin');
 planted.farm[index].plantedAt=Date.now()-300001;
 await page.locator('#inventory-toggle').click();await upload(planted);await expect(page.locator('#save-message')).toContainText('存檔已匯入');await page.locator('#inventory-close').click();
 await page.locator('#pickup-button').click();await expect(page.locator('#farm-status')).toContainText('已成熟');await page.getByRole('button',{name:'收割',exact:true}).click();
 await expect(page.locator('#farm-status')).toContainText('空田');await page.getByRole('button',{name:'小麥'}).click();await expect(page.locator('#farm-status')).toContainText('小麥');await page.locator('#farm-close').click();await page.locator('#inventory-toggle').click();await expect(page.locator('#inventory-list')).toContainText('南瓜');
 await page.reload();await page.waitForFunction(()=>window.__pixelGame?.read().status==='ready',null,{timeout:22000});await page.locator('#inventory-toggle').click();await expect(page.locator('#inventory-list')).toContainText('南瓜');
 expect(errors).toEqual([]);
});
