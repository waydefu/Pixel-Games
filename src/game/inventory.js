import {SPECIES} from './fishing-logic.js';

// Stable identifiers are shared by pickups, inventory and save files.
export const CATCH_ITEMS = Object.freeze(Object.fromEntries(SPECIES.filter(s=>!s.junk).map(s=>[s.id,{name:s.name}])));
export const ITEMS = Object.freeze({shell:{name:'貝殼'}, driftwood:{name:'漂流木'}, stone:{name:'海石'}, ...CATCH_ITEMS});
export function addCatch(inventory, result) {
  if(!result || result.junk || !Object.hasOwn(CATCH_ITEMS,result.id)) return false;
  inventory[result.id]=(inventory[result.id]??0)+1;
  return true;
}
export const PICKUPS = Object.freeze([
  {id:'shell-1',item:'shell',x:12,z:1}, {id:'shell-2',item:'shell',x:12,z:-4},
  {id:'wood-1',item:'driftwood',x:12,z:12}, {id:'stone-1',item:'stone',x:12,z:-10},
]);
export function collect(inventory, collected, id) {
  const pickup=PICKUPS.find(p=>p.id===id);
  if(!pickup || collected.includes(id)) return false;
  inventory[pickup.item]=(inventory[pickup.item]??0)+1;
  collected.push(id); return true;
}
