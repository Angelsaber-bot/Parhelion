import {expect,it} from 'vitest';
import {buildMap,type MapData} from '../shared/map.ts';
import {WEAPONS,falloff,SPAWN_PROTECTION_TICKS} from '../shared/content.ts';
import {applyInput,newPlayer,BTN} from '../shared/sim.ts';
import {rayPlayer} from '../shared/hit.ts';
import {Match} from '../shared/match.ts';
const flat=buildMap({mapId:'sg-range',version:'1',bounds:{min:[-30,-1,-40],max:[30,10,30]},player:{radius:.32,height:1.8,eyeHeight:1.65,walkSpeed:5.2,stepHeight:.28},objects:[{id:'floor',type:'box',position:[0,-.1,0],size:[60,.2,80],material:'',collision:true,role:'floor'}],anchors:[{id:'a',kind:'spawn',team:'west',position:[0,0,0]},{id:'b',kind:'spawn',team:'east',position:[0,0,-2]}],routes:[]} as MapData);
function samples(distance:number){return Array.from({length:128},(_,seq)=>{
 const p=newPlayer('sg','A',0);Object.assign(p,{alive:true,weapon:1,weaponSlot:1});
 const ev=applyInput(flat,p,{seq,mx:0,mz:0,yaw:0,pitch:-Math.atan2(.65,distance),buttons:BTN.FIRE,weapon:1,view:0}).find(e=>e.type==='fire');
 if(!ev||ev.type!=='fire')throw Error('shot missing');
 let dmg=0;for(const d of ev.dirs){const h=rayPlayer(ev.origin,d,0,0,-distance);if(h)dmg+=WEAPONS[1].damage*falloff(WEAPONS[1],h.t)*(h.head?WEAPONS[1].headMul:1);}
 return Math.round(dmg);
});}
it('a centred close shotgun blast can defeat a full-health 150 HP gun user across deterministic patterns',()=>{
 for(const d of [2,3])expect(Math.min(...samples(d))).toBeGreaterThanOrEqual(150);
 expect(WEAPONS[1].interval/60).toBe(.65);
});
it('one close body shot emits twenty pellets, deals 400 authoritative damage and consumes one shell',()=>{
 const m=new Match(flat,'1v1');
 m.addPlayer('a',{name:'Shooter',team:'A',char:0,skins:[],bot:false});
 m.addPlayer('b',{name:'Target',team:'B',char:0,skins:[],bot:false});
 m.phase='live';m.phaseT=10000;
 for(let i=0;i<SPAWN_PROTECTION_TICKS;i++)m.step();
 const shooter=m.player('a')!,target=m.player('b')!;
 Object.assign(shooter,{x:0,y:0,z:0,weapon:1,weaponSlot:1});Object.assign(target,{x:0,y:0,z:-2,hp:1000});m.step();m.snapshot();
 m.queueInputs('a',[{seq:shooter.lastSeq+1,mx:0,mz:0,yaw:0,pitch:-Math.atan2(.65,2),buttons:BTN.FIRE,weapon:1,view:m.tick}]);m.step();
 const events=m.snapshot().events,shots=events.filter(e=>e.t==='shot'),hits=events.filter(e=>e.t==='hit');
 expect(shots).toHaveLength(1);expect(shots[0].to).toHaveLength(20);
 expect(hits).toEqual([{t:'hit',shooter:'a',victim:'b',dmg:400,head:false}]);
 expect(target.hp).toBe(600);expect(shooter.ammo[1]).toBe(5);
});
it('shotgun keeps a sharp close-range role and does not become a long-range rifle',()=>{
 expect(Math.min(...samples(5))).toBeGreaterThanOrEqual(110);
 expect(Math.max(...samples(12))).toBeLessThan(80);
 expect(Math.max(...samples(18))).toBeLessThan(30);
 console.info(JSON.stringify([2,3,5,8,12,18].map(distance=>{const a=samples(distance);return{distance,min:Math.min(...a),max:Math.max(...a),mean:a.reduce((x,y)=>x+y)/a.length};})));
});
