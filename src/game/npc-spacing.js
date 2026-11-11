// Deterministic town-life placement, feet anchoring and very small crowd solver.
// No Three.js dependency; collision is in world X/Z and never changes camera or terrain.
export const VILLAGER_START_INDICES=Object.freeze([1,3,5,6,7]);
export const NPC_RADIUS=Object.freeze({villager:.72,dog:.43,chicken:.27,cat:.33,player:.5});

/** Fraction of the full sprite plane between its bottom edge and its lowest opaque pixel centre. */
export function spriteFootInset(sheet,frameSize=32){
  if(!Number.isInteger(frameSize)||frameSize<1||
    sheet.width%frameSize||sheet.height%frameSize||
    sheet.data?.length!==sheet.width*sheet.height*4)
    throw new RangeError("invalid NPC sprite sheet");
  let lowest=-1;
  for(let y=0;y<sheet.height;y++){
    for(let x=0;x<sheet.width;x++){
      if(sheet.data[(y*sheet.width+x)*4+3]>=128)
        lowest=Math.max(lowest,y%frameSize);
    }
  }
  if(lowest<0)throw new RangeError("empty NPC sprite");
  return (frameSize-lowest-.5)/frameSize;
}

/** Bottommost opaque pixel rests 15 mm above the gameplay walk plane. */
export function spriteCenterY(ground,size,footInset){
  if(![ground,size,footInset].every(Number.isFinite)||size<=0||footInset<0||footInset>1)
    throw new RangeError("invalid NPC footing");
  return ground+size*(.5-footInset)+.015;
}

/**
 * Resolve disc overlap in place. Actors keep their underlying wanderer state:
 * no disconnected visual-only offset and no snap-back on the next frame.
 * The player never gets teleported. Ten actors × a few relaxation passes is inexpensive.
 * @param {Array<{state:{x:number,z:number},radius:number}>} actors
 * @param {{x:number,z:number}|null} player
 */
export function separateNpcActors(actors,player=null){
  for(let pass=0;pass<14;pass++){
    let maximum=0;
    for(let i=0;i<actors.length;i++){
      const a=actors[i];
      for(let j=i+1;j<actors.length;j++){
        const b=actors[j],dx=a.state.x-b.state.x,dz=a.state.z-b.state.z;
        const d=Math.hypot(dx,dz),overlap=a.radius+b.radius-d;
        if(overlap<=.0001)continue;
        maximum=Math.max(maximum,overlap);
        // Stable tie-break: coincident actors must separate, not produce NaN.
        const nx=d>1e-8?dx/d:((i+j)&1?1:0);
        const nz=d>1e-8?dz/d:((i+j)&1?0:1);
        const move=(overlap+.0001)*.5;
        a.state.x+=nx*move;a.state.z+=nz*move;
        b.state.x-=nx*move;b.state.z-=nz*move;
      }
    }
    if(player&&Number.isFinite(player.x)&&Number.isFinite(player.z)){
      for(let i=0;i<actors.length;i++){
        const actor=actors[i],dx=actor.state.x-player.x,dz=actor.state.z-player.z;
        const d=Math.hypot(dx,dz),overlap=actor.radius+NPC_RADIUS.player-d;
        if(overlap<=.0001)continue;
        maximum=Math.max(maximum,overlap);
        const angle=i*2.399963229728653;
        const nx=d>1e-8?dx/d:Math.cos(angle),nz=d>1e-8?dz/d:Math.sin(angle);
        actor.state.x+=nx*(overlap+.0001);
        actor.state.z+=nz*(overlap+.0001);
      }
    }
    if(maximum<.0002)break;
  }
}
