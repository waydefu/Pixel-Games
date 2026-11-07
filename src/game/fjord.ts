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
    uTwilight:liveSky.twilight,uNightC:liveSky.night,uSunColor:{value:liveSky.sunColor},
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
      uMoonPhase:liveSky.moonPhase,uSkyHour:liveSky.skyHour,uTime:skyUniforms.uTime,
    },
    vertexShader:String.raw`varying vec3 vRay;
      void main(){vRay=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:String.raw`precision highp float;
      varying vec3 vRay;
      uniform vec3 uZenith;uniform vec3 uMid;uniform vec3 uHorizon;uniform vec3 uSunDirection;
      uniform vec3 uMoonDirection;uniform vec3 uSunColor;uniform float uNight;uniform float uMoonStrength;
      uniform float uTwilight;uniform float uStarAlpha;uniform float uMoonPhase;uniform float uSkyHour;uniform float uTime;
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
        // Sun: warm haze tinted by the sun colour, corona and an HDR disc that feeds bloom and god rays.
        float s=max(0.0,dot(ray,normalize(uSunDirection)));
        float sunUp=smoothstep(-.12,.10,uSunDirection.y);
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
          float band=exp(-b*b/(2.0*.17*.17));
          float coreAng=abs(atan(sin(l-.6),cos(l-.6)));
          float core=exp(-coreAng*coreAng/(2.0*.75*.75))*exp(-b*b/(2.0*.11*.11));
          float cloudy=fbm3(q*5.0),fine=fbm3(q*17.0+vec3(3.0));
          float dust=smoothstep(.46,.68,fbm3(q*7.0+vec3(8.0,1.0,2.0)+vec3(0.0,b*6.0,0.0)));
          float density=band*(.35+.9*cloudy)*(1.0-.78*dust*smoothstep(.1,.9,band));
          vec3 mw=mix(vec3(.05,.09,.22),vec3(.11,.16,.36),cloudy)*density*1.9;
          mw+=vec3(.95,.52,.20)*core*(.30+.7*fine)*(1.0-.7*dust)*.55;               // warm galactic core
          mw+=vec3(.30,.18,.45)*band*smoothstep(.55,.8,cloudy)*.35;                // violet nebulosity
          // fine stars: a jittered 3D grid; denser inside the Milky Way
          vec3 sp=q*150.0;vec3 cell=floor(sp);
          float hs=h31(cell),hs2=h31(cell+vec3(7.1,3.3,1.9));
          vec3 centre=cell+vec3(.3+.4*h31(cell+vec3(1.0)),.3+.4*h31(cell+vec3(2.0)),.3+.4*h31(cell+vec3(3.0)));
          float thresh=.955-.10*band;
          float star=step(thresh,hs)*smoothstep(.34,.0,length(sp-centre))*(.25+2.2*pow(hs2,5.0));
          vec3 starCol=mix(vec3(.65,.80,1.0),vec3(1.0,.78,.55),smoothstep(.3,.9,h31(cell+vec3(4.0))));
          float tw=.8+.2*sin(uTime*(2.0+hs*5.0)+hs*40.0);
          float horizonFade=smoothstep(.0,.16,ray.y);
          col+=(mw*1.25+starCol*star*tw*1.6)*uStarAlpha*horizonFade;
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
          vec3 mcol=surf*(lit+.045);
          float edge=smoothstep(1.0,.94,r2);
          col=mix(col,mcol*(2.4+1.6*uNight),edge*moonUp*smoothstep(-.02,.03,ray.y));
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
      uniform float uTwilight;
      uniform float uNightC;
      uniform vec3 uSunColor;
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
        float mask=smoothstep(.04,.17,ray.y)*(1.0-smoothstep(.86,.98,ray.y));
        // long fibrous streaks (altocumulus / cirrus), strongest at twilight
        float streak=smoothstep(.50,.72,texture2D(uCloudMap,cloudUV*vec2(.42,2.4)+vec2(.07,.21)).r)*(.30+.55*uTwilight);
        float opticalDepth=(1.68*cumulus+stacked+.62*cirrus+streak)*mask*uCloudAmount*(1.0-.88*uNightC);
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
        // ---- sunrise / sunset: fiery undersides toward the sun, dark backlit bodies with burning rims, pink on the far side ----
        float tw=uTwilight;
        float glowMask=pow(max(toward,0.0),1.2)*(1.0-smoothstep(.0,.75,ray.y));
        vec3 fiery=vec3(1.0,.20,.05)*2.7;
        float thin=1.0-smoothstep(.47,.74,low);                                 // thin cloud edges
        float back=pow(sun,3.0);
        cloud=mix(cloud,mix(vec3(.10,.04,.16),fiery,.45+.5*sideLight),tw*(.30+.70*glowMask)*.95);
        cloud*=mix(1.0,.38,back*tw*(1.0-thin));                                  // backlit bodies go dark
        cloud+=fiery*thin*pow(sun,5.0)*tw*2.4+uSunColor*thin*pow(sun,2.0)*tw*.6;  // rims burn
        cloud=mix(cloud,vec3(.80,.38,.48)*(.55+.6*sideLight),away*tw*.35*(1.0-smoothstep(.0,.8,ray.y)));
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
