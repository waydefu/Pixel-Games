import * as THREE from "three";
import { fjordSurfaceHeight, FJORD_EXTENTS } from "./terrain-profile.js";
import { buildMountainForest } from "./mountain-forest.js";
import { applyAerialPerspective } from "./aerial-perspective.js";
import { applyRockSurface } from "./rock-surface.js";
import type { CloudField } from "./cloud-field.js";
import { liveSky } from "./sky-live.js";
import type { StageKit } from "./kit.js";
type Region="mainland"|"east"|"north"|"south";
type Extent={x0:number;x1:number;z0:number;z1:number;columns:number;rows:number};
const layouts=FJORD_EXTENTS as unknown as Record<Region,Extent>;
/** The four mountain meshes' extents, shared with the sea (it bakes the mountain reflection from them). */
export {layouts as FJORD_LAYOUTS};
function makeMass(scope:StageKit["scope"],region:Region,e:Extent){
  const verts:number[]=[];const colors:number[]=[];const indexes:number[]=[];
  // Muted cool granite, darker fracture lines and lighter wind-worn ledges.
  // Prebaked vertex colors cost no additional fragment shader texture reads.
  const grass=new THREE.Color("#3a7447"),moss=new THREE.Color("#59974f");
  const rock=new THREE.Color("#63747c"),ridgeRock=new THREE.Color("#99a3a2");
  const fracture=new THREE.Color("#394a54"),weathered=new THREE.Color("#b4b7ae");
  const scratch=new THREE.Color();
  const dx=(e.x1-e.x0)/e.columns,dz=(e.z1-e.z0)/e.rows;
  for(let j=0;j<=e.rows;j++)for(let i=0;i<=e.columns;i++){
    const x=e.x0+dx*i,z=e.z0+dz*j;
    const y=fjordSurfaceHeight(x,z,region);
    verts.push(x,y,z);
    const h=Math.max(0,y),l=(Math.sin(x*.21+z*.13)*Math.cos(z*.19-x*.14)+1)*.5;
    const slope=Math.hypot(
      fjordSurfaceHeight(x+1.5,z,region)-fjordSurfaceHeight(x-1.5,z,region),
      fjordSurfaceHeight(x,z+1.5,region)-fjordSurfaceHeight(x,z-1.5,region))/3.0;
    scratch.copy(grass).lerp(moss,.12+.34*l);
    const exposureRock=Math.min(.96,Math.max(0,(h-19)/60+slope*.25));
    scratch.lerp(rock,exposureRock);
    scratch.lerp(ridgeRock,Math.min(.34,Math.max(0,(h-61)/90)));
    // Broken mineral bands follow elevation and geological flow, not UV strips.
    const band=Math.sin(h*.68+Math.sin(x*.063+z*.051)*2.2);
    const fissure=Math.pow(Math.max(0,band),5);
    scratch.lerp(fracture,exposureRock*(.08+.30*fissure));
    const ledge=Math.pow(Math.max(0,-band),6);
    scratch.lerp(weathered,exposureRock*.24*ledge);
    const mineralNoise=Math.sin(x*.12+z*.18)*Math.cos(z*.19-x*.08);
    scratch.multiplyScalar(.90+l*.10+mineralNoise*.065);
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
export function buildFjordLandscape(k:StageKit,cloudField:CloudField){
  const regionMaterial=k.scope.track(new THREE.MeshStandardMaterial({
    vertexColors:true,flatShading:false,roughness:1,metalness:0,side:THREE.DoubleSide,
  }));
  cloudField.applyToMaterial(regionMaterial);
  applyAerialPerspective(regionMaterial,{valleyBoost:.62,sunWarmth:.22});
  applyRockSurface(regionMaterial);
  const peaks:THREE.Mesh[]=[];
  const forests:ReturnType<typeof buildMountainForest>[]=[];
  for(const [index,region] of (["mainland","east","north","south"] as const).entries()){
    const mesh=new THREE.Mesh(makeMass(k.scope,region,layouts[region]),regionMaterial);
    mesh.name="fjord-"+region;mesh.receiveShadow=false;mesh.castShadow=false;
    k.scene.add(mesh);peaks.push(mesh);
    forests.push(buildMountainForest(k,region,layouts[region],index,cloudField,mesh.geometry));
  }
  // A layered moving skydome uses a small procedural cloud shader, not hundreds
  // of translucent planes or an expensive volumetric march on mobile.
  const skyUniforms={
    ...cloudField.uniforms,
    uTime:{value:0},uCloudAmount:{value:1.0},uCloudDetailLevel:{value:1},
    uSunDirection:{value:liveSky.sunDir},
    uHorizon:{value:liveSky.horizon},
    uCloudLit:{value:liveSky.cloudLit},uCloudShade:{value:liveSky.cloudShade},
  };
  // Art-directed sky: a clear tropical day (reference: saturated blue overhead fading to pale aqua at the
  // horizon, crisp white cumulus). A physical Preetham sky reads pale and hazy and cannot be steered, so the
  // gradient is authored directly in linear light. The cloud sheet below supplies the clouds.
  const skyMaterial=k.scope.track(new THREE.ShaderMaterial({
    depthWrite:false,depthTest:false,side:THREE.BackSide,fog:false,
    uniforms:{
      uZenith:{value:liveSky.zenith},uMid:{value:liveSky.mid},uHorizon:{value:liveSky.horizon},
      uSunDirection:{value:liveSky.sunDir},uMoonDirection:{value:liveSky.moonDir},uSunColor:{value:liveSky.sunColor},
      uNight:liveSky.night,uMoonStrength:liveSky.moonStrength,
    },
    vertexShader:String.raw`varying vec3 vRay;
      void main(){vRay=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:String.raw`precision highp float;
      varying vec3 vRay;
      uniform vec3 uZenith;uniform vec3 uMid;uniform vec3 uHorizon;uniform vec3 uSunDirection;
      uniform vec3 uMoonDirection;uniform vec3 uSunColor;uniform float uNight;uniform float uMoonStrength;
      float h31(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float n3(vec3 p){
        vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
      void main(){
        vec3 ray=normalize(vRay);
        float h=clamp(ray.y,0.0,1.0);
        vec3 col=mix(uHorizon,uMid,smoothstep(0.0,.30,h));
        col=mix(col,uZenith,smoothstep(.22,.95,h));
        // Sun: warm haze tinted by the sun colour, corona and an HDR disc that feeds bloom and god rays.
        float s=max(0.0,dot(ray,normalize(uSunDirection)));
        float sunUp=smoothstep(-.12,.10,uSunDirection.y);
        col=mix(col,uSunColor*.9,pow(s,3.0)*.55*sunUp);
        col+=uSunColor*(pow(s,22.0)*.5+pow(s,170.0)*2.0)*sunUp;
        col=mix(col,uSunColor*vec3(20.0,17.0,13.0),smoothstep(.99955,.99978,s)*sunUp*smoothstep(-.02,.03,ray.y));
        // Moon: cool disc with soft maria and a faint halo.
        vec3 md=normalize(uMoonDirection);
        float m=max(0.0,dot(ray,md));
        float moonUp=smoothstep(-.10,.08,uMoonDirection.y);
        float disc=smoothstep(.99935,.99962,m);
        vec3 moonCol=vec3(.86,.92,1.05)*(.78+.22*n3(ray*55.0+vec3(3.0)));
        col+=vec3(.30,.38,.60)*(pow(m,48.0)*.35+pow(m,600.0)*.8)*uMoonStrength*moonUp;
        col=mix(col,moonCol*(2.4+1.6*uNight),disc*moonUp*smoothstep(-.02,.03,ray.y));
        gl_FragColor=vec4(col,1.0);
      }`,
  }));
  const skyDome=new THREE.Mesh(k.scope.track(new THREE.SphereGeometry(790,32,18)),skyMaterial);
  skyDome.name="sky-atmosphere";skyDome.renderOrder=-1000;
  k.scene.add(skyDome);
  // Stars: a fixed deterministic field on the upper hemisphere, visible only at night, twinkling slowly.
  const starCount=1400,starPositions=new Float32Array(starCount*3),starSeeds=new Float32Array(starCount);
  const starRand=(n:number)=>{const v=Math.sin(n*12.9898+78.233)*43758.5453;return v-Math.floor(v);};
  for(let i=0;i<starCount;i++){
    const theta=starRand(i*2.17)*Math.PI*2,cosPhi=.03+.97*starRand(i*5.31+9),sinPhi=Math.sqrt(1-cosPhi*cosPhi);
    starPositions.set([Math.cos(theta)*sinPhi*780,cosPhi*780,Math.sin(theta)*sinPhi*780],i*3);
    starSeeds[i]=starRand(i*7.7+3);
  }
  const starGeometry=k.scope.track(new THREE.BufferGeometry());
  starGeometry.setAttribute("position",new THREE.BufferAttribute(starPositions,3));
  starGeometry.setAttribute("aSeed",new THREE.BufferAttribute(starSeeds,1));
  const starMaterial=k.scope.track(new THREE.ShaderMaterial({
    // depthTest ON with the points pushed to the far plane: stars show only where nothing else was drawn, so they can
    // never shine through mountains, the church or houses.
    transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,fog:false,
    uniforms:{uAlpha:liveSky.starAlpha,uTime:skyUniforms.uTime},
    vertexShader:String.raw`attribute float aSeed;uniform float uTime;varying float vTwinkle;
      void main(){
        vTwinkle=.55+.45*sin(uTime*(1.2+aSeed*2.0)+aSeed*40.0);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
        gl_Position.z=gl_Position.w*.99999;
        gl_PointSize=1.0+aSeed*2.2;
      }`,
    fragmentShader:String.raw`precision highp float;uniform float uAlpha;varying float vTwinkle;
      void main(){
        float d=smoothstep(.5,.0,length(gl_PointCoord-.5));
        gl_FragColor=vec4(vec3(.75,.85,1.0)*d*vTwinkle*uAlpha*1.6,1.0);
      }`,
  }));
  const stars=new THREE.Points(starGeometry,starMaterial);
  stars.name="sky-stars";stars.renderOrder=-998;stars.frustumCulled=false;
  k.scene.add(stars);
  const cloudShader=k.scope.track(new THREE.ShaderMaterial({
    uniforms:skyUniforms,depthWrite:false,depthTest:true,transparent:true,side:THREE.BackSide,fog:false,
    vertexShader:String.raw`varying vec3 vRay;
      void main(){
        vRay=position;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }`,
    fragmentShader:String.raw`precision highp float;
      varying vec3 vRay;
      uniform float uTime;
      uniform float uCloudAmount;
      uniform float uCloudDetailLevel;
      uniform sampler2D uCloudMap;
      uniform vec2 uCloudWind;
      uniform float uCloudSpan;
      uniform float uCloudHeight;
      uniform vec3 uSunDirection;
      uniform vec3 uHorizon;
      uniform vec3 uCloudLit;
      uniform vec3 uCloudShade;
      void main(){
        vec3 ray=normalize(vRay);
        vec3 sunDir=normalize(uSunDirection);
        float sun=max(0.0,dot(ray,sunDir));
        // Shared precomputed world-space cloud field: the same density drives
        // sky cover and projected mountain/ground shadow, with no second pass.
        // An upper cloud layer is sampled where the view ray reaches the sheet.
        // Never clamp the cloud-plane intersection over a visible horizon band.
        // The previous constant denominator floor produced vertical cloud columns.
        float reach=max(0.0,uCloudHeight-cameraPosition.y)/max(.035,ray.y);
        vec2 cloudUV=(cameraPosition.xz+ray.xz*reach+uCloudWind)/uCloudSpan;
        float low=texture2D(uCloudMap,cloudUV).r;
        float cumulus=smoothstep(.47,.63,low);
        float cirrus=smoothstep(.52,.71,
          texture2D(uCloudMap,cloudUV*2.1+vec2(.17,.39)).r)*.18;
        // VIPER-style optical integration, adapted for the mobile WebGL2
        // budget: one density layer on Basic, two on Balanced, three on High.
        // No high-cost 500-step volumetric march or separate cloud-shadow pass.
        float stacked=0.0;
        if(uCloudDetailLevel>0.5){
          float middle=texture2D(uCloudMap,cloudUV+ray.xz*.018+vec2(.013,-.019)).r;
          stacked+=smoothstep(.41,.59,middle)*.53;
          if(uCloudDetailLevel>1.5){
            float top=texture2D(uCloudMap,cloudUV-ray.xz*.024+vec2(-.028,.011)).r;
            stacked+=smoothstep(.43,.63,top)*.38;
          }
        }
        // Fade the sheet to physical aerial haze where rays graze the horizon.
        // Suppresses the column/curtain artifact in shot-04-vista-fjord.
        float mask=smoothstep(.075,.205,ray.y)*(1.0-smoothstep(.86,.98,ray.y));
        float opticalDepth=(1.68*cumulus+stacked+.62*cirrus)*mask*uCloudAmount;
        float amount=clamp(1.0-exp(-opticalDepth),0.0,.96);
        // Cloud edge self-shading: sample the same cloud field in sunlight's
        // projected direction. Bright rims stay local instead of whitewashing sky.
        vec3 underside=uCloudShade,lit=uCloudLit;
        float leading=texture2D(uCloudMap,cloudUV+sunDir.xz*.016).r;
        float sideLight=clamp(.53+(low-leading)*6.2,0.0,1.0);
        float silver=pow(sun,16.0)*smoothstep(.43,.57,low)*
          (1.0-smoothstep(.63,.78,low));
        vec3 cloud=mix(underside,lit,clamp(.28+.50*sideLight+.22*sun,0.0,1.0));
        cloud+=vec3(.35,.24,.13)*silver;
        cloud*=mix(vec3(1.0),vec3(1.30,1.0,.74),pow(sun,3.0)); // sunward clouds glow warm
        cloud=mix(uHorizon,cloud,clamp(.34+ray.y*2.8,0.0,1.0));
        // Transparent cloud sheet rendered over the physical atmosphere;
        // shared cloudMap controls both visible cover and mountain cloud shade.
        // Keep depth testing on, otherwise clouds paint over buildings.
        gl_FragColor=vec4(cloud,amount);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  const cloudDome=new THREE.Mesh(k.scope.track(new THREE.SphereGeometry(790,36,20)),cloudShader);
  cloudDome.name="sky-moving-cloud-sheet";
  cloudDome.renderOrder=-999;
  k.scene.add(cloudDome);
  function update(time:number){
    skyUniforms.uTime.value=time;
  }
  function setSkyQuality(quality:"basic"|"balanced"|"high"){
    skyUniforms.uCloudDetailLevel.value=quality==="high"?2:quality==="balanced"?1:0;
  }
  return {peaks,forests,sky:skyDome,clouds:cloudDome,update,setSkyQuality};
}
