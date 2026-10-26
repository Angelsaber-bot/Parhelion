'use strict';
// Runs the actual app, GLB loader, Three.js scene and physics with a deterministic
// animation clock. DOM events and WebGLRenderer are test doubles, not a browser.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {dom}=require('./input_test_support.cjs');
const runtime=path.resolve(process.env.ARENA_RUNTIME||path.join(__dirname,'../runtime'));
const Three=require(path.join(runtime,'vendor/three.min.js'));
class Renderer {
  constructor(){this.shadowMap={};this.info={render:{calls:0,triangles:0}};}
  setPixelRatio(){}setClearColor(){}setSize(){}render(){}
}
async function fixture(){
  const env=dom();let nextFrame,now=0;
  const context=vm.createContext({window:env.win,document:env.doc,THREE:{...Three,WebGLRenderer:Renderer},
    MapPhysics:require(path.join(runtime,'physics.js')),ArenaInput:fs.existsSync(path.join(runtime,'input.js'))?require(path.join(runtime,'input.js')):undefined,
    performance:{now:()=>now},devicePixelRatio:1,innerWidth:1280,innerHeight:720,console,TextDecoder,DataView,Uint8Array,Uint16Array,Uint32Array,Float32Array,
    addEventListener:env.win.addEventListener.bind(env.win),requestAnimationFrame:fn=>{nextFrame=fn;},
    fetch:async url=>{const data=fs.readFileSync(path.resolve(runtime,url));return {ok:true,json:async()=>JSON.parse(data),arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};}});
  await vm.runInContext(fs.readFileSync(path.join(runtime,'app.js'),'utf8'),context);
  assert.equal(env.win.mapQA?.ready,true,'full app initialized');
  const qa=env.win.mapQA;
  function tick(count=1,step=16){for(let i=0;i<count;i++){now+=step;const fn=nextFrame;nextFrame=null;assert(fn,'animation loop remains scheduled');fn(now);}}
  function snapshot(){const {x,z,yaw,pitch}=qa.state;return {x,z,yaw,pitch};}
  env.nodes.get('west').emit('click');tick();
  return {...env,qa,tick,snapshot};
}
function stable(f){const before=f.snapshot();f.tick(20);assert.deepEqual(f.snapshot(),before,'no horizontal sliding or camera drift');}
const checks=[];
async function check(name,fn){try{const details=await fn();checks.push({name,passed:true,...(details?{details}:{})});}catch(error){checks.push({name,passed:false,error:error.message});}}
(async()=>{
  await check('rendered asset geometry still loads from the real GLB',async()=>{
    const f=await fixture();assert.equal(f.qa.geometrySource,'station_visual.glb');assert.equal(f.qa.meshes.length,73);
  });
  for(const code of ['KeyW','KeyS','KeyA','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown']){
    await check(code+' acts in the original direction and stops on keyup',async()=>{
      const f=await fixture();f.qa.state.yaw=0;const a=f.snapshot();f.key(code);f.tick(10);const b=f.snapshot();
      const [field,sign]={KeyW:['z',-1],KeyS:['z',1],KeyA:['x',-1],KeyD:['x',1],ArrowLeft:['yaw',-1],ArrowRight:['yaw',1],ArrowUp:['pitch',1],ArrowDown:['pitch',-1]}[code];
      assert((b[field]-a[field])*sign>0);f.up(code);stable(f);
    });
  }
  await check('diagonal motion is normalized to 4.2 m/s',async()=>{
    const f=await fixture(),a=f.snapshot();f.key('KeyW');f.key('KeyD');f.tick(10);const b=f.snapshot();
    assert(Math.abs(Math.hypot(b.x-a.x,b.z-a.z)-4.2*.16)<1e-8);
  });
  await check('opposite directions cancel without losing the still-held key',async()=>{
    const f=await fixture();f.key('KeyW');f.key('KeyS');stable(f);f.up('KeyS');const a=f.snapshot();f.tick(5);assert.notDeepEqual(f.snapshot(),a);f.up('KeyW');stable(f);
  });
  const transitions={
    'pointer-lock loss':f=>f.doc.exitPointerLock(),
    'pointer-lock acquire':f=>{f.doc.pointerLockElement=f.view;f.doc.emit('pointerlockchange');},
    'pointer-lock error':f=>f.doc.emit('pointerlockerror'),
    'blur then focus':f=>{f.blur();f.focus();},
    'hidden then visible':f=>{f.visibility(true);f.visibility(false);},
    'pagehide then pageshow':f=>{f.win.emit('pagehide');f.win.emit('pageshow');},
    'freeze then resume':f=>{f.doc.emit('freeze');f.doc.emit('resume');},
    'frame suspended for 1.1 seconds':f=>f.tick(1,1100),
    'overview round trip':f=>{f.qa.toggleOverview();f.qa.toggleOverview();},
    'respawn':f=>f.qa.spawn('east'),
    'keyboard respawn shortcut':f=>f.key('Digit2'),
    'Escape in keyboard fallback':f=>f.key('Escape'),
    'OS meta shortcut':f=>f.key('KeyL',{metaKey:true}),
    'window resized':f=>f.win.emit('resize'),
    'fullscreen change':f=>f.doc.emit('fullscreenchange'),
    'context menu':f=>f.doc.emit('contextmenu'),
    'pointer cancelled':f=>f.doc.emit('pointercancel'),
    'route selector focus':f=>{f.nodes.get('tourSelect').focus();f.view.focus();},
    'outside pointer':f=>f.doc.emit('pointerdown',{target:f.nodes.get('tourSelect')})
  };
  for(const [name,transition] of Object.entries(transitions))await check(name+' cancels simultaneous W/look and stale repeats',async()=>{
    const f=await fixture();f.key('KeyW');f.key('ArrowUp');f.tick(3);transition(f);
    const before=f.snapshot();f.key('KeyW',{repeat:true});f.key('ArrowUp',{repeat:true});stable(f);
    f.up('KeyW');f.up('ArrowUp');f.key('KeyW');f.key('ArrowUp');f.tick(4);
    assert.notDeepEqual(f.snapshot(),before,'a fresh release/press must still work');
  });
  await check('long uninterrupted holds do not expire',async()=>{
    const f=await fixture(),yaw=f.qa.state.yaw;f.key('ArrowRight');f.tick(400);assert(Math.abs(f.qa.state.yaw-(yaw+1.7*6.4))<1e-8);f.up('ArrowRight');stable(f);
  });
  await check('movement pressed in overview is not replayed on return',async()=>{
    const f=await fixture();f.qa.toggleOverview();f.key('KeyW');f.key('ArrowUp');f.qa.toggleOverview();stable(f);
  });
  await check('route selector native arrows and shortcuts never move/teleport the player',async()=>{
    const f=await fixture();f.nodes.get('tourSelect').focus();for(const c of ['KeyW','ArrowUp','Digit2'])assert.equal(f.key(c).defaultPrevented,undefined);stable(f);
  });
  await check('spawn buttons return keyboard focus to the view',async()=>{
    const f=await fixture();f.nodes.get('east').focus();f.nodes.get('east').emit('click');assert.equal(f.doc.activeElement,f.view);const a=f.snapshot();f.key('KeyW');f.tick(4);assert.notDeepEqual(f.snapshot(),a);
  });
  await check('mouse lock remains optional and locked mouse look still works',async()=>{
    const f=await fixture();assert.equal(f.doc.pointerLockElement,null);f.key('KeyW');f.tick(3);f.up('KeyW');f.view.emit('click');assert.equal(f.doc.pointerLockElement,f.view);
    const a=f.snapshot();f.doc.emit('mousemove',{movementX:40,movementY:20});assert(f.qa.state.yaw>a.yaw);assert(f.qa.state.pitch<a.pitch);stable(f);
  });
  for(const kind of ['missing','throws','rejects'])await check('pointer lock '+kind+' clears input but preserves fresh-key fallback',async()=>{
    const f=await fixture();f.view.requestPointerLock=kind==='missing'?undefined:kind==='throws'?()=>{throw Error('test denial');}:()=>Promise.reject(Error('test denial'));
    f.key('KeyW');f.key('ArrowUp');f.view.emit('click');await Promise.resolve();stable(f);
    f.up('KeyW');f.up('ArrowUp');f.key('KeyW');const a=f.snapshot();f.tick(4);assert.notDeepEqual(f.snapshot(),a);assert.match(f.nodes.get('notice').textContent,/方向键/);
  });
  await check('clicking an already-locked scene does not interrupt a legitimate held key',async()=>{
    const f=await fixture();f.view.emit('click');f.key('KeyW');const a=f.snapshot();f.view.emit('click');f.tick(4);assert.notDeepEqual(f.snapshot(),a);
  });
  await check('automatic route still advances and WASD can take over',async()=>{
    const f=await fixture();f.nodes.get('tour').emit('click');const a=f.snapshot();f.tick(10);assert.notDeepEqual(f.snapshot(),a);f.key('KeyW');f.tick();f.up('KeyW');stable(f);assert.match(f.nodes.get('tourResult').textContent,/手动接管/);
  });
  for(const [name,transition] of [['blur',f=>{f.blur();f.focus();}],['overview',f=>{f.qa.toggleOverview();f.qa.toggleOverview();}],['pointer-lock loss',f=>f.doc.exitPointerLock()],['missed focus event',f=>{f.doc.focused=false;f.tick();f.focus();}],['missed visibility event',f=>{f.doc.hidden=true;f.tick();f.visibility(false);}]]){
    await check('automatic route pauses on '+name+' rather than looking like stuck input',async()=>{
      const f=await fixture();f.nodes.get('tour').emit('click');f.tick(5);transition(f);stable(f);assert.match(f.nodes.get('tourResult').textContent,/暂停/);
    });
  }
  const report={runtime:path.basename(path.dirname(runtime))+'/'+path.basename(runtime),execution:'Node VM; real app.js, physics.js, Three.js and GLB; mocked DOM events, WebGL renderer and animation clock; not real-browser validation',passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length,checks};
  if(process.env.INPUT_REPORT)fs.writeFileSync(process.env.INPUT_REPORT,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));if(report.failed)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
