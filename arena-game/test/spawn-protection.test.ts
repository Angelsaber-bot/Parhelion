import { describe, expect, it } from 'vitest';
import { Bot, BOT_SKILL } from '../shared/bot.ts';
import { COUNTDOWN_TICKS, GUN_IDS, MELEE_IDS, RESPAWN_TICKS, SHIELD, SPAWN_PROTECTION_TICKS, TICK_HZ, WEAPONS, weaponIndex, type WeaponId } from '../shared/content.ts';
import { buildMap, type MapData } from '../shared/map.ts';
import { Match, type PlayerInfo } from '../shared/match.ts';
import { BTN, type Input } from '../shared/sim.ts';
import { startOffline } from '../src/session.ts';

const data: MapData = {
  mapId: 'spawn-fixture', version: '1', bounds: { min: [-30,-1,-30], max: [30,12,30] },
  player: { radius:.32, height:1.8, eyeHeight:1.65, walkSpeed:5.2, stepHeight:.28 },
  objects: [{ id:'floor', type:'box', position:[0,-.1,0], size:[60,.2,60], material:'', collision:true, role:'floor' }],
  anchors: [{ id:'a', kind:'spawn', team:'west', position:[0,0,0] }, { id:'b', kind:'spawn', team:'east', position:[0,0,-2] }], routes:[],
};
const flat = buildMap(data);
const info = (team:'A'|'B'):PlayerInfo => ({ name:team, team, char:0, skins:[], bot:false });
const input = (seq:number, extra:Partial<Input> = {}):Input => ({ seq, mx:0, mz:0, yaw:0, pitch:0, buttons:0, weapon:0, view:0, ...extra });
function fixture(id:WeaponId = 'lumen') {
  const m = new Match(flat,'1v2'), w = WEAPONS[weaponIndex(id)];
  m.addPlayer('a', { ...info('A'), loadout: w.kind === 'gun' ? [id as typeof GUN_IDS[number], id === 'lumen' ? 'halo' : 'lumen', 'blade'] : ['lumen','halo',id as typeof MELEE_IDS[number]] });
  m.addPlayer('b',info('B')); m.phase = 'live'; m.phaseT = 10000;
  const a = m.player('a')!; a.weapon = weaponIndex(id); a.weaponSlot = w.kind === 'melee' ? 2 : 0;
  m.snapshot(); return m;
}
function advance(m:Match, tick:number) { while (m.tick < tick) m.step(); }
function strikeAt(m:Match, tick:number) {
  const a=m.player('a')!, w=WEAPONS[a.weapon];
  advance(m, tick-(w.windup ?? 0)-1);
  m.queueInputs('a',[input(a.lastSeq+1,{ buttons:BTN.FIRE, weapon:a.weaponSlot, view:Math.max(0,m.tick-10) })]); m.step();
  advance(m,tick);
}
function expiry(m:Match,id='b') { return m.snapshot().players.find(p=>p.id===id)!.spawnProtectedUntilTick!; }

