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
  const shortcut=await page.evaluate(()=>{
    const event=new KeyboardEvent('keydown',{key:'f',code:'KeyF',ctrlKey:true,bubbles:true,cancelable:true});
    window.dispatchEvent(event);return event.defaultPrevented;
  });
  expect(shortcut).toBe(false);
  await expect(page.locator('#fish-meter')).toBeHidden();
  await page.evaluate(()=>{
    const editable=document.createElement('div');
    editable.id='test-contenteditable';editable.contentEditable='true';
    document.body.append(editable);editable.focus();
    for(const [code,key] of [['KeyB','b'],['KeyG','g'],['KeyE','e']])
      editable.dispatchEvent(new KeyboardEvent('keydown',{code,key,bubbles:true}));
  });
  await expect(page.getByRole('dialog',{name:'海岸行囊'})).toBeHidden();
  expect(await page.evaluate(()=>window.__pixelGame.read().boat)).toBeNull();
  await page.evaluate(()=>document.querySelector('#test-contenteditable').remove());
  await key(page,'keydown','KeyF','Process');
  await expect(page.locator('#fish-meter')).toBeVisible();
  await expect(page.locator('#fish-button')).toHaveText('放開拋竿！');
  await key(page,'keyup','KeyF','Process');
  await expect(page.locator('#fish-button')).toHaveText('按住收線 (F)',{timeout:40000});
});

test('phone portrait fishing dock stays compact without overlapping movement and look controls',async({page},testInfo)=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(pose);
  await page.waitForFunction(()=>window.__pixelGame?.read().status==='ready',null,{timeout:30000});
  const fishing=page.locator('#fish-button');
  await expect(fishing).toBeVisible();
  const layout=await page.evaluate(()=>{
    const rect=id=>{const el=document.querySelector(id),r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,visible:getComputedStyle(el).display!=='none'&&!el.hidden};};
    return {coarse:matchMedia('(pointer:coarse)').matches,hud:rect('#fish-hud'),button:rect('#fish-button'),joystick:rect('#joystick'),look:rect('#look-hint'),viewport:{width:innerWidth,height:innerHeight}};
  });
  expect(layout.button.width).toBeGreaterThanOrEqual(44);
  expect(layout.button.height).toBeGreaterThanOrEqual(44);
  expect(layout.button.left).toBeGreaterThanOrEqual(0);
  expect(layout.button.right).toBeLessThanOrEqual(layout.viewport.width);
  if(layout.coarse){
    expect(layout.hud.width).toBeLessThanOrEqual(161);
    expect(layout.button.width).toBeLessThanOrEqual(121);
    expect(layout.hud.right).toBeLessThanOrEqual(layout.viewport.width-7);
    expect(layout.hud.left).toBeGreaterThan(layout.joystick.right);
    if(layout.look.visible)expect(layout.hud.bottom).toBeLessThanOrEqual(layout.look.top);
    await page.setViewportSize({width:844,height:390});
    await expect(fishing).toBeVisible();
    const landscapeWidth=(await fishing.boundingBox()).width;
    expect(landscapeWidth).toBeGreaterThanOrEqual(120);
  }
  await page.screenshot({path:testInfo.outputPath('portrait-fishing-hud.png')});
});
