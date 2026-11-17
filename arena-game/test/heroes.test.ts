import {predictAbility} from '../src/player/abilityPrediction.ts';
import {describe,it,expect} from 'vitest';
import {ABILITIES,CHARACTERS,heroIndex,SHIELD,abilityAllowsGunplay} from '../shared/content.ts';
import {abilityPlacement,guardFaces,returnPathClear,BARRAGE_KILL} from '../shared/heroes.ts';
import {Match} from '../shared/match.ts';
import {buildMap,type MapData} from '../shared/map.ts';
import {BTN,applyInput,clonePlayer,type Input} from '../shared/sim.ts';
import {smokeBlocks,insideSmoke} from '../shared/grenade.ts';
import {RoomCore} from '../shared/room.ts';
import {getMap} from '../shared/arenaMap.ts';
import {RULES_VERSION} from '../shared/protocol.ts';
const data:MapData={mapId:'heroes-test',version:'1',bounds:{min:[-30,-1,-30],max:[30,10,30]},objects:[{id:'floor',type:'box',position:[0,-.2,0],size:[60,.4,60],collision:true,role:'floor',material:'stone'}],anchors:[{id:'a',kind:'spawn',team:'west',position:[0,0,0]},{id:'b',kind:'spawn',team:'east',position:[0,0,-10]}],routes:[],player:{radius:.32,height:1.8,eyeHeight:1.62,walkSpeed:5.2,stepHeight:.32}};
function fixture(char=0,mate=false){const m=new Match(buildMap(structuredClone(data)),'2v2');m.addPlayer('a',{team:'A',char,name:'a',skins:[],bot:false});m.addPlayer('b',{team:'B',char:0,name:'b',skins:[],bot:false});if(mate)m.addPlayer('c',{team:'A',char:1,name:'c',skins:[],bot:false});m.phase='live';m.phaseT=10000;for(const s of m.slots.values())s.spawnProtectedUntilTick=0;m.snapshot();return m;}
function step(m:Match,n=1){for(let i=0;i<n;i++)m.step();}
function input(m:Match,id='a',buttons=0,extra:Partial<Input>={}){const p=m.player(id)!;m.queueInputs(id,[{seq:p.lastSeq+1,mx:0,mz:0,yaw:p.yaw,pitch:p.pitch,buttons,weapon:p.weaponSlot,view:m.tick,...extra}]);m.step();}
function cast(m:Match,pitch=0){input(m,'a',BTN.SHIELD,{yaw:0,pitch});}
const targetPitch=(distance:number)=>-Math.atan2(1.62,distance);

