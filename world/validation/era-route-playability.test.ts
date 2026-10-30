import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Player } from '../src/player.ts';
import { FORT_CANNON, FortCannon } from '../src/fortCannon.ts';
import { ERA_IDS, ERA_BOSS_REQUIREMENTS, getEraPieceRequirements, applyEraMarkerRequirements } from '../src/eraStories.ts';
import { createEraStoryScene } from '../src/eraStoryScenes.ts';
import { createTraversalRepairs } from '../src/traversalRepairs.ts';
import { createValleyStoryScene } from '../src/valleyStoryScene.ts';
import { FLEET, LIGHTHOUSE } from '../tools/gen/blacksail/layout.ts';
/** Match the runtime collider stack, including all five living-hub additions. */
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { regionLoader, bakeQuantized } from '../src/glb.ts';
import { REGIONS, mergeLayouts, boundaryWalls, GRID } from '../src/regions.ts';
import { makeCombatTerrain } from '../src/combatTerrain.ts';
import { WorldGrid } from '../src/grid.ts';
import { mergeParts } from '../src/settlements/merge.ts';
import { installSettlements } from '../src/settlements/core.ts';
import { buildAlphaSettlement } from '../src/settlements/alpha.ts';
import { buildBritainSettlement } from '../src/settlements/britain.ts';
import { buildBlackSailSettlement } from '../src/settlements/blacksail.ts';
import { buildWinterSettlement } from '../src/settlements/winter.ts';
import { buildKyotoSettlement } from '../src/settlements/kyoto.ts';
import type { Collider } from '../src/player.ts';
import type { Layout } from '../src/types.ts';

