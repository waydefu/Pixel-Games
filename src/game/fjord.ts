import * as THREE from "three";
import { fjordSurfaceHeight } from "./terrain-profile.js";
import { buildMountainForest } from "./mountain-forest.js";
import type { CloudField } from "./cloud-field.js";
import { SUN_DIRECTION, HORIZON_LINEAR } from "./environment-state.js";
import type { StageKit } from "./kit.js";
type Region="mainland"|"east"|"north"|"south";
type Extent={x0:number;x1:number;z0:number;z1:number;columns:number;rows:number};
const layouts:Record<Region,Extent>={
  mainland:{x0:-175,x1:-43,z0:-190,z1:190,columns:86,rows:145},
  east:{x0:72,x1:245,z0:-210,z1:210,columns:110,rows:160},
  north:{x0:-30,x1:245,z0:84,z1:204,columns:115,rows:65},
  south:{x0:-30,x1:245,z0:-204,z1:-84,columns:115,rows:65},
};
function makeMass(scope:StageKit["scope"],region:Region,e:Extent){
  const verts:number[]=[];const colors:number[]=[];const indexes:number[]=[];
  // Muted cool granite, darker fracture lines and lighter wind-worn ledges.
  // Prebaked vertex colors cost no additional fragment shader texture reads.
  const grass=new THREE.Color("#526e51"),moss=new THREE.Color("#687e6d");
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
    uTime:{value:0},uCloudAmount:{value:1.0},
    uSunDirection:{value:new THREE.Vector3(SUN_DIRECTION.x,SUN_DIRECTION.y,SUN_DIRECTION.z)},
    uHorizon:{value:new THREE.Color().setRGB(HORIZON_LINEAR.r,HORIZON_LINEAR.g,HORIZON_LINEAR.b)},
  };
  const sky=k.scope.track(new THREE.ShaderMaterial({
    uniforms:skyUniforms,depthWrite:false,depthTest:false,side:THREE.BackSide,fog:false,
    vertexShader:String.raw`varying vec3 vRay;
      void main(){
        vRay=position;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }`,
    fragmentShader:String.raw`precision highp float;
      varying vec3 vRay;
      uniform float uTime;
      uniform float uCloudAmount;
      uniform sampler2D uCloudMap;
      uniform vec2 uCloudWind;
      uniform float uCloudSpan;
      uniform float uCloudHeight;
      uniform vec3 uSunDirection;
      uniform vec3 uHorizon;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noiz(vec2 p){
        vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),
                   mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);
      }
      float fbm(vec2 p){
        float a=.5,v=0.0;
        for(int j=0;j<4;j++){v+=a*noiz(p);p=p*2.03+vec2(7.1,3.5);a*=.5;}
        return v;
      }
      void main(){
        vec3 ray=normalize(vRay);
        float h=clamp(ray.y,0.0,1.0); // Match fog at the true geometric horizon.
        vec3 horizon=uHorizon,zenith=vec3(.16,.34,.61);
        vec3 sky=mix(horizon,zenith,pow(h,.78));
        vec3 sunDir=normalize(uSunDirection);
        float sun=max(0.0,dot(ray,sunDir));
        sky+=vec3(.32,.18,.075)*pow(sun,24.0);
        sky+=vec3(.30,.23,.14)*pow(sun,320.0);
        // Shared precomputed world-space cloud field: the same density drives
        // sky cover and projected mountain/ground shadow, with no second pass.
        // An upper cloud layer is sampled where the view ray reaches the sheet.
        float reach=max(0.0,uCloudHeight-cameraPosition.y)/max(.11,ray.y);
        vec2 cloudUV=(cameraPosition.xz+ray.xz*reach+uCloudWind)/uCloudSpan;
        float low=texture2D(uCloudMap,cloudUV).r;
        float cumulus=smoothstep(.39,.56,low);
        float cirrus=smoothstep(.52,.71,
          texture2D(uCloudMap,cloudUV*2.1+vec2(.17,.39)).r)*.18;
        float mask=smoothstep(-.04,.055,ray.y)*(1.0-smoothstep(.86,.98,ray.y));
        float amount=clamp((cumulus+cirrus)*mask*uCloudAmount,0.0,.96);
        vec3 underside=vec3(.36,.47,.55),lit=vec3(1.07,1.04,.94);
        float rim=pow(sun,18.0);
        vec3 cloud=mix(underside,lit,clamp(.50+.34*sun+.25*rim,0.0,1.0));
        sky=mix(sky,cloud,amount);
        gl_FragColor=vec4(sky,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  const dome=new THREE.Mesh(k.scope.track(new THREE.SphereGeometry(790,28,16)),sky);
  dome.name="sky-atmosphere";dome.renderOrder=-1000;k.scene.add(dome);
  function update(time:number){skyUniforms.uTime.value=time;}
  return {peaks,forests,sky:dome,update};
}
