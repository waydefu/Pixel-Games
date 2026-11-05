import * as THREE from "three";
import type { StageKit } from "./kit.js";
import { BOAT_LOCATIONS } from "./placements.js";

/** Original pointed wooden boats. Hull, gunwale, mast and canvas move together. */
export function buildFishingBoats(k:StageKit){
  const boats:THREE.Group[]=[];
  const timber=k.pattern("planks",18,2,1);
  const seam=k.solid("#533e35"),rope=k.solid("#d2ba8a"),canvas=k.pattern("canvas",9),deck=k.pattern("planks",10);
  const locations=BOAT_LOCATIONS;
  for(const location of locations){
    const {x,z,scale:s,seed}=location;
    const before=new Set(k.scene.children);
    const xs=[-1.9,-1.12,-.2,.8,1.95];
    const widths=[.07,.64,.82,.61,.05];
    const vertices:number[]=[],uvs:number[]=[];
    function quad(a:number[],b:number[],c:number[],d:number[]){
      for(const [p,u,v] of [[a,0,0],[b,1,0],[c,1,1],[a,0,0],[c,1,1],[d,0,1]] as const){
        vertices.push(...p);uvs.push(u,v);
      }
    }
    // 10 longitudinal hull panels, tapering to a pointed bow and stern.
    for(let i=0;i<xs.length-1;i++){
      for(const side of [-1,1]){
        const xa=x+xs[i]*s,xb=x+xs[i+1]*s;
        const wa=widths[i]*s*side,wb=widths[i+1]*s*side;
        quad([xa,.27*s,z+wa],[xb,.27*s,z+wb],
          [xb,-.50*s,z+wb*.34],[xa,-.50*s,z+wa*.34]);
      }
    }
    const hullGeom=new THREE.BufferGeometry();
    hullGeom.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
    hullGeom.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));
    hullGeom.computeVertexNormals();
    k.put(hullGeom,timber,0,0,0);
    // Deck is inset below the rim so it reads as an actual vessel.
    const deckMesh=k.block(2.35*s,.11*s,1.0*s,deck,x,-.01*s,z);
    deckMesh.rotation.y=.04*seed;
    for(let i=0;i<xs.length-1;i++){
      for(const side of [-1,1]){
        k.segment(new THREE.Vector3(x+xs[i]*s,.30*s,z+side*widths[i]*s),
          new THREE.Vector3(x+xs[i+1]*s,.30*s,z+side*widths[i+1]*s),
          .09*s,seam,6);
      }
    }
    for(const at of [-.7,.45]){
      k.block(.18*s,.12*s,1.17*s,rope,x+at*s,.13*s,z,false);
    }
    // Traditional single mast and canvas sail.
    k.column(.078*s,3.6*s,seam,x,1.98*s,z,8);
    k.segment(new THREE.Vector3(x,3.60*s,z),new THREE.Vector3(x+1.28*s,.70*s,z),.035*s,rope,5);
    k.segment(new THREE.Vector3(x,3.60*s,z),new THREE.Vector3(x-1.70*s,.32*s,z),.025*s,rope,5);
    k.quad([
      [x+.06*s,3.45*s,z],[x+.06*s,1.0*s,z],
      [x+1.24*s,1.04*s,z],[x+.06*s,3.45*s,z],
    ],canvas,false);
    k.segment(new THREE.Vector3(x,3.64*s,z),new THREE.Vector3(x+1.18*s,3.64*s,z),.032*s,rope,5);
    k.quad([[x,3.64*s,z],[x+.95*s,3.55*s,z],
      [x,3.22*s,z],[x,3.64*s,z]],k.solid("#aa7258"),false);
    // A small stern steering oar (not a motor or contemporary fixture).
    k.segment(new THREE.Vector3(x-1.66*s,.20*s,z-.14*s),
      new THREE.Vector3(x-2.38*s,-.32*s,z-.39*s),.068*s,seam,7);
    const group=new THREE.Group();
    group.name="original-fishing-boat-"+seed;
    for(const item of [...k.scene.children])if(!before.has(item))group.add(item);
    k.scene.add(group);
    boats.push(group);
  }
  function update(time:number){
    for(let i=0;i<boats.length;i++)boats[i].position.y=.06*Math.sin(time*.9+i*1.7);
  }
  return {boats,update};
}
