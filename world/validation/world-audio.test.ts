import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldAudio, WORLD_AUDIO_KEY, WORLD_AUDIO_VOICES } from '../src/worldAudio';

class Parameter {value=0;events:{kind:string,value:number,time:number}[]=[];setValueAtTime(value:number,time=0){this.value=value;this.events.push({kind:'set',value,time});}exponentialRampToValueAtTime(value:number,time=0){this.value=value;this.events.push({kind:'ramp',value,time});}cancelScheduledValues(){}}
class Node {
  gain=new Parameter();frequency=new Parameter();Q=new Parameter();threshold=new Parameter();knee=new Parameter();ratio=new Parameter();attack=new Parameter();release=new Parameter();
  onended:(()=>void)|null=null;buffer:unknown;type='';disconnections=0;started=false;stops=0;stopTimes:(number|undefined)[]=[];
  connect(node:Node){return node;}disconnect(){this.disconnections++;}start(){this.started=true;}stop(time?:number){this.stops++;this.stopTimes.push(time);}end(){this.onended?.();}
}
class Context {
  currentTime=0;sampleRate=48000;state='running';destination=new Node();nodes:Node[]=[];sources:Node[]=[];buffers=0;resumes=0;suspends=0;closes=0;
  node(){const node=new Node();this.nodes.push(node);return node;}
  createGain(){return this.node();}createDynamicsCompressor(){return this.node();}createBiquadFilter(){return this.node();}
  createBufferSource(){const n=this.node();this.sources.push(n);return n;}createOscillator(){const n=this.node();this.sources.push(n);return n;}
  createBuffer(_channels:number,length:number){this.buffers++;return{getChannelData:()=>new Float32Array(length)};}
  async resume(){this.resumes++;this.state='running';}async suspend(){this.suspends++;this.state='suspended';}async close(){this.closes++;this.state='closed';}
}
const trusted={isTrusted:true};
function fixture(){const context=new Context();let calls=0,foreground=true;const audio=new WorldAudio({createContext:()=>{calls++;return context as unknown as AudioContext;},foreground:()=>foreground,gesture:()=>false,storage:null,listen:false});return{audio,context,calls:()=>calls,hide:()=>{foreground=false;}};}