describe('hero roster and universal action contract',()=>{
 it('has nine stable unique identities and equal competitive fundamentals',()=>{expect(CHARACTERS).toHaveLength(9);expect(new Set(CHARACTERS.map(c=>c.id)).size).toBe(9);for(const c of CHARACTERS){expect([c.hp,c.speed]).toEqual([150,5.2]);expect(ABILITIES[c.ability]).toBeDefined();}expect(CHARACTERS.slice(0,2).map(c=>c.id)).toEqual(['aster','vega']);expect(()=>heroIndex('napoleonMounted')).toThrow();expect(()=>heroIndex(undefined,99)).toThrow();});
 for(let char=0;char<9;char++)it(`${CHARACTERS[char].id}: Q is accepted once, ends protection and follows the role's reload contract`,()=>{const m=fixture(char),p=m.player('a')!;p.hp=100;p.reload=80;m.slots.get('a')!.spawnProtectedUntilTick=150;cast(m,targetPitch(3));expect(p.ability.castSeq).toBe(1);expect(p.reload).toBe(abilityAllowsGunplay(char)?79:0);expect(m.slots.get('a')!.spawnProtectedUntilTick).toBe(m.tick);input(m,'a',BTN.SHIELD);expect(p.ability.castSeq).toBe(1);});
 it('invalid ground placement leaves cooldown, spawn protection and reload intact',()=>{const m=fixture(0),p=m.player('a')!;Object.assign(p,{x:29,pitch:0,yaw:-Math.PI/2,reload:80});m.slots.get('a')!.spawnProtectedUntilTick=150;input(m,'a',BTN.SHIELD);expect(p.ability.readyAt).toBe(0);expect(p.reload).toBe(79);expect(m.slots.get('a')!.spawnProtectedUntilTick).toBe(150);expect(p.ability.failure).not.toBe('');});
 it('cooldown elapses while dead and survives respawn without input packets',()=>{const m=fixture(0);cast(m);const p=m.player('a')!,ready=p.ability.readyAt;step(m,20);m.heroDamage('b','B','a',999,BARRAGE_KILL);expect(m.shields).toHaveLength(0);step(m,180);expect(p.alive).toBe(true);expect(p.lifeId).toBe(2);expect(p.ability.readyAt).toBe(ready);expect(p.shieldCd).toBe(ready-m.tick);});
 it('an unrecognized mid-match seat must wait a full cooldown; a new round clears it',()=>{const m=fixture();m.addPlayer('late',{team:'B',char:5,name:'late',skins:[],bot:false});expect(m.player('late')!.ability.readyAt).toBe(m.tick+660);m.phase='ended';m.rematch();expect(m.player('late')!.ability.readyAt).toBe(0);});
 it('same-team hero duplication is rejected by local/Worker room authority',()=>{const core=new RoomCore({map:'homeward',layout:'2v2'});core.join('one',{rulesVersion:RULES_VERSION,team:'A',char:0});expect(()=>core.join('two',{rulesVersion:RULES_VERSION,team:'A',char:0})).toThrow(/同队/);expect(()=>core.join('other',{rulesVersion:RULES_VERSION,team:'B',char:0})).not.toThrow();});
 it('replayed packet sequences cannot generate duplicate casts',()=>{const m=fixture(1);const q:Input={seq:1,mx:0,mz:0,yaw:0,pitch:0,buttons:BTN.SHIELD,weapon:0,view:0};m.queueInputs('a',[q,q,q]);step(m,20);m.queueInputs('a',[q]);m.step();expect(m.player('a')!.ability.castSeq).toBe(1);expect(m.heroes.entities.filter(e=>e.kind==='anchor')).toHaveLength(1);});
 it('death during windup cancels generation, preserves paid cooldown',()=>{const m=fixture(5);cast(m,targetPitch(5));m.heroDamage('b','B','a',999,BARRAGE_KILL);step(m,20);expect(m.heroes.entities).toHaveLength(0);expect(m.player('a')!.ability.readyAt).toBe(661);});
});
describe('barrier and anchor',()=>{
 it('Aster creates 180HP after 15 ticks, blocks friendly bullets and never borrows owner immunity',()=>{const m=fixture(0,true);cast(m);step(m,14);expect(m.shields).toHaveLength(0);m.step();expect(m.shields[0].hp).toBe(SHIELD.hp);const c=m.player('c')!;Object.assign(c,{x:0,z:1,yaw:0,pitch:0});input(m,'c',BTN.FIRE);expect(m.shields[0].hp).toBeLessThan(180);m.slots.get('a')!.spawnProtectedUntilTick=10000;m.damageShield(m.shields[0],20);expect(m.shields[0].hp).toBeLessThan(160);});
 it('shield does not shelter from cannon damage',()=>{const m=fixture(5);m.shields.push({id:1,owner:'b',team:'B',x:0,y:0,z:-4,yaw:0,hp:180,life:300});cast(m,targetPitch(10));step(m,125);expect(m.player('b')!.hp).toBe(30);});
 it('Vega returns at finite speed, remains vulnerable, and never restores ammo or HP',()=>{const m=fixture(1),p=m.player('a')!;cast(m);step(m,20);Object.assign(p,{x:3,hp:70});p.ammo[0]=8;const ready=p.ability.readyAt;input(m);input(m,'a',BTN.SHIELD);expect(p.ability.phase).toBe('return');const before=p.x;m.step();expect(p.x).toBeLessThan(before);expect(p.x).toBeGreaterThan(2);step(m,40);expect(p.x).toBeCloseTo(0,2);expect(p.hp).toBe(70);expect(p.ammo[0]).toBe(8);expect(p.ability.readyAt).toBe(ready);expect(p.ability.phase).toBe('idle');});
 it('return sweep rejects wall corners, elevation, air, range and low ceilings',()=>{const m=fixture(1),p=m.player('a')!;expect(returnPathClear(m.map,p,[3,0,0])).toBe(true);expect(returnPathClear(m.map,p,[6,0,0])).toBe(false);expect(returnPathClear(m.map,p,[3,.3,0])).toBe(false);p.grounded=false;expect(returnPathClear(m.map,p,[3,0,0])).toBe(false);p.grounded=true;const wall={id:'wall',type:'box' as const,position:[1.5,1,0] as [number,number,number],size:[.3,2,3] as [number,number,number],collision:true,role:'wall',material:''};const blocked=buildMap({...data,objects:[...data.objects,wall]});expect(returnPathClear(blocked,p,[3,0,0])).toBe(false);});
 it('destroying an anchor removes the second activation opportunity',()=>{const m=fixture(1);cast(m);step(m,20);const e=m.heroes.entities[0];m.heroes.hit(e,40);m.step();input(m);input(m,'a',BTN.SHIELD);expect(m.player('a')!.ability.phase).toBe('idle');expect(m.player('a')!.ability.failure).toMatch(/冷却/);});
});
describe('guard, smoke and echo',()=>{
 it('guard includes 70 degree edges and excludes 71 degrees and vertical outside 50',()=>{for(const deg of [69,70,71])expect(guardFaces(0,0,[-Math.sin(deg*Math.PI/180)*5,0,-Math.cos(deg*Math.PI/180)*5],[0,0,0])).toBe(deg<=70);expect(guardFaces(0,0,[0,6,-5],[0,0,0])).toBe(false);});
 it('150 raw guard budget is shared by historical hits and never replenished from old poses',()=>{const m=fixture(2),p=m.player('a')!;cast(m);step(m,6);const pose={x:0,y:0,z:0,life:p.lifeId,yaw:0,pitch:0,guard:true,guardSeq:p.ability.castSeq};expect(m.heroes.absorb(p,100,[0,1,-5],pose)).toBe(0);expect(m.heroes.absorb(p,53,[0,1,-5],pose)).toBe(3);expect(m.heroes.absorb(p,100,[0,1,-5],pose)).toBe(100);expect(p.ability.phase).toBe('recovery');});
 it('guard then melee stance follows the 153 -> 3 -> 2 damage order',()=>{const m=fixture(2),p=m.player('a')!;p.weapon=5;p.weaponSlot=2;cast(m);step(m,6);const raw=m.heroes.absorb(p,153,[0,1,-5]);expect(raw).toBe(3);m.heroDamage('b','B','a',raw,4);expect(p.hp).toBe(148);});
 it('Saber holding Q multiplies ordinary movement and rejects dash/reload',()=>{const m=fixture(2),p=m.player('a')!;p.weapon=5;p.weaponSlot=2;cast(m);step(m,6);const x=p.x;input(m,'a',BTN.SHIELD|BTN.DASH|BTN.RELOAD,{mx:1});expect(p.x-x).toBeCloseTo(5.2*1.2*.8/60,3);expect(p.dashCharges).toBe(3);expect(p.reload).toBe(0);});
 it('both sphere smoke and rotated curtains use identical segment and inside semantics',()=>{const s={id:1,owner:'a',x:0,y:0,z:0,life:120,box:{yaw:Math.PI/2,width:4,depth:1.2,height:2.4}};expect(smokeBlocks([s],[-5,1,0],[5,1,0])).toBe(true);expect(insideSmoke([s],[0,1,1.9])).toBe(true);expect(insideSmoke([s],[1,1,0])).toBe(false);expect(smokeBlocks([{...s,delay:2}],[-5,1,0],[5,1,0])).toBe(false);expect(smokeBlocks([s],[-5,3,0],[5,3,0])).toBe(false);});
 it('Blackbeard smoke survives owner death after generation, then expires',()=>{const m=fixture(3);cast(m,targetPitch(4));step(m,15);expect(m.smokes).toHaveLength(1);m.heroDamage('b','B','a',999,BARRAGE_KILL);step(m,20);expect(smokeBlocks(m.smokes,[0,1,0],[0,1,-8])).toBe(true);step(m,240);expect(m.smokes).toHaveLength(0);});
 it('echo is hit once but does not block the bullet or increment kills',()=>{const m=fixture(4);cast(m);step(m,13);const e=m.heroes.entities[0];const end=m.heroes.shoot([e.x,1.1,e.z+3],[0,0,-1],15,20);expect(end).toBe(15);expect(e.hp).toBe(0);expect(m.score).toEqual({A:0,B:0});expect(m.snapshot().events.filter(e=>e.t==='hit'||e.t==='kill')).toHaveLength(0);});
});
describe('barrage and prayer',()=>{
 it('barrage pulses at t0+0.5,0.8,1.1 seconds, including after owner death',()=>{const m=fixture(5);cast(m,targetPitch(10));const start=m.tick;step(m,15);m.heroDamage('b','B','a',999,BARRAGE_KILL);const seen:number[]=[];for(let i=0;i<110;i++){m.step();for(const e of m.snapshot().events)if(e.t==='ability'&&e.kind==='barrage'&&e.action==='pulse')seen.push(m.tick-start);}expect(seen).toEqual([30,48,66]);expect(m.player('b')!.hp).toBe(30);});
 it('barrage does not damage teammates and checks solid walls on each pulse',()=>{const m=fixture(5,true);Object.assign(m.player('c')!,{x:0,z:-10});cast(m,targetPitch(10));step(m,125);expect(m.player('c')!.hp).toBe(150);expect(m.player('b')!.hp).toBe(30);});
 it('banner heals each visible ally for 30 immediately plus 60 over three seconds and never overheals',()=>{for(const hp of [[100,100],[145,100],[100,150],[145,147]]){const m=fixture(6,true);m.player('a')!.hp=hp[0];Object.assign(m.player('c')!,{x:2,z:0,hp:hp[1]});cast(m);step(m,264);expect(m.player('a')!.hp).toBe(Math.min(150,hp[0]+90));expect(m.player('c')!.hp).toBe(Math.min(150,hp[1]+90));}});
 it('full health and recent damage permit defensive planting; air placement does not',()=>{const m=fixture(6),p=m.player('a')!;p.lastDamageTick=0;cast(m);expect(p.ability.readyAt).toBe(721);const k=fixture(6),air=k.player('a')!;air.grounded=false;air.y=2;cast(k);expect(air.ability.readyAt).toBe(0);});
 it('banner mitigates guns by 25%, survives damage to its owner, and stops on device destruction',()=>{const m=fixture(6),p=m.player('a')!;cast(m);step(m,24);m.heroDamage('b','B','a',50,0);expect(p.hp).toBe(112);const flag=m.heroes.entities[0];expect(flag.hp).toBe(100);step(m,30);expect(p.hp).toBe(122);m.heroes.hit(flag,100);m.heroDamage('b','B','a',50,0);expect(p.hp).toBe(72);step(m,60);expect(p.hp).toBe(72);});
 it('banner does not heal dead, distant, enemy or smoke-obscured players',()=>{for(const reason of ['dead','distance','team','smoke']){const m=fixture(6,true);m.player('a')!.hp=100;const c=m.player('c')!;Object.assign(c,{x:3,z:0,hp:100});cast(m);if(reason==='dead'){c.alive=false;m.slots.get('c')!.respawn=1000;}if(reason==='distance')c.x=7;if(reason==='team')c.team='B';if(reason==='smoke')m.smokes.push({id:8,owner:'b',x:1.5,y:0,z:0,life:300});step(m,84);expect(c.hp).toBe(100);expect(m.player('a')!.hp).toBe(reason==='smoke'?100:150);}});

});
describe('lens, boundary and shared authority',()=>{
 it('lens makes four static, expiring marks; walls, smoke and shields obstruct scans',()=>{for(const occluder of ['none','smoke','shield']){const m=fixture(7);cast(m,targetPitch(4));if(occluder==='smoke')m.smokes.push({id:3,owner:'b',x:0,y:0,z:-7,life:300});if(occluder==='shield')m.shields.push({id:4,owner:'b',team:'B',x:0,y:0,z:-7,yaw:0,hp:180,life:300});step(m,21);expect(m.heroes.marks.length).toBe(occluder==='none'?1:0);if(occluder==='none'){const mark={...m.heroes.marks[0]};m.player('b')!.x=25;step(m,5);expect(m.heroes.marks[0].x).toBe(mark.x);step(m,40);expect(m.heroes.marks).toHaveLength(0);}}});
 it('a destroyed lens cannot pulse on that tick',()=>{const m=fixture(7);cast(m,targetPitch(4));step(m,20);const lens=m.heroes.entities[0];m.heroes.hit(lens,80);m.step();expect(m.heroes.marks).toHaveLength(0);});
 it('domain persists, seals new dash without consuming charges, and releases after leaving',()=>{const m=fixture(8),enemy=m.player('b')!;cast(m,targetPitch(4));step(m,52);const e=m.heroes.entities[0];Object.assign(enemy,{x:e.x,z:e.z-.01,y:0});m.heroes.effects(new Map());expect(enemy.slowUntil).toBe(m.tick+2);expect(m.heroes.entities).toHaveLength(1);enemy.abilityTick=m.tick;const charges=enemy.dashCharges;applyInput(m.map,enemy,{seq:enemy.lastSeq+1,mx:0,mz:1,yaw:0,pitch:0,buttons:BTN.DASH,weapon:0,view:m.tick});expect(enemy.dashT).toBe(0);expect(enemy.dashCharges).toBe(charges);enemy.x=e.x+5;step(m,3);input(m,'b',0);input(m,'b',BTN.DASH);expect(enemy.dashT).toBeGreaterThan(0);});
 it('breaking either endpoint removes the whole boundary',()=>{const m=fixture(8);cast(m,targetPitch(4));step(m,16);const e=m.heroes.entities[0],point=m.heroes.points(e)[1];m.heroes.shoot([point[0],point[1],point[2]+3],[0,0,-1],5,90);m.step();expect(m.heroes.entities).toHaveLength(0);});
 it('Homeward denies enemy sustained skill footprints in spawn buffers',()=>{const map=getMap('homeward'),m=fixture(5),p=m.player('a')!;Object.assign(p,{x:20,y:0,z:4,yaw:-Math.PI/2,pitch:targetPitch(6)});expect(abilityPlacement(map,p,'barrage').error).not.toBe('');});
 it('snapshot state is cloned, so client prediction cannot mutate authority',()=>{const m=fixture(1);cast(m);const snap=m.snapshot();snap.players[0].ability.readyAt=0;snap.players[0].ability.target![0]=123;expect(m.player('a')!.ability.readyAt).toBe(1081);expect(m.player('a')!.ability.target![0]).toBe(0);const copy=clonePlayer(m.player('a')!);copy.ability.castSeq=999;expect(m.player('a')!.ability.castSeq).toBe(1);});
});

