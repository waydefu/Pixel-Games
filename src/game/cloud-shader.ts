/**
 * The cloud sheet's GLSL: ten genera drawn as 2D layers on planes at different heights (parallax), low to high.
 *
 * What the forms are built from, and why (the failure modes were met in this project's own screenshots):
 *  - ONE smooth value-noise lattice read (`vn`), no cellular/Worley grids: a thresholded grid shows its squares.
 *    Lattices are turned against each other (15 and 60 degrees) so the squares never line up.
 *  - A noise field cut at a single threshold meanders into sheets and fingers, and perspective draws every finger out
 *    toward the vanishing point as a streak. Cumulus is therefore part field, part a set of separate lumps (`cuLump`),
 *    read on the field's own warped plane, so each lump stands as its own cloud with blue between.
 *  - Shading is a difference of the density against a copy shifted toward the sun: the sun-facing side brightens and
 *    the far side darkens (one extra read). Direct light is the sun's own colour, shadow is blue sky light, a high
 *    layer keeps the sun after a low one has lost it.
 *  - Every read fades to its mean as a pixel's footprint reaches it (no mip chain), so nothing sparkles near the horizon.
 * The approach follows takustaqu/atmosphere (MIT; see docs/ASSET-CREDITS.md); the code is written for this project.
 */
export const CLOUD_VERT=String.raw`varying vec3 vRay;
void main(){
  vRay=position;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`;