test('no context or playback before a foreground user gesture; missing AudioContext is safe',()=>{
 const f=fixture();f.audio.setActive(true);f.audio.shot();f.audio.unlock();f.audio.unlock({isTrusted:false});assert.equal(f.calls(),0);
 f.hide();f.audio.unlock(trusted);assert.equal(f.calls(),0);f.audio.dispose();
 const absent=new WorldAudio({foreground:()=>true,gesture:()=>false,createContext:()=>null,listen:false});assert.doesNotThrow(()=>{absent.unlock(trusted);absent.setActive(true);absent.shot();absent.dispose();});
 const browserAbsent=new WorldAudio({foreground:()=>true,gesture:()=>false,listen:false});assert.doesNotThrow(()=>{browserAbsent.unlock(trusted);browserAbsent.cannon();browserAbsent.dispose();});
});
test('strict source budget drops excess layers, reuses noise and disconnects every ended node',()=>{
 const f=fixture();f.audio.unlock(trusted);f.audio.setActive(true);
 for(let i=0;i<1000;i++)f.audio.shot();assert.equal(f.audio.activeVoices,WORLD_AUDIO_VOICES);assert.equal(f.context.sources.length,WORLD_AUDIO_VOICES);assert.equal(f.context.buffers,1);
 const voices=f.context.nodes.slice(2);for(const source of f.context.sources)source.end();assert.equal(f.audio.activeVoices,0);assert.ok(voices.every(n=>n.disconnections===1));
 f.audio.cannon();assert.equal(f.audio.activeVoices,2);assert.equal(f.context.buffers,1);f.audio.dispose();assert.ok(f.context.nodes.every(n=>n.disconnections===1));
});
test('menu mute cancels tails and requires another gesture to resume the suspended device',()=>{
 const f=fixture();f.audio.unlock(trusted);f.audio.setActive(true);f.audio.skill();assert.equal(f.audio.activeVoices,2);
 f.audio.setActive(false);assert.equal(f.audio.activeVoices,0);assert.equal(f.context.suspends,1);
 f.audio.setActive(true);f.audio.shot();assert.equal(f.audio.activeVoices,0);assert.equal(f.context.resumes,0);
 f.audio.unlock(trusted);f.audio.shot();assert.equal(f.audio.activeVoices,2);assert.equal(f.context.resumes,1);
 f.audio.setMuted(true);assert.equal(f.audio.activeVoices,0);f.audio.shot();assert.equal(f.audio.activeVoices,0);
 f.audio.setMuted(false);f.audio.setVolume(0);f.audio.cannon();assert.equal(f.audio.activeVoices,0);f.audio.dispose();
});
test('volume/mute persist safely with low defaults, validation and denied storage',()=>{
 const map=new Map<string,string>(),storage={getItem:(key:string)=>map.get(key)??null,setItem:(key:string,value:string)=>{map.set(key,value);}};
 const a=new WorldAudio({storage,listen:false});assert.equal(a.volume,.35);assert.equal(a.muted,false);a.setVolume(.6);a.setMuted(true);
 const b=new WorldAudio({storage,listen:false});assert.equal(b.volume,.6);assert.equal(b.muted,true);b.setVolume(99);assert.equal(b.volume,1);b.setVolume(NaN);assert.equal(b.volume,1);
 assert.deepEqual(JSON.parse(map.get(WORLD_AUDIO_KEY)!),{volume:1,muted:true});
 const denied=new WorldAudio({storage:{getItem(){throw new Error('denied');},setItem(){throw new Error('denied');}},listen:false});assert.equal(denied.volume,.35);assert.doesNotThrow(()=>denied.setVolume(.2));assert.equal(denied.saved,false);assert.equal(denied.volume,.2);
 map.set(WORLD_AUDIO_KEY,'{"volume":"loud","muted":"yes"}');const invalid=new WorldAudio({storage,listen:false});assert.equal(invalid.volume,.35);assert.equal(invalid.muted,false);
 for(const audio of[a,b,denied,invalid])audio.dispose();
});
test('all cues are bounded transients; repeated dispose or later calls cannot recreate resources',()=>{
 const f=fixture();f.audio.unlock(trusted);f.audio.setActive(true);
 for(const name of ['shot','cannon','melee','contact','hurt','kill','skill','evade','interaction'] as const){f.audio[name]();for(const node of f.context.sources)node.end();assert.equal(f.audio.activeVoices,0);}
 assert.ok(f.context.sources.every(node=>node.started&&node.stops===1));f.audio.shot();f.audio.dispose();f.audio.dispose();
 const nodes=f.context.nodes.length;f.audio.unlock(trusted);f.audio.setActive(true);f.audio.shot();assert.equal(f.context.nodes.length,nodes);assert.equal(f.context.closes,1);assert.equal(f.calls(),1);
});
test('creation/start/resume failures are swallowed without leaving tracked voices',async()=>{
 const a=new WorldAudio({foreground:()=>true,createContext:()=>{throw new Error('device');},listen:false});assert.doesNotThrow(()=>a.unlock(trusted));a.dispose();
 const f=fixture();f.context.createOscillator=()=>{throw new Error('node allocation');};f.audio.unlock(trusted);f.audio.setActive(true);assert.doesNotThrow(()=>f.audio.interaction());assert.equal(f.audio.activeVoices,0);f.audio.dispose();
 const g=fixture();g.context.state='suspended';g.context.resume=async()=>{throw new Error('autoplay denied');};g.audio.unlock(trusted);await Promise.resolve();g.audio.setActive(true);g.audio.shot();assert.equal(g.audio.activeVoices,0);g.audio.dispose();
});
test('foreground loss stops voices via module listeners and dispose removes those listeners',()=>{
 const oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),oldDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
 const handlers=new Map<string,()=>void>();const target={addEventListener:(name:string,fn:()=>void)=>handlers.set(name,fn),removeEventListener:(name:string)=>handlers.delete(name)};
 Object.defineProperty(globalThis,'window',{value:target,configurable:true});Object.defineProperty(globalThis,'document',{value:{...target,visibilityState:'visible',hasFocus:()=>true},configurable:true});
 try{const context=new Context(),audio=new WorldAudio({createContext:()=>context as unknown as AudioContext,gesture:()=>false,storage:null});audio.unlock(trusted);audio.setActive(true);audio.shot();assert.equal(audio.activeVoices,2);handlers.get('blur')!();assert.equal(audio.activeVoices,0);assert.equal(context.state,'suspended');audio.dispose();assert.equal(handlers.size,0);}
 finally{if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else Reflect.deleteProperty(globalThis,'window');if(oldDocument)Object.defineProperty(globalThis,'document',oldDocument);else Reflect.deleteProperty(globalThis,'document');}
});

