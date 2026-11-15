import {Match,type Snapshot} from '../../shared/match.ts';
import {buildMap,type MapData} from '../../shared/map.ts';
import {BTN} from '../../shared/sim.ts';
import {CHARACTERS} from '../../shared/content.ts';
const map=buildMap({mapId:'hero-demonstration',version:'2',bounds:{min:[-20,-1,-20],max:[20,10,20]},player:{radius:.32,height:1.8,eyeHeight:1.62,walkSpeed:5.2,stepHeight:.32},objects:[{id:'floor',type:'box',position:[0,-.2,0],size:[40,.4,40],collision:true,material:'',role:'floor'}],anchors:[{id:'a',kind:'spawn',team:'west',position:[0,0,0]},{id:'b',kind:'spawn',team:'east',position:[0,0,-6]}],routes:[]} as MapData);
/** Frame-rate independent, actual-rule demonstration; no cosmetic fake damage. */
export class HeroDemo {
  readonly match=new Match(map,'1v1');
  readonly duration=8;
  ticks=0;
  private accumulator=0;
  snapshot:Snapshot;
  lastAction='';
  constructor(readonly char:number){
    this.match.addPlayer('hero',{name:'Hero',team:'A',char,skins:[],bot:false});
    this.match.addPlayer('target',{name:'Target',team:'B',char:0,skins:[],bot:true});
    this.match.phase='live';this.match.phaseT=10000;
    const hero=this.match.player('hero')!,target=this.match.player('target')!;
    Object.assign(hero,{x:0,y:0,z:0,yaw:0,hp:100});
    Object.assign(target,{x:0,y:0,z:CHARACTERS[char].ability==='guard'?-6:CHARACTERS[char].ability==='barrage'?-6:-8,yaw:Math.PI});
    for(const s of this.match.slots.values())s.spawnProtectedUntilTick=0;
    this.snapshot=this.match.snapshot();
  }
  get done(){return this.ticks>=480;}
  advance(dt:number){
    if(!Number.isFinite(dt)||dt<=0||this.done)return this.snapshot;
    this.accumulator+=Math.min(.25,dt);
    while(this.accumulator+1e-9>=1/60&&!this.done){
      this.accumulator-=1/60;const f=this.ticks++,kind=CHARACTERS[this.char].ability;
      const buttons=f===30?BTN.SHIELD:kind==='guard'&&f>30&&f<80?BTN.SHIELD:(kind==='anchor'||kind==='curtain'||kind==='lens')&&f===115?BTN.SHIELD:0;
      this.match.queueInputs('hero',[{seq:f+1,mx:kind==='anchor'&&f>55&&f<90?1:0,mz:0,yaw:0,pitch:-Math.atan2(1.62,6),buttons,weapon:0,view:this.match.tick}]);
      this.match.queueInputs('target',[{seq:f+1,mx:0,mz:kind==='edict'&&f>=90&&f<140?1:0,yaw:Math.PI,pitch:-Math.atan2(.52,8),buttons:kind==='guard'&&f>=45&&f<70?BTN.FIRE:0,weapon:0,view:this.match.tick}]);
      this.match.step();
    }
    this.snapshot=this.match.snapshot();
    for(const e of this.snapshot.events)if(e.t==='ability')this.lastAction=e.action;
    return this.snapshot;
  }
}
