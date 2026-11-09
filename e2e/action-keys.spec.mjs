import {test,expect} from '@playwright/test';

const pose='./?visualShot=shot-03-first-pier&x=27&z=8&yaw=-1.5708&pitch=-.12&fishSeed=4';
const key=(page,type,code,value)=>page.evaluate(({type,code,value})=>window.dispatchEvent(new KeyboardEvent(type,{code,key:value,bubbles:true})),{type,code,value});

test('physical C and F work with an IME and after closing inventory',async({page})=>{
  await page.goto(pose);
  await page.waitForFunction(()=>window.__pixelGame?.read().status==='ready',null,{timeout:30000});
  await page.keyboard.press('b');
  await expect(page.getByRole('dialog',{name:'海岸行囊'})).toBeVisible();
  await key(page,'keydown','KeyC','ㄏ');
  await key(page,'keydown','KeyF','ㄑ');
  await expect(page.locator('#fish-meter')).toBeHidden();
  expect(await page.evaluate(()=>window.__pixelGame.read().camera)).toBe('first');
  await page.keyboard.press('b');
  await key(page,'keydown','KeyC','ㄏ');
  await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().camera)).toBe('vista');
  await page.keyboard.press('2');
  await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().camera)).toBe('first');
  await page.evaluate(()=>{const input=document.createElement('input');input.id='test-editing-target';document.body.append(input);input.focus();input.dispatchEvent(new KeyboardEvent('keydown',{key:'ㄏ',code:'KeyC',bubbles:true}));input.dispatchEvent(new KeyboardEvent('keydown',{key:'ㄑ',code:'KeyF',bubbles:true}));});
  await expect(page.locator('#fish-meter')).toBeHidden();
  expect(await page.evaluate(()=>window.__pixelGame.read().camera)).toBe('first');
  await page.evaluate(()=>document.querySelector('#test-editing-target').remove());
  await key(page,'keydown','KeyF','Process');
  await expect(page.locator('#fish-meter')).toBeVisible();
  await expect(page.locator('#fish-button')).toHaveText('放開拋竿！');
  await key(page,'keyup','KeyF','Process');
  await expect(page.locator('#fish-button')).toHaveText('按住收線 (F)',{timeout:40000});
});