describe('client windup prediction and packet impairment',()=>{
 it('predicts action lock immediately without spawning a device or touching authoritative health',()=>{
  const m=fixture(0),snap=m.snapshot(),p=clonePlayer(m.player('a')!);const q:Input={seq:1,mx:0,mz:0,yaw:0,pitch:0,buttons:BTN.SHIELD|BTN.FIRE,weapon:0,view:0};
  predictAbility(m.map,p,q,snap);const events=applyInput(m.map,p,q);expect(p.ability.phase).toBe('windup');expect(events.some(e=>e.type==='fire')).toBe(false);expect(m.shields).toHaveLength(0);expect(m.player('a')!.ability.castSeq).toBe(0);expect(m.player('b')!.hp).toBe(150);
 });
 it('predicted healing never awards HP and rejected placement never spends cooldown',()=>{
  const m=fixture(6),snap=m.snapshot(),p=clonePlayer(m.player('a')!);p.hp=100;snap.players[0].hp=100;
  for(let i=1;i<100;i++){const q:Input={seq:i,mx:0,mz:0,yaw:0,pitch:0,buttons:i===1?BTN.SHIELD:0,weapon:0,view:0};predictAbility(m.map,p,q,snap);applyInput(m.map,p,q);}expect(p.hp).toBe(100);expect(p.ability.phase).toBe('idle');
  const b=fixture(0),k=clonePlayer(b.player('a')!);k.x=29;predictAbility(b.map,k,{seq:1,mx:0,mz:0,yaw:-Math.PI/2,pitch:0,buttons:BTN.SHIELD,weapon:0,view:0},b.snapshot());expect(k.ability.readyAt).toBe(0);
 });
 for(const rtt of [50,100,180])it(`simulated ${rtt}ms RTT with loss, jitter and duplicates preserves one cast and world-time windup`,()=>{
   const m=fixture(0),delay=Math.ceil(rtt/2/1000*60),history:Input[]=[],packets:{at:number;batch:Input[]}[]=[];let accepted=-1,spawned=-1,loss=0;
   for(let t=0;t<180;t++){
    history.push({seq:t+1,mx:0,mz:0,yaw:0,pitch:0,buttons:t>=30&&t<37?BTN.SHIELD:0,weapon:0,view:Math.max(0,t-delay)});
    if(t%3===0){if(t%21===0)loss++;else{const batch=history.slice(-9);packets.push({at:t+delay+t%4,batch});if(t%12===0)packets.push({at:t+delay+5,batch});}}
    for(const packet of packets.filter(p=>p.at===t))m.queueInputs('a',JSON.parse(JSON.stringify(packet.batch)));m.step();const wire=JSON.parse(JSON.stringify(m.snapshot()));
    for(const e of wire.events){if(e.t==='ability'&&e.id==='a'&&e.action==='accepted')accepted=m.tick;if(e.t==='ability'&&e.id==='a'&&e.action==='spawn')spawned=m.tick;}
   }
   expect(loss).toBeGreaterThan(0);expect(m.player('a')!.ability.castSeq).toBe(1);expect(spawned-accepted).toBe(15);expect(m.shields).toHaveLength(1);expect(m.player('a')!.ability.readyAt).toBe(accepted+960);
 });
});
it('solid devices shelter echoes and bullet falloff is evaluated at the device hit distance',()=>{
 const m=fixture(1);cast(m);step(m,10);const anchor=m.heroes.entities[0];const echo={...anchor,id:99,kind:'decoy' as const,hp:1,z:anchor.z-2};m.heroes.entities.push(echo);let hitAt=-1;
 m.heroes.shoot([anchor.x,anchor.y+.25,anchor.z+3],[0,0,-1],20,t=>{hitAt=t;return 20;});expect(hitAt).toBeCloseTo(2.75);expect(anchor.hp).toBe(20);expect(echo.hp).toBe(1);
});