const geos: THREE.BufferGeometry[] = [boundaryWalls()];
const props: THREE.BufferGeometry[] = [];
const colliders: Collider[] = [];
const terrains: THREE.Mesh[] = [];
const dynamicMeta = new Map<string, Record<string, any>>();
const targetArt = new Map<string, THREE.Mesh>();
const parts = await Promise.all(REGIONS.map(async def => {
  const bytes = readFileSync(new URL(`../public/assets/${def.file}.glb`, import.meta.url));
  const gltf = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  bakeQuantized(gltf.scene);
  gltf.scene.position.set(def.offset[0], 0, def.offset[1]);
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.getObjectByName('ART')!.traverse(object => {
    if (object instanceof THREE.Mesh && object.name === 'Terrain') terrains.push(object);
    if (object instanceof THREE.Mesh && object.name.startsWith('TGT_')) targetArt.set(object.userData.target, object);
  });
  gltf.scene.getObjectByName('COLLISION')!.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    let geometry = new THREE.BufferGeometry().setAttribute('position', object.geometry.attributes.position.clone());
    if (object.geometry.index) geometry.setIndex(object.geometry.index.clone());
    geometry.applyMatrix4(object.matrixWorld);
    if (geometry.index) geometry = geometry.toNonIndexed();
    if (object.name !== 'COL_Terrain') props.push(geometry);
    if (object.userData.dynamic) { dynamicMeta.set(object.name, object.userData); colliders.push({ name: object.name, enabled: true, bvh: new MeshBVH(geometry) }); }
    else geos.push(geometry);
  });
  const layout = JSON.parse(readFileSync(new URL(`../public/assets/${def.file}.layout.json`, import.meta.url), 'utf8')) as Layout;
  return { def, layout };
}));
const layout = mergeLayouts(parts);
const grid = new WorldGrid(terrains, GRID.x0, GRID.z0, GRID.span, GRID.cell, '#4f8fa8', GRID.spanZ);
const settlements = installSettlements([
  buildAlphaSettlement(), buildBritainSettlement(), buildBlackSailSettlement(), buildWinterSettlement(), buildKyotoSettlement(),
], { grid, blockers: new MeshBVH(mergeParts(props)), layout });
geos.push(...settlements.collisionGeometries);
const traversalRepairs = createTraversalRepairs();geos.push(...traversalRepairs.collisionGeometries);
for (const placement of settlements.placements) layout.areas.push({
  id: `${placement.id}_living_hub`, name: placement.name[0], nameEn: placement.name[1],
  c: [placement.position[0], placement.position[2]], r: Math.hypot(...placement.footprint) / 2,
  tp: [placement.entry[0], placement.entry[2] + 8], region: placement.id, color: '#c4ced6',
});
colliders.unshift({ name: 'static', enabled: true, bvh: new MeshBVH(mergeParts(geos)) });
const q = makeCombatTerrain(colliders, layout, (x, z) => grid.sampleHeight(x, z));
// Independent Node collision tests, not browser/GPU acceptance. Real five-region
// meshes, installed settlements and additive story props share Player collision.
const storyScenes = settlements.placements.map(p => p.id === 'alpha' ? createValleyStoryScene(p) : createEraStoryScene(p));
for (const story of storyScenes) { colliders.push(...story.colliders); layout.markers.push(...story.markers); }
const done = new Set<string>();
function progress(flags: readonly string[]) {
  done.clear(); for (const flag of flags) done.add(flag);
  for (const c of colliders) {
    const meta = dynamicMeta.get(c.name); if (!meta) continue;
    c.enabled = true;
    if (c.name.startsWith('COL_TGT_')) c.enabled = !done.has(c.name.slice('COL_TGT_'.length));
    if (Array.isArray(meta.opensWhen)) c.enabled = !meta.opensWhen.every((f: string) => done.has(f));
    if (Array.isArray(meta.solidWhen)) c.enabled = (getEraPieceRequirements(c.name, done) ?? meta.solidWhen).every((f: string) => done.has(f));
  }
  applyEraMarkerRequirements(layout.markers, done);
}
const idle = { x: 0, z: 0, jump: false, sprint: false };
const marker = (id: string) => { const m = layout.markers.find(m => m.id === id); assert.ok(m, `missing marker ${id}`); return m; };
const at = (id: string): [number,number] => [marker(id).p[0],marker(id).p[2]];
const world = (region: string,x: number,z: number): [number,number] => {const r=REGIONS.find(r=>r.id===region)!;return[x+r.offset[0],z+r.offset[1]];};
const path = (region:string,index:number):[number,number][] => parts.find(p=>p.def.id===region)!.layout.paths[index].map(([x,z])=>world(region,x,z));
function make(from:[number,number], y?:number) {
  const p = new Player(colliders,layout.world.waterLevel);
  const g=q.ground(...from); assert.ok(g,`ground missing ${from}`);
  p.teleport(from[0],(y??g.point.y)+.2,from[1]);
  for(let i=0;i<120;i++)p.step(1/120,idle);
  return p;
}
function follow(p:Player,route:[number,number][],opts:{jump?:boolean;sprint?:boolean;tol?:number}={}) {
  let k=0, stuck=0, last=p.pos.clone();
  for(let i=0;i<120*180&&k<route.length;i++) {
    const [x,z]=route[k];
    if(Math.hypot(p.pos.x-x,p.pos.z-z)<(opts.tol??1.0)){k++;continue;}
    p.yaw=Math.atan2(-(x-p.pos.x),-(z-p.pos.z));
    if(i%120===0){stuck=p.pos.distanceTo(last)<1?stuck+1:0;last.copy(p.pos);if(stuck>8)break;}
    p.step(1/120,{x:0,z:1,jump:(opts.jump??true)&&stuck>0&&i%60<5,sprint:opts.sprint??true});
  }
  assert.equal(k,route.length,`stuck at ${p.pos.toArray().map(n=>n.toFixed(2))}, next ${route[k]}, grounded=${p.onGround}, swimming=${p.swimming}, stuck=${stuck}`);
  return p;
}
function reachable(p:Player,id:string) {
  const m=marker(id);assert.ok(p.pos.distanceTo(new THREE.Vector3(...m.p))<(m.radius??3),`${id} interaction out of reach: ${p.pos.toArray()} vs ${m.p}`);
}
function targetVisible(from:THREE.Vector3,id:string) {
  const art=targetArt.get(id);assert.ok(art,`actual target art ${id}`);
  const center=new THREE.Box3().setFromObject(art).getCenter(new THREE.Vector3());
  const d=center.clone().sub(from),distance=d.length();
  const ray=new THREE.Raycaster(from,d.clone().normalize(),0,180);
  const hit=ray.intersectObject(art,false)[0];assert.ok(hit,`ray hits actual ${id} mesh, not merely its bounding box`);
  const wall=q.cast(from,d,hit.distance-.06,c=>c.name.startsWith('COL_TGT_'));
  assert.equal(wall,null,`${id} wall at ${wall?.distance}, target at ${hit.distance}`);
  return {center,point:hit.point,distance};
}

