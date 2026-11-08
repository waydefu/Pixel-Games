import {chromium} from '@playwright/test';
import {spawn,spawnSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createServer} from 'node:net';
import os from 'node:os';
import {summarize,stutters} from './metrics.mjs';
import {makeReport} from './report.mjs';

const warmupMs=Number(process.env.PERF_WARMUP_MS??15000),sampleMs=Number(process.env.PERF_SAMPLE_MS??30000),repetitions=Number(process.env.PERF_REPETITIONS??3);
if(!Number.isFinite(warmupMs)||warmupMs<0||!Number.isFinite(sampleMs)||sampleMs<1000||!Number.isInteger(repetitions)||repetitions<1)throw Error('Invalid benchmark durations or repetitions');
const quality=process.env.PERF_QUALITY??'balanced';
if(!['basic','balanced','high'].includes(quality))throw Error('Invalid PERF_QUALITY');
const scenarios=[{id:'street',shot:'shot-01-quarter-street'},{id:'wall',shot:'shot-02-first-wall'},{id:'pier',shot:'shot-03-first-pier'},{id:'walk',shot:'shot-01-quarter-street',route:'alternating-w-s-3s-v1'}];
const git=(...args)=>{const p=spawnSync('git',args,{encoding:'utf8'});return p.status===0?p.stdout.trim():null};
const commit=git('rev-parse','HEAD'),dirty=git('status','--porcelain','--untracked-files=normal');
const output=resolve(process.env.PERF_OUTPUT_DIR??join('performance-output',new Date().toISOString().replace(/[:.]/g,'-')));
await mkdir(output,{recursive:true});
const server=createServer();await new Promise((ok,fail)=>server.once('error',fail).listen(0,'127.0.0.1',ok));const port=server.address().port;await new Promise(ok=>server.close(ok));
const preview=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'});
let browser;
const run={schemaVersion:4,protocolVersion:4,createdAt:new Date().toISOString(),commit,dirty:dirty===null?null:!!dirty,gitStatus:dirty,valid:false,invalidReasons:[],environment:{browser:'Chromium',browserVersion:null,os:`${os.platform()} ${os.release()} ${os.arch()}`,cpu:os.cpus()[0]?.model??null,memoryBytes:os.totalmem(),gpuVendor:null,gpuRenderer:null,viewport:{width:1280,height:720},dpr:1,quality,warmupMs,sampleMs,repetitions,scenarios,cachePolicy:'fresh isolated browser context per repetition; OS and GPU caches may persist'},results:[],resourceCycle:{status:'NOT_RUN',snapshots:[]},gpuTimeMethod:'EXT_disjoint_timer_query_webgl2; total on one in three frames, phases on the others; no nested queries',mobileThermals:'NOT RUN'};
try{
  const url=`http://127.0.0.1:${port}/Pixel-Games/`;
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(url)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100));}if(!ready)throw Error('Preview server failed to start');
  browser=await chromium.launch({headless:false,...(process.env.PERF_BROWSER_PATH?{executablePath:process.env.PERF_BROWSER_PATH}:{})});
  run.environment.browserVersion=browser.version();
  for(const scenario of scenarios)for(let iteration=1;iteration<=repetitions;iteration++){
    console.log(`${scenario.id} ${iteration}/${repetitions}`);
    const context=await browser.newContext({viewport:run.environment.viewport,deviceScaleFactor:1});
    const page=await context.newPage(),errors=[],warnings=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/HD-2D pipeline failed/i.test(m.text())){const url=m.location().url;const message=m.text()+(url?' ('+url+')':'');if(m.type()==='error'&&/\/favicon\.ico(?:\?|$)/.test(url)&&/404/.test(m.text()))warnings.push(message);else errors.push(message);}});
    const result={scenario:scenario.id,iteration,samples:[],summary:summarize([]),state:null,screenshot:null,invalidReasons:[],warnings};run.results.push(result);
    try{
      await page.addInitScript(()=>{window.__startupHidden=document.visibilityState!=='visible';document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')window.__startupHidden=true;});window.addEventListener('blur',()=>{window.__startupHidden=true;});});
      await page.goto(url+'?visualShot='+scenario.shot+'&perfAudit=1&weather=clear');
      await page.waitForFunction(()=>['ready','unsupported','failed'].includes(window.__pixelGame?.read().status),null,{timeout:60000});
      let state=await page.evaluate(()=>window.__pixelGame.read());
      if(state.status!=='ready')throw Error('Game status: '+state.status);
      await page.waitForFunction(()=>window.__pixelPerf.startup().firstDrawMs!==null,null,{timeout:60000});
      result.startup=await page.evaluate(()=>{const startup=window.__pixelPerf.startup();return {...startup,status:window.__startupHidden||document.visibilityState!=='visible'?'INVALID':startup.assetsLoaded?'OK':'FALLBACK',navigation:performance.getEntriesByType('navigation').map(n=>({type:n.type,responseEnd:n.responseEnd,domContentLoadedEventEnd:n.domContentLoadedEventEnd}))[0]??null};});
      const gpu=await page.evaluate(()=>{const gl=document.querySelector('#stage').getContext('webgl2');const ext=gl?.getExtension('WEBGL_debug_renderer_info');return {vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):null,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null}});
      if(iteration===1&&scenario===scenarios[0]){run.environment.gpuVendor=gpu.vendor;run.environment.gpuRenderer=gpu.renderer;}
      if(!gpu.renderer||/swiftshader|llvmpipe|software|softpipe/i.test(gpu.renderer))result.invalidReasons.push('Hardware GPU renderer unavailable or unidentified');
      if(gpu.renderer!==run.environment.gpuRenderer||gpu.vendor!==run.environment.gpuVendor)result.invalidReasons.push('GPU identity changed');
      await page.locator('#menu-toggle').click();
      await page.locator('#weather').selectOption('clear');await page.locator('#quality').selectOption(quality);
      await page.locator('#menu-close').click();
      await page.waitForTimeout(warmupMs);
      const start=await page.evaluate(()=>{window.__pixelPerf.start();return {...window.__pixelGame.read(),viewport:{width:innerWidth,height:innerHeight},dpr:devicePixelRatio}});
      if(start.viewport.width!==run.environment.viewport.width||start.viewport.height!==run.environment.viewport.height||start.dpr!==run.environment.dpr)result.invalidReasons.push('Viewport or DPR differs from protocol');
      if(start.visualShot!==scenario.shot||start.grade!==quality||!start.bufferWidth||!start.bufferHeight||start.pipeline!=='on')result.invalidReasons.push('Scenario, quality or renderer did not match the protocol');
      if(scenario.route)await page.evaluate(()=>{let n=0;const event=(type,key)=>window.dispatchEvent(new KeyboardEvent(type,{key,bubbles:true}));window.__perfRouteStart=window.__pixelGame.read().player;window.__perfRouteDistance=0;event('keydown','w');window.__perfRoute=setInterval(()=>{const p=window.__pixelGame.read().player;window.__perfRouteDistance=Math.max(window.__perfRouteDistance,Math.hypot(p.x-window.__perfRouteStart.x,p.z-window.__perfRouteStart.z));event('keyup',n%2?'s':'w');n++;event('keydown',n%2?'s':'w')},3000)});
      await page.waitForTimeout(sampleMs);
      const capture=await page.evaluate(()=>{if(window.__perfRoute){clearInterval(window.__perfRoute);for(const key of ['w','s'])window.dispatchEvent(new KeyboardEvent('keyup',{key,bubbles:true}));}const state=window.__pixelGame.read();const p=window.__perfRouteStart;if(p)window.__perfRouteDistance=Math.max(window.__perfRouteDistance,Math.hypot(state.player.x-p.x,state.player.z-p.z));return {measurement:window.__pixelPerf.stop(),state,routeDistance:window.__perfRouteDistance,visible:document.visibilityState,viewport:{width:innerWidth,height:innerHeight},dpr:devicePixelRatio}});
      try{await page.waitForFunction(()=>window.__pixelPerf.gpu().status!=='PENDING',null,{timeout:3000});}catch{/* retain pending status as incomplete rather than blocking the GPU */}
      const gpuTiming=await page.evaluate(()=>window.__pixelPerf.gpu());
      gpuTiming.samples=gpuTiming.samples.filter(s=>s.atMs>=0&&s.atMs<=sampleMs);
      const allGpu=gpuTiming.samples,totalGpu=allGpu.filter(s=>!s.phase);
      if(gpuTiming.status==='OK'&&(gpuTiming.dropped||totalGpu.length<Math.max(2,Math.floor(sampleMs/3000))||totalGpu.at(-1)?.atMs-totalGpu[0]?.atMs<sampleMs*.8))gpuTiming.status='INCOMPLETE';
      const phases={};for(const name of ['cloudShadow','reflection','scene','bloom','rays','dof','composite']){const samples=allGpu.filter(s=>s.phase===name);const status=gpuTiming.status!=='OK'?gpuTiming.status:samples.length>=2?'OK':samples.length?'INCOMPLETE':'NOT_RUN';phases[name]={status,samples,summary:status==='OK'?summarize(samples.map(s=>s.gpuMs)):summarize([])};}
      result.gpu={...gpuTiming,samples:totalGpu,phases,summary:gpuTiming.status==='OK'?summarize(totalGpu.map(s=>s.gpuMs)):summarize([])};
      result.samples=capture.measurement.samples.filter(s=>s.atMs>=s.frameMs&&s.atMs<=sampleMs);result.durationMs=capture.measurement.durationMs;result.summary=summarize(result.samples);result.state=capture.state;result.startPlayer=start.player;result.errors=errors;
      const cpuSamples=(capture.measurement.cpu??[]).filter(s=>s.atMs>=0&&s.atMs<=sampleMs);const cpuSummary={};for(const name of ['movementMs','cameraMs','worldMs','drawSubmitMs'])cpuSummary[name]=summarize(cpuSamples.map(s=>s[name]),{allowZero:true});result.cpu={samples:cpuSamples,summary:cpuSummary};
      result.resources={samples:capture.measurement.resources??[],status:capture.measurement.resources?.length>=2?'OK':'INCOMPLETE'};
      result.stutters=stutters(result.samples,gpuTiming.status==='OK'?totalGpu:[],cpuSamples);
      if(capture.measurement.hidden||capture.visible!=='visible')result.invalidReasons.push('Page was hidden');
      if(capture.viewport.width!==start.viewport.width||capture.viewport.height!==start.viewport.height||capture.dpr!==start.dpr)result.invalidReasons.push('Viewport or DPR changed during measurement');
      if(result.summary.count<Math.max(2,Math.floor(sampleMs/1000))||result.durationMs<sampleMs||result.samples.at(-1)?.atMs-result.samples[0]?.atMs<sampleMs*.8)result.invalidReasons.push('Insufficient samples or incomplete measurement');
      if(capture.measurement.interrupted)result.invalidReasons.push('Renderer was interrupted during measurement');
      if(capture.state.status!=='ready'||capture.state.pipeline!=='on')result.invalidReasons.push('Renderer failed or pipeline fallback');
      if(start.bufferWidth!==capture.state.bufferWidth||start.bufferHeight!==capture.state.bufferHeight||start.renderScale!==capture.state.renderScale)result.invalidReasons.push('Render buffer changed during measurement');
      result.routeDistance=capture.routeDistance??null;
      if(scenario.route&&!(capture.routeDistance>.01))result.invalidReasons.push('Walking route did not move the player');
      if(errors.length)result.invalidReasons.push('Browser errors: '+errors.join('; '));
      const screenshot=`${scenario.id}-${iteration}.png`;await page.screenshot({path:join(output,screenshot)});result.screenshot=screenshot;
    }catch(error){result.invalidReasons.push(String(error));}
    finally{await context.close();}
  }
  console.log('resource-cycle');
  const context=await browser.newContext({viewport:run.environment.viewport,deviceScaleFactor:1});
  try{
    const page=await context.newPage();let hidden=false;page.on('pageerror',e=>run.resourceCycle.error=String(e));page.on('console',m=>{if(/Shader Error|WebGLProgram|VALIDATE_STATUS|COMPILE_STATUS|HD-2D pipeline failed/i.test(m.text()))run.resourceCycle.error=m.text();});
    await page.goto(url+'?visualShot=shot-01-quarter-street&perfAudit=1&weather=clear');
    await page.waitForFunction(()=>window.__pixelPerf?.startup().firstDrawMs!==null&&window.__pixelGame?.read().status==='ready',null,{timeout:60000});
    await page.evaluate(()=>{window.__resourceHidden=false;window.__resourceLost=false;document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')window.__resourceHidden=true});window.addEventListener('blur',()=>{window.__resourceHidden=true});document.querySelector('#stage').addEventListener('webglcontextlost',()=>{window.__resourceLost=true});});
    async function setAndSettle(q,c){
      const before=await page.evaluate(({q,c})=>{for(const [selector,value] of [['#quality',q],['#camera-mode',c]]){const node=document.querySelector(selector);node.value=value;node.dispatchEvent(new Event('change',{bubbles:true}));}return window.__pixelGame.read().frames;},{q,c});
      await page.waitForFunction(n=>window.__pixelGame.read().frames>=n+3,before,{timeout:30000});
      await page.waitForTimeout(500);
    }
    async function snapshot(cycle){return page.evaluate(cycle=>({cycle,atMs:performance.now(),state:window.__pixelGame.read(),hidden:window.__resourceHidden||document.visibilityState!=='visible',lost:window.__resourceLost}),cycle);}
    await setAndSettle(quality,'quarter');run.resourceCycle.snapshots.push(await snapshot(0));
    for(let i=1;i<=3;i++){await setAndSettle('basic','first');await setAndSettle('high','vista');await setAndSettle(quality,'quarter');run.resourceCycle.snapshots.push(await snapshot(i));}
    hidden=run.resourceCycle.snapshots.some(x=>x.hidden);
    const usable=run.resourceCycle.snapshots.every(x=>!x.lost&&x.state.status==='ready'&&x.state.pipeline==='on'&&x.state.camera==='quarter'&&x.state.grade===quality&&x.state.renderStats?.geometries!=null&&x.state.renderStats?.textures!=null&&x.state.renderStats?.programs!=null);
    run.resourceCycle.status=!hidden&&usable&&!run.resourceCycle.error?'OK':'INVALID';
    if(hidden)run.resourceCycle.error='Page lost focus or visibility during resource cycle';
    else if(!usable)run.resourceCycle.error='Renderer, camera, quality or resource counts unavailable';
  }catch(error){run.resourceCycle.status='FAILED';run.resourceCycle.error=String(error);}
  finally{await context.close();}
}catch(error){run.invalidReasons.push(String(error));}
finally{await browser?.close();preview.kill();}
if(!commit||dirty===null)run.invalidReasons.push('Git revision or working tree state unavailable');
if(run.results.length!==scenarios.length*repetitions)run.invalidReasons.push('Missing scenario repetitions');
for(const x of run.results)if(x.invalidReasons.length)run.invalidReasons.push(`${x.scenario} #${x.iteration}: ${x.invalidReasons.join('; ')}`);
run.valid=run.invalidReasons.length===0;
const resultPath=join(output,'result.json');await writeFile(resultPath,JSON.stringify(run,null,2)+'\n');await makeReport([resultPath],join(output,'report.html'));
console.log(`Result: ${resultPath}\nReport: ${join(output,'report.html')}\n${run.valid?'VALID':'INVALID: '+run.invalidReasons.join('; ')}`);
if(!run.valid)process.exitCode=1;
