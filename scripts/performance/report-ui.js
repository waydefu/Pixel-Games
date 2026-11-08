/* Self-contained browser UI embedded in every offline report. */
(()=>{
  const {runs,reasons}=reportData,app=document.querySelector('#app');
  const tabs=[['overview','總覽'],['startup','啟動時間'],['smooth','順暢與卡頓'],['cpu','CPU 分段'],['gpu','GPU 繪製'],['resources','資源變化'],['images','畫面與資訊']];
  const names={street:'街景',wall:'第一人稱近牆',pier:'第一人稱碼頭',walk:'步行路線'};
  const phaseNames={cloudShadow:'雲影',reflection:'海面反射（實際繪製）',scene:'主場景',bloom:'Bloom 泛光',rays:'光線',dof:'景深',composite:'最終合成'};
  const E=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined&&text!==null)n.textContent=String(text);if(cls)n.className=cls;return n};
  const median=values=>{const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2};
  const fmt=(v,digits=2)=>Number.isFinite(v)?v.toFixed(digits):'—';
  const ids=[...new Set(runs.flatMap(r=>(r.results??[]).map(x=>x.scenario)))];
  let tab='overview',scenario=ids[0]??'',selected='0:1',resourceMetric='textures';
  const layout=E('div',null,'layout'),side=E('aside'),main=E('main'),nav=E('nav',null,'nav');nav.setAttribute('aria-label','效能指標');
  const brand=E('div','PIXEL-GAMES','brand');brand.append(E('span','Performance Lab'));side.append(brand,nav,E('p','本機離線報告 · 資料不會上傳','side-note'));layout.append(side,main);app.append(layout);
  const select=(label,options,value,onchange)=>{const wrap=E('label',null,'control');wrap.append(E('span',label));const el=E('select');for(const [v,l] of options){const opt=E('option',l);opt.value=String(v);el.append(opt)}el.value=value;el.addEventListener('change',()=>onchange(el.value));wrap.append(el);return wrap};
  const panel=(title,description)=>{const n=E('section',null,'panel');n.append(E('h2',title));if(description)n.append(E('p',description));return n};
  const card=(title,value,note)=>{const n=E('div',null,'card');n.append(E('div',title,'card-label'),E('div',value,'card-value'),E('small',note));return n};
  const results=(run)=> (run.results??[]).filter(x=>x.scenario===scenario);
  const startupValue=(x,key)=>x.startup&&(!x.startup.status||x.startup.status==='OK')&&x.startup.assetsLoaded!==false?x.startup[key]:null;
  const selectedResult=()=>{const [i,n]=selected.split(':').map(Number);return results(runs[i]??{}) .find(x=>x.iteration===n)??null};
  const selectedRun=()=>runs[Number(selected.split(':')[0])]??runs[0];
  function addTable(section,rows){
    const wrap=E('div',null,'table-wrap'),table=E('table'),thead=E('thead'),head=E('tr');
    ['指標','A 中位數',...(runs.length>1?['B 中位數','改善']:[])].forEach(x=>head.append(E('th',x)));thead.append(head);table.append(thead);const body=E('tbody');
    for(const [label,get,unit='ms'] of rows){const vals=runs.map(run=>{const rr=results(run),values=rr.map(get);return !values.length||values.some(v=>!Number.isFinite(v))?null:median(values)});const tr=E('tr');tr.append(E('td',label),E('td',fmt(vals[0])+(Number.isFinite(vals[0])?' '+unit:'')));if(runs.length>1){tr.append(E('td',fmt(vals[1])+(Number.isFinite(vals[1])?' '+unit:'')));const change=vals[0]>0&&Number.isFinite(vals[1])?100*(vals[0]-vals[1])/vals[0]:null;tr.append(E('td',reasons.length?'不可比較':Number.isFinite(change)?fmt(change)+'%':'—'))}body.append(tr)}table.append(body);wrap.append(table);section.append(wrap);
  }
  function chart(section,points,key,{color='#91e5c5',events=[],unit='ms',min=1}={}){
    if(!points?.length){section.append(E('div','這次沒有可用的時間序列。','empty'));return}
    const canvas=E('canvas',null,'graph');canvas.width=1200;canvas.height=300;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','數據隨時間變化的折線圖');section.append(canvas);
    const ctx=canvas.getContext('2d'),valid=points.filter(p=>Number.isFinite(p[key])&&Number.isFinite(p.atMs));if(!valid.length)return;
    const max=valid.reduce((m,p)=>Math.max(m,p[key]),min),last=valid.reduce((m,p)=>Math.max(m,p.atMs),1);
    ctx.strokeStyle='#324653';ctx.lineWidth=1;for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(45,i*65);ctx.lineTo(1180,i*65);ctx.stroke()}
    ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();valid.forEach((p,i)=>{const x=45+p.atMs/last*1135,y=270-Math.min(p[key]/max,1)*240;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();
    ctx.fillStyle='#f3ba79';for(const ev of events){const x=45+ev.atMs/last*1135;ctx.fillRect(x,28,2,242)}ctx.fillStyle='#a3b4bc';ctx.font='15px sans-serif';ctx.fillText(fmt(max)+' '+unit,8,18);ctx.fillText('0 s',45,294);ctx.fillText(fmt(last/1000,1)+' s',1110,294);
  }
  function raw(section,label,value){const d=E('details'),s=E('summary',label);d.append(s,E('pre',JSON.stringify(value,null,2)));section.append(d)}
  function header(){
    nav.replaceChildren();for(const [id,label] of tabs){const b=E('button',label,id===tab?'active':'');b.type='button';b.setAttribute('aria-pressed',String(id===tab));b.addEventListener('click',()=>{tab=id;render();nav.querySelector('[aria-pressed="true"]')?.focus()});nav.append(b)}
    main.replaceChildren();const top=E('div',null,'heading'),left=E('div');left.append(E('div','PERFORMANCE REPORT','eyebrow'),E('h1',tabs.find(t=>t[0]===tab)?.[1]??'效能報告'),E('p','選擇指標與場景，查看同一份測試資料。','sub'));top.append(left);
    const allValid=runs.every(r=>r.valid);top.append(E('span',allValid?'採樣有效':'採樣需檢查','badge'+(allValid?'':' bad')));main.append(top);
    if(reasons.length)main.append(E('div','A/B 不可直接比較：'+reasons.join('；'),'warning'));
    if(runs.some(r=>r.dirty))main.append(E('div','包含未提交變更：可檢視本次結果，但不能作為可追溯的版本比較。','warning'));
    const controls=E('div',null,'controls');controls.append(select('場景',ids.map(id=>[id,names[id]??id]),scenario,v=>{scenario=v;const options=runOptions();if(!options.some(o=>o[0]===selected))selected=options[0]?.[0]??'';render()}));
    controls.append(select('查看單次結果',runOptions(),selected,v=>{selected=v;render()}));main.append(controls);
  }
  function runOptions(){return runs.flatMap((r,i)=>results(r).map(x=>[i+':'+x.iteration,(i?'B':'A')+' · 第 '+x.iteration+' 次']))}
  function overview(x){
    const cards=E('div',null,'cards');cards.append(card('畫面更新 p95',fmt(x?.summary?.p95Ms)+' ms','越低越平穩'),card('GPU 整幀 p95',fmt(x?.gpu?.summary?.p95Ms)+' ms',x?.gpu?.status??'未測量'),card('超過 33.3 ms',Number.isFinite(x?.stutters?.over33Count)?x.stutters.over33Count+' 次':'—','本次選中輪次'),card('第一幀繪製完成',fmt(x?startupValue(x,'firstDrawMs'):null,0)+' ms','從導覽開始起算'));main.append(cards);
    const p=panel('本次測試','下方數字為各輪結果的中位數；圖表與明細跟隨上方選擇的輪次。');addTable(p,[['畫面更新 p95',x=>x.summary?.p95Ms],['GPU 整幀 p95',x=>x.gpu?.status==='OK'?x.gpu.summary?.p95Ms:null],['卡頓 >33.3 ms',x=>x.stutters?.over33Count,'次'],['第一幀繪製完成',x=>startupValue(x,'firstDrawMs')]]);main.append(p);
    const tip=panel('怎麼看這份報告','從左側選擇啟動、卡頓、CPU、GPU 或資源；畫面與版本資訊可在最後一頁查看。');tip.append(E('div','GPU 整幀和各階段採不同幀交錯抽樣；CPU 為同步程式區段的經過時間，不是 CPU 使用率。','muted'));main.append(tip);
  }
  function startupView(x){
    const p=panel('從開啟到第一幀','每輪使用新的瀏覽器 context；作業系統、瀏覽器程序及 GPU 快取仍可能保留。數字從頁面導覽開始計算。');
    addTable(p,[['程式開始執行',x=>startupValue(x,'scriptStartMs')],['素材載入完成',x=>startupValue(x,'assetsReadyMs')],['世界建立完成',x=>startupValue(x,'worldReadyMs')],['輸入系統建立',x=>startupValue(x,'inputReadyMs')],['渲染器就緒',x=>startupValue(x,'rendererReadyMs')],['第一幀繪製呼叫完成',x=>startupValue(x,'firstDrawMs')],['可操作代理時間',x=>Number.isFinite(startupValue(x,'firstDrawMs'))&&Number.isFinite(startupValue(x,'inputReadyMs'))?Math.max(x.startup.firstDrawMs,x.startup.inputReadyMs):null]]);
    p.append(E('p','第一幀完成加上輸入系統就緒，可作為「大致可操作」的代理指標；並非已驗證的畫面呈現時間或實際輸入延遲。啟動時採遊戲預設畫質。','muted'));
    if(x?.startup?.assetsLoaded===false)p.append(E('p','素材載入失敗，本次使用程序生成的替代場景。','warning'));
    if(x?.startup?.status==='INVALID')p.append(E('p','啟動期間頁面曾失焦或進入背景，啟動數字不納入比較。','warning'));
    if(!x?.startup)p.append(E('p','這份舊報告沒有啟動時間資料。','muted'));raw(p,'查看本輪啟動明細',x?.startup??'NOT MEASURED');main.append(p);
  }
  function smoothView(x){
    const p=panel('畫面更新間隔','時間越低通常越順暢；橘線標示超過 33.3 ms 的幀。');addTable(p,[['p50',x=>x.summary?.p50Ms],['p95',x=>x.summary?.p95Ms],['p99',x=>x.summary?.p99Ms],['超過 33.3 ms',x=>x.stutters?.over33Count,'次'],['超過 50 ms',x=>x.stutters?.over50Count,'次'],['最長幀間隔',x=>x.stutters?.maxFrameMs]]);chart(p,x?.samples,'frameMs',{min:34,events:x?.stutters?.events});main.append(p);
    const q=panel('卡頓事件','附近的 CPU／GPU 數據可能來自另一幀，只供對照，不能證明卡頓原因。');const ev=x?.stutters?.events;if(!ev)q.append(E('div','這份報告沒有卡頓事件資料。','empty'));else if(!ev.length)q.append(E('div','這次沒有超過 33.3 ms 的卡頓。','empty'));else{q.append(E('p','共 '+ev.length+' 次；畫面顯示前 100 次，完整資料保留於 JSON。'));for(const e of ev.slice(0,100))raw(q,fmt(e.atMs/1000,2)+' 秒 · '+fmt(e.frameMs)+' ms',{gpuMs:e.gpuMs,gpuOffsetMs:e.gpuOffsetMs,cpu:e.cpu})}main.append(q);
  }
  function cpuView(x){const p=panel('CPU 同步工作','以主執行緒各區段的經過時間顯示，含量測負擔；不是 CPU 使用率，也不是 GPU 執行時間。');const labels={movementMs:'移動與碰撞',cameraMs:'相機',worldMs:'世界與音效',drawSubmitMs:'繪製提交'};addTable(p,Object.entries(labels).map(([key,label])=>[label+' p95',x=>x.cpu?.summary?.[key]?.p95Ms]));raw(p,'查看本輪 CPU 摘要',x?.cpu?.summary??'NOT MEASURED');main.append(p)}
  function gpuView(x){const p=panel('GPU 整幀','WebGL 非同步計時；GPU 整幀和各階段交錯抽樣，因此各階段數字不能直接相加。');addTable(p,[['GPU p50',x=>x.gpu?.status==='OK'?x.gpu.summary?.p50Ms:null],['GPU p95',x=>x.gpu?.status==='OK'?x.gpu.summary?.p95Ms:null],['GPU p99',x=>x.gpu?.status==='OK'?x.gpu.summary?.p99Ms:null]]);chart(p,x?.gpu?.status==='OK'?x.gpu.samples:[],'gpuMs');p.append(E('div','本輪狀態：'+(x?.gpu?.status??'NOT MEASURED'),'legend'));main.append(p);
    const q=panel('GPU 各繪製階段','海面反射只在實際執行時取樣；未執行或無效顯示 —。');addTable(q,Object.entries(phaseNames).map(([key,label])=>[label+' p95',x=>x.gpu?.phases?.[key]?.status==='OK'?x.gpu.phases[key].summary?.p95Ms:null]));raw(q,'查看本輪階段狀態與樣本數',Object.fromEntries(Object.entries(x?.gpu?.phases??{}).map(([k,v])=>[k,{status:v.status,count:v.samples?.length??0}])));main.append(q)}
  function resourcesView(x){const p=panel('執行期間的資源數量','每秒記錄貼圖、幾何體和 shader program 數量；這些是數量，不是 VRAM 容量。');p.append(select('顯示項目',[['textures','貼圖'],['geometries','幾何體'],['programs','Shader programs']],resourceMetric,v=>{resourceMetric=v;render()}));chart(p,x?.resources?.samples,resourceMetric,{unit:'個'});raw(p,'查看本輪資源樣本',x?.resources??'NOT MEASURED');main.append(p);
    const r=selectedRun(),cycle=r?.resourceCycle,q=panel('反覆切換後','依序切換基本／高畫質與視角，再回到原設定；比較每輪回復後的數量。GPU 快取可能保留資源，數量增加只是調查線索，不能單獨證明洩漏。');q.append(E('p','測試狀態：'+(cycle?.status??'NOT MEASURED')));if(cycle?.error)q.append(E('p',cycle.error,'warning'));
    if(cycle?.snapshots?.length){const table=E('table'),h=E('tr');['輪次','貼圖','幾何體','Shader programs'].forEach(t=>h.append(E('th',t)));table.append(h);for(const s of cycle.snapshots){const tr=E('tr');[s.cycle===0?'起始':String(s.cycle),s.state?.renderStats?.textures??'—',s.state?.renderStats?.geometries??'—',s.state?.renderStats?.programs??'—'].forEach(t=>tr.append(E('td',t)));table.append(tr)}const wrap=E('div',null,'table-wrap');wrap.append(table);q.append(wrap)}else q.append(E('div','這份報告沒有切換測試資料。','empty'));main.append(q)}
  function imagesView(){const p=panel('場景截圖','比較時請確認構圖和畫質一致。'),wrap=E('div',null,'screens');for(const [i,r] of runs.entries()){const x=results(r)[0];if(x?.image){const fig=E('figure'),img=E('img');img.src=x.image;img.alt=(i?'B':'A')+' '+(names[scenario]??scenario);fig.append(img,E('figcaption',(i?'B':'A')+' · 第 '+x.iteration+' 次'));wrap.append(fig)}}if(!wrap.children.length)wrap.append(E('div','沒有可用截圖。','empty'));p.append(wrap);main.append(p);const q=panel('版本與測試環境','硬體、瀏覽器、畫質和測試條件決定比較是否可靠。');runs.forEach((r,i)=>raw(q,(i?'B':'A')+' · '+(r.commit??'未記錄'),{valid:r.valid,dirty:r.dirty,invalidReasons:r.invalidReasons,environment:r.environment}));main.append(q)}
  function render(){header();const x=selectedResult();if(tab==='overview')overview(x);else if(tab==='startup')startupView(x);else if(tab==='smooth')smoothView(x);else if(tab==='cpu')cpuView(x);else if(tab==='gpu')gpuView(x);else if(tab==='resources')resourcesView(x);else imagesView()}
  const opts=runOptions();if(!opts.some(x=>x[0]===selected))selected=opts[0]?.[0]??'';render();
})();
