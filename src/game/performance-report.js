// User-exported performance snapshot. Browser RAF intervals are not GPU timing.
const approximateFps=ms=>Number.isFinite(ms)&&ms>0?Math.round(10000/ms)/10:null;
export function makePerformanceSnapshot({capturedAt,frame,device,run,renderer}){
  return {
    schemaVersion:1,
    capturedAt,
    source:"requestAnimationFrame frame interval (not a GPU timer or thermal benchmark)",
    device,run,renderer,
    frame:{...frame,medianFpsApprox:approximateFps(frame.p50Ms),lowFpsApprox:approximateFps(frame.p95Ms)},
    // The rate may be 5, 30, 60 or 120+ FPS: a fixed 60-frame threshold
    // says nothing about elapsed time, and rejects exactly the slow phones we need to diagnose.
    validity:{
      usable:frame.count>=10 && Number.isFinite(frame.meanMs) && frame.meanMs*frame.count>=15000,
      minimumFrames:10,
      minimumDurationMs:15000,
      measuredDurationMs:Number.isFinite(frame.meanMs)?Math.round(frame.meanMs*frame.count):0,
      notes:"Samples collected only while playing, reset on settings close, quality change or tab visibility change; this is browser frame pacing, not GPU time."
    }
  };
}
