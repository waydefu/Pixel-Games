/** Segment a masonry facade into solid rectangles around real rectangular apertures. */
export function partitionFacade(width,minY,maxY,holes) {
  if(!Number.isFinite(width)||width<=0||!Number.isFinite(minY)||!Number.isFinite(maxY)||maxY<=minY)throw new RangeError("invalid facade bounds");
  const minX=-width/2,maxX=width/2;
  const xs=[minX,maxX],ys=[minY,maxY];
  for(const h of holes){
    if(![h.x,h.y,h.w,h.h].every(Number.isFinite)||h.w<=0||h.h<=0)throw new RangeError("invalid opening");
    xs.push(Math.max(minX,h.x-h.w/2),Math.min(maxX,h.x+h.w/2));
    ys.push(Math.max(minY,h.y-h.h/2),Math.min(maxY,h.y+h.h/2));
  }
  const sorted=(array)=>[...new Set(array.map(v=>Math.round(v*10000)/10000))].sort((a,b)=>a-b);
  const xCuts=sorted(xs),yCuts=sorted(ys);
  const result=[];
  for(let j=0;j<yCuts.length-1;j++){
    const y0=yCuts[j],y1=yCuts[j+1];
    let run=null;
    for(let i=0;i<xCuts.length-1;i++){
      const x0=xCuts[i],x1=xCuts[i+1],mx=(x0+x1)/2,my=(y0+y1)/2;
      const open=holes.some(h=>Math.abs(mx-h.x)<h.w/2-1e-5&&Math.abs(my-h.y)<h.h/2-1e-5);
      if(open){if(run){result.push(run);run=null;}continue;}
      if(run && Math.abs(run.x1-x0)<1e-4)run.x1=x1;
      else {if(run)result.push(run);run={x0,x1,y0,y1};}
    }
    if(run)result.push(run);
  }
  return result.map(r=>Object.freeze({
    x:(r.x0+r.x1)/2,y:(r.y0+r.y1)/2,w:r.x1-r.x0,h:r.y1-r.y0
  }));
}
