// User-exported performance snapshot. Browser RAF intervals are not GPU timing.
const approximateFps=ms=>Number.isFinite(ms)&&ms>0?Math.round(10000/ms)/10:null;
export function makePerformanceSnapshot({capturedAt,frame,device,run,renderer}){
  return {
    schemaVersion:1,
    capturedAt,
    source:"requestAnimationFrame frame interval (not a GPU timer or thermal benchmark)",
    device,run,renderer,
    frame:{...frame,medianFpsApprox:approximateFps(frame.p50Ms),lowFpsApprox:approximateFps(frame.p95Ms)},
    validity:{usable:frame.count>=60,minimumFrames:60,notes:"Rolling sample captured on settings open. Play at least 15 seconds with settings closed; compare identical view, time, weather and device conditions."}
  };
}
