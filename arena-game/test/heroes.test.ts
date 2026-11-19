import {predictAbility} from '../src/player/abilityPrediction.ts';
import {describe,it,expect} from 'vitest';
import {ABILITIES,CHARACTERS,heroIndex,SHIELD,WEAPONS,abilityAllowsGunplay,SMOKE} from '../shared/content.ts';
import {abilityPlacement,guardFaces,returnPathClear,BARRAGE_KILL} from '../shared/heroes.ts';
import {Match} from '../shared/match.ts';
import {buildMap,type MapData} from '../shared/map.ts';
import {BTN,applyInput,clonePlayer,type Input} from '../shared/sim.ts';
import {smokeBlocks,insideSmoke,settleSmoke} from '../shared/grenade.ts';
import {RoomCore} from '../shared/room.ts';
import {getMap} from '../shared/arenaMap.ts';
import {RULES_VERSION} from '../shared/protocol.ts';
const data:MapData={mapId:'heroes-test',version:'1',bounds:{min:[-30,-1,-30],max:[30,10,30]},objects:[{id:'floor',type:'box',position:[0,-.2,0],size:[60,.4,60],collision:true,role:'floor',material:'stone'}],anchors:[{id:'a',kind:'spawn',team:'west',position:[0,0,0]},{id:'b',kind:'spawn',team:'east',position:[0,0,-10]}],routes:[],player:{radius:.32,height:1.8,eyeHeight:1.62,walkSpeed:5.2,stepHeight:.32}};
function fixture(char=0,mate=false,map:MapData=data){const m=new Match(buildMap(structuredClone(map)),'2v2');m.addPlayer('a',{team:'A',char,name:'a',skins:[],bot:false});m.addPlayer('b',{team:'B',char:0,name:'b',skins:[],bot:false});if(mate)m.addPlayer('c',{team:'A',char:1,name:'c',skins:[],bot:false});m.phase='live';m.phaseT=10000;for(const s of m.slots.values())s.spawnProtectedUntilTick=0;m.snapshot();return m;}
function step(m:Match,n=1){for(let i=0;i<n;i++)m.step();}
function input(m:Match,id='a',buttons=0,extra:Partial<Input>={}){const p=m.player(id)!;m.queueInputs(id,[{seq:p.lastSeq+1,mx:0,mz:0,yaw:p.yaw,pitch:p.pitch,buttons,weapon:p.weaponSlot,view:m.tick,...extra}]);m.step();}
function cast(m:Match,pitch=0){input(m,'a',BTN.SHIELD,{yaw:0,pitch});}
const targetPitch=(distance:number)=>-Math.atan2(1.62,distance);

