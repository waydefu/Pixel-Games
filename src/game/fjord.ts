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
    uTwilight:liveSky.twilight,uNightC:liveSky.night,uWeatherDark:liveSky.weatherDark,uWeatherFlash:liveSky.weatherFlash,uSunColor:{value:liveSky.sunColor},
  };
  // Art-directed sky: a clear tropical day (reference: saturated blue overhead fading to pale aqua at the
  // horizon, crisp white cumulus). A physical Preetham sky reads pale and hazy and cannot be steered, so the
  // gradient is authored directly in linear light. The cloud sheet below supplies the clouds.
  const skyMaterial=k.scope.track(new THREE.ShaderMaterial({
    depthWrite:false,depthTest:false,side:THREE.BackSide,fog:false,
    uniforms:{
      uZenith:{value:liveSky.zenith},uMid:{value:liveSky.mid},uHorizon:{value:liveSky.horizon},
      uSunDirection:{value:liveSky.sunDir},uMoonDirection:{value:liveSky.moonDir},uSunColor:{value:liveSky.sunColor},
      uNight:liveSky.night,uMoonStrength:liveSky.moonStrength,uTwilight:liveSky.twilight,uStarAlpha:liveSky.starAlpha,
      uMoonPhase:liveSky.moonPhase,uSkyHour:liveSky.skyHour,uTime:skyUniforms.uTime,uSkyDetail:skyUniforms.uCloudDetailLevel,uWeatherDark:liveSky.weatherDark,uWeatherFlash:liveSky.weatherFlash,
    },
    vertexShader:String.raw`varying vec3 vRay;
      void main(){vRay=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:String.raw`precision highp float;
      varying vec3 vRay;
      uniform vec3 uZenith;uniform vec3 uMid;uniform vec3 uHorizon;uniform vec3 uSunDirection;
      uniform vec3 uMoonDirection;uniform vec3 uSunColor;uniform float uNight;uniform float uMoonStrength;
      uniform float uTwilight;uniform float uStarAlpha;uniform float uMoonPhase;uniform float uSkyHour;uniform float uTime;uniform float uSkyDetail;uniform float uWeatherDark;uniform float uWeatherFlash;
      float h31(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float n3(vec3 p){
        vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
      float fbm3(vec3 p){return .5*n3(p)+.27*n3(p*2.03+vec3(1.7,9.2,3.1))+.15*n3(p*4.1+vec3(5.3,1.1,7.7))+.08*n3(p*8.3+vec3(2.2,6.4,4.0));}
      void main(){
        vec3 ray=normalize(vRay);
        float h=clamp(ray.y,0.0,1.0);
        // Rayleigh-like: a pale hazy horizon that deepens slowly toward a darker zenith (as in the three.js Sky example).
        vec3 col=mix(uHorizon,uMid,smoothstep(0.0,.40,pow(h,.8)));
        col=mix(col,uZenith,smoothstep(.28,1.0,pow(h,.85)));
        // ---- twilight: the sun-side glow, and opposite it the belt of Venus rising over the Earth's blue shadow ----
        vec2 sf=normalize(uSunDirection.xz+vec2(1e-5)),rf=normalize(ray.xz+vec2(1e-5));
        float toward=dot(rf,sf),away=max(0.0,-toward),yy=max(ray.y,0.0);
        col+=uSunColor*vec3(1.0,.50,.24)*pow(max(toward,0.0),2.0)*exp(-yy*7.0)*uTwilight*.9;
        float wAnti=smoothstep(.15,1.0,away)*uTwilight;
        col=mix(col,vec3(.03,.045,.12),(1.0-smoothstep(.015,.075,yy))*wAnti*.8*step(0.0,ray.y));
        col=mix(col,vec3(.90,.36,.38)*.95,smoothstep(.03,.085,yy)*(1.0-smoothstep(.13,.36,yy))*wAnti*.62);
        // weather: a heavy sky is darker and greyer, and a lightning flash lights it from within
        col=mix(col,vec3(dot(col,vec3(.2126,.7152,.0722)))*.40,uWeatherDark*.92);
        col+=vec3(.55,.62,.9)*uWeatherFlash*(.45+.55*n3(ray*3.0+vec3(uTime*.0)))*smoothstep(.0,.5,ray.y+.1);
        // Sun: warm haze tinted by the sun colour, corona and an HDR disc that feeds bloom and god rays.
        float s=max(0.0,dot(ray,normalize(uSunDirection)));
        float sunUp=smoothstep(-.12,.10,uSunDirection.y)*(1.0-.85*uWeatherDark);
        col=mix(col,uSunColor*.9,pow(s,3.0)*.55*sunUp);
        col+=uSunColor*(pow(s,22.0)*.5+pow(s,170.0)*2.0)*sunUp;
        col=mix(col,uSunColor*vec3(20.0,17.0,13.0),smoothstep(.99955,.99978,s)*sunUp*smoothstep(-.02,.03,ray.y));
        // ---- night: the Milky Way (blue arms, dark dust lanes, a warm core), dense coloured stars ----
        if(uStarAlpha>.01){
          float ang=uSkyHour/24.0*6.2831853,ca=cos(ang),sa=sin(ang);
          vec3 q=vec3(ca*ray.x-sa*ray.z,ray.y,sa*ray.x+ca*ray.z);                  // the sky turns slowly through the night
          vec3 G=normalize(vec3(.30,.78,.55));                                      // normal of the galactic plane
          vec3 E1=normalize(cross(G,vec3(0.0,1.0,.2))),E2=cross(G,E1);
          float b=dot(q,G),l=atan(dot(q,E2),dot(q,E1));
          float band=exp(-b*b/(2.0*.14*.14));
          float coreAng=abs(atan(sin(l-.6),cos(l-.6)));
          float core=exp(-coreAng*coreAng/(2.0*.75*.75))*exp(-b*b/(2.0*.11*.11));
          vec3 qw=uSkyDetail>1.5?q+.12*vec3(fbm3(q*3.0),fbm3(q*3.0+vec3(5.0)),fbm3(q*3.0+vec3(9.0))):q;   // domain warp: wispy arms
          float cloudy=fbm3(qw*5.0),fine=fbm3(qw*19.0+vec3(3.0));
          float dust=smoothstep(.44,.66,fbm3(qw*7.0+vec3(8.0,1.0,2.0)+vec3(0.0,b*6.0,0.0)))+.5*smoothstep(.55,.75,fbm3(qw*21.0+vec3(2.0)))*band;
          dust=min(dust,1.0);
          float density=band*(.30+1.1*cloudy)*(.7+.6*fine)*(1.0-.82*dust*smoothstep(.1,.9,band));
          vec3 mw=mix(vec3(.05,.09,.22),vec3(.11,.16,.36),cloudy)*density*1.9;
          mw+=vec3(1.0,.58,.22)*core*(.35+.9*fine)*(1.0-.7*dust)*.8;               // warm galactic core
          mw+=vec3(.30,.18,.45)*band*smoothstep(.6,.85,cloudy)*.18;                // violet nebulosity
          // Stars are small white points of a fixed size in pixels (about 1-2 px), many faint ones and few bright ones;
          // inside the Milky Way the faint ones pack together into its grain. No halos, no crosses.
          vec3 starSum=vec3(0.0);
          int kmax=uSkyDetail>1.5?3:uSkyDetail>.5?2:1;
          for(int k=0;k<3;k++){
            if(k>=kmax)break;
            float scale=k==0?420.0:k==1?170.0:64.0;
            float rad=(k==0?.0011:k==1?.0015:.0021)*scale;                               // star radius in cell units
            vec3 sp=q*scale;vec3 cell=floor(sp);
            float hs=h31(cell+vec3(float(k)*13.0)),hs2=h31(cell+vec3(7.1,3.3,1.9)+float(k));
            vec3 centre=cell+vec3(.34+.32*h31(cell+vec3(1.0)),.34+.32*h31(cell+vec3(2.0)),.34+.32*h31(cell+vec3(3.0)));
            float thresh=k==0?.915-.16*band:k==1?.955-.03*band:.990;
            float dd=length(sp-centre);
            float mag=pow(hs2,k==0?5.0:k==1?3.0:1.5);                                    // power-law magnitudes
            float dot_=smoothstep(rad,rad*.25,dd);
            float soft=k==2?smoothstep(rad*2.2,rad*.5,dd)*.25:0.0;                      // only the brightest get a faint skirt
            vec3 tint=mix(vec3(.80,.88,1.0),vec3(1.0,.95,.88),smoothstep(.3,.7,h31(cell+vec3(4.0))));
            tint=mix(tint,vec3(1.0,.78,.60),smoothstep(.9,1.0,h31(cell+vec3(4.0)))*.6); // a few warm stars
            float tw=.88+.12*sin(uTime*(2.0+hs*5.0)+hs*40.0);
            starSum+=tint*step(thresh,hs)*(dot_+soft)*(k==0?.30+1.2*mag:k==1?.55+1.6*mag:1.2+1.8*mag)*tw;
          }
          // a few steady planets (Venus bright and white, Jupiter cream, Mars red) on a faint ecliptic
          starSum+=vec3(1.0,.97,.88)*(pow(max(dot(q,normalize(vec3(.50,.55,-.67))),0.0),60000.0)*4.0);
          starSum+=vec3(1.0,.88,.66)*(pow(max(dot(q,normalize(vec3(-.55,.62,.56))),0.0),60000.0)*2.4);
          starSum+=vec3(1.0,.42,.28)*(pow(max(dot(q,normalize(vec3(-.12,.45,.88))),0.0),60000.0)*1.6);
                    // an occasional meteor: a bright head with a fading tail, a few seconds apart
          float mt=uTime*.17,mi=floor(mt),mf=fract(mt);
          float seed=h31(vec3(mi,3.7,1.3));
          if(seed>.55&&uSkyDetail>1.5){
            vec3 mstart=normalize(vec3(seed*2.0-1.0,.6+.3*h31(vec3(mi,9.0,2.0)),h31(vec3(mi,5.0,8.0))*2.0-1.0));
            vec3 mdir=normalize(cross(mstart,vec3(0.0,1.0,0.3))+vec3(0.0,-.4,0.0));
            vec3 mpos=normalize(mstart+mdir*mf*.35);
            float close=1.0-dot(ray,mpos);
            float head=smoothstep(.00004,.0,close);
            starSum+=vec3(.9,.95,1.0)*head*3.0*smoothstep(.0,.08,mf)*(1.0-smoothstep(.55,.62,mf));
          }
          float horizonFade=smoothstep(.0,.16,ray.y);
          col+=(mw*.85+starSum*1.7)*uStarAlpha*horizonFade;
          col+=vec3(.16,.06,.03)*exp(-max(ray.y,0.0)*12.0)*uStarAlpha*.22;          // faint warm glow low on the horizon
        }
        // ---- the moon: a lit disc with phase, maria, earthshine and a faint halo ----
        vec3 md=normalize(uMoonDirection);
        float m=max(0.0,dot(ray,md));
        float moonUp=smoothstep(-.10,.08,uMoonDirection.y);
        float lum=.5-.5*cos(uMoonPhase*6.2831853);
        col+=vec3(.30,.38,.60)*(pow(m,48.0)*.35*lum+pow(m,600.0)*.8*lum)*uMoonStrength*moonUp;
        float cosR=.99905;                                                         // an artistically large disc (~2.5 deg)
        if(m>cosR&&moonUp>.001){
          vec3 Tm=normalize(cross(md,vec3(0.0,1.0,0.0))),Bm=cross(Tm,md);
          vec2 pq=vec2(dot(ray,Tm),dot(ray,Bm))/sqrt(1.0-cosR*cosR);               // -1..1 across the disc
          float r2=dot(pq,pq);
          vec3 nrm=vec3(pq,sqrt(max(0.0,1.0-r2)));
          float al=uMoonPhase*6.2831853;
          vec3 L=vec3(sin(al),0.0,-cos(al));                                       // waxing: lit on the right
          float lit=smoothstep(-.03,.05,dot(nrm,L));
          float maria=smoothstep(.45,.62,fbm3(nrm*2.6+vec3(4.0)));
          vec3 surf=vec3(.90,.93,1.0)*(1.0-.38*maria)*(.9+.1*n3(nrm*30.0));
          float edge=smoothstep(1.0,.94,r2);
          float vis=moonUp*smoothstep(-.02,.03,ray.y);
          col=mix(col,surf*(2.4+1.6*uNight),edge*lit*vis);                       // only the lit part is opaque ...
          col+=surf*.07*edge*(1.0-lit)*vis*uNight;                               // ... the dark side is sky with a trace of earthshine
        }
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
        gl_PointSize=1.0+aSeed*1.1;
      }`,
    fragmentShader:String.raw`precision highp float;uniform float uAlpha;varying float vTwinkle;
      void main(){
        float d=smoothstep(.5,.15,1.0-length(gl_PointCoord-.5)*2.0+.5)*smoothstep(.5,.1,length(gl_PointCoord-.5));
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
      uniform float uTwilight;
      uniform float uNightC;
      uniform float uCloudBias;
      uniform float uWeatherDark;
      uniform float uWeatherFlash;
      uniform vec3 uSunColor;
      float h31(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float n3(vec3 p){
        vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
      void main(){
        vec3 ray=normalize(vRay);
        vec3 sunDir=normalize(uSunDirection);
        vec2 sf=normalize(sunDir.xz+vec2(1e-5)),rf=normalize(ray.xz+vec2(1e-5));
        float toward=dot(rf,sf),away=max(0.0,-toward);
        float sun=max(0.0,dot(ray,sunDir));
        // Shared precomputed world-space cloud field: the same density drives
        // sky cover and projected mountain/ground shadow, with no second pass.
        // An upper cloud layer is sampled where the view ray reaches the sheet.
        // Never clamp the cloud-plane intersection over a visible horizon band.
        // The previous constant denominator floor produced vertical cloud columns.
        float reach=max(0.0,uCloudHeight-cameraPosition.y)/max(.035,ray.y);
        vec2 cloudUV=(cameraPosition.xz+ray.xz*reach+uCloudWind)/uCloudSpan;
        float low=texture2D(uCloudMap,cloudUV).r;
        float cumulus=smoothstep(.47-uCloudBias,.63-uCloudBias,low);
        float cirrus=smoothstep(.52,.71,
          texture2D(uCloudMap,cloudUV*2.1+vec2(.17,.39)).r)*.18;
        // VIPER-style optical integration, adapted for the mobile WebGL2
        // budget: one density layer on Basic, two on Balanced, three on High.
        // No high-cost 500-step volumetric march or separate cloud-shadow pass.
        float stacked=0.0;
        if(uCloudDetailLevel>0.5){
          float middle=texture2D(uCloudMap,cloudUV+ray.xz*.018+vec2(.013,-.019)).r;
          stacked+=smoothstep(.41-uCloudBias,.59-uCloudBias,middle)*.53;
          if(uCloudDetailLevel>1.5){
            float top=texture2D(uCloudMap,cloudUV-ray.xz*.024+vec2(-.028,.011)).r;
            stacked+=smoothstep(.43-uCloudBias,.63-uCloudBias,top)*.38;
          }
        }
        // Fade the sheet to physical aerial haze where rays graze the horizon.
        // Suppresses the column/curtain artifact in shot-04-vista-fjord.
        float mask=smoothstep(.04,.17,ray.y)*(1.0-smoothstep(.86,.98,ray.y));
        float opticalDepth=(1.68*cumulus+stacked+.62*cirrus)*mask*uCloudAmount*(1.0-.97*uNightC);
        float amount=clamp(1.0-exp(-opticalDepth),0.0,.96);
        // Cloud edge self-shading: sample the same cloud field in sunlight's
        // projected direction. Bright rims stay local instead of whitewashing sky.
        vec3 underside=uCloudShade,lit=uCloudLit;
        // Solid volume from the height field: bumps give a surface normal, and a short march toward the sun accumulates
        // the cloud's own optical depth (Beer-Lambert), so thick clouds have dark, self-shadowed bases and lit crowns.
        vec2 sdir=normalize(sunDir.xz+vec2(1e-4))*mix(.020,.007,clamp(sunDir.y*2.0,0.0,1.0));
        float tau=0.0;
        int marchSteps=uCloudDetailLevel>1.5?5:uCloudDetailLevel>.5?2:0;   // the self-shadow march is a High-quality feature
        for(int i=1;i<=5;i++){
          if(i>marchSteps)break;
          float d=texture2D(uCloudMap,cloudUV+sdir*float(i)).r;
          tau+=smoothstep(.44,.62,d)*(1.0+.35*float(i));
        }
        float shadowed=marchSteps>0?exp(-tau*(uCloudDetailLevel>1.5?.34:.6)):.7;
        float gx=texture2D(uCloudMap,cloudUV+vec2(.006,0.0)).r-texture2D(uCloudMap,cloudUV-vec2(.006,0.0)).r;
        float gy=texture2D(uCloudMap,cloudUV+vec2(0.0,.006)).r-texture2D(uCloudMap,cloudUV-vec2(0.0,.006)).r;
        vec3 bump=normalize(vec3(-gx*9.0,1.0,-gy*9.0));
        float lambert=clamp(dot(bump,normalize(vec3(sunDir.x,max(sunDir.y,.15)+.25,sunDir.z)))*.5+.55,0.0,1.0);
        float sideLight=clamp(lambert*.55+shadowed*.45,0.0,1.0);
        float thick=smoothstep(.52,.88,low);
        // ---- HIGH: real volumetric clouds. A ray marched through a slab 1.7-4.3 km up: the shared coverage map shapes the
        // cloud field (so ground shadows and sun occlusion stay consistent), a height profile gives flat bases and billowing
        // tops, 3D noise erodes the edges, and each sample is lit by marching toward the sun (Beer-Lambert). Clouds have depth,
        // parallax and real volume; they thicken, rise into towers and darken with the weather. ----
        if(uCloudDetailLevel>1.5&&ray.y>.03&&uNightC<.97){
          const float BASE=1700.0,TOP=4300.0;
          float t0=(BASE-cameraPosition.y)/ray.y,t1=min((TOP-cameraPosition.y)/ray.y,t0+16000.0);
          float stepLen=(t1-t0)/28.0;
          float jitter=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
          float T=1.0,lightSum=0.0,weight=0.0,densSum=0.0;
          vec3 sd=normalize(vec3(sunDir.x,max(sunDir.y,.12),sunDir.z));
          for(int i=0;i<28;i++){
            if(T<.03)break;
            vec3 p=cameraPosition+ray*(t0+(float(i)+jitter)*stepLen);
            float hgt=clamp((p.y-BASE)/(TOP-BASE),0.0,1.0);
            vec2 cuv=p.xz/(uCloudSpan*34.0)+uCloudWind/uCloudSpan;
            float cover=texture2D(uCloudMap,cuv).r;
            float shape=smoothstep(.40-uCloudBias,.64-uCloudBias,cover);
            float topH=.30+.70*smoothstep(.45,.85,cover);
            float prof=smoothstep(.0,.10,hgt)*(1.0-smoothstep(topH*.55,topH,hgt));
            float dens=shape*prof;
            if(dens>.01){
              vec3 q=p*.0017+vec3(uCloudWind.x*.9,0.0,uCloudWind.y*.9)*.5;
              float detail=.62*n3(q)+.38*n3(q*2.9+vec3(3.1));
              dens=clamp(dens-(1.0-detail)*.72*(1.0-.45*prof),0.0,1.0);
            }
            if(dens>.012){
              // light: march toward the sun through the coverage field
              float tauL=0.0;
              for(int k=1;k<=3;k++){
                vec3 pl=p+sd*(float(k)*420.0);
                float hl=clamp((pl.y-BASE)/(TOP-BASE),0.0,1.0);
                float cl=texture2D(uCloudMap,pl.xz/(uCloudSpan*34.0)+uCloudWind/uCloudSpan).r;
                tauL+=smoothstep(.40-uCloudBias,.64-uCloudBias,cl)*smoothstep(.0,.1,hl)*(1.0-smoothstep(.55,.9,hl));
              }
              float lightHere=exp(-tauL*1.6)*(.42+.58*hgt)+.10*hgt;
              float sig=dens*stepLen*.00115*uCloudAmount;
              float a=1.0-exp(-sig);
              lightSum+=T*a*lightHere;densSum+=T*a*dens;weight+=T*a;
              T*=1.0-a;
            }
          }
          float cov=1.0-T;
          amount=clamp(cov,0.0,.97);
          if(weight>.001){
            float lit=lightSum/weight,dv=densSum/weight;
            shadowed=clamp(lit,0.0,1.0);sideLight=clamp(lit*.9+.08,0.0,1.0);
            low=mix(.50,.86,clamp(dv*1.3,0.0,1.0));thick=smoothstep(.52,.88,low);
          }
        }
        float silver=pow(sun,16.0)*smoothstep(.43,.57,low)*
          (1.0-smoothstep(.63,.78,low));
        vec3 cloud=mix(underside,lit,clamp(.10+.62*sideLight+.22*sun,0.0,1.0));
        cloud*=1.0-.42*thick*(1.0-shadowed*.6);                                  // thick bodies are darker in the middle
        cloud+=vec3(.35,.24,.13)*silver;
        cloud*=mix(vec3(1.0),vec3(1.30,1.0,.74),pow(sun,3.0)); // sunward clouds glow warm
        // ---- sunrise / sunset: fiery undersides toward the sun, dark backlit bodies with burning rims, pink on the far side ----
        float tw=uTwilight;
        // Physics of twilight clouds: high cirrus / altocumulus catch the reddened light and keep it after the sun has set,
        // while low clouds near the horizon fall into shadow first. The colour walks yellow -> orange -> red -> magenta.
        float sy=sunDir.y;
        float highLit=smoothstep(.05,.30,ray.y);
        float afterSet=smoothstep(.0,-.10,sy);
        float glowMask=max(pow(max(toward,0.0),1.2)*(1.0-.6*smoothstep(.0,.75,ray.y)),afterSet*highLit*(.55+.45*max(toward,0.0)));
        vec3 fieryBase=mix(vec3(1.0,.55,.18),vec3(1.0,.16,.04),smoothstep(.13,-.02,sy));
        fieryBase=mix(fieryBase,vec3(.80,.14,.38),smoothstep(-.03,-.09,sy));
        fieryBase=mix(fieryBase,vec3(.38,.24,.80),smoothstep(-.09,-.16,sy));   // blue hour: violet-blue
        vec3 fiery=fieryBase*1.7;
        float thin=1.0-smoothstep(.47,.74,low);                                 // thin cloud edges
        float back=pow(sun,3.0);
        cloud=mix(cloud,mix(vec3(.10,.03,.14),fiery,.40+.60*sideLight),clamp(tw*(.55+.75*glowMask),0.0,1.0));
        cloud*=mix(1.0,.38,back*tw*(1.0-thin));
        cloud*=mix(1.0,.42,smoothstep(-.10,-.17,sy)*(1.0-highLit));                              // low clouds are in shadow once the sun is down                                  // backlit bodies go dark
        cloud+=fiery*thin*pow(sun,5.0)*tw*2.4+uSunColor*thin*pow(sun,2.0)*tw*.6;  // rims burn
        cloud=mix(cloud,vec3(.80,.38,.48)*(.55+.6*sideLight),away*tw*.35*(1.0-smoothstep(.0,.8,ray.y)));
        // heavy weather: slate-grey, darker bodies; lightning lights the cloud from inside
        float lumC=dot(cloud,vec3(.2126,.7152,.0722));
        cloud=mix(cloud,vec3(lumC)*vec3(.55,.60,.70),uWeatherDark*.95);
        cloud*=1.0-.72*uWeatherDark*(.45+.55*thick);
        cloud+=vec3(.7,.78,1.0)*uWeatherFlash*(.35+.65*smoothstep(.45,.9,low))*1.4;
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
  /** Weather: cloud coverage multiplier (optical depth) and the threshold bias come from the cloud field. */
  function setCloudAmount(v:number){skyUniforms.uCloudAmount.value=v;}
  function setSkyQuality(quality:"basic"|"balanced"|"high"){
    skyUniforms.uCloudDetailLevel.value=quality==="high"?2:quality==="balanced"?1:0;
  }
  return {peaks,forests,sky:skyDome,clouds:cloudDome,update,setSkyQuality,setCloudAmount};
}
