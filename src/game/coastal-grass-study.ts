import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import grassGltf from "../../assets/models/polyhaven/grass-medium-01/grass_medium_01_1k.gltf?raw";
import grassBin from "../../assets/models/polyhaven/grass-medium-01/grass_medium_01.bin?url";
import grassColor from "../../assets/models/polyhaven/grass-medium-01/textures/grass_medium_01_bleed_2k.png";
import grassNormal from "../../assets/models/polyhaven/grass-medium-01/textures/grass_medium_01_nor_gl_1k.jpg";
import grassArm from "../../assets/models/polyhaven/grass-medium-01/textures/grass_medium_01_arm_1k.jpg";
import type { StageKit } from "./kit.js";
import type { CloudField } from "./cloud-field.js";
import { addVegetationWind } from "./vegetation-wind.js";
import { grassSuitability } from "./grass-placement.js";
import { COASTLINE_GLSL } from "./coastal-outline.js";
import leafyColor from "../../assets/textures/coastal-study/leafy_grass_diff_1k.jpg";
import leafyNormal from "../../assets/textures/coastal-study/leafy_grass_nor_gl_1k.jpg";
import leafyRough from "../../assets/textures/coastal-study/leafy_grass_rough_1k.jpg";
import sparseColor from "../../assets/textures/coastal-study/sparse_grass_diff_1k.jpg";
import sparseNormal from "../../assets/textures/coastal-study/sparse_grass_nor_gl_1k.jpg";
import sparseRough from "../../assets/textures/coastal-study/sparse_grass_rough_1k.jpg";

