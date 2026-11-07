/**
 * The coast's sound, synthesised with the Web Audio API: no recordings, so there is nothing to license, nothing to
 * download and the levels follow the game state exactly (the shared wind, the waves, the hour, where you stand).
 * Wind, surf, foliage and lapping water are filtered noise; seagulls, bells and crickets are small synths; footsteps,
 * splashes and the reel are short noise or tone bursts. This is a deliberate choice: real recordings sound better for
 * surf and gulls, and every layer here has a clear place to be replaced by a verified-licence sample later
 * (see `LAYERS` and `sampleFor`), but none could be obtained and verified for this project.
 */
import { soundscapeMix, groundSurface, stepInterval } from "./audio-mix.js";

export type SoundState={
  time:number;                              // seconds, monotonic (any clock)
  x:number;z:number;                        // the traveller
  night:number;windStrength:number;gust:number;
  aboard:boolean;speed:number;sprint:boolean;
  gulls?:{x:number;y:number;z:number;flying:boolean}[];
  hour:number;
  listener?:{x:number;y:number;z:number;fx:number;fy:number;fz:number};
};
export type AudioSettings={master:number;ambient:number;sfx:number;muted:boolean};
export const DEFAULT_AUDIO:AudioSettings={master:.8,ambient:1,sfx:1,muted:false};
export const CHURCH_POS={x:-39,z:0};
const rand=(a:number,b:number)=>a+Math.random()*(b-a);