describe('hero roster and universal action contract',()=>{
 it('every hero has 200 HP and the Longnight sniper deals 110 to the body and 200 to the head',()=>{const w=WEAPONS.find(x=>x.id==='longnight')!;expect(w.damage).toBe(110);expect(Math.round(w.damage*w.headMul)).toBe(200);for(const c of CHARACTERS)expect(c.hp).toBe(200);const m=fixture(2),enemy=m.player('b')!;Object.assign(m.player('a')!,{loadout:['longnight','lumen','blade'],weapon:WEAPONS.indexOf(w),weaponSlot:0,ammo:WEAPONS.map(x=>x.mag)});enemy.z=-20;input(m,'a',BTN.FIRE,{yaw:0,pitch:-Math.atan2(1.62-1,20),weapon:0});step(m,2);expect(enemy.hp).toBe(90);});
 it('has nine stable unique identities and equal competitive fundamentals',()=>{expect(CHARACTERS).toHaveLength(9);expect(new Set(CHARACTERS.map(c=>c.id)).size).toBe(9);for(const c of CHARACTERS){expect([c.hp,c.speed]).toEqual([200,5.2]);expect(ABILITIES[c.ability]).toBeDefined();}expect(CHARACTERS.slice(0,2).map(c=>c.id)).toEqual(['aster','vega']);expect(()=>heroIndex('napoleonMounted')).toThrow();expect(()=>heroIndex(undefined,99)).toThrow();});
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
 it('the round shot shatters a shield in its way and still hits the enemy behind it',()=>{const m=fixture(5);m.shields.push({id:1,owner:'b',team:'B',x:0,y:0,z:-4,yaw:0,hp:180,life:300});cast(m,-Math.atan2(.4,10));step(m,30);expect(m.shields[0]?.hp??0).toBeLessThanOrEqual(0);expect(m.player('b')!.hp).toBe(130);});
 it('Vega returns at finite speed, remains vulnerable, and never restores ammo or HP',()=>{const m=fixture(1),p=m.player('a')!;cast(m);step(m,20);Object.assign(p,{x:3,hp:70});p.ammo[0]=8;const ready=p.ability.readyAt;input(m);input(m,'a',BTN.SHIELD);expect(p.ability.phase).toBe('return');const before=p.x;m.step();expect(p.x).toBeLessThan(before);expect(p.x).toBeGreaterThan(2);step(m,40);expect(p.x).toBeCloseTo(0,2);expect(p.hp).toBe(70);expect(p.ammo[0]).toBe(8);expect(p.ability.readyAt).toBe(ready);expect(p.ability.phase).toBe('idle');});
 it('return sweep rejects wall corners, elevation, air, range and low ceilings',()=>{const m=fixture(1),p=m.player('a')!;expect(returnPathClear(m.map,p,[3,0,0])).toBe(true);expect(returnPathClear(m.map,p,[6,0,0])).toBe(false);expect(returnPathClear(m.map,p,[3,.3,0])).toBe(false);p.grounded=false;expect(returnPathClear(m.map,p,[3,0,0])).toBe(false);p.grounded=true;const wall={id:'wall',type:'box' as const,position:[1.5,1,0] as [number,number,number],size:[.3,2,3] as [number,number,number],collision:true,role:'wall',material:''};const blocked=buildMap({...data,objects:[...data.objects,wall]});expect(returnPathClear(blocked,p,[3,0,0])).toBe(false);});
 it('destroying an anchor removes the second activation opportunity',()=>{const m=fixture(1);cast(m);step(m,20);const e=m.heroes.entities[0];m.heroes.hit(e,40);m.step();input(m);input(m,'a',BTN.SHIELD);expect(m.player('a')!.ability.phase).toBe('idle');expect(m.player('a')!.ability.failure).toMatch(/冷却/);});
});
describe('guard, smoke and echo',()=>{
 it('guard includes 70 degree edges and excludes 71 degrees and vertical outside 50',()=>{for(const deg of [69,70,71])expect(guardFaces(0,0,[-Math.sin(deg*Math.PI/180)*5,0,-Math.cos(deg*Math.PI/180)*5],[0,0,0])).toBe(deg<=70);expect(guardFaces(0,0,[0,6,-5],[0,0,0])).toBe(false);});
 it('150 raw guard budget is shared by historical hits and never replenished from old poses',()=>{const m=fixture(2),p=m.player('a')!;cast(m);step(m,6);const pose={x:0,y:0,z:0,life:p.lifeId,yaw:0,pitch:0,guard:true,guardSeq:p.ability.castSeq};expect(m.heroes.absorb(p,100,[0,1,-5],pose)).toBe(0);expect(m.heroes.absorb(p,53,[0,1,-5],pose)).toBe(3);expect(m.heroes.absorb(p,100,[0,1,-5],pose)).toBe(100);expect(p.ability.phase).toBe('recovery');});
 it('guard then melee stance follows the 153 -> 3 -> 2 damage order',()=>{const m=fixture(2),p=m.player('a')!;p.weapon=5;p.weaponSlot=2;cast(m);step(m,6);const raw=m.heroes.absorb(p,153,[0,1,-5]);expect(raw).toBe(3);m.heroDamage('b','B','a',raw,4);expect(p.hp).toBe(198);});
 it('Saber holding Q multiplies ordinary movement and rejects dash/reload',()=>{const m=fixture(2),p=m.player('a')!;p.weapon=5;p.weaponSlot=2;cast(m);step(m,6);const x=p.x;input(m,'a',BTN.SHIELD|BTN.DASH|BTN.RELOAD,{mx:1});expect(p.x-x).toBeCloseTo(5.2*1.2*.8/60,3);expect(p.dashCharges).toBe(3);expect(p.reload).toBe(0);});
 it('both sphere smoke and rotated curtains use identical segment and inside semantics',()=>{const s={id:1,owner:'a',x:0,y:0,z:0,life:120,box:{yaw:Math.PI/2,width:4,depth:1.2,height:2.4}};expect(smokeBlocks([s],[-5,1,0],[5,1,0])).toBe(true);expect(insideSmoke([s],[0,1,1.9])).toBe(true);expect(insideSmoke([s],[1,1,0])).toBe(false);expect(smokeBlocks([{...s,delay:2}],[-5,1,0],[5,1,0])).toBe(false);expect(smokeBlocks([s],[-5,3,0],[5,3,0])).toBe(false);});
 it('a hook that catches nothing raises no smoke and refunds 40% of its cooldown',()=>{const m=fixture(3),p=m.player('a')!;cast(m,.6);const paid=p.ability.readyAt;step(m,25);expect(m.smokes).toHaveLength(0);expect(m.heroes.entities).toHaveLength(0);expect(p.ability.readyAt).toBe(paid-240);});
 it('Musashi leaves no echo and cuts each enemy once per dash',()=>{const m=fixture(4),enemy=m.player('b')!;enemy.z=-3;cast(m);step(m,15);expect(enemy.hp).toBe(110);expect(m.heroes.entities).toHaveLength(0);expect(m.player('a')!.z).toBeCloseTo(-9,1);});
});
describe('barrage and prayer',()=>{
 it('the round shot arrives within a fifth of a second at ten metres and still lands after its gunner dies',()=>{const m=fixture(5),enemy=m.player('b')!;cast(m,-Math.atan2(.4,10));const start=m.tick;let hit=-1;for(let i=0;i<20&&hit<0;i++){m.step();if(enemy.hp<200)hit=m.tick-start;}expect(hit).toBeGreaterThan(0);expect(hit).toBeLessThanOrEqual(13);expect(enemy.hp).toBe(130);
  const n=fixture(5),far=n.player('b')!;far.z=-30;cast(n,-Math.atan2(.4,30));step(n,6);n.heroDamage('b','B','a',999,BARRAGE_KILL);step(n,30);expect(far.hp).toBe(130);});
 it('the round shot pierces every enemy in line, spares teammates, knocks back and recoils the gunner',()=>{const m=new Match(buildMap(structuredClone(data)),'2v2');m.addPlayer('a',{team:'A',char:5,name:'a',skins:[],bot:false});m.addPlayer('b',{team:'B',char:2,name:'b',skins:[],bot:false});m.addPlayer('d',{team:'B',char:3,name:'d',skins:[],bot:false});m.addPlayer('c',{team:'A',char:6,name:'c',skins:[],bot:false});m.phase='live';m.phaseT=10000;for(const s of m.slots.values())s.spawnProtectedUntilTick=0;
  for(const [id,z] of [['a',0],['b',-6],['d',-12],['c',-9]] as const)Object.assign(m.player(id)!,{x:0,y:0,z,yaw:0});cast(m,-Math.atan2(.4,8));step(m,16);expect(m.player('b')!.hp).toBe(130);expect(m.player('d')!.hp).toBe(130);expect(m.player('c')!.hp).toBe(200);for(let i=0;i<12;i++){input(m,'a',0);input(m,'b',0);}expect(m.player('a')!.z).toBeGreaterThan(2.8);expect(m.player('b')!.z).toBeLessThan(-6.5);});
 it('banner heals each visible ally for 30 immediately plus 60 over three seconds and never overheals',()=>{for(const hp of [[100,100],[195,100],[100,200],[195,197]]){const m=fixture(6,true);m.player('a')!.hp=hp[0];Object.assign(m.player('c')!,{x:2,z:0,hp:hp[1]});cast(m);step(m,264);expect(m.player('a')!.hp).toBe(Math.min(200,hp[0]+90));expect(m.player('c')!.hp).toBe(Math.min(200,hp[1]+90));}});
 it('full health and recent damage permit defensive planting; air placement does not',()=>{const m=fixture(6),p=m.player('a')!;p.lastDamageTick=0;cast(m);expect(p.ability.readyAt).toBe(721);const k=fixture(6),air=k.player('a')!;air.grounded=false;air.y=2;cast(k);expect(air.ability.readyAt).toBe(0);});
 it('banner mitigates guns by 25%, survives damage to its owner, and stops on device destruction',()=>{const m=fixture(6),p=m.player('a')!;cast(m);step(m,24);m.heroDamage('b','B','a',50,0);expect(p.hp).toBe(162);const flag=m.heroes.entities[0];expect(flag.hp).toBe(100);step(m,30);expect(p.hp).toBe(172);m.heroes.hit(flag,100);m.heroDamage('b','B','a',50,0);expect(p.hp).toBe(122);step(m,60);expect(p.hp).toBe(122);});
 it('banner does not heal dead, distant, enemy or smoke-obscured players',()=>{for(const reason of ['dead','distance','team','smoke']){const m=fixture(6,true);m.player('a')!.hp=100;const c=m.player('c')!;Object.assign(c,{x:3,z:0,hp:100});cast(m);if(reason==='dead'){c.alive=false;m.slots.get('c')!.respawn=1000;}if(reason==='distance')c.x=7;if(reason==='team')c.team='B';if(reason==='smoke')m.smokes.push({id:8,owner:'b',x:1.5,y:0,z:0,life:300});step(m,84);expect(c.hp).toBe(100);expect(m.player('a')!.hp).toBe(reason==='smoke'?100:155);}});

});
describe('lens, boundary and shared authority',()=>{
 it('lens makes four static, expiring marks; walls, smoke and shields obstruct scans',()=>{for(const occluder of ['none','smoke','shield']){const m=fixture(7);cast(m,targetPitch(4));if(occluder==='smoke')m.smokes.push({id:3,owner:'b',x:0,y:0,z:-7,life:300});if(occluder==='shield')m.shields.push({id:4,owner:'b',team:'B',x:0,y:0,z:-7,yaw:0,hp:180,life:300});step(m,21);expect(m.heroes.marks.length).toBe(occluder==='none'?1:0);if(occluder==='none'){const mark={...m.heroes.marks[0]};m.player('b')!.x=25;step(m,5);expect(m.heroes.marks[0].x).toBe(mark.x);step(m,40);expect(m.heroes.marks).toHaveLength(0);}}});
 it('a destroyed lens cannot pulse on that tick',()=>{const m=fixture(7);cast(m,targetPitch(4));step(m,20);const lens=m.heroes.entities[0];m.heroes.hit(lens,80);m.step();expect(m.heroes.marks).toHaveLength(0);});
 it('the edict roots an enemy: no steps, dash or jump, but shooting works and damage taken rises 25%',()=>{const m=fixture(8),enemy=m.player('b')!;enemy.z=-6;cast(m,targetPitch(6));step(m,19);expect(enemy.rootUntil).toBeGreaterThan(m.tick);const charges=enemy.dashCharges,z=enemy.z;input(m,'b',BTN.DASH|BTN.JUMP,{mz:1});input(m,'b',BTN.FIRE,{mz:1});expect(enemy.z).toBe(z);expect(enemy.dashT).toBe(0);expect(enemy.dashCharges).toBe(charges);expect(enemy.y).toBe(0);m.heroDamage('a','A','b',40,0);expect(enemy.hp).toBe(150);step(m,45);input(m,'b',0,{mz:1});expect(enemy.z).not.toBe(z);});
 it('the landed edict stays 5 s as a zone that slows enemies inside by 35%; exposure lasts as long as the zone',()=>{
  const m=fixture(8),enemy=m.player('b')!;enemy.z=-6;cast(m,targetPitch(6));step(m,19);
  const edict=m.heroes.entities.find(e=>e.kind==='edict')!;expect(edict.pulse).toBe(1);expect(edict.expires-edict.created).toBe(12+300);
  expect(enemy.exposedUntil).toBe(edict.expires);
  step(m,45);expect(enemy.rootUntil).toBeLessThan(m.tick);expect(enemy.slowUntil).toBeGreaterThan(m.tick);
  const walk=(n:number)=>{const x=enemy.x,z=enemy.z;for(let i=0;i<n;i++)input(m,'b',0,{mz:1});return Math.hypot(enemy.x-x,enemy.z-z);};
  walk(6);const slowed=walk(12);expect(Math.hypot(enemy.x-edict.x,enemy.z-edict.z)).toBeLessThan(6);
  step(m,edict.expires-m.tick+10);expect(m.heroes.entities.some(e=>e.kind==='edict')).toBe(false);expect(enemy.slowUntil).toBeLessThan(m.tick);
  walk(6);const free=walk(12);expect(slowed/free).toBeCloseTo(.65,1);
 });
 it('the edict roots within 8 m and reveals only rooted enemies, to the caster team, until the zone ends; respawn clears it',()=>{
  const m=fixture(8,true),enemy=m.player('b')!,mate=m.player('c')!;enemy.z=-6;Object.assign(mate,{x:1,z:-6});
  m.addPlayer('d',{team:'B',char:0,name:'d',skins:[],bot:false});const far=m.player('d')!;Object.assign(far,{x:7.6,z:-6});m.slots.get('d')!.spawnProtectedUntilTick=0;
  const outside=m.player('d')!;cast(m,targetPitch(6));step(m,19);
  expect(enemy.revealedUntil).toBe(m.heroes.entities.find(e=>e.kind==='edict')!.expires);
  expect(far.rootUntil).toBeGreaterThan(m.tick);expect(far.revealedUntil).toBeGreaterThan(m.tick);
  expect(mate.revealedUntil).toBe(0);expect(m.player('a')!.revealedUntil).toBe(0);
  const snap=m.snapshot();expect(snap.players.find(p=>p.id==='b')!.revealedUntil).toBe(enemy.revealedUntil);
  step(m,301);expect(enemy.revealedUntil).toBeLessThan(m.tick);
  const again=fixture(8),beyond=again.player('b')!;Object.assign(beyond,{x:8.6,z:-6});cast(again,targetPitch(6));step(again,19);expect(beyond.revealedUntil).toBe(0);expect(beyond.rootUntil).toBe(0);
  const dead=fixture(8),victim=dead.player('b')!;victim.z=-6;cast(dead,targetPitch(6));step(dead,19);expect(victim.revealedUntil).toBeGreaterThan(dead.tick);
  dead.heroDamage('a','A','b',999,0);step(dead,200);expect(victim.alive).toBe(true);expect(victim.revealedUntil).toBe(0);void outside;
 });
 it('the edict roots and slows through walls, buildings, smoke and other floors',()=>{
  const walled=structuredClone(data);walled.objects.push({id:'wall',type:'box',position:[0,1.5,-9],size:[24,3,.4],collision:true,role:'wall',material:'stone'} as never,
   {id:'deck',type:'box',position:[6,2.4,-6],size:[3,.4,3],collision:true,role:'floor',material:'stone'} as never);
  const m=fixture(8,false,walled),hidden=m.player('b')!;Object.assign(hidden,{x:0,z:-11.5});
  m.addPlayer('d',{team:'B',char:0,name:'d',skins:[],bot:false});m.slots.get('d')!.spawnProtectedUntilTick=0;const above=m.player('d')!;Object.assign(above,{x:6,y:2.6,z:-6});
  m.smokes.push({id:9,owner:'b',x:0,y:0,z:-7.5,life:300} as never);
  cast(m,targetPitch(6));step(m,19);
  const edict=m.heroes.entities.find(e=>e.kind==='edict')!;expect(edict.z).toBeCloseTo(-6,0);
  expect(hidden.rootUntil).toBeGreaterThan(m.tick);expect(hidden.exposedUntil).toBe(edict.expires);expect(hidden.revealedUntil).toBe(edict.expires);
  expect(above.rootUntil).toBeGreaterThan(m.tick);expect(above.revealedUntil).toBe(edict.expires);
  step(m,45);expect(hidden.slowUntil).toBeGreaterThan(m.tick);
 });
 it('an enemy who walks into the zone later is rooted once, exposed and revealed until it ends',()=>{
  const m=fixture(8),enemy=m.player('b')!;Object.assign(enemy,{x:0,z:-20});cast(m,targetPitch(6));step(m,19);
  const edict=m.heroes.entities.find(e=>e.kind==='edict')!;expect(edict.pulse).toBe(1);expect(enemy.rootUntil).toBe(0);
  step(m,60);Object.assign(enemy,{x:0,z:-9});step(m,1);
  expect(enemy.rootUntil).toBeGreaterThan(m.tick);expect(enemy.exposedUntil).toBe(edict.expires);expect(enemy.revealedUntil).toBe(edict.expires);
  const firstRoot=enemy.rootUntil;step(m,50);Object.assign(enemy,{z:-20});step(m,5);Object.assign(enemy,{z:-9});step(m,1);
  expect(enemy.rootUntil).toBe(firstRoot);expect(enemy.slowUntil).toBeGreaterThan(m.tick);
 });
 it('the edict zone does not slow its own team or players who were never inside it',()=>{
  const m=fixture(8,true),enemy=m.player('b')!,mate=m.player('c')!;enemy.z=-6;Object.assign(mate,{x:1,z:-6});cast(m,targetPitch(6));step(m,40);
  expect(mate.slowUntil).toBeLessThanOrEqual(m.tick);expect(enemy.slowUntil).toBeGreaterThan(m.tick);
  const far=fixture(8),other=far.player('b')!;Object.assign(other,{x:12,z:-6});cast(far,targetPitch(6));step(far,40);expect(other.slowUntil).toBeLessThanOrEqual(far.tick);
 });
 it('the edict reaches 18 m and catches an enemy 4.5 m from where it lands',()=>{const m=fixture(8),enemy=m.player('b')!;Object.assign(enemy,{x:4.5,z:-16});cast(m,targetPitch(16));step(m,19);expect(enemy.rootUntil).toBeGreaterThan(m.tick);});
 it('the edict snaps to an enemy inside smoke and roots them',()=>{
  const m=fixture(8),enemy=m.player('b')!;Object.assign(enemy,{x:.4,z:-12});
  m.smokes.push(settleSmoke(m.map,{id:5,owner:'b',x:0,y:0,z:-9,life:SMOKE.life-120}));
  expect(smokeBlocks(m.smokes,[0,1.62,0],[.4,.9,-12])).toBe(true);
  cast(m,0);step(m,19);const e=m.heroes.entities.find(x=>x.kind==='edict')!;expect(e.z).toBeCloseTo(-12,0);expect(enemy.rootUntil).toBeGreaterThan(m.tick);
 });
 it('the edict snaps to an enemy near the crosshair and lands at their feet',()=>{const m=fixture(8),enemy=m.player('b')!;Object.assign(enemy,{x:.4,z:-8});cast(m,0);step(m,6);const e=m.heroes.entities[0];expect(e.kind).toBe('edict');expect(e.x).toBeCloseTo(.4,1);expect(e.z).toBeCloseTo(-8,1);});
 it('Homeward denies enemy sustained skill footprints in spawn buffers',()=>{const map=getMap('homeward'),m=fixture(8),p=m.player('a')!;Object.assign(p,{x:20,y:0,z:4,yaw:-Math.PI/2,pitch:targetPitch(6)});expect(abilityPlacement(map,p,'edict').error).not.toBe('');});
 it('snapshot state is cloned, so client prediction cannot mutate authority',()=>{const m=fixture(1);cast(m);const snap=m.snapshot();snap.players[0].ability.readyAt=0;snap.players[0].ability.target![0]=123;expect(m.player('a')!.ability.readyAt).toBe(1081);expect(m.player('a')!.ability.target![0]).toBe(0);const copy=clonePlayer(m.player('a')!);copy.ability.castSeq=999;expect(m.player('a')!.ability.castSeq).toBe(1);});
});

