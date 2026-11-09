// Stable identifiers are shared by pickups, inventory and save files.
export const ITEMS = Object.freeze({shell:{name:'貝殼'}, driftwood:{name:'漂流木'}, stone:{name:'海石'}});
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
