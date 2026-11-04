import { readFileSync, readdirSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";

const base="dist";
for(const path of ["index.html","lab/index.html"]) {
  if(!existsSync(base+"/"+path)) throw Error("missing compiled page: "+path);
  const html=readFileSync(base+"/"+path,"utf8");
  if(!html.includes("/Pixel-Games/assets/")) throw Error("build base URL mismatch: "+path);
}
const assets = readdirSync(base+"/assets").filter(x=>x.endsWith(".js"));
function check(prefix,cap) {
  const js = assets.filter(x=>x.startsWith(prefix+"-"));
  if(!js.length) throw Error("missing JS bundle: "+prefix);
  const bytes = js.reduce((sum,x)=>sum+gzipSync(readFileSync(base+"/assets/"+x)).length,0);
  if(bytes>cap) throw Error(prefix+" gzip bundle "+bytes+" exceeds budget "+cap);
  console.log("PASS: "+prefix+" JS gzip "+bytes+" / "+cap+" bytes.");
}
check("home",50_000);
check("lab",250_000);
