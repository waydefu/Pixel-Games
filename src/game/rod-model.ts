import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/**
 * A modern spinning rod, modelled after a real lure combo: a tapered black carbon blank that bends, stainless guides with
 * dark frames and thread wraps, a black EVA foam handle with a metal reel seat, and a spinning reel (gunmetal body with
 * silver trim, gold anodised spool, rotor with a bail arm and line roller, and a long handle ending in a T-knob).
 *
 * Rod space: +y runs along the shaft toward the tip, the underside (where the reel and the guides hang) is -z,
 * and the reel handle is on +x. Static parts are merged into three meshes (matte, metal, gold); the blank, the guides,
 * the wraps, the rotor and the crank move every frame.
 */
type Scope={track:<T extends{dispose:()=>void}>(item:T)=>T};
type Part=THREE.BufferGeometry;

const paint=(geometry:Part,color:string)=>{
  const c=new THREE.Color(color),count=geometry.getAttribute("position").count,array=new Float32Array(count*3);
  for(let i=0;i<count;i++){array[i*3]=c.r;array[i*3+1]=c.g;array[i*3+2]=c.b;}
  geometry.setAttribute("color",new THREE.BufferAttribute(array,3));
  return geometry;
};
const place=(geometry:Part,x:number,y:number,z:number,rx=0,ry=0,rz=0)=>{
  if(rx||ry||rz)geometry.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx,ry,rz)));
  geometry.translate(x,y,z);return geometry;
};
/** Revolve a profile of [radius, y] points around the y axis. */
const lathe=(profile:[number,number][],segments=18)=>new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),segments);
const cylinder=(r0:number,r1:number,length:number,segments=14)=>new THREE.CylinderGeometry(r0,r1,length,segments);
const ring=(radius:number,tube:number,segments=22)=>new THREE.TorusGeometry(radius,tube,6,segments);
const box=(sx:number,sy:number,sz:number)=>new THREE.BoxGeometry(sx,sy,sz);

const SEGMENTS=10;
/** Handle thickness relative to the first drawing: a real EVA grip is about 3 cm across. */
const K=.78;
export const ROD_LENGTH=3.4;
const GUIDE_AT=[1,2,3,4,5,6,8];
const GUIDE_SIZE=[.027,.022,.019,.016,.0135,.0115,.0095];

