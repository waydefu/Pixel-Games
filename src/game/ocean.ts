import * as THREE from "three";
import type { StageKit } from "./kit.js";

// WebGL2 production fallback: camera-space Fresnel, analytic Gerstner-style
// directional wave normal, coherent shoreline foam and a sky-light surrogate.
// Research- #28 describes SSR/probe as future tested alternatives, not shipped.
export function createCoastalWater(k:StageKit) {
  const uniforms={uTime:{value:0}};
  const material=k.scope.track(new THREE.ShaderMaterial({
    uniforms,transparent:false,depthWrite:true,side:THREE.DoubleSide,
    vertexShader:String.raw`
      precision highp float;
      uniform float uTime;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vDist;
      float shore(float z){return 13.3+sin(z*.13)*.65+sin(z*.37)*.22;}
      void main(){
        vec3 w=(modelMatrix*vec4(position,1.0)).xyz;
        float dist=max(0.0,w.x-shore(w.z));
        float damp=.22+.78*smoothstep(0.0,9.0,dist);
        float p0=w.x*.29+w.z*.08+uTime*.85;
        float p1=-w.x*.16+w.z*.34+uTime*.65;
        float p2=w.x*.91+w.z*.72+uTime*1.45;
        float h=(.18*sin(p0)+.12*sin(p1)+.028*sin(p2))*damp;
        float dx=(.0522*cos(p0)-.0192*cos(p1)+.0255*cos(p2))*damp;
        float dz=(.0144*cos(p0)+.0408*cos(p1)+.0202*cos(p2))*damp;
        vec3 changed=position;
        changed.z+=h;  // Plane rotated by -90°: local Z becomes world-up.
        vNormal=normalize(vec3(-dx,1.0,-dz));
        vWorld=(modelMatrix*vec4(changed,1.0)).xyz;
        vDist=dist;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(changed,1.0);
      }`,
    fragmentShader:String.raw`
      precision highp float;
      uniform float uTime;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vDist;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){
        vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),
          mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);
      }
      void main(){
        vec3 v=normalize(cameraPosition-vWorld);
        vec3 n=normalize(vNormal);
        float f=.025+.975*pow(1.0-max(0.0,dot(n,v)),5.0);
        float depth=smoothstep(0.0,34.0,vDist);
        vec3 shallow=vec3(.024,.195,.195),deep=vec3(.006,.073,.13);
        vec3 water=mix(shallow,deep,depth);
        // As a WebGL2 fallback, reflection includes a simple analytic sky tint,
        // not a falsely claimed SSR or world-space environment probe.
        vec3 reflected=reflect(-v,n);
        vec3 sky=mix(vec3(.16,.30,.36),vec3(.055,.23,.39),
          clamp(reflected.y*.75+.3,0.0,1.0));
        water=mix(water,sky,clamp(f*.57+.06,0.0,.60));
        float glint=pow(max(0.0,dot(reflect(-normalize(vec3(-.58,.68,-.28)),n),v)),96.0);
        water+=vec3(.49,.39,.25)*glint*.38;
        // Fine irregular wind highlights depend on world coordinates, not
        // a giant UV repeat that turns the water into regular blue stripes.
        float small=noise(vWorld.xz*2.3+vec2(uTime*.24,uTime*.17));
        float micro=noise(vWorld.xz*5.2-vec2(uTime*.31,uTime*.13));
        water+=vec3(.024,.04,.047)*(small-.35)+vec3(.013)*(micro-.5);
        float shoreline=(1.0-smoothstep(.0,2.65,vDist))*(1.0-smoothstep(34.0,48.0,abs(vWorld.z)));
        float moving=sin(vWorld.z*.85+uTime*1.8+noise(vWorld.xz*.5)*5.0);
        float foam=shoreline*smoothstep(.45,.76,
          .55*noise(vWorld.xz*1.35+uTime*.13)+.45*(moving*.5+.5));
        water=mix(water,vec3(.72,.80,.74),clamp(foam*.52,0.0,.47));
        gl_FragColor=vec4(max(water,vec3(0.0)),1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  // A segmented mesh is required: a two-triangle water plane cannot
  // physically displace between its corners.
  const geo=k.scope.track(new THREE.PlaneGeometry(680,620,164,160));
  const mesh=new THREE.Mesh(geo,material);
  mesh.name="continuous-fjord-water";
  mesh.rotation.x=-Math.PI/2;
  mesh.position.set(140,-.38,0);
  mesh.receiveShadow=false;mesh.castShadow=false;
  mesh.frustumCulled=true;
  mesh.userData.dynamic=true;  // Waves must not be merged into the static batch.
  k.scene.add(mesh);
  function update(time:number){uniforms.uTime.value=time;}
  return {material,mesh,update};
}
