import * as THREE from "three";

const GLASS_AREA={min:.15,max:2.4};
const GLASS_THICKNESS=.2; // a pane is flat; beams and posts are not
const GLASS_SPAN=.4;      // and has two real dimensions; door jambs and hinges are slivers

/**
 * Marks window glass in a baked geometry: connected patches of near-black triangles that are small and
 * pane-sized. The near-black vertex colour alone also paints whole walls, door ironwork and barrel hoops,
 * which must never light up at night.
 */
export function markGlass(geometry){
  const position=geometry.getAttribute("position"),color=geometry.getAttribute("color"),glow=geometry.getAttribute("glow");
  const index=geometry.index;
  const triangles=index?index.count/3:position.count/3;
  const vertexOf=(t,c)=>index?index.getX(t*3+c):t*3+c;
  // Glass is near-black and slightly blue; dark timber is near-black and red-brown.
  const dark=v=>Math.max(color.getX(v),color.getY(v),color.getZ(v))<.10&&color.getZ(v)>=color.getX(v)*.75;
  const keys=new Map();
  const parent=[];
  const find=a=>{while(parent[a]!==a){parent[a]=parent[parent[a]];a=parent[a];}return a;};
  const slot=v=>{
    const key=Math.round(position.getX(v)*500)+","+Math.round(position.getY(v)*500)+","+Math.round(position.getZ(v)*500);
    let id=keys.get(key);
    if(id===undefined){id=parent.length;parent.push(id);keys.set(key,id);}
    return id;
  };
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  const area=new Map(),box=new Map();
  const darkTriangles=[];
  for(let t=0;t<triangles;t++){
    const v0=vertexOf(t,0),v1=vertexOf(t,1),v2=vertexOf(t,2);
    if(!dark(v0)||!dark(v1)||!dark(v2))continue;
    darkTriangles.push(t);
    const s0=slot(v0),s1=slot(v1),s2=slot(v2);
    parent[find(s1)]=find(s0);parent[find(s2)]=find(s0);
  }
  for(const t of darkTriangles){
    a.fromBufferAttribute(position,vertexOf(t,0));b.fromBufferAttribute(position,vertexOf(t,1));c.fromBufferAttribute(position,vertexOf(t,2));
    const root=find(slot(vertexOf(t,0)));
    area.set(root,(area.get(root)??0)+b.clone().sub(a).cross(c.clone().sub(a)).length()/2);
    if(!box.has(root))box.set(root,new THREE.Box3());
    box.get(root).expandByPoint(a).expandByPoint(b).expandByPoint(c);
  }
  let panes=0;
  for(const t of darkTriangles){
    const total=area.get(find(slot(vertexOf(t,0))))??0;
    if(total<GLASS_AREA.min||total>GLASS_AREA.max)continue;
    const size=box.get(find(slot(vertexOf(t,0)))).getSize(a);
    const dims=[size.x,size.y,size.z].sort((p,q)=>p-q);
    if(dims[0]>GLASS_THICKNESS||dims[1]<GLASS_SPAN)continue;
    for(let i=0;i<3;i++)glow.setX(vertexOf(t,i),1);
    panes++;
  }
  glow.needsUpdate=true;
  return panes;
}