test('era routes: every shard-free mainline requirement exists in the correct merged era',()=>{
  for(const region of ERA_IDS){
    const core={britain:'sun_core',blacksail:'sea_core',winter:'winter_core',kyoto:'fire_core'}[region];
    for(const id of [...ERA_BOSS_REQUIREMENTS[core],core]) {
      const m=marker(id);const source=parts.find(p=>p.def.id===region)!;const local=source.layout.markers.find(m=>m.id===id)!;assert.ok(local);assert.deepEqual(m.p,[local.p[0]+source.def.offset[0],local.p[1],local.p[2]+source.def.offset[1]],`${id} has correct cross-layer offset`);
      assert.ok(m.p.every(Number.isFinite));assert.ok(!id.startsWith('shard_'));
    }
  }
});

test('era routes: actual Player walks Kyoto inn south entrance to grounded quiet firing slope',()=>{
  progress(['summon_circle']);
  const hub=settlements.placements.find(p=>p.id==='kyoto')!;
  const p=make([hub.entry[0],hub.entry[2]+8],hub.position[1]);
  follow(p,[[-172,835.5],[-190,835.5],[-205,838],[-224,840]],{jump:false,sprint:false,tol:.55});
  assert.ok(p.onGround&&!p.swimming&&!p.flying);
  assert.ok(Math.abs(p.pos.y-grid.sampleHeight(p.pos.x,p.pos.z)!)<.25,'on true terrain, not a prop roof');
  for(const id of ['kikyo_banner_1','kikyo_banner_2','kikyo_banner_3']) {
    for(const h of [1.3,1.62]){const hit=targetVisible(p.pos.clone().add(new THREE.Vector3(0,h,0)),id);assert.ok(hit.distance<150,`${id} rifle range`);}
  }
});

test('era routes: actual Player reaches battery from road and cannon muzzle hits all three actual boats',()=>{
  progress(['summon_circle','blackbeard_meet','fort_cannon']);
  const W=(x:number,z:number)=>world('blacksail',x,z);
  const p=make(W(-40,0));
  follow(p,[...path('blacksail',2),W(150,-176),W(176,-180),W(186,-182),W(199,-182),at('fort_cannon')]);
  reachable(p,'fort_cannon');
  const cannon=new FortCannon();assert.ok(cannon.toggle(p.pos,true),'normal player position can mount');
  assert.equal(cannon.near({x:p.pos.x,y:29,z:p.pos.z}),false,'well below the deck cannot mount');
  for(const id of ['ghost_boat_1','ghost_boat_2','ghost_boat_3']) {
    const hit=targetVisible(new THREE.Vector3(FORT_CANNON.muzzle.x,FORT_CANNON.muzzle.y,FORT_CANNON.muzzle.z),id);
    assert.ok(cannon.canAim(hit.point),`${id} actual surface in artillery arc and range`);
    targetVisible(p.pos.clone().add(new THREE.Vector3(0,1.62,0)),id);
  }
});

