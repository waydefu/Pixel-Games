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
  const grass=new THREE.Color("#526e51"),moss=new THREE.Color("#708666");
  const rock=new THREE.Color("#69766d"),ridgeRock=new THREE.Color("#9a9c8e");
  const snow=new THREE.Color("#bac0b5"),scratch=new THREE.Color();
  const dx=(e.x1-e.x0)/e.columns,dz=(e.z1-e.z0)/e.rows;
  for(let j=0;j<=e.rows;j++)for(let i=0;i<=e.columns;i++){
    const x=e.x0+dx*i,z=e.z0+dz*j;
    const y=fjordHeight(x,z,region)-.16;
    verts.push(x,y,z);
    const h=Math.max(0,y),l=(Math.sin(x*.21+z*.13)*Math.cos(z*.19-x*.14)+1)*.5;
    const slope=Math.hypot(
      fjordHeight(x+1.5,z,region)-fjordHeight(x-1.5,z,region),
      fjordHeight(x,z+1.5,region)-fjordHeight(x,z-1.5,region))/3.0;
    scratch.copy(grass).lerp(moss,.19+.36*l);
    const stoneFraction=Math.min(.83,Math.max(0,(h-37)/80+slope*.055));
    scratch.lerp(rock,stoneFraction);
    scratch.lerp(ridgeRock,Math.min(.4,Math.max(0,(h-77)/90)));
    scratch.lerp(snow,Math.min(.2,Math.max(0,(h-126)/100)));
    const strata=Math.sin(h*.46+x*.09+z*.06)*.028;
    scratch.multiplyScalar(.92+l*.11+strata);
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
    vertexColors:true,flatShading:false,roughness:1,metalness:0,side:THREE.DoubleSide,
  }));
  const peaks:THREE.Mesh[]=[];
  for(const region of ["mainland","east","north","south"] as const){
    const mesh=new THREE.Mesh(makeMass(k.scope,region,layouts[region]),regionMaterial);
    mesh.name="fjord-"+region;mesh.receiveShadow=false;mesh.castShadow=false;
    k.scene.add(mesh);peaks.push(mesh);
  }
  // A layered moving skydome uses a small procedural cloud shader, not hundreds
  // of translucent planes or an expensive volumetric march on mobile.
  const skyUniforms={uTime:{value:0},uCloudAmount:{value:.82}};
  const sky=k.scope.track(new THREE.ShaderMaterial({
    uniforms:skyUniforms,depthWrite:false,depthTest:false,side:THREE.BackSide,fog:false,
    vertexShader:String.raw`varying vec3 vRay;
      void main(){
        vRay=position;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }`,
    fragmentShader:String.raw`precision highp float;
      varying vec3 vRay;
      uniform float uTime;
      uniform float uCloudAmount;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noiz(vec2 p){
        vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),
                   mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);
      }
      float fbm(vec2 p){
        float a=.5,v=0.0;
        for(int j=0;j<4;j++){v+=a*noiz(p);p=p*2.03+vec2(7.1,3.5);a*=.5;}
        return v;
      }
      void main(){
        vec3 ray=normalize(vRay);
        float h=clamp(ray.y*.5+.5,0.0,1.0);
        vec3 horizon=vec3(.54,.65,.70),zenith=vec3(.13,.39,.63);
        vec3 sky=mix(horizon,zenith,pow(h,1.16));
        vec3 sunDir=normalize(vec3(-.60,.30,-.74));
        float sun=max(0.0,dot(ray,sunDir));
        sky+=vec3(.32,.18,.075)*pow(sun,24.0);
        sky+=vec3(.30,.23,.14)*pow(sun,320.0);
        // Two atmospheric cloud levels with different wind velocity and edge scale.
        // Moving these fields is independent of landscape geometry.
        vec2 uv=ray.xz/max(.20,ray.y+.24);
        vec2 wind=vec2(uTime*.0026,uTime*.0011);
        float low=fbm(uv*2.05+wind);
        low=.70*low+.30*fbm(uv*4.12-wind*.42);
        float cumulus=smoothstep(.38,.59,low);
        float wisps=fbm(uv*5.0+vec2(-uTime*.0018,uTime*.0007));
        float cirrus=smoothstep(.59,.78,wisps)*.28;
        float mask=smoothstep(-.025,.12,ray.y)*(1.0-smoothstep(.83,.96,ray.y));
        float amount=clamp((cumulus+cirrus)*mask*uCloudAmount,0.0,.88);
        vec3 underside=vec3(.60,.64,.65),lit=vec3(.96,.89,.74);
        vec3 cloud=mix(underside,lit,.42+.34*sun);
        sky=mix(sky,cloud,amount);
        gl_FragColor=vec4(sky,1.0);
      }`,
  }));
  const dome=new THREE.Mesh(k.scope.track(new THREE.SphereGeometry(790,28,16)),sky);
  dome.name="sky-atmosphere";dome.renderOrder=-1000;k.scene.add(dome);
  function update(time:number){skyUniforms.uTime.value=time;}
  return {peaks,sky:dome,update};
}
