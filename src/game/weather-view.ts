import * as THREE from "three";

/**
 * The visible weather: rain as camera-facing streaks that wrap in a box around the viewer (one instanced draw call, all
 * motion in the vertex shader), slanted by the shared wind; and a lightning bolt, a jagged ribbon with branches that is
 * rebuilt for each strike and fades in a fraction of a second. Quality sets how many drops there are.
 */
type Scope={track:<T extends{dispose:()=>void}>(item:T)=>T};
const COUNTS={basic:1500,balanced:5000,high:14000};

export function createWeatherView(scene:THREE.Scene,scope:Scope){
  let quality:"basic"|"balanced"|"high"="balanced";
  // ---- rain ----
  const uniforms={uCam:{value:new THREE.Vector3()},uTime:{value:0},uWind:{value:new THREE.Vector2()},uRain:{value:0},uFlash:{value:0},uLight:{value:1}};
  const base=new THREE.PlaneGeometry(1,1);
  const geo=scope.track(new THREE.InstancedBufferGeometry());
  geo.index=base.index;geo.setAttribute("position",base.getAttribute("position"));
  const MAX=COUNTS.high;
  const seeds=new Float32Array(MAX*4);
  for(let i=0;i<MAX;i++){seeds[i*4]=Math.random();seeds[i*4+1]=Math.random();seeds[i*4+2]=Math.random();seeds[i*4+3]=Math.random();}
  geo.setAttribute("aSeed",new THREE.InstancedBufferAttribute(seeds,4));
  geo.instanceCount=0;
  const material=scope.track(new THREE.ShaderMaterial({
    uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:false,
    vertexShader:`
      attribute vec4 aSeed;uniform vec3 uCam;uniform float uTime;uniform vec2 uWind;uniform float uRain;
      varying float vAlpha;
      void main(){
        vec3 box=vec3(46.0,30.0,46.0);
        float speed=.55+aSeed.w*.2;
        float fy=fract(aSeed.y-uTime*speed);
        vec3 head=uCam+vec3((aSeed.x-.5)*box.x,fy*box.y-5.0,(aSeed.z-.5)*box.z);
        head.xz+=uWind*(fy-.5)*box.y*.22;                       // the wind slants the fall
        vec3 vel=normalize(vec3(uWind.x*.22,-1.0,uWind.y*.22));
        float len=.55+aSeed.w*.5;
        vec4 v0=viewMatrix*vec4(head,1.0),v1=viewMatrix*vec4(head-vel*len,1.0);
        vec2 d=v1.xy-v0.xy;d=length(d)>1e-5?normalize(d):vec2(0.0,-1.0);
        vec2 n=vec2(-d.y,d.x);
        vec4 pos=mix(v0,v1,position.y+.5);
        pos.xy+=n*position.x*.014*(1.0+length(pos.xyz)*.02);
        gl_Position=projectionMatrix*pos;
        float dist=length(head-uCam);
        vAlpha=step(aSeed.w,uRain)*smoothstep(1.2,5.0,dist)*(1.0-smoothstep(18.0,26.0,dist))*.38;
      }`,
    fragmentShader:`
      precision highp float;varying float vAlpha;uniform float uFlash;uniform float uLight;
      void main(){gl_FragColor=vec4(mix(vec3(.62,.70,.82)*uLight,vec3(.95,.97,1.0),uFlash),vAlpha);}`,
  }));
  const rain=new THREE.Mesh(geo,material);rain.frustumCulled=false;rain.renderOrder=40;rain.userData.dynamic=true;rain.visible=false;scene.add(rain);

  // ---- lightning bolt ----
  const boltMaterial=scope.track(new THREE.MeshBasicMaterial({color:"#cfd8ff",transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));
  const boltMesh=new THREE.Mesh(scope.track(new THREE.BufferGeometry()),boltMaterial);boltMesh.frustumCulled=false;boltMesh.renderOrder=-980;boltMesh.visible=false;boltMesh.userData.dynamic=true;scene.add(boltMesh);
  let boltSeed=-1;
  function buildBolt(cam:THREE.Vector3,azimuth:number,distance:number,seed:number){
    let s=seed>>>0;const rnd=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
    const reach=Math.min(distance,620);
    const dir=new THREE.Vector3(Math.cos(azimuth),0,Math.sin(azimuth)),side=new THREE.Vector3(-dir.z,0,dir.x);
    const top=new THREE.Vector3().copy(cam).addScaledVector(dir,reach);top.y=cam.y+380+rnd()*120;
    const bottom=new THREE.Vector3().copy(top);bottom.y=cam.y-2;bottom.addScaledVector(side,(rnd()-.5)*90);
    const positions:number[]=[];
    const ribbon=(a:THREE.Vector3,b:THREE.Vector3,w:number)=>{
      const view=new THREE.Vector3().subVectors(cam,a).normalize(),axis=new THREE.Vector3().subVectors(b,a),n=new THREE.Vector3().crossVectors(axis,view).normalize().multiplyScalar(w);
      const p=[a.clone().add(n),a.clone().sub(n),b.clone().add(n),b.clone().sub(n)];
      for(const i of [0,1,2,1,3,2])positions.push(p[i].x,p[i].y,p[i].z);
    };
    const trace=(from:THREE.Vector3,to:THREE.Vector3,steps:number,width:number,branchChance:number,depth:number)=>{
      let prev=from.clone();
      for(let i=1;i<=steps;i++){
        const f=i/steps,p=new THREE.Vector3().lerpVectors(from,to,f);
        const jag=(1-f*.3)*(depth?14:9);p.addScaledVector(side,(rnd()-.5)*jag*2);p.x+=(rnd()-.5)*jag;
        ribbon(prev,p,width*(1-f*.4));
        if(depth<2&&rnd()<branchChance){const end=p.clone().add(new THREE.Vector3((rnd()-.5)*120,-60-rnd()*130,(rnd()-.5)*120));trace(p,end,9,width*.55,.08,depth+1);}
        prev=p;
      }
    };
    trace(top,bottom,22,3.4,.16,0);
    const g=boltMesh.geometry;g.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));g.computeBoundingSphere();
  }
  function update(o:{dt:number;time:number;cam:THREE.Vector3;wind:{x:number;z:number};windStrength:number;rain:number;flash:number;dark:number;bolt:{active:boolean;age:number;azimuth:number;distance:number;seed:number};light:number}){
    uniforms.uCam.value.copy(o.cam);uniforms.uTime.value=o.time;
    uniforms.uWind.value.set(o.wind.x*o.windStrength*1.6,o.wind.z*o.windStrength*1.6);
    uniforms.uRain.value=o.rain;uniforms.uFlash.value=Math.min(1,o.flash);uniforms.uLight.value=.35+.65*o.light;
    const count=Math.round(COUNTS[quality]);
    geo.instanceCount=o.rain>.01?count:0;rain.visible=o.rain>.01;
    if(o.bolt.active){
      if(boltSeed!==o.bolt.seed){boltSeed=o.bolt.seed;buildBolt(o.cam,o.bolt.azimuth,o.bolt.distance,o.bolt.seed);}
      boltMesh.visible=true;boltMaterial.opacity=Math.max(0,1-o.bolt.age/.28)*(.7+.3*Math.sin(o.bolt.age*90));
    }else boltMesh.visible=false;
  }
  return {update,setQuality:(q:"basic"|"balanced"|"high")=>{quality=q;}};
}
export type WeatherView=ReturnType<typeof createWeatherView>;
