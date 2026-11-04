import * as THREE from "three";
import { createResourceScope } from "../rendering/resource-scope.js";
import { configurePixelTexture } from "../rendering/pixel-texture.js";

type Collider = { x: number; z: number; halfX: number; halfZ: number };
const tone = { grass:"#728b70", stone:"#bac1ae", sand:"#d5c4a0", roof:"#785850", wall:"#d9b993", wood:"#725848" };

export function createCoastalWorld() {
  const scope = createResourceScope();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#89aeb4");
  scene.fog = new THREE.FogExp2("#88aeb7",0.011);
  const colliders: Collider[]=[];
  const mats = new Map<string,THREE.MeshStandardMaterial>();

  function mat(color:string,roughness=0.96) {
    const key=color+":"+roughness;
    let found=mats.get(key);
    if(!found){const created=new THREE.MeshStandardMaterial({color,roughness});scope.track(created);mats.set(key,created);found=created;}
    return found;
  }
  function mesh(geometry:THREE.BufferGeometry,color:string,x:number,y:number,z:number, opts:{shadow?:boolean,receive?:boolean}={}) {
    const o=new THREE.Mesh(scope.track(geometry),mat(color));
    o.position.set(x,y,z);
    o.castShadow=opts.shadow??false;
    o.receiveShadow=opts.receive??true;
    scene.add(o);
    return o;
  }
  function cube(w:number,h:number,d:number,color:string,x:number,y:number,z:number,shadow=true) {
    return mesh(new THREE.BoxGeometry(w,h,d),color,x,y,z,{shadow});
  }
  const ground=mesh(new THREE.PlaneGeometry(90,74),tone.grass,-30,-0.16,0);
  ground.rotation.x=-Math.PI/2;
  const beach=mesh(new THREE.PlaneGeometry(5.5,74),tone.sand,10.7,-0.12,0);
  beach.rotation.x=-Math.PI/2;
  const nearShore=mesh(new THREE.PlaneGeometry(1.8,74),"#bdc7ae",13.1,-0.115,0);
  nearShore.rotation.x=-Math.PI/2;

  const waterUniforms={uTime:{value:0}};
  const waterMaterial=scope.track(new THREE.ShaderMaterial({
    uniforms:waterUniforms,depthWrite:true,
    vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`precision mediump float;varying vec2 vUv;uniform float uTime;
      void main(){
        float a=sin(vUv.x*41.0+vUv.y*12.0+uTime*.58);
        float b=sin(vUv.y*73.0-vUv.x*8.0-uTime*.39);
        float c=sin(vUv.x*19.0-vUv.y*28.0+uTime*.23);
        float spark=smoothstep(.85,.98,a*.5+b*.35+c*.15);
        vec3 deep=vec3(.105,.38,.46), shallow=vec3(.18,.53,.57);
        vec3 water=mix(deep,shallow,clamp(vUv.x*.45+.36,0.0,1.0));
        water+=spark*vec3(.21,.23,.17);
        gl_FragColor=vec4(water,1.0);
      }`
  }));
  const water=new THREE.Mesh(scope.track(new THREE.PlaneGeometry(95,84)),waterMaterial);
  water.rotation.x=-Math.PI/2;water.position.set(61,-0.13,0);scene.add(water);

  // Worn stone road made in a single instanced draw call.
  const stoneGeometry=scope.track(new THREE.BoxGeometry(1,0.045,1));
  const stoneMat=mat("#a6a99d");
  const stones=scope.track(new THREE.InstancedMesh(stoneGeometry,stoneMat,700));
  const dummy=new THREE.Object3D();
  let si=0;
  for(let xi=-22;xi<=11.7 && si<700;xi+=0.92){
    for(let zi=-2.7;zi<=2.9 && si<700;zi+=0.88){
      const hash=Math.sin(xi*13.16+zi*38.21)*43758.5453;
      const h=hash-Math.floor(hash);
      dummy.position.set(xi+(h-.5)*.09,0.003,zi+(h-.5)*.07);
      dummy.rotation.y=(h-.5)*.085;dummy.scale.set(.78+h*.17,1,.74+h*.2);
      dummy.updateMatrix();stones.setMatrixAt(si++,dummy.matrix);
    }
  }
  stones.count=si;stones.instanceMatrix.needsUpdate=true;stones.receiveShadow=true;
  scene.add(stones);

  // Pier: open sea reached along the broad main road on the right of the village.
  const pier=cube(17,.4,4.5,"#88684e",20.25,.08,8,false);
  for(let i=0;i<23;i++){
    const x=12.6+i*.71;
    cube(.08,.08,4.45,i%2===0?"#bc9773":"#a88468",x,.33,8,false);
  }
  for(const x of [13.4,18.5,24.7,28]){
    for(const z of [5.65,10.35]){
      cube(.34,2.1,.34,"#705646",x,-.6,z,false);
    }
  }

  function house(x:number,z:number,w:number,d:number,height:number,roof:string){
    cube(w,height,d,tone.wall,x,height/2,z);
    cube(w+.2,.18,d+.2,"#a68e73",x,.19,z);
    const slope=.48;
    const left=cube(w*.59,.18,d+.75,roof,x-w*.235,height+.55,z);
    left.rotation.z=slope;
    const right=cube(w*.59,.18,d+.75,roof,x+w*.235,height+.55,z);
    right.rotation.z=-slope;
    const front=z+d/2+.075;
    cube(.92,1.95,.14,"#5f534a",x,height*.5-0.48,front);
    cube(.68,.76,.15,"#4c7276",x-w*.29,height*.65,front);
    cube(.68,.76,.15,"#4c7276",x+w*.29,height*.65,front);
    cube(.84,.11,.22,"#71594a",x-w*.29,height*.27+1.6,front+.08);
    cube(.84,.11,.22,"#71594a",x+w*.29,height*.27+1.6,front+.08);
    const chimney=cube(.7,1.4,.68,"#8e7c70",x+w*.29,height+1.15,z-d*.24);
    chimney.castShadow=true;
    colliders.push({x,z,halfX:w/2+.35,halfZ:d/2+.45});
  }
  house(-11,-9.6,6.4,5.5,3.7,"#8e6258");
  house(-16,10.3,5.4,5.1,3.4,"#82685a");
  house(1,-12.3,6.4,6,4.3,"#8c6250");
  house(2,13.1,5.8,6.2,3.6,"#665c59");
  house(-21,-12.5,4.8,4.4,3.5,"#94704e");

  function tree(x:number,z:number,scale=1){
    const trunk=mesh(new THREE.CylinderGeometry(.18*scale,.27*scale,2.5*scale,7),"#6a5144",x,1.25*scale,z,{shadow:true});
    for(let i=0;i<3;i++){
      const crown=mesh(new THREE.ConeGeometry((1.55-i*.32)*scale,2.1*scale,7),i%2?"#416d5e":"#527a5e",x,(2.6+i*.82)*scale,z,{shadow:true});
      crown.rotation.y=.2+i*.38;
    }
    colliders.push({x,z,halfX:.4*scale,halfZ:.4*scale});
  }
  [[-5,-8],[8,-8],[-7,10],[-21,4],[-21,18],[7,18],[-4,19],[-23,-4],[-14,-19]].forEach(([x,z],i)=>tree(x,z,.9+(i%3)*.13));

  function lantern(x:number,z:number) {
    cube(.16,3.2,.16,"#3b5251",x,1.6,z);
    const bulb=mesh(new THREE.SphereGeometry(.27,8,6),"#f4dd9f",x,3.26,z,{shadow:false});
    bulb.material=scope.track(new THREE.MeshStandardMaterial({color:"#fff0c4",emissive:"#d79b5c",emissiveIntensity:.9}));
    const light=new THREE.PointLight("#f4b66a",8,9,2);
    light.position.set(x,3.25,z);scene.add(light);
    cube(.65,.10,.65,"#38484c",x,3.56,z,false);
  }
  for(const [x,z] of [[-18,-3.8],[-7,4.3],[5,-3.9],[8,6.3]])lantern(x,z);

  // Low, detailed decorative vegetation, one draw call per material.
  const grassGeometry=scope.track(new THREE.ConeGeometry(.13,.45,3));
  const grassMaterial=mat("#91a47a");
  const grassInst=scope.track(new THREE.InstancedMesh(grassGeometry,grassMaterial,350));
  let gi=0;
  for(let i=0;i<700 && gi<350;i++){
    const x=-23+(i*17.11%33),z=-23+(i*7.91%46);
    if(Math.abs(z)<4.3 || (x>9) || colliders.some(c=>Math.abs(x-c.x)<c.halfX+1&&Math.abs(z-c.z)<c.halfZ+1))continue;
    dummy.position.set(x,.10,z);dummy.rotation.y=i*.52;const s=.5+(Math.sin(i*72.9)+1)*.28;dummy.scale.set(s,s,s);
    dummy.updateMatrix();grassInst.setMatrixAt(gi++,dummy.matrix);
  }
  grassInst.count=gi;grassInst.instanceMatrix.needsUpdate=true;scene.add(grassInst);

  const skyLight=new THREE.HemisphereLight("#c2e1de","#79634c",2.15);scene.add(skyLight);
  const sun=new THREE.DirectionalLight("#ffcf9a",3.05);sun.position.set(-18,26,12);
  sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
  sun.shadow.camera.left=-28;sun.shadow.camera.right=28;
  sun.shadow.camera.top=30;sun.shadow.camera.bottom=-30;
  sun.shadow.normalBias=.025;
  scene.add(sun);
  const sunTarget=new THREE.Object3D();scene.add(sunTarget);sun.target=sunTarget;

  // Original 24x36 pixel character, modeled as a camera-facing vertical plane.
  const characterCanvas=document.createElement("canvas");
  characterCanvas.width=24;characterCanvas.height=36;
  const ctx=characterCanvas.getContext("2d");
  if(!ctx) throw new Error("2D canvas unavailable");
  ctx.clearRect(0,0,24,36);
  const draw=(color:string,x:number,y:number,w:number,h:number)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
  draw("#402b2b",8,2,8,3);draw("#63453b",7,4,10,7);
  draw("#f0ccaa",8,8,8,8);draw("#432f30",7,7,2,6);draw("#432f30",15,7,2,6);
  draw("#2e3946",9,12,2,2);draw("#2e3946",14,12,2,2);
  draw("#e7d8c0",10,17,4,3);draw("#486e76",7,19,10,10);
  draw("#d0a86d",7,21,10,2);draw("#e8c69f",4,20,3,7);draw("#e8c69f",17,20,3,7);
  draw("#263d49",8,28,4,6);draw("#263d49",13,28,4,6);
  draw("#4a403e",8,33,4,2);draw("#4a403e",13,33,4,2);
  const texture=scope.track(new THREE.CanvasTexture(characterCanvas));
  configurePixelTexture(THREE,texture);
  const avatarMaterial=scope.track(new THREE.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.42,side:THREE.DoubleSide,roughness:1}));
  const avatar=new THREE.Mesh(scope.track(new THREE.PlaneGeometry(1.45,2.2)),avatarMaterial);
  avatar.position.set(2,1.18,1);avatar.castShadow=true;
  scene.add(avatar);
  const shadow=new THREE.Mesh(scope.track(new THREE.CircleGeometry(.52,20)),scope.track(new THREE.MeshBasicMaterial({color:"#21352d",transparent:true,opacity:.38,depthWrite:false})));
  shadow.rotation.x=-Math.PI/2;shadow.position.set(2,.016,1);scene.add(shadow);
  const player={x:2,z:1};
  function movePlayer(x:number,z:number,elapsed:number){
    player.x=x;player.z=z;
    avatar.position.set(x,1.18+Math.sin(elapsed*9)*.035,z);
    shadow.position.set(x,.014,z);
  }
  function faceCamera(cam:THREE.Camera){
    const pos=new THREE.Vector3();
    cam.getWorldPosition(pos);
    avatar.rotation.y=Math.atan2(pos.x-player.x,pos.z-player.z);
  }
  function update(seconds:number){waterUniforms.uTime.value=seconds;}
  function setShadows(enabled:boolean) {sun.castShadow=enabled;}
  function dispose(){scope.dispose();}
  return {scene,colliders,player,avatar,shadow,movePlayer,faceCamera,update,setShadows,dispose};
}
