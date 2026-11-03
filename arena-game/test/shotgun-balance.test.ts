import {expect,it} from 'vitest';
import {buildMap,type MapData} from '../shared/map.ts';
import {WEAPONS,falloff} from '../shared/content.ts';
import {applyInput,newPlayer,BTN} from '../shared/sim.ts';
import {rayPlayer} from '../shared/hit.ts';
const flat=buildMap({mapId:'sg-range',version:'1',bounds:{min:[-30,-1,-40],max:[30,10,30]},player:{radius:.32,height:1.8,eyeHeight:1.65,walkSpeed:5.2,stepHeight:.28},objects:[{id:'floor',type:'box',position:[0,-.1,0],size:[60,.2,80],material:'',collision:true,role:'floor'}],anchors:[],routes:[]} as MapData);
function samples(distance:number){return Array.from({length:128},(_,seq)=>{
 const p=newPlayer('sg','A',0);Object.assign(p,{alive:true,weapon:1,weaponSlot:1});
 const ev=applyInput(flat,p,{seq,mx:0,mz:0,yaw:0,pitch:-Math.atan2(.65,distance),buttons:BTN.FIRE,weapon:1,view:0}).find(e=>e.type==='fire');
 if(!ev||ev.type!=='fire')throw Error('shot missing');
 let dmg=0;for(const d of ev.dirs){const h=rayPlayer(ev.origin,d,0,0,-distance);if(h)dmg+=18*falloff(WEAPONS[1],h.t)*(h.head?WEAPONS[1].headMul:1);}
 return Math.round(dmg);
});}
it('a centred close shotgun blast can defeat a full-health 150 HP gun user across deterministic patterns',()=>{
 for(const d of [2,3])expect(Math.min(...samples(d))).toBeGreaterThanOrEqual(150);
 expect(WEAPONS[1].interval/60).toBe(.65);
});
it('shotgun keeps a sharp close-range role and does not become a long-range rifle',()=>{
 expect(Math.min(...samples(5))).toBeGreaterThanOrEqual(110);
 expect(Math.max(...samples(12))).toBeLessThan(80);
 expect(Math.max(...samples(18))).toBeLessThan(30);
 console.info(JSON.stringify([2,3,5,8,12,18].map(distance=>{const a=samples(distance);return{distance,min:Math.min(...a),max:Math.max(...a),mean:a.reduce((x,y)=>x+y)/a.length};})));
});