export function createSoundscape(ctx:BaseAudioContext,opts:{quality?:"basic"|"balanced"|"high";settings?:AudioSettings}={}){
  const quality=opts.quality??"balanced";
  const settings:AudioSettings={...DEFAULT_AUDIO,...(opts.settings??{})};
  // ---- mix graph: layers -> ambient/sfx buses -> master -> limiter -> out ----
  const out=ctx.createGain();
  const limiter=ctx.createDynamicsCompressor();
  limiter.threshold.value=-9;limiter.knee.value=8;limiter.ratio.value=6;limiter.attack.value=.004;limiter.release.value=.25;
  const master=ctx.createGain(),ambientBus=ctx.createGain(),sfxBus=ctx.createGain();
  // phone speakers cannot reproduce the bottom octaves: keep them from eating the headroom
  const rumble=ctx.createBiquadFilter();rumble.type="highpass";rumble.frequency.value=85;rumble.Q.value=.6;
  ambientBus.connect(rumble);rumble.connect(master);sfxBus.connect(master);master.connect(limiter);limiter.connect(out);out.connect(ctx.destination);
  const applySettings=(when=ctx.currentTime)=>{
    master.gain.setTargetAtTime(settings.muted?0:settings.master,when,.05);
    ambientBus.gain.setTargetAtTime(settings.ambient,when,.05);sfxBus.gain.setTargetAtTime(settings.sfx,when,.05);
  };
  applySettings(0);

  // ---- noise sources (made once, looped, started at random offsets) ----
  const rate=ctx.sampleRate,len=Math.round(rate*5);
  const pinkBuf=ctx.createBuffer(2,len,rate),brownBuf=ctx.createBuffer(1,len,rate),whiteBuf=ctx.createBuffer(1,rate,rate);
  for(let c=0;c<2;c++){
    const d=pinkBuf.getChannelData(c);let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for(let i=0;i<len;i++){                                  // Paul Kellet's pink-noise filter
      const w=Math.random()*2-1;
      b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;
      d[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)*.11;b6=w*.115926;
    }
  }
  {const d=brownBuf.getChannelData(0);let last=0;for(let i=0;i<len;i++){last=(last+.02*(Math.random()*2-1))/1.02;d[i]=last*3.2;}}
  {const d=whiteBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
  const loop=(buf:AudioBuffer)=>{const s=ctx.createBufferSource();s.buffer=buf;s.loop=true;s.start(0,Math.random()*buf.duration);return s;};
  const filter=(type:BiquadFilterType,f:number,q=.7)=>{const n=ctx.createBiquadFilter();n.type=type;n.frequency.value=f;n.Q.value=q;return n;};
  const gain=(v=0)=>{const g=ctx.createGain();g.gain.value=v;return g;};
  const pan=(v=0)=>{const p=ctx.createStereoPanner();p.pan.value=v;return p;};
  const sources:AudioScheduledSourceNode[]=[];

  // ---- wind: pink noise through a moving band, plus a low howl that only wakes in a strong wind ----
  const windSrc=loop(pinkBuf),windBand=filter("bandpass",420,.55),windLow=filter("lowpass",2200),windGain=gain(0),windPan=pan(0);
  windSrc.connect(windBand);windBand.connect(windLow);windLow.connect(windGain);windGain.connect(windPan);windPan.connect(ambientBus);sources.push(windSrc);
  const howlSrc=loop(brownBuf),howlBand=filter("bandpass",170,5),howlGain=gain(0);
  howlSrc.connect(howlBand);howlBand.connect(howlGain);howlGain.connect(ambientBus);sources.push(howlSrc);

  // ---- surf: two wave trains a little out of step; each swells, crests (hiss) and draws back ----
  const surfSrc=loop(pinkBuf),surfLow=filter("lowpass",900,.5),surfGain=gain(0),surfPan=pan(0);
  surfSrc.connect(surfLow);surfLow.connect(surfGain);surfGain.connect(surfPan);surfPan.connect(ambientBus);sources.push(surfSrc);
  const crestSrc=loop(pinkBuf),crestHp=filter("highpass",2400,.6),crestGain=gain(0);
  crestSrc.connect(crestHp);crestHp.connect(crestGain);crestGain.connect(surfPan);sources.push(crestSrc);

  // ---- foliage: a dry rustle in the high mids; lapping water: low irregular slaps ----
  const leafSrc=loop(pinkBuf),leafHp=filter("highpass",2000),leafBp=filter("bandpass",4300,.8),leafGain=gain(0);
  leafSrc.connect(leafHp);leafHp.connect(leafBp);leafBp.connect(leafGain);leafGain.connect(ambientBus);sources.push(leafSrc);
  const lapSrc=loop(brownBuf),lapBp=filter("bandpass",260,1.4),lapGain=gain(0);
  lapSrc.connect(lapBp);lapBp.connect(lapGain);lapGain.connect(ambientBus);sources.push(lapSrc);

  // ---- crickets: two detuned, pulsed tones ----
  const crickets=quality==="basic"?null:(()=>{
    const g=gain(0),voices=[4300,4520].map((f,i)=>{
      const o=ctx.createOscillator();o.type="sine";o.frequency.value=f;
      const am=gain(0),lfo=ctx.createOscillator();lfo.frequency.value=11+i*1.7;lfo.type="square";
      const lfoDepth=gain(.5),dc=ctx.createConstantSource();dc.offset.value=.5;
      lfo.connect(lfoDepth);lfoDepth.connect(am.gain);dc.connect(am.gain);o.connect(am);am.connect(g);
      sources.push(o,lfo,dc);o.start(0);lfo.start(0);dc.start(0);return o;
    });
    g.connect(ambientBus);return {g,voices};
  })();
  for(const s of sources){try{(s as AudioBufferSourceNode).start?.(0);}catch{/* already started */}}

  // ---- one-shots ----
  const when0=()=>ctx.currentTime;
  function burst(opts:{buf?:AudioBuffer;type:BiquadFilterType;f0:number;f1?:number;q?:number;dur:number;peak:number;attack?:number;at?:number;bus?:AudioNode;panValue?:number}){
    const t=opts.at??when0(),src=ctx.createBufferSource();src.buffer=opts.buf??whiteBuf;
    const f=filter(opts.type,opts.f0,opts.q??.8),g=gain(0),p=pan(opts.panValue??0);
    f.frequency.setValueAtTime(opts.f0,t);if(opts.f1)f.frequency.exponentialRampToValueAtTime(opts.f1,t+opts.dur);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(opts.peak,t+(opts.attack??.008));g.gain.exponentialRampToValueAtTime(.0001,t+opts.dur);
    src.connect(f);f.connect(g);g.connect(p);p.connect(opts.bus??sfxBus);src.start(t,Math.random()*.5);src.stop(t+opts.dur+.05);
  }
  function tone(opts:{type:OscillatorType;f0:number;f1?:number;dur:number;peak:number;at?:number;dest?:AudioNode;attack?:number}){
    const t=opts.at??when0(),o=ctx.createOscillator(),g=gain(0);o.type=opts.type;o.frequency.setValueAtTime(opts.f0,t);
    if(opts.f1)o.frequency.exponentialRampToValueAtTime(opts.f1,t+opts.dur);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(opts.peak,t+(opts.attack??.006));g.gain.exponentialRampToValueAtTime(.0001,t+opts.dur);
    o.connect(g);g.connect(opts.dest??sfxBus);o.start(t);o.stop(t+opts.dur+.05);
  }
  const listener=ctx.listener;
  function placed(x:number,y:number,z:number,ref=8){
    const p=ctx.createPanner();p.panningModel=quality==="high"?"HRTF":"equalpower";p.distanceModel="inverse";p.refDistance=ref;p.maxDistance=160;p.rolloffFactor=1.15;
    if(p.positionX){p.positionX.value=x;p.positionY.value=y;p.positionZ.value=z;}else (p as any).setPosition?.(x,y,z);
    p.connect(sfxBus);return p;
  }
  const api={
    /** A seagull's call: a few harsh, falling "kyow" syllables at a place in the sky. */
    gull(x:number,y:number,z:number,at=when0()){
      const p=placed(x,y,z,10),n=2+Math.floor(Math.random()*4),base=rand(1500,2000);
      let t=at;
      for(let i=0;i<n;i++){
        const dur=rand(.16,.26),f=filter("bandpass",rand(1700,2300),1.2),g=gain(0),lp=filter("lowpass",4200);
        const o1=ctx.createOscillator(),o2=ctx.createOscillator(),vib=ctx.createOscillator(),vibG=gain(40);
        o1.type="sawtooth";o2.type="sawtooth";vib.frequency.value=rand(18,26);vib.connect(vibG);vibG.connect(o1.frequency);vibG.connect(o2.frequency);
        const hi=base*rand(1.15,1.4);
        for(const [o,d] of [[o1,1],[o2,1.012]] as const){o.frequency.setValueAtTime(base*d*.8,t);o.frequency.linearRampToValueAtTime(hi*d,t+dur*.25);o.frequency.exponentialRampToValueAtTime(base*d*.62,t+dur);}
        g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.16,t+.025);g.gain.setValueAtTime(.13,t+dur*.5);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
        o1.connect(f);o2.connect(f);f.connect(lp);lp.connect(g);g.connect(p);
        for(const o of [o1,o2,vib]){o.start(t);o.stop(t+dur+.05);}
        t+=dur+rand(.07,.16);
      }
    },
    /** Footstep on a surface at a position underfoot. */
    step(surface:"wood"|"sand"|"stone",sprint=false,at=when0()){
      const v=rand(.8,1.2),k=sprint?1.25:1,pn=rand(-.08,.08);
      if(surface==="wood"){
        burst({type:"bandpass",f0:190*v,q:3.2,dur:.16,peak:.55*k,at,panValue:pn});
        burst({type:"lowpass",f0:1400*v,dur:.04,peak:.22*k,at,panValue:pn});
        tone({type:"sine",f0:115*v,f1:70,dur:.12,peak:.3*k,at});
      }else if(surface==="stone"){
        burst({type:"bandpass",f0:1700*v,q:1.1,dur:.06,peak:.4*k,at,panValue:pn});
        burst({type:"lowpass",f0:420*v,dur:.07,peak:.3*k,at,panValue:pn});
      }else{
        burst({buf:pinkBuf,type:"lowpass",f0:1900*v,f1:600,dur:.16,peak:.32*k,attack:.03,at,panValue:pn});
      }
    },
    /** A splash of a given strength 0..1; with a position it comes from that place. */
    splash(strength:number,pos?:{x:number;y:number;z:number},at=when0()){
      const s=Math.min(1,Math.max(0,strength));
      const bus=pos?placed(pos.x,pos.y,pos.z,6):undefined;
      burst({buf:pinkBuf,type:"lowpass",f0:3600,f1:700,dur:.25+.4*s,peak:.2+.55*s,attack:.012,at,bus});
      burst({type:"highpass",f0:3000,dur:.1+.12*s,peak:.12+.2*s,at,bus});
      if(s>.35)tone({type:"sine",f0:240,f1:90,dur:.18,peak:.25*s,at,dest:bus??sfxBus});     // a "bloop"
    },
    cast(at=when0()){burst({buf:pinkBuf,type:"bandpass",f0:400,f1:2400,q:1.6,dur:.32,peak:.34,attack:.05,at});burst({buf:pinkBuf,type:"bandpass",f0:2400,f1:500,q:1.6,dur:.3,peak:.2,at:at+.28});},
    reelTick(at=when0()){tone({type:"square",f0:2700,dur:.012,peak:.07,at});burst({type:"highpass",f0:3800,dur:.008,peak:.06,at});},
    oar(speed:number,at=when0()){
      const s=Math.min(1,.25+speed/3);
      burst({buf:pinkBuf,type:"lowpass",f0:2600,f1:600,dur:.3+.2*s,peak:.2+.35*s,attack:.02,at});
      tone({type:"sawtooth",f0:150,f1:210,dur:.22,peak:.04+.05*s,at:at+.04});                        // the oarlock creaks
    },
    strike(at=when0()){api.splash(.8,undefined,at);},
    /** A church bell: inharmonic partials with long, separate decays (hum, prime, minor tierce, quint, nominal ...). */
    bell(strokes=3,at=when0()){
      const lp=filter("lowpass",2800),p=placed(CHURCH_POS.x,6,CHURCH_POS.z,18);lp.connect(p);
      const partials:[number,number,number][]=[[.5,7,.5],[1,6,1],[1.19,4.5,.55],[1.5,3.2,.4],[2,2.6,.45],[2.5,1.6,.2],[3.2,1.1,.15]];
      for(let s=0;s<strokes;s++){
        const t=at+s*2.4;
        for(const [ratio,decay,amp] of partials)tone({type:"sine",f0:233*ratio,dur:decay,peak:.16*amp,at:t,dest:lp,attack:.004});
        burst({type:"bandpass",f0:900,q:2,dur:.06,peak:.1,at:t,bus:lp});
      }
    },
  };

  // ---- per-frame update: ambient levels follow the mix; waves swell on their own clock; events are scheduled ----
  let wavePhaseA=rand(0,1),wavePhaseB=rand(0,1),lastTime:number|null=null,gullTimer=rand(2,6),stepTimer=0,lapTimer=0,lastHour:number|null=null;
  const waveEnv=(p:number)=>p<.5?Math.pow(p/.5,1.8):Math.pow((1-p)/.5,1.15);
  function update(s:SoundState,when=ctx.currentTime){
    const dt=lastTime===null?0:Math.min(.25,Math.max(0,s.time-lastTime));lastTime=s.time;
    const m=soundscapeMix(s);
    const tc=.35;
    // wind: a moving band, louder and brighter in a gust, with a howl in a strong wind
    windGain.gain.setTargetAtTime(m.wind*.5,when,tc);
    windBand.frequency.setTargetAtTime(300+520*s.gust*Math.min(1.4,s.windStrength),when,.3);
    windPan.pan.setTargetAtTime(Math.sin(s.time*.11)*.5,when,.5);
    howlGain.gain.setTargetAtTime(Math.max(0,s.windStrength-1.15)*.55*m.wind,when,.6);
    // surf: two wave trains with a ~9 s period, each swelling, hissing at the crest and drawing back
    wavePhaseA=(wavePhaseA+dt/9.3)%1;wavePhaseB=(wavePhaseB+dt/7.4)%1;
    const e=Math.min(1,waveEnv(wavePhaseA)*.7+waveEnv(wavePhaseB)*.5);
    surfGain.gain.setTargetAtTime(m.surf*(.1+.9*e)*.6,when,.12);
    surfLow.frequency.setTargetAtTime(500+1500*e,when,.15);
    crestGain.gain.setTargetAtTime(m.surf*Math.pow(waveEnv(wavePhaseA),3)*.22,when,.08);
    surfPan.pan.setTargetAtTime(Math.sin(s.time*.07)*.45,when,.6);
    // foliage and lapping water
    leafGain.gain.setTargetAtTime(m.foliage*(.1+.12*s.gust)*(quality==="basic"?0:1),when,.4);
    lapTimer-=dt;if(lapTimer<=0){lapTimer=rand(.35,1.1);lapGain.gain.setTargetAtTime(m.lap*rand(.04,.2),when,.12);lapBp.frequency.setTargetAtTime(rand(180,380),when,.2);}
    if(crickets)crickets.g.gain.setTargetAtTime(m.crickets*.025,when,1.2);
    // listener
    if(s.listener){const L=s.listener;
      if(listener.positionX){listener.positionX.value=L.x;listener.positionY.value=L.y;listener.positionZ.value=L.z;
        listener.forwardX.value=L.fx;listener.forwardY.value=L.fy;listener.forwardZ.value=L.fz;listener.upX.value=0;listener.upY.value=1;listener.upZ.value=0;}
      else{(listener as any).setPosition?.(L.x,L.y,L.z);(listener as any).setOrientation?.(L.fx,L.fy,L.fz,0,1,0);}}
    // seagulls call from the real gulls near you, by day
    gullTimer-=dt;
    if(gullTimer<=0&&s.gulls){
      gullTimer=rand(5,14)/Math.max(.15,m.gullRate);
      if(m.gullRate>.05){
        const near=s.gulls.filter(g=>g.flying&&Math.hypot(g.x-s.x,g.z-s.z)<70);
        if(near.length){const g=near[Math.floor(Math.random()*near.length)];api.gull(g.x,g.y,g.z,when);}
      }
    }
    // footsteps
    if(!s.aboard&&s.speed>.4){
      stepTimer-=dt;
      if(stepTimer<=0){stepTimer=stepInterval(s.speed);api.step(groundSurface(s.x,s.z),s.sprint,when);}
    }else stepTimer=0;
    // a bell at dawn, noon and dusk (three strokes), once per crossing
    if(lastHour!==null){
      for(const h of [6,12,18]){if((lastHour<h&&s.hour>=h)&&Math.abs(s.hour-lastHour)<1)api.bell(3,when);}
    }
    lastHour=s.hour;
    return m;
  }
  function setSettings(next:Partial<AudioSettings>){Object.assign(settings,next);applySettings();}
  function dispose(){for(const n of sources){try{n.stop();}catch{/* ignore */}}out.disconnect();}
  /** Where a verified-licence recording could replace a synthesised layer later. */
  const LAYERS=["wind","surf","foliage","lap","crickets","gull","step","splash","bell"] as const;
  return {update,api,setSettings,settings,dispose,LAYERS,out,nodes:{windGain,surfGain,leafGain,lapGain,howlGain,crestGain,master}};
}
export type Soundscape=ReturnType<typeof createSoundscape>;
