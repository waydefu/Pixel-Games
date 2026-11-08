import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {compareConditions} from './metrics.mjs';

export async function makeReport(paths,output){
  const runs=[];
  for(const path of paths){
    const run=JSON.parse(await readFile(path,'utf8'));
    for(const result of run.results??[]){
      if(result.screenshot){try{result.image='data:image/png;base64,'+(await readFile(resolve(dirname(path),result.screenshot))).toString('base64');}catch{result.image=null;}}
    }
    runs.push(run);
  }
  const data=JSON.stringify({runs,reasons:runs.length===2?compareConditions(...runs):[]}).replace(/</g,'\\u003c');
  const ui=(await readFile(new URL('./report-ui.js',import.meta.url),'utf8')).replace(/<\/script/gi,'<\\/script');
  const css=await readFile(new URL('./report.css',import.meta.url),'utf8');
  await writeFile(output,`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pixel-Games 效能報告</title><style>${css}</style></head><body><div id="app"></div><script>const reportData=${data};\n${ui}</script></body></html>`);
}
