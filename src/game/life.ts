import * as THREE from "three";
import type { StageKit } from "./kit.js";
import { liveSky } from "./sky-live.js";
import { groundHeight } from "./navigation.js";
import { createWanderer, facingRow, mulberry32 } from "./wander.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { paintVillagerSheet, paintAnimalSheet, VILLAGERS, NPC_FRAME } from "./pixel/npc.js";

/**
 * A living harbour: villagers strolling the promenade, a dog, chickens and a cat, seagulls riding the sea breeze and
 * chimney smoke. Everything is cheap: sprites are billboards on the shared pixel sheets, the gulls are two
 * instanced draw calls, the smoke is one instanced draw call whose motion lives in the vertex shader.
 */
type Actor={
  mesh:THREE.Mesh;material:THREE.MeshStandardMaterial;texture:THREE.CanvasTexture;
  wanderer:ReturnType<typeof createWanderer>;row:number;frame:number;half:number;
};

function sheetTexture(scope:StageKit["scope"],sheet:{width:number;height:number;data:Uint8ClampedArray}){
  const canvas=document.createElement("canvas");
  canvas.width=sheet.width;canvas.height=sheet.height;
  const ctx=canvas.getContext("2d");
  if(!ctx)throw new Error("Cannot paint sprite sheet");
  ctx.putImageData(new ImageData(new Uint8ClampedArray(sheet.data),sheet.width,sheet.height),0,0);
  const texture=scope.track(new THREE.CanvasTexture(canvas));
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;
  texture.repeat.set(.25,.25);
  return texture;
}

// Waypoints along the promenade (|z| < 3) and the plaza, clear of the lamp posts and the pier.
const STREET:[number,number][]=[[-24,-1.3],[-17,1.4],[-10,-1.2],[-4,1.6],[2,-1.4],[7,1.2],[-14,2.2],[-1,-2.2]];