describe('seven heroes: distinctive actions and counterplay',()=>{
 it('wind guard releases a stronger slash after absorbing damage, never through a wall',()=>{
  for(const wall of [false,true]){const m=fixture(2),p=m.player('a')!,enemy=m.player('b')!;enemy.z=-5;cast(m);step(m,6);m.heroes.absorb(p,60,[0,1,-5]);if(wall)m.shields.push({id:9,owner:'b',team:'B',x:0,y:0,z:-2,yaw:0,hp:180,life:300});input(m);expect(enemy.hp).toBe(wall?150:70);expect(p.ability.phase).toBe('recovery');}
 });
 it('Musashi really changes position while the echo follows the original direction',()=>{const m=fixture(4),p=m.player('a')!;cast(m);step(m,25);expect(p.x).toBeCloseTo(5,2);expect(p.z).toBeCloseTo(0,2);expect(m.heroes.entities[0].z).toBeLessThan(-1);m.heroDamage('b','B','a',20,0);expect(p.hp).toBe(130);});
 it('Blackbeard fires automatically after the warning and never stacks overlapping cannon hits',()=>{const m=fixture(3),p=m.player('a')!,enemy=m.player('b')!;enemy.z=-7;cast(m);step(m,6);const smoke=m.heroes.entities[0],ready=p.ability.readyAt;expect(smoke.commandedAt).toBe(m.tick);step(m,20);expect(enemy.hp).toBe(150);m.step();expect(enemy.hp).toBe(70);input(m);input(m,'a',BTN.SHIELD);expect(p.ability.readyAt).toBe(ready);step(m,35);expect(enemy.hp).toBe(70);expect(p.ability.castSeq).toBe(1);});
 it('Ozymandias can redirect the disc; each pulse damages only visible enemies in its cone',()=>{const m=fixture(7),p=m.player('a')!,enemy=m.player('b')!;Object.assign(enemy,{x:5,z:-4});cast(m,targetPitch(4));step(m,30);input(m);input(m,'a',BTN.SHIELD,{yaw:-Math.PI/2});const disc=m.heroes.entities[0];expect(disc.yaw).toBeCloseTo(-Math.PI/2);step(m,25);expect(enemy.hp).toBe(120);expect(m.heroes.marks).toHaveLength(1);expect(p.ability.castSeq).toBe(1);});
 it('a running dash crosses a domain without being stopped, but no queued follow-up is allowed',()=>{const m=fixture(8),enemy=m.player('b')!;cast(m,targetPitch(4));step(m,52);const e=m.heroes.entities[0];Object.assign(enemy,{x:e.x,z:e.z,y:0,dashT:6,dashX:1,dashZ:0});m.heroes.begin();const x=enemy.x;input(m,'b',BTN.DASH,{mx:1});expect(enemy.x-x).toBeCloseTo(17/60,3);expect(enemy.dashQueue).toHaveLength(0);});
 it('damaging an unborn, dead or spawn-protected target cannot award skill damage',()=>{const m=fixture(2),enemy=m.player('b')!;enemy.z=-5;m.slots.get('b')!.spawnProtectedUntilTick=200;cast(m);step(m,6);input(m);expect(enemy.hp).toBe(150);});
 it('failed duplicate joins preserve the previous seats and bots',()=>{const core=new RoomCore({map:'homeward',layout:'2v2',bots:true});core.join('one',{rulesVersion:RULES_VERSION,team:'A',char:2});const before=[...core.match.slots].map(([id,s])=>[id,s.state.char]);expect(()=>core.join('two',{rulesVersion:RULES_VERSION,team:'A',char:2})).toThrow();expect([...core.match.slots].map(([id,s])=>[id,s.state.char])).toEqual(before);});
});