test('servant cast/release cues stay inside the shared voice budget and mute cancels them',()=>{
 const f=fixture();f.audio.unlock(trusted);f.audio.setActive(true);const signatures=new Set<string>();
 for(const identity of ['saber','blackbeard','napoleon','musashi'] as const)for(const slot of ['skill','ultimate'] as const){
  const common={identity,slot,origin:{x:0,y:0,z:0},direction:{x:0,y:0,z:1}};
  f.audio.skillEvent({...common,type:'cast',duration:1});assert.equal(f.audio.activeVoices,1);for(const node of f.context.sources)node.end();
  const start=f.context.sources.length;f.audio.skillEvent({...common,type:'strike',range:10,halfWidth:2,damage:30,maxTargets:2,pulse:0,at:.2});assert.equal(f.audio.activeVoices,slot==='ultimate'?3:2);
  signatures.add(JSON.stringify(f.context.sources.slice(start).map(n=>[n.type,n.frequency.value])));for(const node of f.context.sources)node.end();
 }
 assert.ok(signatures.size>=6);for(let i=0;i<100;i++)f.audio.skill();assert.equal(f.audio.activeVoices,WORLD_AUDIO_VOICES);f.audio.setMuted(true);assert.equal(f.audio.activeVoices,0);f.audio.dispose();
});

test('Saber ultimate has a bounded slow-attack swell and exactly three authored release layers',()=>{
 const f=fixture();f.audio.unlock(trusted);f.audio.setActive(true);
 const common={identity:'saber' as const,slot:'ultimate' as const,origin:{x:0,y:0,z:0},direction:{x:0,y:0,z:1}};
 f.audio.skillEvent({...common,type:'cast',duration:1.4});assert.equal(f.audio.activeVoices,1);
 const charge=f.context.sources[0];assert.equal(charge.type,'triangle');assert.equal(charge.frequency.events[0].value,260);assert.equal(charge.frequency.value,728);
 assert.deepEqual(charge.stopTimes,[.61]);
 const envelope=f.context.nodes.find(n=>n.gain.events.some(e=>e.kind==='ramp'&&e.value===.065));assert.ok(envelope);assert.equal(envelope.gain.events[1].time,.38);
 charge.end();const start=f.context.sources.length;
 f.audio.skillEvent({...common,type:'strike',range:18,halfWidth:2.4,damage:138,maxTargets:4,pulse:0,at:.7});
 assert.equal(f.audio.activeVoices,3);const layers=f.context.sources.slice(start);assert.equal(layers.length,3);assert.deepEqual(layers.map(n=>n.type),['','sine','triangle']);
 layers.forEach((n,i)=>assert.ok(Math.abs(n.stopTimes[0]!-[.19,.29,.59][i])<1e-9));assert.equal(layers[1].frequency.value,44);assert.equal(layers[2].frequency.value,1320);
 for(const node of layers)node.end();assert.equal(f.audio.activeVoices,0);f.audio.dispose();
});
test('Saber layering never exceeds sixteen sources and mute, blur, zero volume and disposal stop every tail',()=>{
 const event={identity:'saber' as const,slot:'ultimate' as const,type:'strike' as const,origin:{x:0,y:0,z:0},direction:{x:0,y:0,z:1},range:18,halfWidth:2.4,damage:138,maxTargets:4,pulse:0,at:.7};
 for(const stop of ['mute','blur','volume','dispose']){
  const f=fixture();f.audio.unlock(trusted);f.audio.setActive(true);
  for(let i=0;i<100;i++)f.audio.skillEvent(event);assert.equal(f.audio.activeVoices,16);assert.equal(f.context.sources.length,16);assert.equal(f.context.buffers,1);
  if(stop==='mute')f.audio.setMuted(true);else if(stop==='blur'){f.hide();f.audio.setActive(false);}else if(stop==='volume')f.audio.setVolume(0);else f.audio.dispose();
  assert.equal(f.audio.activeVoices,0);assert.ok(f.context.sources.every(n=>n.onended===null&&n.stops===2));
  f.audio.skillEvent(event);assert.equal(f.audio.activeVoices,0);f.audio.dispose();
 }
});

