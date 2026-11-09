import {ITEMS,PICKUPS} from './inventory.js';
import {CROPS,validPlots,emptyPlots} from './farming.js';

export const SAVE_KEY='pixel-games.save.v1';
const PICKUP_BY_ID=new Map(PICKUPS.map(p=>[p.id,p]));

export function validateSave(s) {
  if(!s || ![1,2].includes(s.version) || !s.player || !Number.isFinite(s.player.x) || !Number.isFinite(s.player.z) || Math.abs(s.player.x)>120 || Math.abs(s.player.z)>40 || !Number.isFinite(s.hour) || s.hour<0 || s.hour>=24 || typeof s.timeAuto!=='boolean') throw Error('存檔版本或位置、時間無效');
  if(!s.inventory || Array.isArray(s.inventory) || typeof s.inventory!=='object' || Object.entries(s.inventory).some(([id,n])=>!Object.hasOwn(ITEMS,id)||!Number.isSafeInteger(n)||n<1)) throw Error('存檔物品或數量無效');
  if(!Array.isArray(s.collected) || new Set(s.collected).size!==s.collected.length || s.collected.some(id=>!PICKUP_BY_ID.has(id))) throw Error('存檔拾取紀錄無效');
  // Each current pickup is a one-time object. Item quantities must match those IDs exactly.
  const expected=Object.create(null);
  for(const id of s.collected){
    const item=PICKUP_BY_ID.get(id).item;
    expected[item]=(expected[item]??0)+1;
  }
  if(Object.entries(s.inventory).some(([id,n])=>!Object.hasOwn(CROPS,id)&&n!==(expected[id]??0)) || Object.entries(expected).some(([id,count])=>s.inventory[id]!==count) || (s.version===1&&Object.keys(s.inventory).some(id=>Object.hasOwn(CROPS,id)))) throw Error('背包數量與拾取紀錄不一致');
  if(s.version===2&&!validPlots(s.farm)) throw Error('農田資料無效');
  if(!s.fishing || !Number.isSafeInteger(s.fishing.count) || s.fishing.count<0 || (s.fishing.best!==null && (!s.fishing.best || typeof s.fishing.best.name!=='string' || !Number.isFinite(s.fishing.best.length) || s.fishing.best.length<0))) throw Error('存檔釣魚紀錄無效');
  if(typeof s.boatsMovable!=='boolean' || !Array.isArray(s.boats) || !Number.isInteger(s.aboard) || s.aboard < -1 || s.aboard>=s.boats.length || s.boats.some(b=>!b || ![b.x,b.z,b.heading].every(Number.isFinite) || (s.boatsMovable ? (b.x<14.8 || b.x>118 || Math.abs(b.z)>40) : (b.x!==0 || b.z!==0)))) throw Error('存檔船隻資料無效');
  return s;
}
export function upgradeSave(s) { validateSave(s); return s.version===1?{...s,version:2,farm:emptyPlots()}:s; }
export function readSave(storage) { const raw=storage.getItem(SAVE_KEY); return raw ? validateSave(JSON.parse(raw)) : null; }
export function writeSave(storage, save) { storage.setItem(SAVE_KEY,JSON.stringify(validateSave(save))); }

// Apply before committing the localStorage key. On any failure, restore the
// in-memory state (including fishing's legacy tally) without changing the save.
export function commitImportedSave(storage, candidate, previous, apply) {
  validateSave(candidate);validateSave(previous);
  try{apply(candidate);writeSave(storage,candidate);}
  catch(error){
    try{apply(previous);}
    catch(rollbackError){throw new AggregateError([error,rollbackError],'匯入失敗且無法還原原本遊戲狀態');}
    throw error;
  }
}

