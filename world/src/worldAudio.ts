import type { SkillEvent } from './contractSkills';
/** Short, original synthesized World cues. No microphone, assets, music or audio timers.
 * Call unlock(nativeInputEvent) from a user gesture, and setActive(gameplayActive)
 * from the integration. A failed/blocked audio device must never interrupt gameplay.
 */
export const WORLD_AUDIO_KEY = 'parhelion-world-audio-v1';
export const WORLD_AUDIO_VOICES = 16;
interface Storage { getItem(key:string):string|null; setItem(key:string,value:string):void }
export interface WorldAudioOptions {
  storage?: Storage | null;
  createContext?: () => AudioContext | null;
  foreground?: () => boolean;
  /** Test/embedding injection; defaults to navigator.userActivation.isActive. */
  gesture?: () => boolean;
  listen?: boolean;
}
interface Voice { source: AudioScheduledSourceNode; nodes: AudioNode[]; clean():void }
export class WorldAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private noise: AudioBuffer | null = null;
  private voices = new Set<Voice>();
  private active = false;
  private disposed = false;
  private storage: Storage | null;
  private volumeValue = .35;
  private mutedValue = false;
  private unlisten: (()=>void)[] = [];
  saved = true;
  constructor(private options: WorldAudioOptions = {}) {
    try { this.storage = options.storage === undefined ? (typeof localStorage === 'undefined' ? null : localStorage) : options.storage; }
    catch { this.storage = null; this.saved = false; }
    try {
      const raw = this.storage?.getItem(WORLD_AUDIO_KEY);
      const value = raw ? JSON.parse(raw) : null;
      if (value && typeof value.volume === 'number' && Number.isFinite(value.volume)) this.volumeValue = Math.max(0,Math.min(1,value.volume));
      if (value && typeof value.muted === 'boolean') this.mutedValue = value.muted;
    } catch { this.saved = false; }
    if (options.listen !== false && typeof window !== 'undefined' && typeof document !== 'undefined') {
      const blur = () => this.setActive(false);
      const hidden = () => { if (document.visibilityState !== 'visible') this.setActive(false); };
      window.addEventListener('blur',blur); document.addEventListener('visibilitychange',hidden);
      this.unlisten.push(()=>window.removeEventListener('blur',blur),()=>document.removeEventListener('visibilitychange',hidden));
    }
  }
  get volume() { return this.volumeValue; }
  get muted() { return this.mutedValue; }
  /** Sources, not logical effects: multi-layer cues share this strict budget. */
  get activeVoices() { return this.voices.size; }
  private foreground() {
    try { return this.options.foreground ? this.options.foreground() : typeof document !== 'undefined' && document.visibilityState === 'visible' && document.hasFocus(); }
    catch { return false; }
  }
  unlock(event?: {isTrusted:boolean}): void {
    if (this.disposed || !this.foreground()) return;
    let gesture = event?.isTrusted === true;
    try { gesture ||= this.options.gesture ? this.options.gesture() : typeof navigator !== 'undefined' && navigator.userActivation?.isActive === true; } catch { /* unavailable */ }
    if (!gesture) return;
    try {
      if (!this.context) {
        const context = this.options.createContext ? this.options.createContext() : typeof AudioContext === 'undefined' ? null : new AudioContext();
        if (!context) return;
        this.context = context;
        this.master = context.createGain(); this.master.gain.value = 0;
        this.compressor = context.createDynamicsCompressor();
        this.compressor.threshold.value=-18; this.compressor.knee.value=12; this.compressor.ratio.value=4;
        this.compressor.attack.value=.003; this.compressor.release.value=.12;
        this.master.connect(this.compressor); this.compressor.connect(context.destination);
        // One immutable mono noise buffer reused by every transient in this context.
        this.noise = context.createBuffer(1,context.sampleRate,context.sampleRate);
        const data=this.noise.getChannelData(0);let seed=73129;
        for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;data[i]=(seed>>>0)/2147483648-1;}
      }
      if(this.context.state==='suspended') void this.context.resume().catch(()=>{});
      this.applyGain();
    } catch { this.releaseContext(); }
  }
  setActive(value:boolean) {
    if(this.disposed)return;
    const next=!!value&&this.foreground();if(next===this.active)return;
    this.active=next;this.applyGain();
    if(!this.active){this.stopVoices();try{if(this.context?.state==='running')void this.context.suspend().catch(()=>{});}catch{/* audio is optional */}}
  }
  setVolume(value:number) {
    if(this.disposed||!Number.isFinite(value))return;
    this.volumeValue=Math.max(0,Math.min(1,value));if(this.volumeValue===0)this.stopVoices();this.applyGain();this.persist();
  }
  setMuted(value:boolean) {
    if(this.disposed)return;this.mutedValue=!!value;if(this.mutedValue)this.stopVoices();this.applyGain();this.persist();
  }
  private persist(){try{if(!this.storage){this.saved=false;return;}this.storage.setItem(WORLD_AUDIO_KEY,JSON.stringify({volume:this.volumeValue,muted:this.mutedValue}));this.saved=true;}catch{this.saved=false;}}
  private applyGain(){try{if(this.master&&this.context){this.master.gain.cancelScheduledValues(this.context.currentTime);this.master.gain.setValueAtTime(this.active&&!this.mutedValue&&this.foreground()?this.volumeValue:0,this.context.currentTime);}}catch{/* no gameplay dependency */}}
  private playable(){return !this.disposed&&this.active&&!this.mutedValue&&this.volumeValue>0&&this.foreground()&&this.context?.state==='running';}
  private voice(kind:'noise'|OscillatorType,duration:number,frequency:number,gain:number,slide=1,attack=.004) {
    if(!this.playable()||this.voices.size>=WORLD_AUDIO_VOICES)return;
    const context=this.context!,nodes:AudioNode[]=[];let source:AudioScheduledSourceNode|undefined,voice:Voice|undefined;
    try {
      const now=context.currentTime;
      if(kind==='noise'){
        const noise=context.createBufferSource();source=noise;nodes.push(noise);noise.buffer=this.noise;
        const filter=context.createBiquadFilter();nodes.push(filter);filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=.7;noise.connect(filter);
      } else {
        const oscillator=context.createOscillator();source=oscillator;nodes.push(oscillator);oscillator.type=kind;
        oscillator.frequency.setValueAtTime(frequency,now);oscillator.frequency.exponentialRampToValueAtTime(Math.max(35,frequency*slide),now+duration);
      }
      const envelope=context.createGain();nodes[nodes.length-1].connect(envelope);nodes.push(envelope);
      envelope.gain.setValueAtTime(.0001,now);envelope.gain.exponentialRampToValueAtTime(gain,now+Math.min(duration*.8,Math.max(.004,attack)));envelope.gain.exponentialRampToValueAtTime(.0001,now+duration);
      envelope.connect(this.master!);
      let ended=false;
      voice={source,nodes,clean:()=>{if(ended)return;ended=true;source!.onended=null;for(const node of nodes)try{node.disconnect();}catch{/* already disconnected */}this.voices.delete(voice!);}};
      this.voices.add(voice);source.onended=voice.clean;source.start(now);source.stop(now+duration+.01);
    } catch { if(source)try{source.stop();}catch{/* may not have started */}if(voice)voice.clean();else for(const node of nodes)try{node.disconnect();}catch{/* best effort */} }
  }
  private stopVoices(){for(const voice of [...this.voices]){try{voice.source.stop();}catch{/* ended */}voice.clean();}}
  shot(){this.voice('noise',.065,2400,.18);this.voice('sine',.075,135,.16,.45);}
  cannon(){this.voice('noise',.34,650,.28);this.voice('sine',.38,90,.25,.4);}
  melee(){this.voice('noise',.13,1900,.11);this.voice('triangle',.11,220,.035,1.6);}
  contact(){this.voice('noise',.04,3100,.10);this.voice('triangle',.06,1050,.045,.75);}
  hurt(){this.voice('noise',.11,380,.13);this.voice('sine',.13,165,.10,.6);}
  kill(){this.voice('triangle',.16,660,.065,1.5);this.voice('sine',.2,1320,.035,1.1);}
  skill(){this.voice('triangle',.22,330,.075,2);this.voice('noise',.16,1600,.06);}
  /** Cast anticipation and authored release cues; never implies that a target was hit. */
  skillEvent(event: SkillEvent) {
    if(event.type==='guard')return;
    const ultimate=event.slot==='ultimate';
    if(event.type==='cast') {
      // Original sword charge: one bounded rising harmonic, not a looping music bed.
      if(ultimate&&event.identity==='saber'){this.voice('triangle',.60,260,.065,2.8,.38);return;}
      const pitch=event.identity==='napoleon'?130:event.identity==='blackbeard'?210:event.identity==='musashi'?490:330;
      this.voice('triangle',ultimate?.44:.24,pitch,.045,ultimate?1.8:1.35);return;
    }
    switch(event.identity){
      case 'saber':
        if(ultimate){
          // Only an authored strike releases this three-layer cue. Air/weight/ring
          // have distinct envelopes; all share the same strict 16-source budget.
          this.voice('noise',.18,1450,.14);
          this.voice('sine',.28,110,.18,.4);
          this.voice('triangle',.58,880,.045,1.5,.012);
        }else{this.voice('noise',.23,1100,.10);this.voice('triangle',.24,440,.055,2.2);}
        break;
      case 'blackbeard':
        if(ultimate){
          // Three original broadside layers per real cannon contact: powder, body, hull ring.
          this.voice('noise',.22,650+event.pulse*80,.17);
          this.voice('sine',.32,92-event.pulse*6,.14,.42);
          this.voice('triangle',.20,230,.035,.7);
        }else{this.voice('noise',.12,2100,.16);this.voice('sine',.22,165,.12,.45);}
        break;
      case 'napoleon':
        if(ultimate){
          // Mounted sword impact, not artillery: steel air, hoof weight, rising blade resonance.
          this.voice('noise',.18,980,.11);
          this.voice('sine',.24,135,.13,.55);
          this.voice('triangle',.42,620,.045,1.7);
        }else{this.voice('noise',.26,420,.11);this.voice('triangle',.22,125,.10,.55);}
        break;
      case 'musashi':
        if(ultimate){
          // Alternating steel sweeps; only the authored third contact earns the heavier end cut.
          const final=event.pulse===2;
          this.voice('noise',.11,2600+event.pulse*450,.10);
          this.voice('triangle',.18,680+event.pulse*170,.06,event.pulse%2?.72:1.9);
          this.voice('sine',final?.24:.14,final?160:210,final?.11:.045,.6);
        }else{this.voice('noise',.12,1900+event.pulse*450,.095);this.voice('triangle',.13,520+event.pulse*130,.045,1.65);}
        break;
      default:this.skill();
    }
  }
  evade(){this.voice('noise',.17,2600,.085);}
  interaction(){this.voice('sine',.12,520,.055,1.5);}
  private releaseContext(){this.stopVoices();for(const node of [this.master,this.compressor])try{node?.disconnect();}catch{/* best effort */}try{if(this.context&&this.context.state!=='closed')void this.context.close().catch(()=>{});}catch{/* unavailable */}this.context=null;this.master=null;this.compressor=null;this.noise=null;}
  dispose(){if(this.disposed)return;this.disposed=true;this.active=false;this.releaseContext();for(const remove of this.unlisten)remove();this.unlisten=[];}
}