import { randomBotHero, PLAYABLE_HERO_INDICES as ROSTER } from '../shared/content.ts';
import { startOffline } from '../src/network/session.ts';
describe('bots draw their heroes at random', () => {
  it('stays inside the playable roster, never doubles a teammate and prefers heroes nobody plays', () => {
    const seen = new Set<number>();
    for (let k = 0; k < 200; k++) { const h = randomBotHero([{ team: 'A', char: 3 }], 'B', () => k / 200); seen.add(h); expect(ROSTER).toContain(h); expect(h).not.toBe(3); }
    expect(seen.size).toBe(ROSTER.length - 1);
    expect(randomBotHero(ROSTER.map(char => ({ team: 'A', char })), 'B', () => .5)).toBeGreaterThanOrEqual(2);
    const team = ROSTER.map(char => ({ team: 'B', char })).slice(0, -1);
    expect(randomBotHero(team, 'B', () => .99)).toBe(ROSTER.at(-1));
    expect(ROSTER).toContain(randomBotHero([], 'A', () => NaN));
  });
  it('a 1v1 offline Bot is not always the same fighter', () => {
    const heroes = new Set<number>();
    for (let k = 0; k < 7; k++) {
      let x = k / 7 + .01; const session = startOffline({ name: 'me', layout: '1v1', team: 'A', char: 2, map: 'homeward', loadout: ['lumen', 'corona', 'blade'], utility: 'frag', skins: [] } as never, 'normal', () => { const v = x; x = (x + .37) % 1; return v; });
      const bot = [...session.match!.slots.values()].find(s => s.info.bot)!; heroes.add(bot.state.char); expect(bot.state.char).not.toBe(2); session.close();
    }
    expect(heroes.size).toBeGreaterThan(3);
  });
});