test('era routes: shard-free cannon progress enables the real bridge and carries Player to flagship',()=>{
  progress(['summon_circle','blackbeard_meet','fort_cannon']);
  const bridge=colliders.find(c=>c.name==='COL_Ghost_Bridge');assert.ok(bridge);assert.equal(bridge.enabled,false);
  progress(['summon_circle',...ERA_BOSS_REQUIREMENTS.sea_core]);assert.equal(bridge.enabled,true);
  assert.ok(![...done].some(f=>f.startsWith('shard_')));
  const W=(x:number,z:number)=>world('blacksail',x,z);
  const shipAt=(g:typeof FLEET[number],u:number,v=0):[number,number]=>W(g.c[0]+Math.sin(g.ry)*u+Math.cos(g.ry)*v,g.c[1]+Math.cos(g.ry)*u-Math.sin(g.ry)*v);
  const bow=(g:typeof FLEET[number])=>shipAt(g,-g.len*.33-Math.max(6,g.len*.27)*.5+1.2);
  const stern=(g:typeof FLEET[number])=>shipAt(g,g.len*.45-1);
  const [a,b,f]=FLEET;
  const p=make(W(214,-14));
  follow(p,[W(240,-4),W(272,-4),W(LIGHTHOUSE.c[0]+24,LIGHTHOUSE.c[1]+10),bow(a),shipAt(a,-a.len*.2,1.6),shipAt(a,a.len*.3,1.6),stern(a),bow(b),shipAt(b,-b.len*.2,1.6),shipAt(b,b.len*.3,1.6),stern(b),bow(f),shipAt(f,-f.len*.25,1.6),shipAt(f,-10,1.6)],{jump:false});
  for(let i=0;i<240&&p.pos.distanceTo(new THREE.Vector3(...marker('sea_core').p))>=marker('sea_core').radius!;i++){const [x,z]=at('sea_core');p.yaw=Math.atan2(-(x-p.pos.x),-(z-p.pos.z));p.step(1/120,{...idle,z:1});}
  reachable(p,'sea_core');assert.equal(p.swimming,false);assert.ok(Math.abs(p.pos.y-marker('sea_core').p[1])<.3);
});

test('era routes: Britain lake oath and first hearth are physically reachable with full settlements',()=>{
  progress(['summon_circle']);const W=(x:number,z:number)=>world('britain',x,z);
  const sword=marker('saber_contract');let p=make([sword.p[0],sword.p[2]-60]);
  follow(p,[[sword.p[0],sword.p[2]-40],[sword.p[0],sword.p[2]-20],at('saber_contract')]);reachable(p,'saber_contract');
  p=make(W(2,58));follow(p,[...path('britain',2),W(-166,-166),W(-180,-182),W(-203,-177),W(-208,-172),W(-204,-166),at('hall_brazier_1')]);reachable(p,'hall_brazier_1');
});

test('era routes: Winter commander, three heat beacons and red-square core use normal Player traversal',()=>{
  progress(['summon_circle']);const W=(x:number,z:number)=>world('winter',x,z);
  let p=make(W(-140,186));follow(p,[W(-160,150),W(-176,142),at('napoleon_meet')]);reachable(p,'napoleon_meet');
  for(const id of ['beacon_1','beacon_2','beacon_3']){p=make(W(-160,74));follow(p,[...path('winter',1),at(id)]);reachable(p,id);}
  p=make(W(40,-100));follow(p,[...path('winter',4),at('winter_core')]);reachable(p,'winter_core');
});

test('era routes: Britain mainline reaches Camlann core without optional shards',()=>{
  progress(['summon_circle',...ERA_BOSS_REQUIREMENTS.sun_core]);
  const W=(x:number,z:number)=>world('britain',x,z),p=make(W(-4,128));
  follow(p,[...path('britain',3),W(-170,200),at('sun_core')]);reachable(p,'sun_core');
  assert.ok(![...done].some(f=>f.startsWith('shard_')));
});

test('era routes: Blackbeard meet and return contract remain reachable in Nassau',()=>{
  progress(['summon_circle']);const W=(x:number,z:number)=>world('blacksail',x,z);
  const p=make(W(-110,138));
  follow(p,[W(-128,138),W(-128,131),at('blackbeard_meet')]);reachable(p,'blackbeard_meet');
  follow(p,[at('blackbeard_contract')]);reachable(p,'blackbeard_contract');
});

test('era routes: Kyoto bridge ally and Honnoji core stay reachable with full scene additions',()=>{
  progress(['summon_circle']);const W=(x:number,z:number)=>world('kyoto',x,z);
  let p=make(W(110,-75));follow(p,[W(130,-75),at('musashi_meet')],{jump:false});reachable(p,'musashi_meet');
  p=make(W(45,-75));follow(p,[...path('kyoto',1).slice(0,-1),W(-44,45)]);
  follow(p,[W(-50,45),W(-60,45),W(-71,45)],{jump:false,tol:.4});reachable(p,'fire_core');
  assert.equal(p.swimming,false);
});

