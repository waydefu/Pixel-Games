// WebGL2 GPU elapsed queries are asynchronous; never wait for a result on the render thread.
export function createGpuTimer(gl, {maxPending=120}={}) {
  const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  let active=false, recording=false, query=null, queryAt=0, queryPhase='total', pending=[],samples=[],reason=ext?null:'UNSUPPORTED',dropped=0;
  function clear() { for(const item of pending)gl.deleteQuery(item.query);pending=[];if(query){gl.deleteQuery(query);query=null;} }
  function fail(message) {if(!reason)reason=message;recording=false;clear();}
  function start() {
    clear();samples=[];dropped=0;active=true;recording=!!ext;reason=ext?null:'UNSUPPORTED';
    if(ext)gl.getParameter(ext.GPU_DISJOINT_EXT); // discard stale disjoint state
  }
  function poll() {
    if(!active||!ext||reason)return;
    if(gl.isContextLost()){fail('CONTEXT_LOST');return;}
    if(gl.getParameter(ext.GPU_DISJOINT_EXT)){fail('DISJOINT');samples=[];return;}
    const waiting=[];
    for(const item of pending){
      if(!gl.getQueryParameter(item.query,gl.QUERY_RESULT_AVAILABLE)){waiting.push(item);continue;}
      const ns=gl.getQueryParameter(item.query,gl.QUERY_RESULT);gl.deleteQuery(item.query);
      if(Number.isFinite(ns)&&ns>0)samples.push({atMs:item.atMs,gpuMs:ns/1e6,...(item.phase==='total'?{}:{phase:item.phase})});else dropped++;
    }
    pending=waiting;
  }
  function begin(atMs,phase='total') {
    if(!active||!recording||reason)return;
    poll();if(reason)return;
    if(query||pending.length>=maxPending){dropped++;return;}
    query=gl.createQuery();if(!query){dropped++;return;}
    gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
    queryAt=atMs;queryPhase=phase;
  }
  function end() {
    if(!query)return;
    gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push({query,atMs:queryAt,phase:queryPhase});query=null;
  }
  function stop() {recording=false;poll();}
  function read() {poll();return {status:reason??(pending.length?'PENDING':samples.length?'OK':'NO_SAMPLES'),samples:[...samples],pending:pending.length,dropped};}
  function dispose(){recording=false;active=false;clear();}
  return {start,begin,end,stop,poll,read,dispose};
}
