import * as THREE from "three";
import { Water } from "three/addons/objects/Water.js";
import { SEA_LEVEL_Y } from "./beach-profile.js";
import type { StageKit } from "./kit.js";
import { liveSky } from "./sky-live.js";
import { skylineTangents, skylineBytes, SKYLINE_BINS, SKYLINE_MAX_TANGENT } from "./skyline.js";
import { BOAT_LOCATIONS } from "./placements.js";
import { COASTLINE_GLSL } from "./coastal-outline.js";

/** How many rocks, piles and hulls can wear a foam skirt (uniform array size in the shader). */
export const FOAM_SPOTS=40;

// The sea is three.js's official `Water` (the webgl_shaders_ocean example): a mirror camera renders the real scene
// (sky, sun, mountains, village, boats) into a texture, and the surface samples it distorted by a scrolling normal map,
// with a Fresnel mix and sun glitter. The owner lifted the "lightweight sea" limit (2026-11-06) and asked for demo-level
// water. Our own shoreline colours, foam skirts around rocks, piles and hulls, wave displacement and day/night
// grading are kept on top; the analytic sky/skyline reflection remains as the fallback when reflection is off
// (basic quality) or the camera is orthographic.

/** A tileable water normal map (RGBA8, tangent space, blue = up) built from integer-frequency sine waves. */
export function makeWaterNormals(size=256){
  const waves:[number,number,number,number][]=[];   // kx, ky, amplitude, phase
  let seed=11;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  for(let i=0;i<14;i++){
    const kx=Math.round((rnd()-.5)*2*(2+i*1.1)),ky=Math.round((rnd()-.5)*2*(2+i*1.1));
    if(!kx&&!ky)continue;
    waves.push([kx,ky,1/Math.hypot(kx,ky)*(.6+rnd()*.5),rnd()*Math.PI*2]);
  }
  const data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size,v=y/size;
    let dx=0,dy=0;
    for(const [kx,ky,a,ph] of waves){const c=Math.cos(Math.PI*2*(kx*u+ky*v)+ph)*a*Math.PI*2;dx+=c*kx;dy+=c*ky;}
    let nx=-dx*.075,ny=-dy*.075,nz=1;
    const l=Math.hypot(nx,ny,nz);nx/=l;ny/=l;nz/=l;
    const i=(y*size+x)*4;
    data[i]=Math.round((nx*.5+.5)*255);data[i+1]=Math.round((ny*.5+.5)*255);data[i+2]=Math.round((nz*.5+.5)*255);data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;
  texture.anisotropy=4;texture.needsUpdate=true;
  return texture;
}

