// Pure benchmark calculations; RAF intervals are not GPU timings.
export function summarize(samples, {allowZero=false}={}) {
  const values=samples.map(s=>typeof s==='number'?s:s.frameMs).filter(v=>Number.isFinite(v)&&(allowZero?v>=0:v>0)).sort((a,b)=>a-b);
  if(!values.length)return {count:0,p50Ms:null,p95Ms:null,p99Ms:null,meanMs:null,over16_7Pct:null,over33_3Pct:null};
  const pct=p=>values[Math.ceil(values.length*p)-1];
  return {count:values.length,p50Ms:pct(.5),p95Ms:pct(.95),p99Ms:pct(.99),meanMs:values.reduce((a,b)=>a+b,0)/values.length,over16_7Pct:100*values.filter(v=>v>16.7).length/values.length,over33_3Pct:100*values.filter(v=>v>33.3).length/values.length};
}
export function stutters(samples,gpuSamples=[],cpuSamples=[]) {
  const nearest=(items,at)=>{let best=null;for(const item of items)if(!best||Math.abs(item.atMs-at)<Math.abs(best.atMs-at))best=item;return best&&Math.abs(best.atMs-at)<=50?best:null;};
  const events=samples.filter(s=>s.frameMs>33.3).map(s=>{const gpu=nearest(gpuSamples,s.atMs),cpu=nearest(cpuSamples,s.atMs);return {...s,gpuMs:gpu?.gpuMs??null,gpuOffsetMs:gpu?gpu.atMs-s.atMs:null,cpu:cpu??null};});
  return {over33Count:events.length,over50Count:events.filter(e=>e.frameMs>50).length,maxFrameMs:samples.length?samples.reduce((max,s)=>Math.max(max,s.frameMs),0):null,events};
}
export function median(values) {
  const a=values.filter(Number.isFinite).sort((x,y)=>x-y);
  if(!a.length)return null;
  const i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2;
}
export function improvement(a,b) {return Number.isFinite(a)&&Number.isFinite(b)&&a>0?100*(a-b)/a:null;}
export function compareConditions(a,b) {
  const reasons=[];
  for(const key of ['schemaVersion','protocolVersion'])if(a[key]!==b[key])reasons.push(key+' differs');
  for(const key of ['browser','browserVersion','os','cpu','memoryBytes','gpuVendor','gpuRenderer','viewport','dpr','quality','warmupMs','sampleMs','repetitions','scenarios','cachePolicy'])
    if(JSON.stringify(a.environment?.[key])!==JSON.stringify(b.environment?.[key]))reasons.push(key+' differs');
  if(a.valid!==true||b.valid!==true)reasons.push('one or both runs are invalid');
  if(a.dirty!==false||b.dirty!==false)reasons.push('working tree contains uncommitted or unidentified changes');
  if([a,b].some(run=>!run.environment?.gpuRenderer||!run.environment?.browserVersion||!run.environment?.scenarios?.length||run.results?.length!==run.environment.scenarios.length*run.environment.repetitions||run.results.some(x=>!x.samples?.length||!x.state?.bufferWidth||!x.state?.bufferHeight)))reasons.push('missing benchmark metadata or samples');
  const buffers=run=>run.results?.map(x=>[x.scenario,x.iteration,x.state?.bufferWidth,x.state?.bufferHeight,x.state?.renderScale,x.state?.pipeline,x.state?.weather]);
  if(JSON.stringify(buffers(a))!==JSON.stringify(buffers(b)))reasons.push('scenario render conditions differ');
  if(!a.results?.length||!b.results?.length)reasons.push('missing results');
  return reasons;
}