// Preserve the original approved study footprint for existing shrub and flower exclusions.
export function inGrassStudy(x:number,z:number){return x>-5&&x<11&&z>3.3&&z<14;}
export function createGrassStudy(k:StageKit,clouds:CloudField){
  const loader=new THREE.TextureLoader();
  const texture=(url:string,color=false)=>{
    const t=k.scope.track(loader.load(url));
    t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;
    t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;
    return t;
  };
  const maps=[texture(leafyColor,true),texture(leafyNormal),texture(leafyRough),
    texture(sparseColor,true),texture(sparseNormal),texture(sparseRough)];
  function apply(material:THREE.MeshStandardMaterial){
    const previous=material.onBeforeCompile;
    const key=material.customProgramCacheKey.bind(material);
    material.onBeforeCompile=(shader,renderer)=>{
      previous(shader,renderer);
      ["leafColor","leafNormal","leafRough","sparseColor","sparseNormal","sparseRough"].forEach((name,i)=>{shader.uniforms[name]={value:maps[i]};});
      shader.fragmentShader=shader.fragmentShader.replace("#include <common>",`#include <common>
        uniform sampler2D leafColor,leafNormal,leafRough,sparseColor,sparseNormal,sparseRough;
        ${COASTLINE_GLSL}
        float studyHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float studyNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(studyHash(i),studyHash(i+vec2(1,0)),f.x),mix(studyHash(i+vec2(0,1)),studyHash(i+vec2(1,1)),f.x),f.y);}
      `).replace("pxUv=pixelWorldUv();",`pxUv=pixelWorldUv();
        vec2 sp=vPxWorld.xz;float n=studyNoise(sp*.65);float macro=studyNoise(sp*.22);
        float grassEdge=shore(sp.y)-5.1*shoreRegion(sp.y);
        float edge=1.-smoothstep(grassEdge+.4,grassEdge+3.5,sp.x+(n-.5)*.35);
        float sheltered=(1.-smoothstep(2.,7.,distance(sp,vec2(-4.,12.))))*.7;
        float leafy=clamp(.48+sheltered*.35+macro*.12,0.,.85);
        vec2 uv1=sp*.5,uv2=sp*.43+vec2(.37,.71);
        vec3 sc=texture2D(sparseColor,uv1).rgb;vec3 lc=texture2D(leafColor,uv2).rgb;
        vec3 studyColor=mix(sc,lc,leafy);
        float dry=smoothstep(grassEdge-5.,grassEdge+1.,sp.x);studyColor=mix(studyColor,studyColor*vec3(1.17,1.07,.79),dry*.55);
        studyColor*=mix(.82,1.18,macro);
        studyColor*=vec3(.86,1.12,.84);
        vec3 studyNormal=normalize(mix(texture2D(sparseNormal,uv1).xyz*2.-1.,texture2D(leafNormal,uv2).xyz*2.-1.,leafy));
        float studyRough=mix(texture2D(sparseRough,uv1).g,texture2D(leafRough,uv2).g,leafy);
      `).replace("diffuseColor*=texture2D(map,pxUv);","diffuseColor*=vec4(mix(texture2D(map,pxUv).rgb,studyColor,edge),1.0);")
        .replace("vec3 pxMapN=texture2D(normalMap,pxUv).xyz*2.0-1.0;","vec3 pxMapN=normalize(mix(texture2D(normalMap,pxUv).xyz*2.0-1.0,studyNormal,edge));")
        .replace("vec3 pxMapN=pxPackedSurfaceNormal.xyz*2.0-1.0;","vec3 pxMapN=normalize(mix(pxPackedSurfaceNormal.xyz*2.0-1.0,studyNormal,edge));")
        .replace("#include <roughnessmap_fragment>","#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,studyRough,edge);");
    };
    material.customProgramCacheKey=()=>key()+"|coastal-study-v1";
    material.needsUpdate=true;
  }
  function applyMountain(material:THREE.MeshStandardMaterial){
    const previous=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
    material.onBeforeCompile=(shader,renderer)=>{
      previous(shader,renderer);
      shader.uniforms.mountainGrassColor={value:maps[3]};
      shader.uniforms.mountainGrassRough={value:maps[5]};
      shader.fragmentShader=shader.fragmentShader.replace("#include <common>",
        "#include <common>\nuniform sampler2D mountainGrassColor,mountainGrassRough;")
        .replace("#include <color_fragment>",`#include <color_fragment>
          float mountainSlope=1.0-clamp(normalize(vRockWorldNormal).y,0.0,1.0);
          float mountainMeadow=(1.0-smoothstep(.12,.48,mountainSlope))*(1.0-smoothstep(14.0,38.0,vRockWorldPosition.y));
          vec2 mountainUv=vRockWorldPosition.xz*.5;
          vec3 mountainPhoto=texture2D(mountainGrassColor,mountainUv).rgb;
          diffuseColor.rgb=mix(diffuseColor.rgb,mountainPhoto*vec3(.75,.9,.70),mountainMeadow*.7);`)
        .replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
          roughnessFactor=mix(roughnessFactor,texture2D(mountainGrassRough,mountainUv).g,mountainMeadow*.7);`);
    };
    material.customProgramCacheKey=()=>key()+"|mountain-grass-v1";material.needsUpdate=true;
  }
  return {apply,applyMountain};
}

export function addStudyGrass(k:StageKit,clouds:CloudField){
  const cellSize=6, slots=9, capacity=220;
  type Tile={meshes:THREE.InstancedMesh[]; counts:number[]};
  const tiles:Tile[]=[];
  let alive=true, ready=false, amount=1, lastX=NaN,lastZ=NaN;
  let focus={x:0,z:0};
  k.scope.track({dispose(){alive=false;}});
  const source=JSON.parse(grassGltf);
  source.buffers[0].uri=grassBin;
  for(const img of source.images){
    if(img.uri.includes("nor_gl"))img.uri=grassNormal;
    else if(img.uri.includes("diff")){img.uri=grassColor;img.mimeType="image/png";}
    else if(img.uri.includes("arm"))img.uri=grassArm;
  }
  const rand=(n:number)=>{const x=Math.sin(n*127.1+3.4)*43758.5453;return x-Math.floor(x);};
  function refresh(){
    if(!ready)return;
    const cx=Math.floor(focus.x/cellSize),cz=Math.floor(focus.z/cellSize);
    if(cx===lastX&&cz===lastZ)return;
    lastX=cx;lastZ=cz;
    const dummy=new THREE.Object3D();
    for(let slot=0;slot<slots;slot++){
      const tile=tiles[slot], tx=cx+slot%3-1,tz=cz+Math.floor(slot/3)-1;
      const counts=[0,0,0];
      for(let i=0;i<2600;i++){
        const seed=tx*173.31+tz*319.87+i*7.19;
        const x=(tx+rand(seed))*cellSize,z=(tz+rand(seed+8.4))*cellSize;
        const suitability=grassSuitability(x,z,k.colliders);
        const cluster=(Math.sin(x*1.7+Math.sin(z*.9))*Math.cos(z*1.4+x*.4)+1)*.5;
        if(rand(seed+12.3)>suitability*(.22+.73*cluster))continue;
        const kind=i%3,j=counts[kind];if(j>=capacity)continue;
        const size=(.62+rand(seed+24)*.75)*1.5;
        dummy.rotation.set(0,rand(seed+18)*Math.PI*2,0);
        dummy.scale.set(size,size*(.8+rand(seed+30)*.6),size);
        dummy.position.set(x,-.185+.2*dummy.scale.y,z);dummy.updateMatrix();
        const mesh=tile.meshes[kind];mesh.setMatrixAt(j,dummy.matrix);
        const dry=THREE.MathUtils.smoothstep(x,4.5,8.5);
        mesh.setColorAt(j,new THREE.Color().setRGB(.78+rand(seed+40)*.2+dry*.08,.81+rand(seed+50)*.19,.72+rand(seed+60)*.22-dry*.12));
        counts[kind]++;
        if(counts.every(n=>n===capacity))break;
      }
      tile.counts=counts;
      for(let j=0;j<3;j++){
        const mesh=tile.meshes[j];mesh.count=counts[j];mesh.instanceMatrix.needsUpdate=true;
        if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
        mesh.computeBoundingSphere();if(mesh.boundingSphere)mesh.boundingSphere.radius+=.4;
        mesh.count=Math.round(counts[j]*amount);
      }
    }
  }
  new GLTFLoader().parseAsync(JSON.stringify(source),"").then(gltf=>{
    const resources=new Set<{dispose:()=>void}>();
    gltf.scene.traverse(child=>{
      if(!(child instanceof THREE.Mesh))return;
      resources.add(child.geometry);
      for(const material of Array.isArray(child.material)?child.material:[child.material]){
        resources.add(material);
        for(const value of Object.values(material))if(value instanceof THREE.Texture)resources.add(value);
      }
    });
    if(!alive){for(const item of resources)item.dispose();return;}
    for(const item of resources)k.scope.track(item);
    const names=["grass_medium_01_small_a_LOD0","grass_medium_01_mid_b_LOD0","grass_medium_01_mid_a_LOD0"];
    const sources=names.map(name=>gltf.scene.getObjectByName(name) as THREE.Mesh|undefined);
    if(sources.some(item=>!item||!(item.material instanceof THREE.MeshStandardMaterial))){console.warn("Grass models missing");return;}
    const shared=k.scope.track((sources[0]!.material as THREE.MeshStandardMaterial).clone());
    shared.transparent=false;shared.alphaTest=.2;shared.depthWrite=true;shared.side=THREE.DoubleSide;
    clouds.applyToMaterial(shared);
    addVegetationWind(shared,clouds,.035);
    const windCompile=shared.onBeforeCompile,windKey=shared.customProgramCacheKey.bind(shared);
    shared.onBeforeCompile=(shader,renderer)=>{
      windCompile(shader,renderer);
      shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>",
        "#include <map_fragment>\ndiffuseColor.rgb=pow(max(diffuseColor.rgb,vec3(0.0)),vec3(.74))*vec3(.88,1.12,.83);");
    };
    shared.customProgramCacheKey=()=>windKey()+"|grass-photo-tint-v1";
    const geometries=sources.map(item=>{const g=k.scope.track(item!.geometry.clone());g.translate(0,-.2,0);return g;});
    for(let i=0;i<slots;i++){
      const meshes=geometries.map(geometry=>{
        const mesh=k.scope.track(new THREE.InstancedMesh(geometry,shared,capacity));
        mesh.count=0;mesh.castShadow=false;mesh.receiveShadow=true;k.scene.add(mesh);return mesh;
      });
      tiles.push({meshes,counts:[0,0,0]});
    }
    ready=true;refresh();
  }).catch(error=>console.warn("Photographic grass unavailable; procedural fallback retained",error));
  return {
    update(player:{x:number;z:number}){focus=player;refresh();},
    setDensity(factor:number){
      const value=THREE.MathUtils.clamp(factor,0,1);
      const next=value===0?0:Math.max(.65,value);
      if(next===amount)return;amount=next;
      for(const tile of tiles)for(let i=0;i<3;i++)tile.meshes[i].count=Math.round(tile.counts[i]*amount);
    },
    get ready(){return ready;},
  };
}