describe('client windup prediction and packet impairment',()=>{
 it('predicts action lock immediately without spawning a device or touching authoritative health',()=>{
  const m=fixture(0),snap=m.snapshot(),p=clonePlayer(m.player('a')!);const q:Input={seq:1,mx:0,mz:0,yaw:0,pitch:0,buttons:BTN.SHIELD|BTN.FIRE,weapon:0,view:0};
  predictAbility(m.map,p,q,snap);const events=applyInput(m.map,p,q);expect(p.ability.phase).toBe('windup');expect(events.some(e=>e.type==='fire')).toBe(false);expect(m.shields).toHaveLength(0);expect(m.player('a')!.ability.castSeq).toBe(0);expect(m.player('b')!.hp).toBe(200);
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
 it('the wind slash throws a survivor three metres back',()=>{const m=fixture(2),enemy=m.player('b')!;enemy.z=-6;cast(m);step(m,4);input(m);expect(enemy.hp).toBe(120);expect(enemy.pullT).toBeGreaterThan(0);for(let i=0;i<12;i++)input(m,'b',0);expect(enemy.z).toBeCloseTo(-9,1);});
 it('a front guard stops a cannonball and a hook; the shot never reaches the teammate behind her',()=>{
  for(const shooter of [5,3]){const m=new Match(buildMap(structuredClone(data)),'2v2');m.addPlayer('a',{team:'A',char:shooter,name:'a',skins:[],bot:false});m.addPlayer('b',{team:'B',char:2,name:'b',skins:[],bot:false});m.addPlayer('d',{team:'B',char:6,name:'d',skins:[],bot:false});m.phase='live';m.phaseT=10000;for(const s of m.slots.values())s.spawnProtectedUntilTick=0;
   Object.assign(m.player('a')!,{x:0,y:0,z:0,yaw:0});Object.assign(m.player('b')!,{x:0,y:0,z:-8,yaw:Math.PI});Object.assign(m.player('d')!,{x:0,y:0,z:-12,yaw:Math.PI});
   input(m,'b',BTN.SHIELD,{yaw:Math.PI,pitch:0});for(let i=0;i<4;i++)input(m,'b',BTN.SHIELD,{yaw:Math.PI,pitch:0});expect(m.player('b')!.ability.phase).toBe('guard');
   input(m,'a',BTN.SHIELD,{yaw:0,pitch:-Math.atan2(.4,8)});for(let i=0;i<12;i++){input(m,'b',BTN.SHIELD,{yaw:Math.PI,pitch:0});}
   expect(m.player('b')!.hp).toBe(200);expect(m.player('b')!.pullT).toBe(0);expect(m.player('b')!.z).toBeCloseTo(-8,1);expect(m.player('d')!.hp).toBe(200);expect(m.heroes.entities.filter(e=>e.kind==='barrage'||e.kind==='curtain')).toHaveLength(0);}
 });
 it('wind guard releases a stronger slash after absorbing damage, never through a wall',()=>{
  for(const wall of [false,true]){const m=fixture(2),p=m.player('a')!,enemy=m.player('b')!;enemy.z=-5;cast(m);step(m,6);m.heroes.absorb(p,60,[0,1,-5]);if(wall)m.shields.push({id:9,owner:'b',team:'B',x:0,y:0,z:-2,yaw:0,hp:180,life:300});input(m);expect(enemy.hp).toBe(wall?200:100);expect(p.ability.phase).toBe('recovery');}
 });
 it('a full guard counters at once for 130, and the guard holds a full second',()=>{
  const m=fixture(2),p=m.player('a')!,enemy=m.player('b')!;enemy.z=-5;cast(m);for(let i=0;i<50;i++)input(m,'a',BTN.SHIELD);expect(p.ability.phase).toBe('guard');
  m.heroes.absorb(p,150,[0,1,-5],undefined,'b');expect(p.ability.phase).toBe('recovery');expect(enemy.hp).toBe(70);
 });
 it('a front guard swallows Musashi\'s cut, the solar judgement and a cannon burst, and says who it stopped',()=>{
  const m=fixture(4),musashi=m.player('a')!,artoria=m.player('b')!;artoria.char=2;Object.assign(artoria,{z:-4,yaw:Math.PI});m.snapshot();
  const both=(a:number,b:number)=>{m.queueInputs('a',[{seq:musashi.lastSeq+1,mx:0,mz:0,yaw:0,pitch:0,buttons:a,weapon:musashi.weaponSlot,view:m.tick}]);m.queueInputs('b',[{seq:artoria.lastSeq+1,mx:0,mz:0,yaw:Math.PI,pitch:0,buttons:b,weapon:artoria.weaponSlot,view:m.tick}]);m.step();};
  for(let i=0;i<5;i++)both(0,BTN.SHIELD);expect(artoria.ability.phase).toBe('guard');
  for(let i=0;i<14;i++)both(i===0?BTN.SHIELD:0,BTN.SHIELD);
  expect(artoria.hp).toBe(200);expect(artoria.ability.guardBudget).toBe(60);
  const blocked=m.snapshot().events.filter(e=>e.t==='ability'&&e.action==='blocked');expect(blocked).toHaveLength(1);expect(blocked[0]).toMatchObject({id:'b',by:'a',amount:90});
  m.heroes.heroHit('a','A',artoria,30,104,[0,2.3,-1]);expect(artoria.hp).toBe(200);m.heroes.heroHit('a','A',artoria,35,101,[0,1,-1]);expect(artoria.hp).toBe(195);
 });
 it('Musashi\'s cut still lands on a guard turned away from it',()=>{
  const m=fixture(4),artoria=m.player('b')!;artoria.char=2;Object.assign(artoria,{z:-4,yaw:0});m.heroes.heroHit('a','A',artoria,90,106,[0,1.1,-2]);expect(artoria.hp).toBe(110);
 });
 it('Musashi dashes nine metres along the aim, not the movement keys, and stays vulnerable',()=>{const m=fixture(4),p=m.player('a')!;input(m,'a',BTN.SHIELD,{yaw:0,pitch:0,mx:1});step(m,15);expect(p.x).toBeCloseTo(0,2);expect(p.z).toBeCloseTo(-9,1);m.heroDamage('b','B','a',20,0);expect(p.hp).toBe(180);});
 it('Blackbeard hooks an enemy, drags them to 2.5 m in front and slows them; a second Q does nothing',()=>{const m=fixture(3),p=m.player('a')!,enemy=m.player('b')!;enemy.z=-7;cast(m,-Math.atan2(.4,7));const ready=p.ability.readyAt;step(m,12);expect(enemy.hp).toBe(170);expect(enemy.pullT).toBeGreaterThan(0);for(let i=0;i<20;i++)input(m,'b',0);expect(enemy.z).toBeCloseTo(-2.5,1);expect(enemy.slowUntil).toBeGreaterThan(m.tick-20);input(m);input(m,'a',BTN.SHIELD);expect(p.ability.readyAt).toBe(ready);expect(p.ability.castSeq).toBe(1);});
 it('Ozymandias can redirect the disc; each pulse damages only visible enemies in its cone',()=>{const m=fixture(7),p=m.player('a')!,enemy=m.player('b')!;Object.assign(enemy,{x:5,z:-4});cast(m,targetPitch(4));step(m,30);input(m);input(m,'a',BTN.SHIELD,{yaw:-Math.PI/2});const disc=m.heroes.entities[0];expect(disc.yaw).toBeCloseTo(-Math.PI/2);step(m,25);expect(enemy.hp).toBe(170);expect(m.heroes.marks).toHaveLength(1);expect(p.ability.castSeq).toBe(1);});
 it('the hook reaches an enemy 22 m away and drags them all the way in',()=>{const m=fixture(3),enemy=m.player('b')!;enemy.z=-22;cast(m,-Math.atan2(.4,22));step(m,22);expect(enemy.hp).toBe(170);expect(enemy.pullT).toBeGreaterThan(0);for(let i=0;i<40;i++)input(m,'b',0);expect(enemy.z).toBeCloseTo(-2.5,1);});
 it('a hooked enemy cannot dash or jump out of the drag',()=>{const m=fixture(3),enemy=m.player('b')!;enemy.z=-7;cast(m,-Math.atan2(.4,7));step(m,12);expect(enemy.pullT).toBeGreaterThan(0);input(m,'b',BTN.DASH|BTN.JUMP,{mx:1});expect(enemy.dashT).toBe(0);expect(enemy.y).toBe(0);});
 it('damaging an unborn, dead or spawn-protected target cannot award skill damage',()=>{const m=fixture(2),enemy=m.player('b')!;enemy.z=-5;m.slots.get('b')!.spawnProtectedUntilTick=200;cast(m);step(m,6);input(m);expect(enemy.hp).toBe(200);});
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
