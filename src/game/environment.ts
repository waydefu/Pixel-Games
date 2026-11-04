import * as THREE from "three";
import type { StageKit } from "./kit.js";

function noise(seed:number){const value=Math.sin(seed*182.739+22.13)*43758.5453;return value-Math.floor(value);}
export function buildEnvironment(k:StageKit){
  const ground=k.pattern("grass",1,14,13),sand=k.pattern("sand",5,2,13),stone=k.pattern("cobble",2,17,6);
  const dirt=k.solid("#957b5b"),oak=k.pattern("planks",9),posts=k.solid("#715742");
  const dark=k.solid("#434944"),foam=k.solid("#dae3c6",.8);
  const cliff=k.pattern("cliff",9),leaves=[k.pattern("foliage",1,2,2),k.pattern("foliage",3,2,2),k.pattern("foliage",5,2,2),k.pattern("foliage",7,2,2)];
  // Wide lawn with a considered waterfront. Ground is behind the buildings.
  k.flat(65,75,ground,-19,-.19,0);
  k.flat(6.1,75,sand,11.1,-.12,0);
  k.flat(2.2,75,k.pattern("sand",7,1,10),13,-.10,0);
  // Cobblestone promenade & irregular town square, not a grid of raised box tiles.
  k.flat(42,6.3,stone,-8.0,-.062,0);
  k.flat(3.2,13,k.pattern("cobble",4,3,9),9,-.059,5.2);
  k.ellipse(6.0,5.0,k.pattern("cobble",6,4,4),-5.0,-.057,6.1);
  for(let i=0;i<40;i++){
    const x=-26+i*.98;
    for(const s of [-1,1]){
      const zz=s*(3.25+noise(i*.78)*.36);
      k.block(.26,.035,.30,i%3?dirt:k.pattern("stone",3),x,-.040,zz,false);
    }
  }
  // The waterfront is shallow turquoise at the surf line and darker further out.
  const waveUniforms={uTime:{value:0}};
  const seaMaterial=k.scope.track(new THREE.ShaderMaterial({
    uniforms:waveUniforms,depthWrite:true,side:THREE.DoubleSide,
    vertexShader:String.raw`varying vec2 vUv; varying vec3 vPos;
      uniform float uTime;
      void main(){
        vUv=uv; vec3 transformed=position;
        transformed.z+=.12*sin(position.x*.37+uTime*.65)+.075*cos(position.y*.29-uTime*.5);
        vPos=transformed;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(transformed,1.0);
      }`,
    fragmentShader:"precision highp float;\nvarying vec2 vUv;\nvarying vec3 vPos;\nuniform float uTime;\nvoid main(){\n  // Interleaved wind-driven ripples instead of flat tinted geometry.\n  float r1=sin(vUv.y*548.0+vUv.x*157.0+\n    sin(vUv.y*67.0-uTime*.34)*3.8+uTime*1.08);\n  float r2=sin(vUv.y*283.0-vUv.x*218.0-uTime*.64);\n  float r3=cos(vUv.y*108.0+vUv.x*88.0+uTime*.32);\n  float shimmer=pow(max(0.0,r1*.64+r2*.27+r3*.09),7.0);\n  float shallow=1.0-smoothstep(.022,.29,vUv.x);\n  vec3 water=mix(vec3(.021,.16,.23),vec3(.12,.38,.41),shallow);\n  water+=r1*.019+r2*.013;\n  water+=shimmer*vec3(.29,.34,.28);\n  // Breakers wrap softly along the irregular stone coast.\n  float foamEdge=1.0-smoothstep(.009,.065,vUv.x);\n  float breaker=sin(vUv.y*174.0+uTime*.9+sin(vUv.y*31.0)*3.0);\n  float foam=pow(max(0.0,breaker*.72+r2*.28),5.0)*foamEdge;\n  water=mix(water,vec3(.75,.83,.73),foam*.82);\n  gl_FragColor=vec4(clamp(water,0.0,1.0),1.0);\n}",
  }));
  k.flat(100,80,seaMaterial,63,-.20,0);
  // Curved surf edge: tiny sunlit stones and tidal foam ribbons.
  for(let i=0;i<85;i++){
    const z=-33+i*.79;
    const x=13.42+Math.sin(z*.21)*.43+Math.sin(z*.77)*.11;
    const r=.08+noise(i)*.16;
    k.ellipse(r*2,r*.45,foam,x,-.082,z);
    if(i%3===0)k.put(new THREE.IcosahedronGeometry(.13+noise(i*2)*.18,0),
      k.pattern("cliff",2),11.2+noise(i)*1.5,.06,z,false);
  }
  // Water-facing low masonry seawall, interrupted naturally for the fishing pier.
  const seawall=k.pattern("stone",13,2,1);
  for(let z=-29;z<30;z+=3.3){
    if(z>5.3&&z<11.2)continue;
    k.block(.55,.44,3.0,seawall,12.4,.13,z,false);
    k.block(.83,.14,3.06,k.solid("#c7b99a"),12.4,.40,z,false);
  }

  // Functional, approachable wood wharf with piers, decks, mooring ropes.
  const pierX=20,pierZ=8.0;
  k.block(18.5,.48,4.75,oak,pierX,-.003,pierZ);
  const plankMaterial=k.pattern("planks",17);
  const plankGeometry=k.scope.track(new THREE.BoxGeometry(.10,.035,4.73));
  const planks=k.scope.track(new THREE.InstancedMesh(plankGeometry,plankMaterial,98));
  const dummy=new THREE.Object3D();
  for(let i=0;i<98;i++){
    dummy.position.set(11+i*.187,.275,pierZ);
    dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);
    dummy.updateMatrix();planks.setMatrixAt(i,dummy.matrix);
  }
  planks.instanceMatrix.needsUpdate=true;planks.castShadow=false;planks.receiveShadow=true;k.scene.add(planks);
  for(let x=12.1;x<29.2;x+=4.0){
    for(const z of [5.65,10.35]){
      k.column(.29,2.2,posts,x,-.86,z,9);
      k.column(.36,.17,k.solid("#af9774"),x,.35,z,9);
    }
  }
  for(let i=0;i<3;i++){
    const x=13+i*6.1;
    for(const z of [5.6,10.4]){
      k.column(.17,.78,posts,x,.62,z,7);
      // Coiled rope from three short loops.
      const ring=k.put(new THREE.TorusGeometry(.23,.045,5,12),k.solid("#bcad88"),x,.49,z,false);
      ring.rotation.x=Math.PI/2;
    }
  }
  // Two decorative fishing boats float out beyond the walkable pier.
  const boatGroups:THREE.Group[]=[];
  function boat(x:number,z:number,s:number,seed:number){
    const previous=new Set(k.scene.children);
    const hull=k.put(new THREE.SphereGeometry(1.6,12,8),k.pattern("planks",seed),x,-.07,z);
    hull.scale.set(s,.33*s,.65*s);hull.rotation.y=.13;
    // Keep the entire boat assembled; hull-only rotation detached the mast and sail.
    const rail=k.put(new THREE.TorusGeometry(1,.075,7,14),k.solid("#5d453a"),x,.24*s,z);
    rail.rotation.x=Math.PI/2;rail.scale.set(1.5*s,.92*s,1);
    // Hull, rails, mast and canvas will move as one group.
    const mast=k.column(.08*s,3.9*s,posts,x,2.05*s,z);
    // The mast is part of this boat.
    const cloth=k.pattern("canvas",seed,1,1);
    const sail=k.quad([
      [x,3.8*s,z],[x+.1*s,1.3*s,z-.1*s],
      [x+1.22*s,1.5*s,z-.12*s],[x,3.8*s,z]
    ],cloth,false);
    // The sail is part of this boat.
    const pennant=k.quad([[x,4.1*s,z],[x+1.1*s,3.9*s,z],
      [x,3.65*s,z],[x,4.1*s,z]],k.solid("#b46b51"),false);
    const group=new THREE.Group();
    group.name="fishing-boat-"+seed;
    for(const child of [...k.scene.children]) {
      if(!previous.has(child)) group.add(child);
    }
    k.scene.add(group);
    boatGroups.push(group);
  }
  boat(18,-3.5,.88,6);
  boat(24,15.2,1.22,7);

  // Natural stone banks and no harsh rectangular cliff wall.
  const stones=[k.pattern("cliff",2),k.pattern("cliff",3),k.solid("#8c9788")];
  for(let i=0;i<42;i++){
    const x=9.8+(noise(i*3)*2.7),z=-31+i*1.5;
    if(z>2.2&&z<12.3)continue;
    const scale=.30+noise(i*8)*.78;
    const rock=k.put(new THREE.IcosahedronGeometry(scale,0),stones[i%3],x,scale*.22,z);
    rock.scale.set(1.33,.69,1.07);rock.rotation.set(.15,noise(i)*6,.2);
  }
  // Small distant rocks and headlands balance the shore while framing the view.
  for(let i=0;i<18;i++){
    const x=18+noise(i*5)*12,z=-31+noise(i*9)*55;
    const r=.3+noise(i+33)*1.4;
    const rock=k.put(new THREE.IcosahedronGeometry(r,1),stones[i%3],x,-.1,z);
    rock.scale.set(1.2,.5,1.8);rock.rotation.y=i*.67;
  }

  function tree(x:number,z:number,scale:number,seed:number){
    const trunk=k.put(new THREE.CylinderGeometry(.22*scale,.34*scale,3.15*scale,9),
      k.pattern("timber",4),x,1.55*scale,z);
    trunk.castShadow=true;
    const crowns=[[-.83,3.25,.18],[.82,3.12,.02],[0,3.74,0],[0,2.98,-.84],
      [-.2,3.12,.87],[.46,4.15,.25],[-.57,3.84,-.4]];
    for(let i=0;i<crowns.length;i++){
      const [ox,oy,oz]=crowns[i],radius=(.94+.18*noise(seed+i))*scale;
      const bulb=k.put(new THREE.IcosahedronGeometry(radius,1),leaves[(seed+i)%leaves.length],
        x+ox*scale,oy*scale,z+oz*scale);
      bulb.scale.set(1.12,.9,1.15);bulb.rotation.set(i*.15,i*.47,i*.1);
    }
    k.collider(x,z,.52*scale,.52*scale);
  }
  const treeLocations=[
    [-4,-8],[8,-9],[-8,12],[-22,6],[-30,20],[6,22],[-12,22],[-31,-4],
    [-20,-19],[-34,-24],[-35,0],[-37,13],[-9,-23],[7,-23],[-15,29],[-25,29]
  ];
  for(let i=0;i<treeLocations.length;i++){
    const [x,z]=treeLocations[i];
    tree(x,z,.70+noise(i+31)*.60,i+3);
  }
  // Instanced grasses and flowers; no runtime geometry per blade.
  const grassMaterial=k.solid("#8ba777");
  const grassGeom=k.scope.track(new THREE.ConeGeometry(.075,.38,3));
  const grass=k.scope.track(new THREE.InstancedMesh(grassGeom,grassMaterial,900));
  let count=0;
  for(let i=0;i<1600&&count<900;i++){
    const x=-38+noise(i*3.03)*48,z=-34+noise(i*4.19)*68;
    if(Math.abs(z)<4.1&&x>-32)continue;
    if(k.colliders.some(c=>Math.abs(x-c.x)<c.halfX+.6&&Math.abs(z-c.z)<c.halfZ+.6))continue;
    if(x>10)continue;
    const s=.45+noise(i*8.2)*1.9;
    dummy.position.set(x,-.04,z);dummy.scale.set(s,s,s);dummy.rotation.set(0,i*.28,0);dummy.updateMatrix();
    grass.setMatrixAt(count++,dummy.matrix);
  }
  grass.count=count;grass.instanceMatrix.needsUpdate=true;grass.castShadow=false;k.scene.add(grass);
  const flowerColors=["#e7be8b","#edd7bc","#c997ae","#d8bf6b"];
  for(let color=0;color<flowerColors.length;color++){
    const geo=k.scope.track(new THREE.IcosahedronGeometry(.115,0));
    const inst=k.scope.track(new THREE.InstancedMesh(geo,k.solid(flowerColors[color]),95));
    let j=0;
    for(let i=0;i<330&&j<95;i++){
      const x=-37+noise(i*2.3+color*.6)*46,z=-30+noise(i*8.9+color*.7)*64;
      if(x>8||Math.abs(z)<4.5)continue;
      if(k.colliders.some(c=>Math.abs(x-c.x)<c.halfX+.6&&Math.abs(z-c.z)<c.halfZ+.6))continue;
      dummy.position.set(x,.21,z);dummy.scale.set(1,1,1);dummy.rotation.set(0,0,0);dummy.updateMatrix();
      inst.setMatrixAt(j++,dummy.matrix);
    }
    inst.count=j;inst.instanceMatrix.needsUpdate=true;k.scene.add(inst);
  }

  // Lighting: soft upper atmosphere and low sun, physically motivated windows.
  const sky=new THREE.HemisphereLight("#c8dbd6","#675a48",1.17);k.scene.add(sky);
  const sunlight=new THREE.DirectionalLight("#ffd09a",3.1);
  sunlight.position.set(-19,25,-10);sunlight.castShadow=true;
  sunlight.shadow.mapSize.set(1024,1024);
  sunlight.shadow.camera.left=-26;sunlight.shadow.camera.right=26;
  sunlight.shadow.camera.top=27;sunlight.shadow.camera.bottom=-27;
  sunlight.shadow.camera.near=1;sunlight.shadow.camera.far=75;
  sunlight.shadow.normalBias=.036;sunlight.shadow.bias=-.00015;
  k.scene.add(sunlight);
  const target=new THREE.Object3D();k.scene.add(target);
  sunlight.target=target;
  function update(time:number){
    waveUniforms.uTime.value=time;
    // The scene is intentionally golden-hour biased; the breeze keeps the sea alive.
    for(let i=0;i<boatGroups.length;i++){
      // All boat parts share a parent and bob together.
      boatGroups[i].position.y=.045*Math.sin(time*.9+i*1.7);
    }
  }
  return {sunlight,update,sea:seaMaterial};
}
