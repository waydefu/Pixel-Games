export const clamp01 = value => Math.min(1,Math.max(0,value));
const wave = (x,z) => Math.sin(x*.083+Math.sin(z*.039)*1.7)*.42+Math.sin(z*.065-x*.051)*.27+Math.sin(x*.17+z*.12)*.12+Math.sin(z*.215-x*.096)*.07;
const ridge = (x,z) => Math.pow(Math.abs(Math.sin(z*.039+x*.026+wave(x,z)*.8)),.66);
const smooth = (a,b,v) => { const t = clamp01((v-a)/(b-a)); return t*t*(3-2*t); };

/**
 * Open-bay terrain. Only the landward (west) side is mountainous; it is the
 * backdrop BEHIND the village. North/south spurs fall to low headlands toward the
 * sea and the eastern region is only sparse, low island silhouettes, so no
 * mountain wall ever stands between the player and the horizon.
 */
export const OPEN_SEA_CORRIDOR = Object.freeze({ originX: 9, originZ: 4, eye: 1.7, halfAngle: 50*Math.PI/180, maxElevationDeg: 4.2 });

// Spur height multiplier: 1 at the mountain backdrop (x <= -30) -> ~0.1 at sea.
export const flankScale = x => { const f = 1 - smooth(-30, 55, x); return .10 + .90*f*f; };


/**
 * Extents of the four terrain meshes (see fjord.ts). The north and south spurs start at the mainland's east edge so
 * no gap is left between them.
 */
export const FJORD_EXTENTS = Object.freeze({
  mainland: Object.freeze({ x0: -175, x1: -43, z0: -190, z1: 190, columns: 86, rows: 145 }),
  east: Object.freeze({ x0: 72, x1: 245, z0: -210, z1: 210, columns: 110, rows: 160 }),
  north: Object.freeze({ x0: -44, x1: 245, z0: 84, z1: 204, columns: 120, rows: 65 }),
  south: Object.freeze({ x0: -44, x1: 245, z0: -204, z1: -84, columns: 120, rows: 65 }),
});

/** Sides of each mesh that face open water: the land must sink below the sea there, never end in a cut wall. */
const OPEN_SIDES = Object.freeze({
  mainland: ["x0", "x1", "z0", "z1"],
  east: ["x1", "z0", "z1"],
  north: ["x0", "x1", "z0", "z1"],
  south: ["x0", "x1", "z0", "z1"],
});
export const EDGE_FALL = 55;
export const SEABED = -6;

/** 1 inside the mesh, falling to 0 over EDGE_FALL units toward each open side. */
export function edgeFade(x, z, region) {
  const e = FJORD_EXTENTS[region];
  let fade = 1;
  for (const side of OPEN_SIDES[region]) {
    const d = side === "x0" ? x - e.x0 : side === "x1" ? e.x1 - x : side === "z0" ? z - e.z0 : e.z1 - z;
    let f = smooth(0, EDGE_FALL, d);
    // The mainland's east edge meets the village's own land (see coastline.ts) for |z| < ~40: only beyond that
    // does it face open sea and have to sink.
    if (region === "mainland" && side === "x1") f = 1 - smooth(36, 54, Math.abs(z)) * (1 - f);
    fade *= f;
  }
  return fade;
}

function rawFjordHeight(x,z,region) {
  if(!Number.isFinite(x)||!Number.isFinite(z))return 0;
  if(region==="east"){
    if(x<72)return 0;
    // Sparse low islands that appear only in the distance; everything else is
    // sea bed below the water plane. Heights are capped so the horizon stays open.
    const reach=smooth(100,160,x);
    const field=wave(x*1.25+9,z*1.25-13)*.5+ridge(x*.7,z*.7)*.5;
    const land=clamp01((field-.48)/.4);
    const island=Math.pow(land,1.3)*(6+3*reach)*reach;
    return island-5*(1-clamp01(land*4));
  }
  let distance;
  switch(region){
    case "mainland":distance=(-x-44)/85;break;
    case "north":distance=(z-(92+14*Math.sin(x*.027)+5*Math.sin(x*.081)))/78;break;
    case "south":distance=((-z)-(90+13*Math.sin(x*.031)+5*Math.sin(x*.072)))/82;break;
    default:throw new RangeError("Unknown terrain region");
  }
  const approach=clamp01(distance);
  // Rounded piedmont avoids the old nearly vertical wall immediately outside town.
  const slope=Math.pow(approach,1.60)*(1.12-.12*approach);
  const summit=24+56*ridge(x,z)+18*Math.abs(wave(x,z));
  const small=2.9*(Math.sin(x*.38+z*.22)+Math.sin(x*.24-z*.33));
  const height=Math.max(0,slope*(summit+small));
  return region==="mainland"?height:height*flankScale(x);
}
export function coastX(z) {return 13.3+Math.sin(z*.13)*.65+Math.sin(z*.37)*.22;}

// Geometry-aligned height for decorative forest instances. Keep this displacement
// identical to the highland crest modification in fjord.ts; no floating trees.
export function fjordSurfaceHeight(x,z,region){
  const base=fjordHeight(x,z,region)-.16;
  const exposure=Math.min(1.75,Math.max(0,(base-9)/30));
  const crack=Math.sin(x*.145+Math.sin(z*.046)*2.1)*Math.cos(z*.17-x*.033);
  return base+exposure*crack;
}

/**
 * Exact barycentric height of the triangle-strip geometry in fjord.ts.
 * Sampling the analytic noise at a tree's x,z can differ from the rendered
 * mesh between vertices, leaving roots floating or buried in steep relief.
 */
export function fjordMeshHeight(x,z,region,extent,sampleVertex){
  const {x0,x1,z0,z1,columns,rows}=extent;
  if(!Number.isFinite(x)||!Number.isFinite(z)||columns<1||rows<1)
    throw new RangeError("invalid mountain sample");
  const tx=Math.min(columns-1e-7,Math.max(0,(x-x0)/(x1-x0)*columns));
  const tz=Math.min(rows-1e-7,Math.max(0,(z-z0)/(z1-z0)*rows));
  const ix=Math.floor(tx),iz=Math.floor(tz),u=tx-ix,v=tz-iz;
  const xA=x0+(x1-x0)*ix/columns,xB=x0+(x1-x0)*(ix+1)/columns;
  const zA=z0+(z1-z0)*iz/rows,zB=z0+(z1-z0)*(iz+1)/rows;
  // Reuse already-generated BufferGeometry heights when available instead
  // of recomputing four procedural-noise samples per forest candidate.
  const at=(i,j,xx,zz)=>sampleVertex?sampleVertex(i,j):fjordSurfaceHeight(xx,zz,region);
  const a=at(ix,iz,xA,zA);
  const b=at(ix+1,iz,xB,zA);
  const c=at(ix,iz+1,xA,zB);
  const d=at(ix+1,iz+1,xB,zB);
  return u+v<=1 ? a*(1-u-v)+b*u+c*v :
    b*(1-v)+c*(1-u)+d*(u+v-1);
}

/** Terrain height with the open sides sinking into the sea (a seabed below the water plane at the very edge). */
export function fjordHeight(x,z,region) {
  if(!Number.isFinite(x)||!Number.isFinite(z))return 0;
  const raw=rawFjordHeight(x,z,region);
  const e=FJORD_EXTENTS[region];
  if(x<e.x0||x>e.x1||z<e.z0||z>e.z1)return raw; // outside the mesh nothing is drawn: leave the analytic value alone
  const fade=edgeFade(x,z,region);
  return fade>=1?raw:raw*fade+SEABED*(1-fade);
}