describe('full authoritative 2.5-second spawn immunity',()=>{
  it('is 150 world ticks and never changes the existing 180-tick death delay',()=>{
    expect(SPAWN_PROTECTION_TICKS).toBe(150); expect(SPAWN_PROTECTION_TICKS/TICK_HZ).toBe(2.5); expect(RESPAWN_TICKS).toBe(180);
  });
  for (const id of [...GUN_IDS,...MELEE_IDS]) for (const impact of [149,150]) it(`${id}: impact at tick ${impact} respects exact expiry for HP, events and score`,()=>{
    const m=fixture(id); expect(expiry(m)).toBe(150);
    // A protected defender can fire; neither shooting nor an attack windup cancels immunity.
    m.queueInputs('b',[input(1,{ yaw:Math.PI, buttons:BTN.FIRE })]); m.step(); m.snapshot();
    strikeAt(m,impact); const snap=m.snapshot(), b=m.player('b')!;
    expect(snap.events.some(e=>e.t==='shot'||e.t==='meleeStrike')).toBe(true);
    if(impact<150){
      expect(b.hp).toBe(150); expect(b.alive).toBe(true);
      expect(snap.events.filter(e=>e.t==='hit'||e.t==='kill')).toEqual([]);
      expect(snap.score).toEqual({A:0,B:0}); expect(snap.players.every(p=>p.kills===0&&p.deaths===0)).toBe(true);
    }else{ expect(b.hp).toBeLessThan(150); expect(snap.events.some(e=>e.t==='hit'&&e.victim==='b')).toBe(true); }
  });
  for (const id of [...GUN_IDS,...MELEE_IDS]) it(`${id}: deployed shield HP also stays intact until its owner's immunity expires`,()=>{
    for(const impact of [149,150]){
      const m=fixture(id);
      m.queueInputs('b',[input(1,{yaw:Math.PI,buttons:BTN.SHIELD})]); m.step();
      expect(m.shields).toHaveLength(1); expect(m.shields[0].hp).toBe(SHIELD.hp); m.snapshot();
      strikeAt(m,impact); const snap=m.snapshot();
      expect(m.player('b')!.hp).toBe(150);
      if(impact<150){ expect(m.shields[0].hp).toBe(SHIELD.hp); expect(snap.events.some(e=>e.t==='hit'||e.t==='kill'||e.t==='shieldBreak')).toBe(false); }
      else expect(m.shields[0].hp).toBeLessThan(SHIELD.hp);
    }
  });
  it('uses world ticks without packets, ignores forged protection fields, and cannot be shortened by catch-up inputs',()=>{
    const m=fixture(); advance(m,20);
    const before=expiry(m,'a');
    m.queueInputs('a',Array.from({length:8},(_,i)=>({...input(i+1,{buttons:BTN.FIRE}),spawnProtectedUntilTick:0,spawnProtection:0})));
    m.step(); expect(m.player('a')!.lastSeq).toBe(8); expect(expiry(m,'a')).toBe(before); expect(m.tick).toBe(21);
    advance(m,149); expect(expiry(m,'a')-m.tick).toBe(1); m.step(); expect(expiry(m,'a')-m.tick).toBe(0);
  });
  it('grants full time at first join, late join, live-round reset, every real respawn and rematch',()=>{
    const m=fixture('longnight'); expect(expiry(m)).toBe(150);
    advance(m,40); m.addPlayer('late',info('B')); expect(expiry(m,'late')).toBe(190);
    m.phase='countdown'; m.phaseT=1; m.step(); const live=m.tick;
    expect(expiry(m)).toBe(live+150); expect(expiry(m,'late')).toBe(live+150);
    // Longnight's unchanged headshot is lethal at expiry; actual death delay is preserved.
    strikeAt(m,live+150); expect(m.player('b')!.alive).toBe(false);
    expect(m.slots.get('b')!.respawn).toBe(RESPAWN_TICKS-1); // existing end-of-death-tick decrement
    const spawnTick=m.tick+m.slots.get('b')!.respawn;
    advance(m,spawnTick-1); expect(m.player('b')!.alive).toBe(false);
    m.step(); expect(m.player('b')!.alive).toBe(true); expect(expiry(m)).toBe(spawnTick+150);
    // Repeat a second death/respawn, without changing expiry or bypassing damage.
    const a=m.player('a')!; a.fireCd=0; a.prevButtons=0;
    strikeAt(m,spawnTick+150); expect(m.player('b')!.alive).toBe(false);
    advance(m,m.tick+m.slots.get('b')!.respawn); expect(expiry(m)).toBe(m.tick+150);
    for(let round=0;round<2;round++){
      m.phase='ended'; m.rematch(); expect(expiry(m)).toBe(m.tick+150);
      advance(m,m.tick+COUNTDOWN_TICKS); expect(m.phase).toBe('live'); expect(expiry(m)).toBe(m.tick+150);
    }
  });
  it('a real bot cannot damage a fresh target but can after protection expires',()=>{
    const m=fixture('blade'), bot=new Bot(2,BOT_SKILL.hard); let protectedAttacks=0, laterHit=false;
    for(let i=0;i<450&&!laterHit;i++){
      const a=m.player('a')!,b=m.player('b')!;
      Object.assign(b,{x:a.x-Math.sin(a.yaw)*1.5,y:a.y,z:a.z-Math.cos(a.yaw)*1.5});
      m.queueInputs('a',[bot.think(m,'a')]); m.step(); const snap=m.snapshot();
      if(m.tick<150){ expect(b.hp).toBe(150); expect(snap.events.some(e=>e.t==='hit'||e.t==='kill')).toBe(false); protectedAttacks+=snap.events.filter(e=>e.t==='shot'||e.t==='meleeStrike').length; }
      else laterHit=snap.events.some(e=>e.t==='hit'&&e.victim==='b');
    }
    expect(protectedAttacks).toBeGreaterThan(0); expect(laterHit).toBe(true);
  });
  it('the actual offline session preserves immunity while paused and refreshes it when the live round begins',()=>{
    const s=startOffline({layout:'1v1',team:'A',name:'Local',char:0,skins:[]},'easy');
    try{
      s.setPaused(true); const m=s.match!; expect(expiry(m,s.id)-m.tick).toBe(150);
      while(m.phase!=='live')m.step();
      expect(expiry(m,s.id)-m.tick).toBe(150);
      const saved=expiry(m,s.id); s.send([input(1,{buttons:BTN.FIRE})]); m.step(); expect(expiry(m,s.id)).toBe(saved);
    }finally{s.close();}
  });
});
