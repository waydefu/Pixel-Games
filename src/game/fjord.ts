import * as THREE from "three";
import { fjordHeight } from "./terrain-profile.js";
import type { StageKit } from "./kit.js";
type Region="mainland"|"east"|"north"|"south";
type Extent={x0:number;x1:number;z0:number;z1:number;columns:number;rows:number};
const layouts:Record<Region,Extent>={
  mainland:{x0:-175,x1:-43,z0:-190,z1:190,columns:86,rows:145},
  east:{x0:72,x1:245,z0:-210,z1:210,columns:110,rows:160},
  north:{x0:-30,x1:245,z0:84,z1:204,columns:115,rows:65},
  south:{x0:-30,x1:245,z0:-204,z1:-84,columns:115,rows:65},
};
function makeMass(scope:StageKit["scope"],region:Region,e:Extent){
  const verts:number[]=[];const colors:number[]=[];const indexes:number[]=[];
  const grass=new THREE.Color("#58755e"),moss=new THREE.Color("#78916d");
  const rock=new THREE.Color("#89928a"),ridgeRock=new THREE.Color("#b5b1a0");
  const snow=new THREE.Color("#dbd4bd"),scratch=new THREE.Color();
  const dx=(e.x1-e.x0)/e.columns,dz=(e.z1-e.z0)/e.rows;
  for(let j=0;j<=e.rows;j++)for(let i=0;i<=e.columns;i++){
    const x=e.x0+dx*i,z=e.z0+dz*j;
    const y=fjordHeight(x,z,region)-.16;
    verts.push(x,y,z);
    const h=Math.max(0,y),l=(Math.sin(x*.39+z*.21)*Math.cos(z*.35-x*.12)+1)*.5;
    scratch.copy(grass).lerp(moss,.22+.31*l);
    scratch.lerp(rock,Math.min(1,Math.max(0,(h-16)/58))*.81);
    scratch.lerp(ridgeRock,Math.min(1,Math.max(0,(h-53)/50))*.41);
    scratch.lerp(snow,Math.min(.26,Math.max(0,(h-98)/48)));
    scratch.multiplyScalar(.9+l*.12);
    colors.push(scratch.r,scratch.g,scratch.b);
  }
  for(let j=0;j<e.rows;j++)for(let i=0;i<e.columns;i++){
    const a=j*(e.columns+1)+i,b=a+1,c=a+e.columns+1,d=c+1;
    indexes.push(a,c,b,b,c,d);
  }
  const g=scope.track(new THREE.BufferGeometry());
  g.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));
  g.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
  g.setIndex(indexes);g.computeVertexNormals();
  return g;
}
export function buildFjordLandscape(k:StageKit){
  const regionMaterial=k.scope.track(new THREE.MeshStandardMaterial({
    vertexColors:true,flatShading:true,roughness:1,metalness:0,side:THREE.DoubleSide,
  }));
  const peaks:THREE.Mesh[]=[];
  for(const region of ["mainland","east","north","south"] as const){
    const mesh=new THREE.Mesh(makeMass(k.scope,region,layouts[region]),regionMaterial);
    mesh.name="fjord-"+region;mesh.receiveShadow=false;mesh.castShadow=false;
    k.scene.add(mesh);peaks.push(mesh);
  }
  const sky=k.scope.track(new THREE.ShaderMaterial({
    depthWrite:false,side:THREE.BackSide,fog:false,
    vertexShader:"varying vec3 vRay;void main(){vRay=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader:"precision highp float; varying vec3 vRay; void main(){vec3 ray=normalize(vRay);float height=clamp(ray.y*.5+.5,0.0,1.0);vec3 horizon=vec3(.75,.74,.65);vec3 zenith=vec3(.19,.46,.65);vec3 sky=mix(horizon,zenith,pow(height,.85));float warm=pow(max(0.0,dot(ray,normalize(vec3(-.6,.18,-.8)))),30.0);sky+=vec3(.24,.12,.03)*warm;gl_FragColor=vec4(sky,1.0);}",
  }));
  const dome=new THREE.Mesh(k.scope.track(new THREE.SphereGeometry(790,28,16)),sky);
  dome.name="sky-atmosphere";dome.renderOrder=-1000;k.scene.add(dome);
  return {peaks,sky:dome};
}