export function createLife(k:StageKit,chimneys:readonly (readonly [number,number,number])[]){
  const scope=k.scope;
  const actors:Actor[]=[];
  const screenRight=new THREE.Vector3(1,0,0),screenUp=new THREE.Vector3(0,0,-1),viewDir=new THREE.Vector3(),camPos=new THREE.Vector3();

  function addActor(sheet:{width:number;height:number;data:Uint8ClampedArray},size:number,wanderer:ReturnType<typeof createWanderer>){
    const texture=sheetTexture(scope,sheet);
    const material=scope.track(new THREE.MeshStandardMaterial({
      map:texture,transparent:true,alphaTest:.4,side:THREE.DoubleSide,roughness:1,
      emissive:"#ffffff",emissiveMap:texture,emissiveIntensity:.55,
    }));
    const mesh=new THREE.Mesh(scope.track(new THREE.PlaneGeometry(size,size)),material);
    mesh.userData.dynamic=true;mesh.castShadow=false;mesh.receiveShadow=false;
    k.scene.add(mesh);
    actors.push({mesh,material,texture,wanderer,row:0,frame:0,half:size/2});
  }

  // Five villagers on the promenade, at different paces and starting points.
  VILLAGERS.forEach((_,i)=>{
    const start=STREET[(i*2+1)%STREET.length];
    addActor(paintVillagerSheet(i),2.3,createWanderer({x:start[0],z:start[1],waypoints:STREET,speed:.62+i*.09,pause:[2.5,7],seed:100+i*17}));
  });
  // A dog that trots about the town square, chickens in the grass by the well, a cat on the street edge.
  addActor(paintAnimalSheet("dog"),1.5,createWanderer({x:-6,z:3,home:{x:-6,z:3},radius:5,speed:1.15,pause:[1,4],seed:7}));
  for(let i=0;i<3;i++)
    addActor(paintAnimalSheet("chicken"),1.0,createWanderer({x:-9+i*1.5,z:5.5,home:{x:-9,z:6},radius:2.6,speed:.5,pause:[.5,2.5],seed:31+i}));
  addActor(paintAnimalSheet("cat"),1.2,createWanderer({x:-15,z:-4.4,home:{x:-16,z:-4.2},radius:2.2,speed:.7,pause:[3,9],seed:5}));

  // ---- seagulls: a white body with head, orange beak and tail, and grey two-segment wings with black tips ----
  // (no free, correctly licensed gull model could be downloaded; this one is authored here). Three instanced draw
  // calls: bodies, inner wings, outer wings. The wing's hand segment lags the arm, which gives the gull its "M".
  const GULLS=11;
  const gullAudit=Math.max(1,Math.min(8,Number.parseFloat(new URLSearchParams(window.location.search).get("gullScale")??"1")||1)); // audit only
  const paint=(g:THREE.BufferGeometry,color:(x:number,y:number,z:number)=>THREE.Color)=>{
    const out=g.index?g.toNonIndexed():g;
    const pos=out.getAttribute("position"),col=new Float32Array(pos.count*3);
    for(let i=0;i<pos.count;i++){const c=color(pos.getX(i),pos.getY(i),pos.getZ(i));col.set([c.r,c.g,c.b],i*3);}
    out.setAttribute("color",new THREE.BufferAttribute(col,3));out.deleteAttribute("uv");return out;
  };
  const white=new THREE.Color("#f4f4f2"),belly=new THREE.Color("#dfe2e4"),beak=new THREE.Color("#e8a21c");
  const bodyParts:THREE.BufferGeometry[]=[];
  const torso=new THREE.SphereGeometry(1,8,6);torso.scale(.11,.10,.31);
  bodyParts.push(paint(torso,(_x,y)=>y<0?belly:white));
  const head=new THREE.SphereGeometry(.07,8,6);head.translate(0,.07,.32);bodyParts.push(paint(head,()=>white));
  const bill=new THREE.ConeGeometry(.022,.12,5);bill.rotateX(Math.PI/2);bill.translate(0,.055,.45);bodyParts.push(paint(bill,()=>beak));
  const tail=new THREE.BufferGeometry();
  tail.setAttribute("position",new THREE.Float32BufferAttribute([-.07,0,-.26, .07,0,-.26, 0,0,-.52],3));
  tail.computeVertexNormals();
  bodyParts.push(paint(tail,()=>white));
  const bodyGeometry=mergeGeometries(bodyParts,false) as THREE.BufferGeometry;
  const wingTri=(verts:number[],color:(x:number,y:number,z:number)=>THREE.Color)=>{
    const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));g.computeVertexNormals();return paint(g,color);
  };
  const mantle=new THREE.Color("#aeb7bf"),pale=new THREE.Color("#e9ecee"),tip=new THREE.Color("#1f2226");
  const innerGeometry=wingTri([0,0,.14, 0,0,-.14, .40,0,-.10,  0,0,.14, .40,0,-.10, .40,0,.08],(x)=>pale.clone().lerp(mantle,x/.4));
  const outerGeometry=wingTri([0,0,.08, 0,0,-.10, .30,.03,-.04,  0,0,-.10, .36,.04,-.24, .30,.03,-.04],(x)=>mantle.clone().lerp(tip,Math.min(1,Math.max(0,(x-.12)/.22))));
  const gullMaterial=scope.track(new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1,emissive:"#ffffff",emissiveIntensity:.16}));
  const bodies=new THREE.InstancedMesh(scope.track(bodyGeometry),gullMaterial,GULLS);
  const inner=new THREE.InstancedMesh(scope.track(innerGeometry),gullMaterial,GULLS*2);
  const outer=new THREE.InstancedMesh(scope.track(outerGeometry),gullMaterial,GULLS*2);
  for(const m of [bodies,inner,outer]){m.frustumCulled=false;m.castShadow=false;m.receiveShadow=false;m.userData.dynamic=true;k.scene.add(m);}
  const rng=mulberry32(77);
  const gulls=Array.from({length:GULLS},()=>({
    cx:12+rng()*26,cz:-24+rng()*54,radius:5+rng()*11,height:9+rng()*8,speed:(.16+rng()*.16)*(rng()<.5?-1:1),
    phase:rng()*Math.PI*2,flap:5+rng()*2.5,scale:.9+rng()*.45,bob:rng()*6.28,
  }));
  // The sea breeze lifts them: they circle the bay (never inland over the mountains).
  const dummy=new THREE.Object3D(),gullMatrix=new THREE.Matrix4(),base=new THREE.Matrix4(),armMatrix=new THREE.Matrix4(),handMatrix=new THREE.Matrix4(),
    spin=new THREE.Matrix4(),side=new THREE.Matrix4(),elbow=new THREE.Matrix4().makeTranslation(.40,0,0);

  // ---- chimney smoke: one instanced draw call, billboards, drift/fade computed in the vertex shader ----
  const PUFFS=18;
  const smokeUniforms={uTime:{value:0},uLight:liveSky.dayLight,uWindDir:liveSky.windDir,uWindStrength:liveSky.windStrength};
  const smokeMaterial=scope.track(new THREE.ShaderMaterial({
    uniforms:smokeUniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:`
      attribute vec3 aBase;
      attribute float aSeed;
      uniform float uTime;
      uniform vec2 uWindDir;
      uniform float uWindStrength;
      varying float vAlpha;
      varying float vSeed;
      varying vec2 vUv;
      void main(){
        float t=fract(uTime*.13+aSeed);
        vSeed=aSeed;vUv=uv;
        vec3 drift=vec3(uWindDir.x*(1.6+aSeed*.8)*uWindStrength,2.6,uWindDir.y*(1.6+aSeed*.8)*uWindStrength)*t*2.8+vec3(sin(aSeed*40.0+t*5.0)*.35*t,0.0,cos(aSeed*30.0+t*4.0)*.3*t);
        vec4 view=viewMatrix*vec4(aBase+drift,1.0);
        float size=mix(.35,1.5,t);
        view.xy+=position.xy*size;
        gl_Position=projectionMatrix*view;
        vAlpha=(1.0-t)*smoothstep(.0,.12,t)*.62;
      }`,
    fragmentShader:`
      precision highp float;
      uniform float uLight;
      varying float vAlpha;
      varying float vSeed;
      varying vec2 vUv;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        vec2 cell=floor(vUv*5.0);
        vec2 d=(cell+.5)/5.0-.5;
        if(length(d)>.52||h(cell+vSeed*31.0)>.82)discard;   // a chunky, ragged pixel puff
        vec3 color=mix(vec3(.12,.13,.19),vec3(.86,.85,.84),uLight);
        gl_FragColor=vec4(color,vAlpha);
      }`,
  }));
  const smokeGeometry=new THREE.PlaneGeometry(1,1);
  const smokeBase=new Float32Array(Math.max(1,chimneys.length*PUFFS)*3),smokeSeed=new Float32Array(Math.max(1,chimneys.length*PUFFS));
  chimneys.forEach(([x,y,z],c)=>{
    for(let i=0;i<PUFFS;i++){
      const n=c*PUFFS+i;
      smokeBase.set([x,y,z],n*3);smokeSeed[n]=i/PUFFS;
    }
  });
  const smokeInstanced=new THREE.InstancedBufferGeometry();
  smokeInstanced.index=smokeGeometry.index;
  smokeInstanced.setAttribute("position",smokeGeometry.getAttribute("position"));
  smokeInstanced.setAttribute("uv",smokeGeometry.getAttribute("uv"));
  smokeInstanced.setAttribute("aBase",new THREE.InstancedBufferAttribute(smokeBase,3));
  smokeInstanced.setAttribute("aSeed",new THREE.InstancedBufferAttribute(smokeSeed,1));
  smokeInstanced.instanceCount=chimneys.length*PUFFS;
  const smoke=new THREE.Mesh(scope.track(smokeInstanced),smokeMaterial);
  smoke.frustumCulled=false;smoke.renderOrder=3;smoke.userData.dynamic=true;
  if(chimneys.length)k.scene.add(smoke);

  /** Call every frame before update(): villagers choose their facing from the camera's screen axes. */
  function face(camera:THREE.Camera){
    camera.getWorldPosition(camPos);camera.getWorldDirection(viewDir);
    screenUp.set(viewDir.x,0,viewDir.z);
    if(screenUp.lengthSq()>1e-6){screenUp.normalize();screenRight.set(-screenUp.z,0,screenUp.x);}
  }

  let previous=0;
  function update(time:number){
    const dt=Math.min(.25,Math.max(0,time-previous));previous=time;
    const day=liveSky.dayLight.value as number;
    for(const a of actors){
      const s=a.wanderer.update(dt);
      a.row=facingRow(s.vx,s.vz,screenRight,screenUp,a.row);
      a.frame=s.walking?Math.floor(time*(a.half>1?6:8))%4:0;
      a.texture.offset.set(a.frame*.25,(3-a.row)*.25);
      a.mesh.position.set(s.x,groundHeight(s.x,s.z)+a.half-(a.half>1?0:.02),s.z);
      a.mesh.rotation.y=Math.atan2(camPos.x-s.x,camPos.z-s.z);
      a.material.emissiveIntensity=.22+.38*day;
    }
    // Gulls fly by day and roost by night.
    const flying=Math.min(1,Math.max(0,(day-.25)*3));
    gulls.forEach((g,i)=>{
      const theta=g.phase+time*g.speed;
      const sign=Math.sign(g.speed);
      const x=g.cx+Math.cos(theta)*g.radius,z=g.cz+Math.sin(theta)*g.radius;
      const y=g.height+Math.sin(time*.5+g.bob)*1.1;
      const yaw=Math.atan2(-Math.sin(theta)*sign,Math.cos(theta)*sign);
      const bank=-.32*sign;
      dummy.position.set(x,y,z);dummy.rotation.set(0,yaw,bank,"YXZ");
      // Gulls near the camera would be huge blurry smears (the quarter view floats above the harbour): fade them out.
      const near=Math.hypot(x-camPos.x,y-camPos.y,z-camPos.z);
      const s=g.scale*flying*Math.min(1,Math.max(0,(near-9)/9))*gullAudit;dummy.scale.set(s,s,s);dummy.updateMatrix();gullMatrix.copy(dummy.matrix);
      bodies.setMatrixAt(i,gullMatrix);
      // flap in bursts with glides in between; the hand follows the arm with a lag
      const burst=Math.sin(time*.7+g.bob*2)>-.25?1:.12;
      const arm=Math.sin(time*g.flap+g.phase)*.55*burst+.10;
      const hand=Math.sin(time*g.flap+g.phase-.9)*.42*burst+.14;
      for(const sign of [1,-1] as const){
        side.makeScale(sign,1,1);base.multiplyMatrices(gullMatrix,side);
        spin.makeRotationZ(arm);armMatrix.multiplyMatrices(base,spin);inner.setMatrixAt(i*2+(sign>0?0:1),armMatrix);
        spin.makeRotationZ(hand);handMatrix.multiplyMatrices(armMatrix,elbow).multiply(spin);outer.setMatrixAt(i*2+(sign>0?0:1),handMatrix);
      }
    });
    inner.instanceMatrix.needsUpdate=true;outer.instanceMatrix.needsUpdate=true;bodies.instanceMatrix.needsUpdate=true;
    smokeUniforms.uTime.value=time;
  }
  return {face,update,actors:actors.length,gulls:GULLS,puffs:chimneys.length*PUFFS};
}
export type Life=ReturnType<typeof createLife>;