test('era ultimate contacts have distinct bounded three-layer cues, with no extra fourth Musashi release',()=>{
 const signatures=new Set<string>();
 for(const identity of ['blackbeard','napoleon','musashi'] as const){
  const f=fixture();f.audio.unlock(trusted);f.audio.setActive(true);
  const common={identity,slot:'ultimate' as const,origin:{x:0,y:0,z:0},direction:{x:0,y:0,z:1}};
  f.audio.skillEvent({...common,type:'cast',duration:1.6});assert.equal(f.audio.activeVoices,1);for(const source of f.context.sources)source.end();
  const count=identity==='napoleon'?1:3,first=f.context.sources.length;
  for(let pulse=0;pulse<count;pulse++){
    const start=f.context.sources.length;f.audio.skillEvent({...common,type:'strike',pulse,range:20,halfWidth:2,damage:48,maxTargets:3,at:.5});
    const layers=f.context.sources.slice(start);assert.equal(layers.length,3);assert.equal(f.audio.activeVoices,3);
    signatures.add(JSON.stringify(layers.map(n=>[n.type,n.frequency.value,n.stopTimes[0]])));
    assert.ok(layers.every(n=>n.started&&n.stopTimes[0]!<=.43));for(const source of layers)source.end();assert.equal(f.audio.activeVoices,0);
  }
  assert.equal(f.context.sources.length-first,count*3,'sources are created only per received contact');
  const before=f.context.sources.length;f.audio.skillEvent({type:'guard',duration:1,multiplier:.5});assert.equal(f.context.sources.length,before);
  for(let i=0;i<100;i++)f.audio.skillEvent({...common,type:'strike',pulse:0,range:20,halfWidth:2,damage:48,maxTargets:3,at:.5});assert.equal(f.audio.activeVoices,16);
  f.audio.setActive(false);assert.equal(f.audio.activeVoices,0);f.audio.dispose();
 }
 assert.ok(signatures.size>=6,'identity and alternating authored contacts have distinct synthesis signatures');
});
test('era ordinary skill sound signatures remain unchanged',()=>{
 const expected={blackbeard:{filter:2100,type:'sine',pitch:165,slide:.45,ends:[.13,.23]},napoleon:{filter:420,type:'triangle',pitch:125,slide:.55,ends:[.27,.23]},musashi:{filter:1900,type:'triangle',pitch:520,slide:1.65,ends:[.13,.14]}};
 for(const identity of ['blackbeard','napoleon','musashi'] as const){
  const f=fixture();f.audio.unlock(trusted);f.audio.setActive(true);
  f.audio.skillEvent({identity,slot:'skill',type:'strike',origin:{x:0,y:0,z:0},direction:{x:0,y:0,z:1},pulse:0,range:10,halfWidth:2,damage:30,maxTargets:2,at:.2});
  const e=expected[identity];assert.equal(f.audio.activeVoices,2);assert.equal(f.context.sources[1].type,e.type);assert.equal(f.context.sources[1].frequency.events[0].value,e.pitch);assert.equal(f.context.sources[1].frequency.value,e.pitch*e.slide);
  assert.ok(f.context.nodes.some(n=>n.type==='bandpass'&&n.frequency.value===e.filter));f.context.sources.forEach((n,i)=>assert.ok(Math.abs(n.stopTimes[0]!-e.ends[i])<1e-9));f.audio.dispose();
 }
});
