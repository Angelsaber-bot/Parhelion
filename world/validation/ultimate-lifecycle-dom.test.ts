import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bootWorldWithoutGpu } from './world-dom-boot.fixture';
import { SERVANTS } from '../src/contracts';

/** Explicit NON-GPU production DOM/GLB/BVH/HP verification, not pixels or FPS.
 * Recruitment, charge and target recovery are injected only to isolate ultimate damage. */
test('NON-GPU production ultimate lifecycle retains one paid cast and authored HP pulses', async t => {
 const h=await bootWorldWithoutGpu({deterministic:true}); const {world:w,window}=h; let now=0;
 const frame=(n=1)=>{for(let i=0;i<n;i++)h.frame(now+=1000/60);};
 const key=(code:string,key='')=>{for(const type of ['keydown','keyup'])window.document.body.dispatchEvent(new window.KeyboardEvent(type,{code,key,bubbles:true,cancelable:true}));};
 const enemy=w.combat.state.enemies.find((e:any)=>e.kind!=='king'&&!e.miniboss);
 const center=w.layout.markers.find((m:any)=>m.id==='boss_vacant_king').p;
 const floor=(x:number,z:number)=>{const ray=new THREE.Ray(new THREE.Vector3(x,center[1]+3,z),new THREE.Vector3(0,-1,0));let best=Infinity;for(const c of w.colliders)if(c.enabled){const hit=c.bvh.raycastFirst(ray,THREE.DoubleSide);if(hit&&Math.abs(hit.face?.normal.y??0)>.7)best=Math.min(best,hit.distance);}assert.ok(Number.isFinite(best));return center[1]+3-best;};
 const position=()=>{w.player.teleport(center[0],floor(center[0],center[2]+7)+.05,center[2]+7);w.player.onGround=true;w.player.flying=w.player.swimming=w.player.gliding=false;};
 const resetTarget=()=>{Object.assign(enemy.p,{x:center[0],y:floor(center[0],center[2]),z:center[2]});Object.assign(enemy.home,enemy.p);enemy.hp=enemy.maxHp=10000;enemy.mode='recover';enemy.timer=100;enemy.active=true;enemy.pacified=false;};
 const hits:any[]=[];const record=w.actions.recordDamage.bind(w.actions);w.actions.recordDamage=(hit:any)=>{hits.push({...hit});record(hit);};
 let shots=0;const shot=w.combat.shot.bind(w.combat);w.combat.shot=(...args:any[])=>{shots++;return shot(...args);};
 let activations=0;const activate=w.actions.skills.activate.bind(w.actions.skills);w.actions.skills.activate=(...args:any[])=>{const ok=activate(...args);if(ok)activations++;return ok;};
 try{
  w.done.add('armory_rack');for(const s of SERVANTS)w.contract.recruit(s.contract);position();(window.document.getElementById('start') as HTMLElement).click();await Promise.resolve();frame(2);await h.settleAssets();
  for(const e of w.combat.state.enemies)if(e!==enemy&&e.kind!=='king'){e.mode='dead';e.timer=Infinity;e.hp=0;e.active=false;}
  for(const s of SERVANTS)for(const mode of ['full','short','off','skip-intro','skip-before-hit','skip-between-hits','skip-after-hit','escape-unlock','visibility-pause','renderer-failure',...(s.id==='musashi'?['blur-intro','blur-release','visibility-release']:[])])await t.test(`${s.id} ${mode}`,async()=>{
   w.actions.reset();w.contract.select(s.id);position();resetTarget();frame(2);await h.settleAssets();frame(30);
   const root=s.id==='saber'?w.servant.root:w.scene.children.find((o:any)=>o.name.startsWith('CharacterKit:')&&o.name.toLowerCase().includes(s.id));assert.ok(root,'actual GLB actor');
   resetTarget();root.position.set(center[0],floor(center[0],center[2]-3),center[2]-3);root.rotation.y=0;w.player.yaw=0;w.actions.reset();w.actions.skills.energyValue=100;hits.length=0;activations=0;w.ultimateDirector.setMode(['short','off'].includes(mode)?mode:'full');
   const viewport=w.renderer.getViewport(new THREE.Vector4()).toArray(),shotsBefore=shots;
   const hp=enemy.hp;key('KeyX','x');assert.equal(w.actions.skills.casting,true);assert.equal(w.ultimateDirector.active,true);assert.equal(w.actions.skills.energy,0);assert.equal(activations,1);
   const playerHp=w.combat.state.hp,playerPos=w.player.pos.clone(),timer=enemy.timer;
   const threat=s.id==='saber'&&mode==='full'?w.combat.state.enemies.find((e:any)=>e!==enemy&&e.kind!=='king'):null;
   if(threat){Object.assign(threat.p,{x:w.player.pos.x,y:w.player.pos.y,z:w.player.pos.z+1});Object.assign(threat.home,threat.p);threat.mode='windup';threat.timer=.001;threat.hp=threat.maxHp;threat.active=true;threat.pacified=false;}

   let interrupted=false;const originalRender=w.ultimateStage.render;
   if(mode==='renderer-failure')w.ultimateStage.render=()=>{throw Error('injected NON-GPU stage failure');};
   if(mode==='skip-intro'||mode==='escape-unlock'){
    if(mode==='escape-unlock'){key('Escape','Escape');window.document.exitPointerLock();}else w.ultimateDirector.overlay.querySelector('button').click();
    assert.equal(w.actions.skills.casting,true);assert.equal(w.ultimateDirector.showing,false);
   }
   if(['visibility-pause','visibility-release','blur-intro','blur-release'].includes(mode)){
    const pureBlur=mode.startsWith('blur-'),descriptor=Object.getOwnPropertyDescriptor(window.document,'hasFocus')!;
    if(mode.endsWith('release')){for(let i=0;i<1200&&hits.length===0;i++)frame();assert.equal(hits.length,1,'pause between authored multihit contacts');}
    const pausedHp=enemy.hp,before=JSON.stringify(w.ultimateDirector.frame),cd=w.actions.skills.cooldown('ultimate'),energy=w.actions.skills.energy;
    if(pureBlur)Object.defineProperty(window.document,'hasFocus',{value:()=>false,configurable:true});
    else{Object.defineProperty(window.document,'visibilityState',{value:'hidden',configurable:true});window.document.dispatchEvent(new window.Event('visibilitychange'));}
    window.dispatchEvent(new window.Event('blur'));frame(240);
    assert.equal(JSON.stringify(w.ultimateDirector.frame),before);assert.equal(enemy.hp,pausedHp);assert.equal(w.actions.skills.casting,true);assert.equal(w.actions.skills.energy,energy);assert.equal(w.actions.skills.cooldown('ultimate'),cd);
    if(pureBlur)Object.defineProperty(window.document,'hasFocus',descriptor);
    else{Object.defineProperty(window.document,'visibilityState',{value:'visible',configurable:true});window.document.dispatchEvent(new window.Event('visibilitychange'));}
    window.dispatchEvent(new window.Event('focus'));h.frame(now+=60000);assert.equal(enemy.hp,pausedHp,'resume must not catch up release strikes');
   }
   if(mode==='full')window.document.body.dispatchEvent(new window.KeyboardEvent('keydown',{code:'KeyW',key:'w',bubbles:true}));
   for(let i=0;i<900&&w.ultimateDirector.active;i++){
    if(!interrupted&&((mode==='skip-before-hit'&&w.ultimateDirector.releasing&&hits.length===0)||(mode==='skip-between-hits'&&hits.length===1)||(mode==='skip-after-hit'&&hits.length===(['blackbeard','musashi'].includes(s.id)?3:1)))){w.ultimateDirector.skip();interrupted=true;}
    key('KeyX','x');if(mode!=='full')key('KeyW','w');key('KeyF','f');window.document.body.dispatchEvent(new window.MouseEvent('mousedown',{button:0,bubbles:true,cancelable:true}));frame();
    assert.equal(w.combat.state.hp,playerHp,'frozen enemy cannot hurt player');assert.deepEqual(w.player.pos.toArray(),playerPos.toArray(),'input cannot move player');assert.equal(enemy.timer,timer,'enemy clock frozen');if(threat){assert.equal(threat.mode,'windup');assert.equal(threat.timer,.001,'imminent adjacent attack must not advance behind the cinematic');}
   }
   if(mode.startsWith('skip-')&&mode!=='skip-intro')assert.equal(interrupted,true,'requested skip phase reached');
   w.ultimateStage.render=originalRender;
   if(mode==='renderer-failure'){assert.equal(h.warnings.length,1);assert.match(String(h.warnings[0][0]),/Ultimate renderer failed/);h.warnings.length=0;}
   if(mode==='escape-unlock'){(window.document.getElementById('start') as HTMLElement).click();await Promise.resolve();}
   if(threat){threat.mode='dead';threat.timer=Infinity;threat.hp=0;threat.active=false;}
   const ult=hits.filter(hit=>hit.source==='ultimate'&&hit.id===enemy.id);const expected={saber:138,blackbeard:144,napoleon:155,musashi:156}[s.id as 'saber'];
   t.diagnostic(`${s.id}/${mode}: HP loss ${hp-enemy.hp}; ultimate ${JSON.stringify(ult)}`);
   assert.equal(w.ultimateDirector.active,false,'cast completes');assert.equal(w.actions.skills.casting,false);assert.equal(ult.reduce((n,h)=>n+h.damage,0),expected);assert.equal(hp-enemy.hp,expected,'no ordinary damage substitution');assert.equal(activations,1);assert.equal(w.actions.skills.energy,0);assert.ok(w.actions.skills.cooldown('ultimate')>20);assert.equal(window.document.body.classList.contains('ultimate-showing'),false);assert.equal(w.ultimateStage.isActive,false);assert.equal(w.ultimateStage.scene.children.length,0,'stage releases scene ownership');
   assert.equal(w.ultimateDirector.overlay.hidden,true);assert.deepEqual(w.renderer.getViewport(new THREE.Vector4()).toArray(),viewport);assert.equal(shots,shotsBefore,'captured mouse input cannot fire during cast');
   if(mode==='full'){
    const frozen=w.player.pos.clone(),clock=enemy.timer,aiAcc=w.combat.acc;frame();assert.ok(w.combat.acc!==aiAcc||enemy.timer<clock,'world simulation clock resumes on first normal frame');frame(2);assert.ok(enemy.timer<clock,'20Hz enemy timer resumes by its next scheduled tick');frame(6);
    assert.ok(Math.hypot(w.player.pos.x-frozen.x,w.player.pos.z-frozen.z)<.001,'held W from cinematic is cleared, not replayed');assert.equal(shots,shotsBefore,'cinematic mouse press cannot become a delayed shot');
    window.document.body.dispatchEvent(new window.KeyboardEvent('keyup',{code:'KeyW',key:'w',bubbles:true}));window.document.body.dispatchEvent(new window.MouseEvent('mouseup',{button:0,bubbles:true}));
    window.document.body.dispatchEvent(new window.KeyboardEvent('keydown',{code:'KeyW',key:'w',bubbles:true}));frame(12);window.document.body.dispatchEvent(new window.KeyboardEvent('keyup',{code:'KeyW',key:'w',bubbles:true}));assert.ok(Math.hypot(w.player.pos.x-frozen.x,w.player.pos.z-frozen.z)>.1,'fresh W after release moves player');
    window.document.body.dispatchEvent(new window.MouseEvent('mousedown',{button:0,bubbles:true}));window.document.body.dispatchEvent(new window.MouseEvent('mouseup',{button:0,bubbles:true}));assert.ok(shots>shotsBefore,'fresh fire after release produces a real production projectile');
   }
  });
  for(const mode of ['full','off','skip'])await t.test(`generic player ${mode} exact 90 HP`,()=>{
   w.actions.reset();if(w.contract.companionSummoned)w.contract.toggle();position();resetTarget();frame(30);resetTarget();enemy.p.z=center[2]+4;enemy.p.y=floor(enemy.p.x,enemy.p.z);Object.assign(enemy.home,enemy.p);w.player.yaw=0;
   w.actions.reset();w.actions.skills.energyValue=100;activations=0;hits.length=0;w.ultimateDirector.setMode(mode==='off'?'off':'full');const hp=enemy.hp;key('KeyX','x');assert.equal(w.ultimateDirector.active,true);assert.equal(w.ultimateDirector.frame.identity,'player');if(mode==='skip')w.ultimateDirector.skip();
   for(let i=0;i<1200&&w.ultimateDirector.active;i++)frame();assert.equal(w.actions.skills.casting,false);assert.equal(w.ultimateDirector.active,false);assert.equal(activations,1);assert.equal(w.actions.skills.energy,0);assert.equal(hp-enemy.hp,90);assert.equal(hits.filter(hit=>hit.source==='ultimate'&&hit.id===enemy.id).reduce((n,hit)=>n+hit.damage,0),90);assert.equal(w.ultimateStage.scene.children.length,0);
  });
  await t.test('production preferences and locale persist across repeated casts',()=>{
   const select=window.document.querySelector('.ultimate-settings select') as HTMLSelectElement;select.value='short';select.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(w.ultimateDirector.mode,'short');assert.equal(window.localStorage.getItem('parhelion-world-ultimate-mode-v1'),'short');
   const lang=window.document.querySelector('.parhelion-language select') as HTMLSelectElement;assert.ok(lang);lang.value='en';lang.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(window.localStorage.getItem('parhelion-language-v1'),'en');assert.equal(select.options[0].textContent,'Full');
   lang.value='zh';lang.dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(window.localStorage.getItem('parhelion-language-v1'),'zh');assert.equal(select.options[0].textContent,'完整');
  });
  for(const interruption of ['blocked-navigation','programmatic-switch','pagehide'])await t.test(interruption,async()=>{
   w.actions.reset();w.contract.select('musashi');position();resetTarget();frame(30);await h.settleAssets();w.actions.reset();w.actions.skills.energyValue=100;w.ultimateDirector.setMode('full');hits.length=0;key('KeyX','x');assert.equal(w.ultimateDirector.active,true);
   if(interruption==='blocked-navigation'){
    const oldSettings=w.settings.value.bindings.settings;assert.equal(w.settings.bind('settings','Mouse4'),null);
    for(const modifier of ['ctrlKey','metaKey','altKey']){window.document.body.dispatchEvent(new window.MouseEvent('mousedown',{button:4,[modifier]:true,bubbles:true,cancelable:true}));window.document.body.dispatchEvent(new window.MouseEvent('mouseup',{button:4,[modifier]:true,bubbles:true,cancelable:true}));assert.equal(w.settingsPanel.open,false,'modified remapped mouse cannot open settings through cinematic capture');assert.equal(w.actions.skills.casting,true);assert.equal(w.ultimateDirector.active,true);}
    assert.equal(w.settings.bind('settings',oldSettings),null);
    const pos=w.player.pos.toArray(),selected=w.contract.selected;for(const k of ['KeyR','Digit1','KeyY','KeyT'])key(k);
    assert.equal(w.executeSafeTravel(w.travelStops[0].id),false);assert.deepEqual(w.player.pos.toArray(),pos);assert.equal(w.contract.selected,selected);assert.equal(w.actions.skills.casting,true);assert.equal(w.ultimateDirector.active,true);w.ultimateDirector.skip();for(let i=0;i<1200&&w.ultimateDirector.active;i++)frame();
   }else{
    const cd=w.actions.skills.cooldown('ultimate');
    if(interruption==='programmatic-switch'){w.contract.select('saber');frame();}else window.dispatchEvent(new window.PageTransitionEvent('pagehide',{persisted:false}));
    assert.equal(w.actions.skills.casting,false);assert.equal(w.ultimateDirector.active,false);assert.equal(w.ultimateStage.isActive,false);assert.equal(window.document.body.classList.contains('ultimate-showing'),false);assert.equal(w.actions.skills.energy,0);assert.ok(w.actions.skills.cooldown('ultimate')>=cd-.1);assert.equal(hits.filter(hit=>hit.source==='ultimate').length,0);
    if(interruption==='pagehide'){assert.equal(window.document.querySelector('.ultimate-overlay'),null);assert.equal(window.document.querySelector('.ultimate-settings'),null);}
   }
  });
  await h.settleAssets();assert.deepEqual(h.errors,[]);assert.deepEqual(h.warnings,[]);
 }finally{await h.close();}
});