test('era routes: all four seam colliders block before and permit walking after summon stability',()=>{
  const routes:[string,[number,number],[number,number]][]=[
    ['west',[-280,-30],[-390,-30]],['east',[280,30],[390,30]],
    ['north',[0,-280],[0,-390]],['south',[40,280],[40,390]],
  ];
  for(const [name,from,to] of routes) {
    const gate=colliders.find(c=>c.name===`COL_Seam_${name}_Gate`);assert.ok(gate);
    progress([]);assert.equal(gate.enabled,true);
    let p=make(from);const direction=new THREE.Vector3(to[0]-from[0],0,to[1]-from[1]).normalize();
    p.yaw=Math.atan2(-direction.x,-direction.z);
    for(let i=0;i<120*15;i++)p.step(1/120,{...idle,z:1,sprint:true});
    assert.ok(Math.hypot(p.pos.x-to[0],p.pos.z-to[1])>20,`${name} physically blocks closed state`);
    assert.ok((p.pos.x-from[0])*direction.x+(p.pos.z-from[1])*direction.z<70,`${name} cannot overshoot the far endpoint and masquerade as blocked`);
    progress(['summon_circle']);assert.equal(gate.enabled,false);
    p=make(from);follow(p,[to],{jump:false});assert.equal(p.swimming,false,`${name} continuous terrain/ice/bridge`);
  }
});

test('era routes: unearned ghost bridge cannot carry Player to first ship',()=>{
  progress(['summon_circle','blackbeard_meet','fort_cannon']);
  const W=(x:number,z:number)=>world('blacksail',x,z),g=FLEET[0];
  const u=-g.len*.33-Math.max(6,g.len*.27)*.5+1.2;
  const bow=W(g.c[0]+Math.sin(g.ry)*u,g.c[1]+Math.cos(g.ry)*u);
  const p=make(W(LIGHTHOUSE.c[0]+24,LIGHTHOUSE.c[1]+10));
  const start=p.pos.clone();p.yaw=Math.atan2(-(bow[0]-p.pos.x),-(bow[1]-p.pos.z));
  for(let i=0;i<120*8;i++)p.step(1/120,{...idle,z:1});
  assert.ok(p.pos.y<start.y-1||p.swimming,'player falls below walkway without its collider');
});


test('era routes: Honnoji repaired apron crosses east-west and west-east without jump and retains rails',()=>{
  progress(['summon_circle']);
  for(const sprint of [false,true])for(const z of [764,765,766]) {
    const p=make([-44,z]);follow(p,[[-49,z],[-54,z],[-60,z]],{jump:false,sprint,tol:.5});
    follow(p,[[-54,z],[-49,z],[-44,z]],{jump:false,sprint,tol:.5});
    // Downhill sprint may leave the slope for a fraction of a frame; allow a
    // quarter second to settle, without any movement/jump input or correction.
    for(let i=0;i<30;i++)p.step(1/120,idle);
    assert.ok(p.onGround&&!p.swimming,`stable after bidirectional ${sprint?'sprint':'walk'} at z=${z}: ${p.pos.toArray()}`);
  }
  for(const sign of [-1,1]){
    const r=make([-52,765]);r.yaw=sign>0?Math.PI:0;
    for(let i=0;i<120*3;i++)r.step(1/120,{...idle,z:1,sprint:true});
    assert.ok(r.pos.z>762.7&&r.pos.z<767.3,`original side rail blocks direction ${sign}: ${r.pos.toArray()}`);
  }
  const wall=make([-62,755]);wall.yaw=-Math.PI/2;
  for(let i=0;i<120*3;i++)wall.step(1/120,{...idle,z:1,sprint:true});
  assert.ok(wall.pos.x<-55,`closed temple wall remains solid away from gate: ${wall.pos.toArray()}`);
});