export function createCoastalWater(k:StageKit,heightAt:(x:number,z:number)=>number=()=>0) {
  // Mountains and islands seen from the harbour, baked once: a 256x1 table of skyline tangents by azimuth.
  const skylineTexture=k.scope.track(new THREE.DataTexture(
    skylineBytes(skylineTangents(heightAt,25,8,{waterline:SEA_LEVEL_Y})),SKYLINE_BINS,1,THREE.RGBAFormat));
  skylineTexture.wrapS=THREE.RepeatWrapping;skylineTexture.magFilter=skylineTexture.minFilter=THREE.LinearFilter;
  skylineTexture.needsUpdate=true;
  const spots=Array.from({length:FOAM_SPOTS},()=>new THREE.Vector4(0,0,0,0));
  const waterNormals=k.scope.track(makeWaterNormals());
  const uniforms={
    uTime:{value:0},uReflect:{value:1},uDetail:{value:.28},uWeather:{value:new THREE.Vector2(1,0)},   // x: wave scale, y: grey/storm tint
    uSunDirection:{value:liveSky.sunDir},uMoonDirection:{value:liveSky.moonDir},
    uSunColor:{value:liveSky.sunColor},uMoonColor:{value:liveSky.moonColor},
    uHorizon:{value:liveSky.fog},uSkyMid:{value:liveSky.mid},
    uDayLight:liveSky.dayLight,uMoonStrength:liveSky.moonStrength,
    uSpots:{value:spots},uSkyline:{value:skylineTexture},
  };
  const shaderSource={
    vertexShader:String.raw`
      precision highp float;
      uniform float uTime;
      uniform vec2 uWeather;
      uniform mat4 textureMatrix;
      varying vec4 mirrorCoord;
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      ${COASTLINE_GLSL}
      void main(){
        vec3 w=(modelMatrix*vec4(position,1.0)).xyz;
        float dist=max(0.0,w.x-shore(w.z));
        dist=mix(60.0,dist,shoreRegion(w.z)); // Unattenuated waves on open sea beyond headlands.
        // Smoothly dissipate wave energy over the shallow coastal shelf, including during storms.
        float damp=.06+.94*smoothstep(0.0,9.0,dist);
        float p0=w.x*.29+w.z*.08+uTime*.85;
        float p1=-w.x*.16+w.z*.34+uTime*.65;
        float p2=w.x*.91+w.z*.72+uTime*1.45;
        float h=(.18*sin(p0)+.12*sin(p1)+.028*sin(p2))*damp*uWeather.x;
        vec3 changed=position;
        changed.z+=h;  // Plane rotated by -90°: local Z becomes world-up.
        vWorld=(modelMatrix*vec4(changed,1.0)).xyz;
        // The mirror lookup uses the FLAT plane: a coarse mesh (4 m cells) would otherwise warp the reflection in
        // straight-edged patches. Normals and shore distance are evaluated per pixel in the fragment shader.
        mirrorCoord=textureMatrix*(modelMatrix*vec4(position,1.0));
        vec4 mvPosition=modelViewMatrix*vec4(changed,1.0);
        gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader:`
      precision highp float;
      uniform float uTime;
      uniform vec2 uWeather;
      varying vec3 vWorld;
      uniform vec3 uSunDirection;
      uniform vec3 uMoonDirection;
      uniform vec3 uSunColor;
      uniform vec3 uMoonColor;
      uniform vec3 uHorizon;
      uniform vec3 uSkyMid;
      uniform float uDayLight;
      uniform float uMoonStrength;
      uniform vec4 uSpots[${FOAM_SPOTS}];
      uniform sampler2D uSkyline;
      uniform sampler2D mirrorSampler;
      uniform sampler2D normalSampler;
      uniform float time;
      uniform float size;
      uniform float distortionScale;
      uniform float uReflect;
      uniform float uDetail;
      varying vec4 mirrorCoord;
      // the official water example's four-layer scrolling normal map
      vec4 getNoise(vec2 uv){
        vec2 uv0=(uv/103.0)+vec2(time/17.0,time/29.0);
        vec2 uv1=uv/107.0-vec2(time/-19.0,time/31.0);
        vec2 uv2=uv/vec2(8907.0,9803.0)+vec2(time/101.0,time/97.0);
        vec2 uv3=uv/vec2(1091.0,1027.0)-vec2(time/109.0,time/-113.0);
        vec4 noise=texture2D(normalSampler,uv0)+texture2D(normalSampler,uv1)+texture2D(normalSampler,uv2)+texture2D(normalSampler,uv3);
        return noise*0.5-1.0;
      }
      #include <fog_pars_fragment>
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){
        vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),
          mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);
      }
      ${COASTLINE_GLSL}
      void main(){
        // The endless sea uses this material too: mask water that used to poke up
        // through the mainland; keep a narrow swash strip over submerged beach.
        if(abs(vWorld.z)<47.0) {
          if(vWorld.x<shoreWaterLimit(vWorld.z))discard;
          if(vWorld.x<shore(vWorld.z) && vWorld.y<=shoreBeachBed(vWorld.x,vWorld.z)+.003)discard;
        }
        vec3 v=normalize(cameraPosition-vWorld);
        // Shore distance and the long-wave normal, per pixel (the same waves the vertex shader displaces).
        float shoreDist=max(0.0,vWorld.x-shore(vWorld.z));
        float coastWeight=shoreRegion(vWorld.z);
        // Only colour/normal blending fades offshore; foam must use the actual shore distance.
        float vDist=mix(60.0,shoreDist,coastWeight);
        float rawDist=vWorld.x-shore(vWorld.z);
        float waveDist=mix(60.0,max(0.0,rawDist),coastWeight);
        float damp=.06+.94*smoothstep(0.0,9.0,waveDist);
        // Product rule: damp changes across the shoal and along both headland tapers.
        float q=clamp(waveDist/9.0,0.0,1.0);
        float dampGrad=.94*(6.0*q*(1.0-q))/9.0;
        float active=step(0.0,rawDist);
        float distDx=coastWeight*active;
        float distDz=-coastWeight*active*shoreSlope(vWorld.z)
                    +(max(0.0,rawDist)-60.0)*shoreRegionSlope(vWorld.z);
        float p0=vWorld.x*.29+vWorld.z*.08+uTime*.85;
        float p1=-vWorld.x*.16+vWorld.z*.34+uTime*.65;
        float p2=vWorld.x*.91+vWorld.z*.72+uTime*1.45;
        float waveShape=.18*sin(p0)+.12*sin(p1)+.028*sin(p2);
        float shapeDx=.0522*cos(p0)-.0192*cos(p1)+.02548*cos(p2);
        float shapeDz=.0144*cos(p0)+.0408*cos(p1)+.02016*cos(p2);
        float dx=(shapeDx*damp+waveShape*dampGrad*distDx)*uWeather.x;
        float dz=(shapeDz*damp+waveShape*dampGrad*distDz)*uWeather.x;
        vec3 n=normalize(vec3(-dx,1.0,-dz));
        vec4 detailNoise=getNoise(vWorld.xz*size);
        vec3 nDetail=normalize(detailNoise.xzy*vec3(1.5,1.0,1.5));
        n=normalize(n+vec3(nDetail.x,0.0,nDetail.z)*uDetail);
        float f=.025+.975*pow(1.0-max(0.0,dot(n,v)),5.0);
        // Reference palette: pale aqua over sand at the shore -> vivid turquoise -> deep cobalt.
        // Water body after the web-ocean reference: a turbid blue-green (deep ~ .026,.128,.154), not cobalt.
        vec3 pale=vec3(.40,.58,.52),turquoise=vec3(.04,.30,.33),cobalt=vec3(.018,.115,.15);
        // Narrow pale shallows; the deeper colours take over quickly so the bay reads as sea, not a lagoon.
        vec3 water=mix(pale,turquoise,smoothstep(0.3,3.0,vDist));
        water=mix(water,cobalt,smoothstep(2.5,24.0,vDist));
        // As a WebGL2 fallback, reflection includes a simple analytic sky tint,
        // not a falsely claimed SSR or world-space environment probe.
        vec3 reflected=reflect(-v,n);
        float skyHeight=clamp(reflected.y*.70+.30,0.0,1.0);
        vec3 sky=mix(uHorizon*.58,uSkyMid*.6,
          pow(skyHeight,.70));
        // Mountains and islands mirror in the sea: the reflected ray is compared with a baked skyline table.
        float refAz=atan(reflected.z,reflected.x);
        float ridge=max(0.0,texture2D(uSkyline,vec2(fract(refAz/6.2831853),.5)).r*${SKYLINE_MAX_TANGENT.toFixed(2)}-.10);
        float refTangent=reflected.y/max(1e-3,length(reflected.xz));
        float landMask=ridge>0.0?1.0-smoothstep(ridge-.03,ridge+.03,refTangent):0.0;
        vec3 land=mix(vec3(.09,.17,.15),uHorizon*.72,.40+.35*smoothstep(.0,.35,refTangent));
        sky=mix(sky,land,landMask);
        // Planar reflection of the real scene (sky, sun, mountains, village, boats), distorted by the normal map.
        float eyeDist=length(cameraPosition-vWorld);
        vec2 distortion=nDetail.xz*(.001+1.0/eyeDist)*distortionScale;
        vec3 mirrorSample=texture2D(mirrorSampler,mirrorCoord.xy/mirrorCoord.w+distortion).rgb;
        vec3 reflection=mix(sky,mirrorSample,uReflect);
        float reflectMix=mix(clamp(f*.66+.09,0.0,.67),clamp(f*.78+.05,0.0,.74),uReflect);
        water=mix(water,reflection,reflectMix);
        float sunRef=max(0.0,dot(reflect(-normalize(uSunDirection),n),v));
        // Glitter path toward the sun: a tight HDR core plus a broad warm sheen (both feed bloom).
        float sunUp=smoothstep(-.10,.10,uSunDirection.y);
        vec3 glitter=uSunColor*(pow(sunRef,220.0)*5.0+pow(sunRef,40.0)*.55+pow(sunRef,6.0)*.10)*sunUp*(1.0-.55*uReflect);
        float moonRef=max(0.0,dot(reflect(-normalize(uMoonDirection),n),v));
        float moonUp=smoothstep(-.05,.15,uMoonDirection.y);
        glitter+=uMoonColor*(pow(moonRef,260.0)*2.2+pow(moonRef,45.0)*.20)*uMoonStrength*moonUp;
        // Fine irregular wind highlights depend on world coordinates, not
        // a giant UV repeat that turns the water into regular blue stripes.
        float small=noise(vWorld.xz*2.3+vec2(uTime*.24,uTime*.17));
        float micro=noise(vWorld.xz*5.2-vec2(uTime*.31,uTime*.13));
        water+=vec3(.024,.04,.047)*(small-.35)+vec3(.013)*(micro-.5);
        // Caustic web on the sunlit shallows: two drifting noise fields whose difference makes bright cells.
        vec2 cp=vWorld.xz*2.1;
        float cA=noise(cp+vec2(uTime*.21,uTime*.13)),cB=noise(cp*1.3-vec2(uTime*.17,uTime*.23)+4.7);
        float caustic=pow(clamp(1.0-abs(cA-cB)*5.5,0.0,1.0),5.0);
        water+=vec3(.46,.62,.54)*caustic*(1.0-smoothstep(1.5,10.0,vDist))*.18;
        // Breaker crests travel shoreward (-X), using distance from the ACTUAL curved coast.
        // Two existing noise taps + one sine; no new textures, simulation passes or FFT.
        float shoreline=(1.0-smoothstep(0.0,2.65,shoreDist))*coastWeight;
        float moving=sin(shoreDist*2.2+vWorld.z*.30+uTime*1.8+noise(vWorld.xz*.5)*3.5);
        float foam=shoreline*smoothstep(.45,.76,
          .55*noise(vWorld.xz*1.35+vec2(uTime*.13,-uTime*.08))+.45*(moving*.5+.5));
        water=mix(water,vec3(.72,.80,.74),clamp(foam*.52,0.0,.47));
        // Foam skirts around rocks, piles and hulls, in chunky texel cells to match the pixel world.
        float spotFoam=0.0,shoal=0.0;
        if(vWorld.x>8.0&&vWorld.x<34.0&&vWorld.z>-36.0&&vWorld.z<26.0){
          vec2 fc=floor(vWorld.xz*7.0);
          float fn=hash(fc)*.5+hash(fc*.37+9.0)*.5;
          for(int i=0;i<${FOAM_SPOTS};i++){
            vec4 sp=uSpots[i];
            if(sp.z<=0.0)continue;
            float edge=length(vWorld.xz-sp.xy)-sp.z;
            float ripple=.5+.5*sin(edge*7.0-uTime*2.2+sp.x);
            float skirt=(1.0-smoothstep(.12,.70+.22*ripple,edge))*step(-.35,edge);
            spotFoam=max(spotFoam,skirt*smoothstep(.28,.62,fn+.22*ripple));
            shoal=max(shoal,1.0-smoothstep(.0,2.2,edge));
          }
        }
        water=mix(water,vec3(.42,.70,.66),shoal*.16);
        water=mix(water,vec3(.86,.93,.88),clamp(spotFoam*.72,0.0,.7));
        // Deep water goes dark at night, caustics and foam included; the sun and moon glitter stay bright.
        water=water*(.12+.88*uDayLight)+glitter;
        // a storm sea is slate-grey and streaked white
        water=mix(water,vec3(dot(water,vec3(.2126,.7152,.0722)))*vec3(.8,.9,1.0),uWeather.y*.55);
        gl_FragColor=vec4(max(water,vec3(0.0)),1.0);
        #include <fog_fragment>
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  };
  // A segmented mesh is required: a two-triangle water plane cannot
  // physically displace between its corners.
  const geo=k.scope.track(new THREE.PlaneGeometry(680,620,164,160));
  const water=new Water(geo,{
    textureWidth:960,textureHeight:512,   // wide, not square: a square target stretched over a phone's landscape screen made the reflection blocky
    waterNormals,sunDirection:liveSky.sunDir,sunColor:0xffffff,waterColor:0x0b3a40,
    distortionScale:1.1,fog:true,alpha:1,side:THREE.DoubleSide,
  });
  const material=water.material as THREE.ShaderMaterial;
  Object.assign(material.uniforms,uniforms);
  material.uniforms.size.value=2.2;
  material.vertexShader=shaderSource.vertexShader;material.fragmentShader=shaderSource.fragmentShader;
  material.lights=false;material.transparent=false;material.depthWrite=true;material.needsUpdate=true;
  k.scope.track(material);
  const mesh=water;
  mesh.name="continuous-fjord-water";
  mesh.rotation.x=-Math.PI/2;
  mesh.position.set(140,SEA_LEVEL_Y,0);
  mesh.receiveShadow=false;mesh.castShadow=false;
  mesh.frustumCulled=true;
  mesh.userData.dynamic=true;  // Waves must not be merged into the static batch.
  k.scene.add(mesh);
  // One endless sea: a huge, coarse plane just below the detailed one, so wherever there is no land the view ends in
  // water that fades into the haze, never in a void. It is far beyond the fog, so its waves need no resolution.
  const outer=new THREE.Mesh(k.scope.track(new THREE.PlaneGeometry(9000,9000,2,2)),material);
  outer.name="endless-sea";outer.rotation.x=-Math.PI/2;outer.position.set(140,-.47,0);
  outer.frustumCulled=false;outer.userData.dynamic=true;outer.receiveShadow=false;outer.castShadow=false;
  k.scene.add(outer);
  // Reflection on/off (off for the basic quality tier) and the mirror pass itself. The mirror render must not draw the
  // endless-sea plane (it samples the very texture being rendered), and an orthographic camera cannot use the oblique
  // clip trick, so both fall back to the analytic sky.
  let reflectionOn=true;
  // The mirror image changes slowly, so it is re-rendered every second frame; the other frame reuses the last one.
  let mirrorTick=0,prepared=false;
  const originalBeforeRender=water.onBeforeRender;
  function renderMirror(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera){
    outer.visible=false;
    originalBeforeRender.call(water,renderer,scene,camera,undefined as never,undefined as never,undefined as never);
    outer.visible=true;
  }
  /** Draws the mirror image for this frame. The frame pipeline calls it BEFORE the scene pass: a render-target switch in the
   *  middle of a multisampled scene pass loses what was already drawn on phone GPUs (blank frames). */
  function mirrorPass(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,measure?:(run:()=>void)=>void){
    prepared=true;
    const ortho=(camera as THREE.OrthographicCamera).isOrthographicCamera===true;
    uniforms.uReflect.value=reflectionOn&&!ortho?1:0;
    if(!reflectionOn||ortho)return;
    if((mirrorTick++&1)===1)return;
    if(measure)measure(()=>renderMirror(renderer,scene,camera));else renderMirror(renderer,scene,camera);
  }
  // Fallback for a renderer that does not run the pre-pass: the mirror is drawn from here, as the example does.
  water.onBeforeRender=function(renderer,scene,camera){
    if(prepared){prepared=false;return;}
    const ortho=(camera as THREE.OrthographicCamera).isOrthographicCamera===true;
    uniforms.uReflect.value=reflectionOn&&!ortho?1:0;
    if(!reflectionOn||ortho)return;
    if((mirrorTick++&1)===1)return;
    renderMirror(renderer,scene,camera);
  };
  function setReflection(on:boolean){reflectionOn=on;}
  function setWeather(waveScale:number,grey:number){uniforms.uWeather.value.set(waveScale,grey);}
  function update(time:number){uniforms.uTime.value=time;material.uniforms.time.value=time*.6;}
  /** Rocks and piles as [x,z,radius]; each boat adds two foam circles along its hull (see setBoats). */
  let fixedSpots:[number,number,number][]=[];
  let boatPoses:{x:number;z:number;heading:number;length:number}[]=BOAT_LOCATIONS.map((b,i)=>({x:b.x,z:b.z,heading:0,length:i?6.3:4.5}));
  function writeSpots(){
    const all:[number,number,number][]=[...fixedSpots];
    for(const boat of boatPoses){
      const r=boat.length*.17,reach=boat.length*.26,cx=Math.cos(boat.heading),cz=Math.sin(boat.heading);
      all.push([boat.x-cx*reach,boat.z-cz*reach,r],[boat.x+cx*reach,boat.z+cz*reach,r]);
    }
    spots.forEach((v,i)=>{const e=all[i];if(e)v.set(e[0],e[1],e[2],1);else v.set(0,0,0,0);});
    return Math.min(all.length,FOAM_SPOTS);
  }
  function setSpots(list:readonly (readonly [number,number,number])[]){
    fixedSpots=list.map(([x,z,r])=>[x,z,r]);
    return writeSpots();
  }
  /** Foam rings follow the boats when they are rowed. */
  function setBoats(poses:{x:number;z:number;heading:number;length:number}[]){boatPoses=poses;writeSpots();}
  return {material,mesh,update,setSpots,setBoats,setReflection,setWeather,mirrorPass};
}
