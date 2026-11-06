import * as THREE from "three";
import type { StageKit } from "./kit.js";
import type { NightLights } from "./night-lights.js";

/**
 * Medieval lighting fixtures: hanging iron lanterns on wall brackets and lantern posts, and open-flame torches
 * on wooden posts. No electric lamp posts. The flame/glass is an HDR emissive that the sky dims by day; each
 * fixture also registers a LightSpot so the lights pool can really light the ground and walls around it.
 */

/**
 * A pixel-art flame: a camera-facing (around the vertical axis) quad whose fragment shader paints a licking teardrop
 * on a 10x16 texel grid with a white-yellow core, orange body and red rim, plus a few rising embers. HDR colours feed
 * the bloom. Pixels are discarded rather than blended, so there is no sorting and the edge stays crisp.
 */
export function createFlameMaterial(){
  return new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0},uBurn:{value:1}},
    side:THREE.DoubleSide,
    vertexShader:`
      varying vec2 vUv;
      varying float vPhase;
      void main(){
        vUv=uv;
        vec3 center=(modelMatrix*vec4(0.0,0.0,0.0,1.0)).xyz;
        vPhase=center.x*1.3+center.z*.7;
        vec3 toCam=cameraPosition-center;toCam.y=0.0;
        vec3 fwd=normalize(toCam+vec3(1e-4,0.0,0.0));
        vec3 right=normalize(cross(vec3(0.0,1.0,0.0),fwd));
        vec3 sc=vec3(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz),1.0);
        vec3 world=center+right*position.x*sc.x+vec3(0.0,1.0,0.0)*position.y*sc.y;
        gl_Position=projectionMatrix*viewMatrix*vec4(world,1.0);
      }`,
    fragmentShader:`
      precision highp float;
      uniform float uTime;
      uniform float uBurn;
      varying vec2 vUv;
      varying float vPhase;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        vec2 grid=vec2(10.0,16.0);
        vec2 cell=(floor(vUv*grid)+.5)/grid;
        float y=cell.y/.72;                       // 0 at the base, 1 at the tip of the flame body
        float x=cell.x-.5;
        float t=uTime*1.0+vPhase;
        // The body sways and licks: a noise row that scrolls upwards narrows the flame unevenly.
        float sway=sin(t*6.0+y*5.0)*.07*y;
        float lick=h(vec2(floor(cell.x*grid.x),floor(cell.y*grid.y-t*7.0)));
        float width=(1.0-pow(clamp(y,0.0,1.0),1.15))*(.30+.20*lick)+.02;
        bool body=y>=0.0&&y<1.0&&abs(x-sway)<width;
        // Rising embers above the flame: one texel each, drifting up and sideways, fading as they go.
        float col=floor(cell.x*grid.x);
        float seed=h(vec2(col,3.7+floor(t*.9+h(vec2(col,1.0)))));
        float ey=fract(t*.9+h(vec2(col,1.0)))*1.4+.62;
        bool ember=seed>.78&&abs(cell.y-ey*.9)<.5/grid.y&&cell.y>.62&&ey<1.9;
        if(!body&&!ember)discard;
        vec3 color;
        if(ember){
          color=vec3(2.6,1.0,.25);
        }else{
          float core=1.0-smoothstep(.0,.75,abs(x-sway)/max(width,.001));
          float heat=core*(1.0-y*.55);
          color=mix(vec3(2.4,.55,.10),vec3(3.0,1.5,.35),smoothstep(.15,.55,heat));   // red rim -> orange body
          color=mix(color,vec3(3.8,3.0,1.7),smoothstep(.62,.9,heat));                 // white-yellow core
        }
        gl_FragColor=vec4(color*uBurn,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export function createFixtures(k:StageKit,lights:NightLights){
  const iron=k.solid("#413f3b",.62);
  const wood=k.pattern("planks",14);
  const flameMaterial=k.solid("#ffdf9a",.56,"#e8a85d");
  flameMaterial.emissiveIntensity=3.2;
  const flameMaterialLive=k.scope.track(createFlameMaterial());
  const flames:{mesh:THREE.Mesh;baseY:number;phase:number}[]=[];

  /** A caged candle lantern whose centre is at (x,y,z). */
  function lantern(x:number,y:number,z:number){
    k.block(.30,.05,.30,iron,x,y-.25,z,false);
    k.block(.22,.30,.22,flameMaterial,x,y-.02,z,false);
    for(const sx of [-1,1])for(const sz of [-1,1])k.block(.035,.34,.035,iron,x+sx*.135,y-.02,z+sz*.135,false);
    k.block(.30,.04,.30,iron,x,y+.17,z,false);
    const cap=k.put(new THREE.ConeGeometry(.24,.16,4),iron,x,y+.27,z,false);
    cap.rotation.y=Math.PI/4;
    k.column(.025,.13,iron,x,y+.39,z,6);
  }

  /** Iron arm bolted to a wall at (x,y,z) that carries a hanging lantern `reach` out, `face` is +1/-1 along z. */
  function hangingLantern(x:number,y:number,z:number,face:1|-1,reach=.62){
    const outZ=z+face*reach;
    k.segment(new THREE.Vector3(x,y+.62,z),new THREE.Vector3(x,y+.62,outZ),.035,iron,6);
    k.segment(new THREE.Vector3(x,y+.20,z),new THREE.Vector3(x,y+.60,z+face*reach*.78),.026,iron,6);
    k.column(.016,.2,iron,x,y+.50,outZ,6);
    lantern(x,y+.1,outZ);
    lights.add({x,y:y+.1,z:outZ+face*.15,intensity:11,distance:12,color:"#ffbf70",flicker:.07});
  }

  /** A wooden post with an iron arm and a hanging lantern, for street edges. `dir` is the arm's z direction. */
  function lanternPost(x:number,z:number,dir:1|-1,height=3.1){
    k.column(.085,height,wood,x,height/2,z,8);
    k.block(.26,.2,.26,iron,x,.1,z,false);
    k.segment(new THREE.Vector3(x,height-.12,z),new THREE.Vector3(x,height-.12,z+dir*.7),.04,iron,6);
    k.segment(new THREE.Vector3(x,height-.75,z),new THREE.Vector3(x,height-.18,z+dir*.5),.03,iron,6);
    k.column(.016,.22,iron,x,height-.24,z+dir*.7,6);
    lantern(x,height-.5,z+dir*.7);
    lights.add({x,y:height-.45,z:z+dir*.7,intensity:12,distance:13,color:"#ffbf70",flicker:.07});
    k.collider(x,z,.2,.2);
  }

  /** A wooden torch post with an iron brazier cup and a living flame. */
  function torchPost(x:number,z:number,height=2.5){
    k.column(.07,height,wood,x,height/2,z,8);
    k.put(new THREE.CylinderGeometry(.2,.11,.24,8),iron,x,height+.04,z,false);
    for(let i=0;i<3;i++){
      const a=i*Math.PI*2/3;
      k.segment(new THREE.Vector3(x+Math.cos(a)*.09,height-.12,z+Math.sin(a)*.09),
        new THREE.Vector3(x+Math.cos(a)*.2,height+.14,z+Math.sin(a)*.2),.018,iron,5);
    }
    // The flame quad's base sits in the brazier cup; its upper part holds the rising embers.
    const flame=k.put(new THREE.PlaneGeometry(.52,.9),flameMaterialLive,x,height+.40,z,false);
    flame.userData.dynamic=true;flame.castShadow=false;flame.receiveShadow=false;
    flames.push({mesh:flame,baseY:flame.position.y,phase:x*1.3+z*.7});
    lights.add({x,y:height+.4,z,intensity:12,distance:14,color:"#ffa64d",flicker:.3});
    k.collider(x,z,.2,.2);
  }

  /** Flames only burn at dusk and night (`glow` is the sky's lamp factor, 0 by day); the shader does the licking. */
  function animate(time:number,glow:number){
    const burn=Math.min(1,Math.max(0,(glow-.05)*2.2));
    flameMaterialLive.uniforms.uTime.value=time;
    flameMaterialLive.uniforms.uBurn.value=burn;
    for(const f of flames)f.mesh.visible=burn>.01;
  }
  return {lantern,hangingLantern,lanternPost,torchPost,animate};
}
export type Fixtures=ReturnType<typeof createFixtures>;