export const CLOUD_FRAG=String.raw`precision highp float;
varying vec3 vRay;
uniform float uTime;
uniform float uCloudAmount;
uniform float uCloudDetailLevel;
uniform vec2 uCloudWind;
uniform sampler2D uNoise;
uniform float uGen[10];
uniform float uOnly;
uniform vec3 uSunDirection;
uniform vec3 uHorizon;
uniform vec3 uZenith;
uniform vec3 uMid;
uniform vec3 uSunColor;
uniform float uTwilight;
uniform float uNightC;
uniform float uWeatherDark;
uniform float uWeatherFlash;

const float NS=128.0;
const mat2 R15=mat2(0.966,0.259,-0.259,0.966);
const mat2 R60=mat2(0.5,0.866,-0.866,0.5);
const mat2 R40=mat2(0.766,-0.643,0.643,0.766);

// smooth value noise, one fetch: the bilinear filter blends the four corners with a smoothstepped weight
float vn(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return texture2D(uNoise,(i+0.5+f)/NS).r;
}
// fractal sum of n octaves; an octave finer than the pixel footprint fades to its mean
float fbmF(vec2 p,int n,float fw){
  float s=0.0,a=0.5,w=0.0,fq=fw;
  for(int i=0;i<5;i++){
    if(i>=n)break;
    s+=a*mix(vn(p),0.5,smoothstep(0.25,0.8,fq));
    w+=a;p=p*2.03+vec2(17.3,9.1);a*=0.5;fq*=2.03;
  }
  return s/w;
}

// ---- forms. Each returns x = density 0..1, y = lit-ness -1..1 (+1 faces the sun), z = thickness 0..1 ----

// Cumulus: separate lumps standing on a warped plane, shaded by the field's slope toward the sun
vec3 cumulusForm(vec2 uv,float fw,float cov,vec2 ldir,int Q){
  float ev=uTime*0.0035;
  int wo=Q>=2?3:2;
  vec2 q=uv+0.5*(vec2(fbmF(uv*1.6+ev,wo,fw*1.6),fbmF(uv*1.6-ev*0.8+7.0,wo,fw*1.6))-0.5);
  float lump=0.28+smoothstep(0.35,0.80,vn(R15*q*0.9+31.7))*0.85;
  float base=fbmF(q,Q>=1?4:3,fw);
  float det=Q>=1?fbmF(q*4.6+17.0+vec2(ev*0.33,-ev*0.21),Q>=2?4:3,fw*4.6):0.5;
  float field=(base*0.54+det*0.46-0.5)*2.2+0.5;
  float d=mix(field,lump,0.45);
  float edge=mix(0.84,0.52,cov);
  float den=smoothstep(edge-0.01,edge+0.07,d);
  if(den<=0.0)return vec3(0.0);
  float lit=0.0;
  if(Q>=1){
    vec2 ql=q+ldir*0.16;
    float lumpL=0.28+smoothstep(0.35,0.80,vn(R15*ql*0.9+31.7))*0.85;
    float baseL=fbmF(ql,Q>=2?4:3,fw);
    float dl=mix((baseL*0.54+det*0.46-0.5)*2.2+0.5,lumpL,0.45);
    lit=clamp((d-dl)*5.5,-1.0,1.0);
  }
  return vec3(den,lit,smoothstep(edge,edge+0.38,d));
}

// Granular (stratocumulus): rolls and mottled masses. One octave cut narrowly: one grain size, irregularly placed
vec3 granularForm(vec2 uv,float fw,float pack,float roll,float flockiness,vec2 ldir,int Q){
  float ev=uTime*0.0035;
  vec2 q=uv*vec2(1.0,roll)+0.7*vec2(vn(uv*0.22+ev*0.2),vn(uv*0.22+17.0-ev*0.16));
  float n=vn(R15*q)*0.72+vn(R60*q*2.1+5.0)*0.28;
  float fineN=Q>=1?fbmF(q*5.0,Q>=2?3:2,fw*5.0):0.47;
  n+=(fineN-0.47)*0.17;
  float e0=0.62-pack*0.24;
  float cell=smoothstep(e0,e0+0.11,n);
  if(cell<=0.0)return vec3(0.0);
  float f=fbmF(uv*0.16+21.0,3,fw*0.16);
  cell*=smoothstep(mix(0.34,0.02,flockiness),mix(0.68,0.38,flockiness),f);
  if(cell<=0.0)return vec3(0.0);
  float lit=0.0;
  if(Q>=1){
    vec2 ql=q+ldir*0.35;
    float nl=vn(R15*ql)*0.72+vn(R60*ql*2.1+5.0)*0.28;
    lit=clamp((n-nl)*4.0+(fineN-0.47)*1.8,-1.0,1.0);
  }
  return vec3(cell,lit,cell);
}

// Flocks (cirrocumulus, altocumulus): many small soft cloudlets gathered in patches, thinning and parting at the margin
vec3 flockForm(vec2 uv,float fw,float grain,float flock,float amt,vec2 ldir,int Q){
  float foot=fw*0.8;
  float c=smoothstep(0.0,0.75,amt);
  vec2 fq=uv*flock+21.0;
  float n0=vn(fq);fq=fq*2.03+vec2(17.3,9.1);
  float n1=vn(fq);fq=fq*2.03+vec2(17.3,9.1);
  float hf=1.0-smoothstep(0.25,0.8,foot*flock*4.12);
  float n2=hf>0.0?mix(0.5,vn(fq),hf):0.5;
  float T=smoothstep(mix(0.40,0.25,c),mix(0.70,0.55,c),n0*0.5+n1*0.25+n2*0.1875);
  if(T<=0.0)return vec3(0.0);
  float k=T*smoothstep(0.0,0.25,T);
  vec2 q=(uv+0.7*vec2(vn(uv*0.22+3.0),vn(uv*0.22+19.0)))*grain;
  float px=foot*grain;
  float h0=1.0-smoothstep(0.25,0.80,px);
  float h1=1.0-smoothstep(0.12,0.32,px*2.3);
  float g=0.5,g0=0.5;
  vec2 q0=R15*q;
  if(h0>0.0){g0=vn(q0);g+=(g0-0.5+vn(R60*q*1.13+5.0)-0.5)*0.36*h0;}
  if(h1>0.0)g+=(vn(R40*q*2.3+9.0)-0.5)*0.24*h1;
  float th=mix(0.64,0.38,T)-c*0.06+(n2-0.5)*0.20;
  float s=(1.0-h0)*0.20;
  float puff=smoothstep(th-s,th+0.40+min(px*1.6,0.3)+s,g);
  float veil=(0.16+0.18*c)*T;
  float a=k*(veil+(1.0-veil)*puff);
  float lit=0.0;
  if(Q>=1&&h0>0.0)lit=clamp((g0-vn(q0+ldir*0.5))*1.6*h0,-1.0,1.0);
  return vec3(a,lit,puff*k);
}

// Stratiform (cirrostratus, altostratus, nimbostratus, stratus): sheets. x coverage, y thickness
vec2 stratiform(vec2 uv,float fw,float breakup,float turb){
  vec2 q=uv+vec2(uTime*0.0005,0.0);
  float d;
  if(turb>0.001){
    q+=turb*1.15*vec2(fbmF(uv*0.60+uTime*0.0012,3,fw*0.6),fbmF(uv*0.60+9.0-uTime*0.001,3,fw*0.6));
    float n=fbmF(q,4,fw);
    d=mix(n,n*0.66+fbmF(q*2.7+11.0,3,fw*2.7)*0.34,turb);
  }else d=fbmF(q,4,fw);
  return vec2(mix(1.0,smoothstep(0.34,0.70,d),breakup),smoothstep(0.34,0.68,d));
}

// Filament (cirrus): strokes drawn out along the wind, bent by a slow noise, sparse
float filament(vec2 uv,float fw){
  float bend=fbmF(uv*vec2(0.30,0.85),3,fw)-0.5;
  vec2 q=uv+vec2(0.0,bend*1.5);
  float f=smoothstep(0.46,0.76,fbmF(q*vec2(0.30,3.2),4,fw*3.2));
  float sparse=smoothstep(0.32,0.62,fbmF(uv*0.20+13.0,3,fw*0.2));
  return f*sparse;
}

// ---- light ----
vec3 gAmb,gDirect,gBounce;
float gSunEl,gTw,gDay,gSun,gDiffuse;

// colour of one cloud: lit by the sun's colour on the sun-facing side, by blue sky light in shade; a high layer
// keeps the sun after a low one has lost it (alt01: 0 low .. 1 high); rimK burns the thin margin toward the sun
vec3 paintCloud(float lit,float thick,float alt01,float rimK){
  float sunUp=smoothstep(-0.035-0.07*alt01,0.015-0.015*alt01,gSunEl);
  vec3 glow=vec3(0.26,0.12,0.07)*gTw*(1.0-gDay)*(1.0-sunUp*0.7);     // the afterglow once the direct sun is gone
  float litE=clamp(0.5+0.5*lit,0.0,1.0);
  vec3 sunC=gDirect*sunUp;
  vec3 litCol=gAmb*(0.40+0.60*(1.0-litE))+glow+sunC*(0.42+0.55*litE);
  vec3 shadeCol=((gAmb+glow)*vec3(0.50,0.54,0.64)+vec3(0.02,0.03,0.05))*(1.0-0.42*gTw)+gBounce;
  float sh=thick*(0.80-gDiffuse*0.36)+(1.0-litE)*0.42*(1.0-gDiffuse*0.6);
  vec3 c=mix(litCol,shadeCol,clamp(sh,0.0,0.85));
  c+=sunC*(1.0-thick)*pow(gSun,4.0)*rimK*litE*1.6;
  return c;
}

bool shown(int i){return uOnly<0.0||abs(uOnly-float(i))<0.5;}

void main(){
  vec3 ray=normalize(vRay);
  vec3 sunDir=normalize(uSunDirection);
  float cs=dot(ray,sunDir);
  gSun=max(0.0,cs);
  float sy=sunDir.y;
  gSunEl=sy;gTw=uTwilight;
  float mask=smoothstep(0.04,0.17,ray.y)*(1.0-smoothstep(0.86,0.98,ray.y))*(1.0-0.97*uNightC);
  vec2 sf=normalize(sunDir.xz+vec2(1e-5)),rf=normalize(ray.xz+vec2(1e-5));
  float toward=dot(rf,sf);

  // direct light is the sun's colour (the fiery walk at twilight); shadow is sky light: zenith blue and the violet band
  vec3 fieryBase=mix(vec3(1.0,0.55,0.18),vec3(1.0,0.16,0.04),smoothstep(0.13,-0.02,sy));
  fieryBase=mix(fieryBase,vec3(0.80,0.14,0.38),smoothstep(-0.03,-0.09,sy));
  fieryBase=mix(fieryBase,vec3(0.38,0.24,0.80),smoothstep(-0.09,-0.16,sy));
  vec3 fiery=fieryBase*1.7;
  gDirect=mix(uSunColor*2.2,fiery*2.7,clamp(uTwilight*1.3,0.0,1.0));
  vec3 skyAmb=mix(uZenith,uMid,0.55)*0.72;
  float amL=dot(skyAmb,vec3(0.2126,0.7152,0.0722));
  gAmb=mix(vec3(amL),skyAmb,0.85)+vec3(0.014,0.018,0.030);
  gDay=smoothstep(0.06,0.5,sy);
  gAmb=mix(gAmb,vec3(0.55,0.62,0.78),gDay*0.55);                       // by day the shaded side is bright, not dark
  gBounce=fiery*0.16*uTwilight*pow(max(toward,0.0),1.5)*(1.0-0.6*smoothstep(0.0,0.8,ray.y));
  gDiffuse=clamp(uGen[3]+uGen[5]+uGen[6]*0.5,0.0,1.0);                  // overcast decks flatten the light

  int Q=uCloudDetailLevel>1.5?2:(uCloudDetailLevel>0.5?1:0);
  vec2 ldir=normalize(sunDir.xz+vec2(1e-4));
  vec2 plane=ray.xz/max(ray.y,0.035);              // where the ray meets a plane at unit height; scaled per layer
  vec2 wind=uCloudWind*0.02;                       // the same shift on every plane: lower (smaller-scaled) layers move faster
  vec3 col=vec3(0.0);float T=1.0,thickAcc=0.0;

  // Layers run low -> high; each is composited over what lies behind it. uv scale = how many noise cells per unit of plane
  // St
  if(uGen[6]>0.01&&shown(6)){
    vec2 uv=plane*1.2+wind;float fw=length(fwidth(uv));
    vec2 s=stratiform(uv,fw,0.55,0.25);
    float a=clamp(s.x*0.95*smoothstep(0.0,0.2,uGen[6])*mask,0.0,0.97);
    if(a>0.002){col+=T*a*paintCloud(0.0,s.y,0.05,0.2);thickAcc+=T*a*s.y;T*=1.0-a;}
  }
  // Cu
  if(uGen[8]>0.01&&shown(8)){
    vec2 uv=plane*3.0+wind;float fw=length(fwidth(uv));
    vec3 f=cumulusForm(uv,fw,clamp(uGen[8]*1.2,0.0,1.0),ldir,Q);
    float a=clamp(f.x*0.97*smoothstep(0.0,0.15,uGen[8])*mask,0.0,0.97);
    if(a>0.002){col+=T*a*paintCloud(f.y,f.z,0.1,1.0);thickAcc+=T*a*f.z;T*=1.0-a;}
  }
  // Sc
  if(uGen[7]>0.01&&shown(7)){
    vec2 uv=plane*4.0+wind*0.9;float fw=length(fwidth(uv));
    vec3 f=granularForm(uv,fw,0.55+0.3*uGen[7],0.8,uGen[7],ldir,Q);
    float a=clamp(f.x*0.92*smoothstep(0.0,0.2,uGen[7])*mask,0.0,0.97);
    if(a>0.002){col+=T*a*paintCloud(f.y,f.z,0.15,0.8);thickAcc+=T*a*f.z;T*=1.0-a;}
  }
  // Ns
  if(uGen[5]>0.01&&shown(5)){
    vec2 uv=plane*1.5+wind*0.8;float fw=length(fwidth(uv));
    vec2 s=stratiform(uv,fw,0.0,0.9);
    float a=clamp(s.x*1.0*smoothstep(0.0,0.3,uGen[5])*mask,0.0,0.99);
    if(a>0.002){col+=T*a*paintCloud(0.0,0.6+0.4*s.y,0.3,0.0);thickAcc+=T*a;T*=1.0-a;}
  }
  // As
  if(uGen[3]>0.01&&shown(3)){
    vec2 uv=plane*1.8+wind*0.7;float fw=length(fwidth(uv));
    vec2 s=stratiform(uv,fw,0.3,0.3);
    float a=clamp(s.x*0.9*smoothstep(0.0,0.3,uGen[3])*mask,0.0,0.95);
    if(a>0.002){col+=T*a*paintCloud(0.0,0.5*s.y,0.45,0.1);thickAcc+=T*a*0.5;T*=1.0-a;}
  }
  // Ac
  if(uGen[4]>0.01&&shown(4)){
    vec2 uv=plane*9.0+wind*0.6;float fw=length(fwidth(uv));
    vec3 f=flockForm(uv,fw,1.3,0.16,uGen[4],ldir,Q);
    float a=clamp(f.x*0.85*mask,0.0,0.9);
    if(a>0.002){col+=T*a*paintCloud(f.y,f.z*0.8,0.55,0.9);thickAcc+=T*a*f.z*0.6;T*=1.0-a;}
  }
  // Cs
  if(uGen[1]>0.01&&shown(1)){
    vec2 uv=plane*2.2+wind*0.5;float fw=length(fwidth(uv));
    vec2 s=stratiform(uv,fw,0.65,0.0);
    float a=clamp(s.x*uGen[1]*0.8*mask,0.0,0.45);
    if(a>0.002){col+=T*a*paintCloud(0.0,0.1*s.y,0.9,0.6);T*=1.0-a;}
  }
  // Cc
  if(uGen[2]>0.01&&shown(2)){
    vec2 uv=plane*18.0+wind*0.4;float fw=length(fwidth(uv));
    vec3 f=flockForm(uv,fw,2.4,0.12,uGen[2],ldir,Q);
    float a=clamp(f.x*0.3*mask,0.0,0.35);
    if(a>0.002){col+=T*a*paintCloud(f.y,0.1,0.95,0.8);T*=1.0-a;}
  }
  // Ci
  if(uGen[0]>0.01&&shown(0)){
    vec2 uv=plane*3.2+wind*0.4;float fw=length(fwidth(uv));
    float f=filament(uv,fw);
    float a=clamp(f*0.4*smoothstep(0.0,0.3,uGen[0])*mask,0.0,0.45);
    if(a>0.002){col+=T*a*paintCloud(0.0,0.05,1.0,1.0);T*=1.0-a;}
  }

  float amount=clamp(1.0-T,0.0,0.97);
  vec3 cloud=amount>0.001?col/max(amount,0.02):vec3(0.0);
  float thick=clamp(thickAcc/max(amount,0.02),0.0,1.0);
  // heavy weather: slate-grey, darker bodies; lightning lights the cloud from inside
  float lumC=dot(cloud,vec3(0.2126,0.7152,0.0722));
  cloud=mix(cloud,vec3(lumC)*vec3(0.55,0.60,0.70),uWeatherDark*0.95);
  cloud*=1.0-0.72*uWeatherDark*(0.45+0.55*thick);
  cloud+=vec3(0.7,0.78,1.0)*uWeatherFlash*(0.35+0.65*thick)*1.4;
  cloud=mix(uHorizon,cloud,clamp(0.34+ray.y*2.8,0.0,1.0));
  // transparent sheet over the sky; depth testing stays on so clouds never paint over buildings
  gl_FragColor=vec4(cloud,amount*uCloudAmount);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