export function createRodModel(scope:Scope){
  const segLength=ROD_LENGTH/SEGMENTS;
  const group=new THREE.Group();group.visible=false;group.userData.dynamic=true;

  // ---------------- static parts: handle, reel seat, reel body, spool ----------------
  const matteParts:Part[]=[],metalParts:Part[]=[],goldParts:Part[]=[];
  const EVA="#17181a",EVA_RIB="#2c2f33",GUNMETAL="#454d55",SILVER="#c8ccd1",STEEL="#8f969d",NUT="#121417";
  // rear grip: black EVA foam with a slight belly, ribs, a rubber butt cap and a silver end ring
  matteParts.push(paint(place(lathe([[.0,-.505],[.021*K,-.505],[.0235*K,-.49],[.0245*K,-.44],[.0258*K,-.32],[.0255*K,-.22],[.0238*K,-.14],[.0225*K,-.13],[.0,-.13]],20),0,0,0),EVA));
  for(const y of [-.46,-.40,-.34,-.28,-.22,-.16])matteParts.push(paint(place(ring(.0252*K,.0014,20),0,y,0,Math.PI/2),EVA_RIB));
  metalParts.push(paint(place(ring(.0236*K,.0016,20),0,-.488,0,Math.PI/2),SILVER));
  // reel seat: threaded steel hood between two black locking nuts
  metalParts.push(paint(place(cylinder(.0225*K,.0225*K,.2,18),0,-.03,0),STEEL));
  matteParts.push(paint(place(cylinder(.0262*K,.0262*K,.026,16),0,-.118,0),NUT));
  matteParts.push(paint(place(cylinder(.0245*K,.0245*K,.026,16),0,.058,0),NUT));
  for(const y of [-.082,.014])metalParts.push(paint(place(ring(.0228*K,.0012,20),0,y,0,Math.PI/2),SILVER));
  // fore grip: short EVA section and a silver ferrule ring
  matteParts.push(paint(place(lathe([[.0,.07],[.0245*K,.07],[.0225*K,.1],[.0185*K,.15],[.0165*K,.2],[.0,.2]],18),0,0,0),EVA));
  metalParts.push(paint(place(ring(.0168*K,.0015,18),0,.2,0,Math.PI/2),SILVER));
  metalParts.push(paint(place(ring(.0245*K,.0014,18),0,.075,0,Math.PI/2),SILVER));

  // ---------------- the spinning reel, hanging under the seat (-z) ----------------
  const AX=-.078,AY=0;   // the spool axis, parallel to the rod
  // reel foot and stem
  metalParts.push(paint(place(box(.019,.085,.007),0,-.014,-.0225),SILVER));
  matteParts.push(paint(place(box(.013,.024,.03),0,-.012,-.047),GUNMETAL));
  // body: a rounded housing with side plates
  const body=new THREE.SphereGeometry(1,22,16);body.scale(.027,.052,.039);
  matteParts.push(paint(place(body,0,-.024,AX),GUNMETAL));
  for(const side of [1,-1]){
    metalParts.push(paint(place(cylinder(.021,.021,.003,24),side*.0268,-.03,AX,0,0,Math.PI/2),SILVER));
    matteParts.push(paint(place(cylinder(.013,.013,.0034,18),side*.0272,-.03,AX,0,0,Math.PI/2),GUNMETAL));
  }
  // rotor housing under the spool
  matteParts.push(paint(place(lathe([[.0,.012],[.03,.012],[.0325,.03],[.03,.052],[.0,.052]],24),0,0,AX),GUNMETAL));
  // spool: gold anodised, flanged, with a silver drag knob
  goldParts.push(paint(place(lathe([[.0,.052],[.0325,.052],[.0335,.057],[.0265,.062],[.0262,.083],[.0315,.0885],[.0315,.094],[.0,.094]],28),0,0,AX),"#c99f3c"));
  metalParts.push(paint(place(cylinder(.014,.0155,.012,16),0,.1,AX),SILVER));
  metalParts.push(paint(place(ring(.0165,.0012,20),0,.0945,AX,Math.PI/2),STEEL));
  // line wound on the spool
  matteParts.push(paint(place(cylinder(.0262,.0262,.026,24),0,.072,AX),"#d8d2b8"));
  const makeStatic=(parts:Part[],material:THREE.Material)=>{
    const merged=scope.track(mergeGeometries(parts,false) as Part);
    const mesh=new THREE.Mesh(merged,material);mesh.castShadow=false;mesh.receiveShadow=false;mesh.userData.dynamic=true;
    group.add(mesh);return mesh;
  };
  const matteMaterial=scope.track(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.5,metalness:.1,emissive:"#14171a",emissiveIntensity:.8}));
  const metalMaterial=scope.track(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.3,metalness:.7,emissive:"#33383d",emissiveIntensity:.8}));
  const goldMaterial=scope.track(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.35,metalness:.6,emissive:"#4a3510",emissiveIntensity:.8}));
  makeStatic(matteParts,matteMaterial);makeStatic(metalParts,metalMaterial);makeStatic(goldParts,goldMaterial);

  // rotor + bail arm: spins around the spool axis while the line comes in
  const rotor=new THREE.Group();rotor.position.set(0,AY,AX);group.add(rotor);
  const rotorMetal:Part[]=[],rotorMatte:Part[]=[];
  for(const side of [1,-1]){
    rotorMatte.push(paint(place(box(.007,.046,.012),side*.0315,.071,0),GUNMETAL));      // rotor arm
    rotorMetal.push(paint(place(cylinder(.0055,.0055,.012,10),side*.0345,.093,0,0,0,Math.PI/2),side===1?SILVER:STEEL)); // bail mount
  }
  rotorMetal.push(paint(place(new THREE.TorusGeometry(.0345,.0017,5,20,Math.PI),0,.093,0),SILVER));                     // the bail wire
  rotorMetal.push(paint(place(cylinder(.0042,.0042,.012,10),.0345,.098,0),SILVER));                                      // line roller
  const rotorGeoMatte=scope.track(mergeGeometries(rotorMatte,false) as Part),rotorGeoMetal=scope.track(mergeGeometries(rotorMetal,false) as Part);
  const rm=new THREE.Mesh(rotorGeoMatte,matteMaterial),rs=new THREE.Mesh(rotorGeoMetal,metalMaterial);
  for(const m of [rm,rs]){m.castShadow=false;m.receiveShadow=false;m.userData.dynamic=true;rotor.add(m);}

  // handle: a crank arm with a counterweight and a black T-knob with a grey cap
  const crank=new THREE.Group();crank.position.set(.0285,-.03,AX);group.add(crank);
  const crankMetal:Part[]=[],crankMatte:Part[]=[];
  crankMetal.push(paint(place(cylinder(.0075,.0075,.014,14),.004,0,0,0,0,Math.PI/2),SILVER));                         // hub
  crankMetal.push(paint(place(box(.005,.0075,.082),.012,0,.038),SILVER));                                              // arm
  crankMetal.push(paint(place(box(.005,.0075,.05),.012,0,-.024),STEEL));                                                // counterweight arm
  crankMatte.push(paint(place(cylinder(.011,.011,.008,12),.012,0,-.05,0,0,Math.PI/2),GUNMETAL));                        // counterweight
  crankMatte.push(paint(place(cylinder(.0085,.0085,.044,12),.03,0,.078,0,0,Math.PI/2),EVA));                           // the T-knob
  crankMetal.push(paint(place(cylinder(.0075,.0075,.004,12),.054,0,.078,0,0,Math.PI/2),STEEL));                         // grey cap
  const cm=new THREE.Mesh(scope.track(mergeGeometries(crankMatte,false) as Part),matteMaterial),cs=new THREE.Mesh(scope.track(mergeGeometries(crankMetal,false) as Part),metalMaterial);
  for(const m of [cm,cs]){m.castShadow=false;m.receiveShadow=false;m.userData.dynamic=true;crank.add(m);}

  // ---------------- the bending blank, guides and thread wraps ----------------
  const blankMaterial=scope.track(new THREE.MeshStandardMaterial({roughness:.28,metalness:.2,emissive:"#15181c",emissiveIntensity:.9}));
  const segments=new THREE.InstancedMesh(scope.track(new THREE.CylinderGeometry(.5,.5,1,10)),blankMaterial,SEGMENTS);
  for(let i=0;i<SEGMENTS;i++)segments.setColorAt(i,new THREE.Color().lerpColors(new THREE.Color("#101316"),new THREE.Color("#2b3138"),i/(SEGMENTS-1)));
  segments.frustumCulled=false;segments.userData.dynamic=true;group.add(segments);
  const ringGeometry=scope.track(new THREE.TorusGeometry(1,.14,6,16));
  const guideRings=new THREE.InstancedMesh(ringGeometry,metalMaterial.clone(),GUIDE_AT.length+1);
  (guideRings.material as THREE.MeshStandardMaterial).vertexColors=false;(guideRings.material as THREE.MeshStandardMaterial).color.set("#dfe2e6");
  const stemMaterial=scope.track(new THREE.MeshStandardMaterial({color:"#b7bcc2",roughness:.35,metalness:.7,emissive:"#30353a",emissiveIntensity:.8}));
  const guideStems=new THREE.InstancedMesh(scope.track(new THREE.BoxGeometry(1,1,1)),stemMaterial,GUIDE_AT.length+1);
  const wrapMaterial=scope.track(new THREE.MeshStandardMaterial({roughness:.7,emissive:"#3a0d0d",emissiveIntensity:.8}));
  const WRAPS=GUIDE_AT.length*2+4;
  const wraps=new THREE.InstancedMesh(scope.track(new THREE.CylinderGeometry(.5,.5,1,10)),wrapMaterial,WRAPS);
  for(const m of [guideRings,guideStems,wraps]){m.frustumCulled=false;m.userData.dynamic=true;m.castShadow=false;group.add(m);}

  const tipLocal=new THREE.Vector3(),chain=new THREE.Matrix4(),link=new THREE.Matrix4(),bendRot=new THREE.Matrix4(),matrix=new THREE.Matrix4();
  const pos=new THREE.Vector3(),quat=new THREE.Quaternion(),one=new THREE.Vector3(1,1,1),scaleV=new THREE.Vector3(),offset=new THREE.Vector3();
  const flip=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
  const red=new THREE.Color("#8c1c20"),gold=new THREE.Color("#d9b24a"),silver=new THREE.Color("#d5d8dc");
  const radiusAt=(i:number)=>.0118*Math.pow(1-i/SEGMENTS,1.2)+.0028;

  /** Rebuild the chain of segments for a bend (radians over the whole blade); `sign` is the side the blade curls toward. */
  function build(bend:number,sign:number){
    chain.identity();
    let guide=0,wrap=0;
    const addWrap=(atChain:THREE.Matrix4,length:number,radius:number,color:THREE.Color)=>{
      matrix.copy(atChain);matrix.decompose(pos,quat,scaleV);
      scaleV.set(radius*2,length,radius*2);matrix.compose(pos,quat,scaleV);
      wraps.setMatrixAt(wrap,matrix);wraps.setColorAt(wrap,color);wrap++;
    };
    for(let i=0;i<SEGMENTS;i++){
      const radius=radiusAt(i);
      link.makeTranslation(0,segLength/2,0);
      matrix.multiplyMatrices(chain,link);matrix.decompose(pos,quat,scaleV);
      scaleV.set(radius*2,segLength*1.02,radius*2);matrix.compose(pos,quat,scaleV);
      segments.setMatrixAt(i,matrix);
      const step=bend*sign*(.35+1.3*(i/(SEGMENTS-1)))/SEGMENTS;
      link.makeTranslation(0,segLength/2,0);chain.multiply(link);
      const g=GUIDE_AT.indexOf(i);
      if(g>=0){
        const size=GUIDE_SIZE[g],r=radiusAt(i+.5);
        // a ring under the blade (the concave side), with a stem to a wrapped foot on the blade
        matrix.copy(chain);matrix.decompose(pos,quat,scaleV);
        offset.set(0,0,sign*(r+size*.95)).applyQuaternion(quat);
        const ringPos=pos.clone().add(offset),ringQuat=quat.clone().multiply(flip);
        matrix.compose(ringPos,ringQuat,scaleV.set(size,size,size));
        guideRings.setMatrixAt(guide,matrix);
        offset.set(0,0,sign*(r+size*.4)).applyQuaternion(quat);
        matrix.compose(pos.clone().add(offset),quat,scaleV.set(.0042,.0055,size*.95+r*.2));
        guideStems.setMatrixAt(guide,matrix);
        guide++;
        // thread wraps on both feet of the guide
        link.makeTranslation(0,-.012,0);addWrap(chain.clone().multiply(link),.034,r*1.22,red);
        link.makeTranslation(0,.0075,0);addWrap(chain.clone().multiply(link),.005,r*1.3,gold);
      }
      bendRot.makeRotationX(step);chain.multiply(bendRot);
    }
    // the tip-top: the last, smallest guide
    matrix.copy(chain);matrix.decompose(pos,quat,scaleV);
    guideRings.setMatrixAt(guide,matrix.compose(pos,quat.clone().multiply(flip),scaleV.set(.0075,.0075,.0075)));
    guideStems.setMatrixAt(guide,matrix.compose(pos,quat,scaleV.set(.001,.001,.001)));
    tipLocal.setFromMatrixPosition(chain);
    // silver bands where the sections of a two-piece blade would join, and one at the foot of the blank
    chain.identity();
    let band=0;
    for(let i=0;i<SEGMENTS;i++){
      if(band<3&&(i===0||i===3||i===6)){
        link.makeTranslation(0,i===0?.02:0,0);
        addWrap(chain.clone().multiply(link),.012,radiusAt(i)*1.25,silver);band++;
      }
      link.makeTranslation(0,segLength,0);chain.multiply(link);
      bendRot.makeRotationX(bend*sign*(.35+1.3*(i/(SEGMENTS-1)))/SEGMENTS);chain.multiply(bendRot);
    }
    for(;wrap<WRAPS;wrap++){matrix.compose(pos.set(0,-9,0),quat.identity(),scaleV.set(0,0,0));wraps.setMatrixAt(wrap,matrix);}
    segments.instanceMatrix.needsUpdate=true;guideRings.instanceMatrix.needsUpdate=true;guideStems.instanceMatrix.needsUpdate=true;wraps.instanceMatrix.needsUpdate=true;
    if(segments.instanceColor)segments.instanceColor.needsUpdate=true;
    if(wraps.instanceColor)wraps.instanceColor.needsUpdate=true;
    void one;
  }
  build(.14,-1);
  /** Turn the handle by `angle` radians; the rotor and its bail arm spin faster (a typical 5:1 ratio, drawn slower to read). */
  function spin(angle:number){crank.rotation.x=angle;rotor.rotation.y=-angle*2.2;}
  return {group,build,spin,tipLocal,segments,ROD_LENGTH};
}
export type RodModel=ReturnType<typeof createRodModel>;
