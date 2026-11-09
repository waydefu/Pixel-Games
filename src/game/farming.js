// Stable plot IDs and wall-clock timestamps are persisted in saves.
export const CROPS=Object.freeze({wheat:{name:"小麥"},cabbage:{name:"甘藍"},pumpkin:{name:"南瓜"},leek:{name:"韭蔥"}});
export const GROW_MS=300000;
const fields=[[-43.2,-29.2],[-33.6,-29.2],[-43.2,-22.2],[-33.6,-22.2]];
export const PLOTS=Object.freeze(fields.flatMap(([x,z],field)=>Array.from({length:6},(_,i)=>({id:field*6+i,x:x+(i%3-1)*2.6,z:z+(Math.floor(i/3)-.5)*2.5}))));
export function stage(plot,now=Date.now()){if(!plot)return 0;const elapsed=Math.max(0,now-plot.plantedAt);return elapsed>=GROW_MS?3:elapsed>=GROW_MS/2?2:1;}
export function plant(plots,id,crop,now=Date.now()){if(!Number.isInteger(id)||id<0||id>=PLOTS.length||plots[id]||!Object.hasOwn(CROPS,crop)||!Number.isSafeInteger(now)||now<0)return false;plots[id]={crop,plantedAt:now};return true;}
export function harvest(plots,id,inventory,now=Date.now()){const plot=plots[id];if(!plot||stage(plot,now)!==3)return false;inventory[plot.crop]=(inventory[plot.crop]??0)+1;plots[id]=null;return true;}
export function validPlots(plots){return Array.isArray(plots)&&plots.length===PLOTS.length&&plots.every(p=>p===null||(p&&typeof p==="object"&&!Array.isArray(p)&&Object.keys(p).length===2&&Object.hasOwn(CROPS,p.crop)&&Number.isSafeInteger(p.plantedAt)&&p.plantedAt>=0));}
export const emptyPlots=()=>PLOTS.map(()=>null);
