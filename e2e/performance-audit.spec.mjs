import {test,expect} from '@playwright/test';

test('opt-in performance sampling records only its active interval',async({page})=>{
  await page.goto('./?visualShot=shot-01-quarter-street&perfAudit=1');
  await page.waitForFunction(()=>['ready','unsupported','failed'].includes(window.__pixelGame?.read().status),null,{timeout:30000});
  const status=await page.evaluate(()=>window.__pixelGame.read().status);
  test.skip(status==='unsupported','WebGL unavailable');
  expect(status).toBe('ready');
  await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().frames),{timeout:30000}).toBeGreaterThan(2);
  const startup=await page.evaluate(()=>window.__pixelPerf.startup());
  expect(startup.assetsReadyMs).toBeGreaterThanOrEqual(startup.scriptStartMs);
  expect(startup.worldReadyMs).toBeGreaterThanOrEqual(startup.assetsReadyMs);
  expect(startup.inputReadyMs).toBeGreaterThanOrEqual(startup.worldReadyMs);
  expect(startup.firstDrawMs).toBeGreaterThanOrEqual(startup.rendererReadyMs);
  const before=await page.evaluate(()=>{window.__pixelPerf.start();return window.__pixelGame.read().frames;});
  await expect.poll(()=>page.evaluate(()=>window.__pixelGame.read().frames),{timeout:30000}).toBeGreaterThan(before+1);
  const result=await page.evaluate(()=>window.__pixelPerf.stop());
  expect(result.hidden).toBe(false);expect(result.samples.length).toBeGreaterThan(0);
  expect(result.resources.length).toBeGreaterThanOrEqual(2);
  expect(result.resources.every(s=>s.geometries!==null&&s.textures!==null&&s.programs!==null)).toBe(true);
  expect(result.samples.every(s=>s.atMs>=0&&s.frameMs>0)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.__pixelPerf.gpu().status),{timeout:30000}).not.toBe('PENDING');
  const gpu=await page.evaluate(()=>window.__pixelPerf.gpu());
  expect(['OK','UNSUPPORTED','DISJOINT','NO_SAMPLES','CONTEXT_LOST']).toContain(gpu.status);
  if(gpu.status==='OK')expect(gpu.samples.every(s=>s.gpuMs>0&&s.atMs>=0)).toBe(true);
  const empty=await page.evaluate(()=>window.__pixelPerf.stop());expect(empty.samples).toEqual([]);
});
