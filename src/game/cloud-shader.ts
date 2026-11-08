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

export const CLOUD_COMMON=String.raw`uniform float uTime;
uniform float uCloudAmount;
uniform float uCloudDetailLevel;
uniform vec2 uCloudWind;
uniform sampler2D uNoise;
uniform float uGen[10];

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

// ---- layers: where each genus sits ----
// H = height of the plane it is drawn on, S = size of one noise cell on it (world units; the island is about 100 across, so a
// cumulus lump is a few tens of units and its shadow is a patch you can walk in and out of). A cloud is a point on that plane,
// so the sky and the ground shadows read the SAME world position: the shadow of the cloud overhead lands where it should.
// Index = cloud-genera.js order: Ci Cs Cc As Ac Ns St Sc Cu Cb. ORDER is low (nearest) to high (farthest).
const int ORDER[10]=int[10](6,8,9,7,5,3,4,1,2,0);
const float LH[10]=float[10](1600.0,1400.0,1500.0,900.0,1000.0,600.0,96.0,280.0,210.0,210.0);
const float LS[10]=float[10](500.0,640.0,83.0,500.0,111.0,400.0,80.0,70.0,70.0,70.0);
const float LW[10]=float[10](0.4,0.5,0.4,0.7,0.6,0.8,1.0,0.9,1.0,1.0);      // wind: low layers move faster
const float LALT[10]=float[10](1.0,0.9,0.95,0.45,0.55,0.3,0.05,0.15,0.1,0.1);   // 0 low .. 1 high: how long the sun lasts on it
const float LRIM[10]=float[10](1.0,0.6,0.8,0.1,0.9,0.0,0.2,0.8,1.0,1.0);        // how strongly its margin burns toward the sun
bool gNeedLit=true;

// one genus at world plane point P: x lit-ness, y thickness; alpha (before the horizon fade) out
vec2 evalLayer(int id,vec2 P,vec2 ldir,int Q,out float alpha){
  vec2 uv=P/LS[id]+uCloudWind*(0.02*LW[id]);
  float fw=length(fwidth(uv));
  float g=uGen[id];
  int QL=gNeedLit?Q:0;
  alpha=0.0;
  if(id==6){vec2 s=stratiform(uv,fw,0.55,0.25);alpha=clamp(s.x*0.95*smoothstep(0.0,0.2,g),0.0,0.97);return vec2(0.0,s.y);}
  if(id==8){vec3 v=cumulusForm(uv,fw,clamp(g*1.2,0.0,1.0),ldir,gNeedLit?Q:min(Q,1));alpha=clamp(v.x*0.97*smoothstep(0.0,0.15,g),0.0,0.97);return v.yz;}
  if(id==9){vec3 v=cumulusForm(uv*0.7,fw*0.7,1.0,ldir,gNeedLit?Q:min(Q,1));alpha=clamp(v.x*0.98*smoothstep(0.0,0.2,g),0.0,0.98);return vec2(v.y*0.5,max(v.z,0.85));}
  if(id==7){vec3 v=granularForm(uv,fw,0.55+0.3*g,0.8,g,ldir,QL);alpha=clamp(v.x*0.92*smoothstep(0.0,0.2,g),0.0,0.97);return v.yz;}
  if(id==5){vec2 s=stratiform(uv,fw,0.0,0.9);alpha=clamp(s.x*smoothstep(0.0,0.3,g),0.0,0.99);return vec2(0.0,0.6+0.4*s.y);}
  if(id==3){vec2 s=stratiform(uv,fw,0.3,0.3);alpha=clamp(s.x*0.9*smoothstep(0.0,0.3,g),0.0,0.95);return vec2(0.0,0.5*s.y);}
  if(id==4){vec3 v=flockForm(uv,fw,1.3,0.16,g,ldir,QL);alpha=clamp(v.x*0.85,0.0,0.9);return vec2(v.y,v.z*0.8);}
  if(id==1){vec2 s=stratiform(uv,fw,0.65,0.0);alpha=clamp(s.x*g*0.8,0.0,0.45);return vec2(0.0,0.1*s.y);}
  if(id==2){vec3 v=flockForm(uv,fw,2.4,0.12,g,ldir,QL);alpha=clamp(v.x*0.3,0.0,0.35);return vec2(v.y,0.1);}
  float f=filament(uv,fw);alpha=clamp(f*0.4*smoothstep(0.0,0.3,g),0.0,0.45);return vec2(0.0,0.05);
}
`;

export const CLOUD_FRAG="precision highp float;\nprecision highp sampler2D;\n"+String.raw`precision highp float;
varying vec3 vRay;
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
`+CLOUD_COMMON+String.raw`// ---- light ----
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
  vec3 col=vec3(0.0);float T=1.0,thickAcc=0.0;

  // Layers run low -> high; each is composited over what lies behind it
  for(int k=0;k<10;k++){
    int id=ORDER[k];
    if(uGen[id]<=0.01||!shown(id))continue;
    float al;
    vec2 lt=evalLayer(id,cameraPosition.xz+plane*LH[id],ldir,Q,al);
    float a=clamp(al*mask,0.0,0.97);
    if(a>0.002){col+=T*a*paintCloud(lt.x,lt.y,LALT[id],LRIM[id]);thickAcc+=T*a*lt.y;T*=1.0-a;}
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

// ---- ground shadows: the same layers, seen from the sun. One texel = a patch of ground; the result is 1 - transmittance ----
export const CLOUD_SHADOW_VERT=String.raw`varying vec2 vUv;
void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`;
export const CLOUD_SHADOW_FRAG="precision highp float;\nprecision highp sampler2D;\n"+String.raw`varying vec2 vUv;
uniform vec2 uShadowCenter;
uniform float uShadowSize;
uniform vec3 uSunDirection;
`+CLOUD_COMMON+String.raw`
void main(){
  gNeedLit=false;
  vec3 s=normalize(uSunDirection);
  vec2 ground=uShadowCenter+(vUv-0.5)*uShadowSize;
  vec2 off=s.xz/max(s.y,0.08);            // each plane is met where the ray from the ground toward the sun reaches its height
  int Q=uCloudDetailLevel>0.5?1:0;
  float T=1.0;
  for(int k=0;k<10;k++){
    int id=ORDER[k];
    if(uGen[id]<=0.01)continue;
    float al;
    evalLayer(id,ground+off*LH[id],vec2(0.0),Q,al);
    // only a dense cloud throws a real shadow: a thin veil's is faint, so the shadow follows the density squared
    T*=1.0-clamp(al*al*1.1,0.0,0.97);
  }
  gl_FragColor=vec4(smoothstep(0.08,0.85,1.0-T),0.0,0.0,1.0);
}`;
