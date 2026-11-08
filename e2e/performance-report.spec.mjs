import {test,expect} from '@playwright/test';
import {mkdtemp,writeFile,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {makeReport} from '../scripts/performance/report.mjs';

test('offline report switches views, scenes and selected runs',async({page})=>{
  const dir=await mkdtemp(join(tmpdir(),'pixel-report-test-'));
  const run={schemaVersion:4,protocolVersion:4,valid:true,dirty:false,commit:'test',environment:{browser:'Chromium',browserVersion:'1',gpuRenderer:'GPU',scenarios:['street','wall'],repetitions:1,viewport:{width:1280,height:720}},resourceCycle:{status:'OK',snapshots:[{cycle:0,state:{renderStats:{textures:4,geometries:3,programs:2}}},{cycle:1,state:{renderStats:{textures:5,geometries:3,programs:2}}}]},results:[]};
  for(const scenario of ['street','wall'])run.results.push({scenario,iteration:1,samples:[{atMs:10,frameMs:40}],summary:{p95Ms:40},state:{bufferWidth:1280,bufferHeight:720},startup:{scriptStartMs:1,assetsReadyMs:2,worldReadyMs:3,inputReadyMs:4,rendererReadyMs:5,firstDrawMs:6,assetsLoaded:true},stutters:{over33Count:1,over50Count:0,maxFrameMs:40,events:[{atMs:10,frameMs:40}]},resources:{status:'OK',samples:[{atMs:0,textures:4,geometries:3,programs:2},{atMs:1000,textures:5,geometries:3,programs:2}]}});
  const a=join(dir,'a.json'),b=join(dir,'b.json'),html=join(dir,'report.html');
  await writeFile(a,JSON.stringify(run));await writeFile(b,JSON.stringify(run));await makeReport([a,b],html);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(pathToFileURL(html).href);
    await expect(page.getByRole('heading',{name:'總覽'})).toBeVisible();
    await page.getByRole('button',{name:'啟動時間'}).click();await expect(page.getByText('可操作代理時間')).toBeVisible();
    await page.getByRole('button',{name:'順暢與卡頓'}).click();await expect(page.getByText('超過 33.3 ms',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'資源變化'}).click();await expect(page.getByText('測試狀態：OK')).toBeVisible();
    await page.getByLabel('顯示項目').selectOption('programs');await expect(page.getByLabel('顯示項目')).toHaveValue('programs');
    await page.getByLabel('場景').selectOption('wall');await page.getByLabel('查看單次結果').selectOption('1:1');
    await page.getByRole('button',{name:'啟動時間'}).click();await expect(page.getByLabel('場景')).toHaveValue('wall');
    await expect(page.getByLabel('查看單次結果')).toHaveValue('1:1');expect(errors).toEqual([]);
  }finally{await unlink(a);await unlink(b);await unlink(html);}
});
