import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {regionLoader,bakeQuantized} from '../src/rendering/glb';
import {Player} from '../src/player/player';
import {HOME_BUILDINGS,HOME_ACTIONS,SABER_HOME_WALK} from '../src/map/homePlan';
import {inviteSaberHome,homeSaberReady,HOME_FLAGS,homeChapterMemories,homeResidentSockets} from '../src/story/homeTown';
import {createHomeResidentLife,HOME_RESIDENT_ROUTES} from '../src/map/homeResidents';
import {createSettlementNpcs} from '../src/settlements/npcs';
import {HOME_CIVIC_ACTIONS} from '../src/map/homeActivities';

const bytes=readFileSync(new URL('../public/assets/world_home.core.glb',import.meta.url));
const {scene}=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');bakeQuantized(scene);scene.updateMatrixWorld(true);
const geos:THREE.BufferGeometry[]=[];scene.getObjectByName('COLLISION')!.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;let g=new THREE.BufferGeometry().setAttribute('position',m.geometry.attributes.position.clone());if(m.geometry.index)g.setIndex(m.geometry.index.clone());g.applyMatrix4(m.matrixWorld);if(g.index)g=g.toNonIndexed();geos.push(g);});
const solid=mergeGeometries(geos),bvh=new MeshBVH(solid),colliders=[{name:'home',bvh,enabled:true}];
function walk(points:readonly (readonly number[])[]){
 const p=new Player(colliders,0),a=points[0];p.teleport(a[0],a[1]+.65,a[2]);for(let i=0;i<120;i++)p.step(1/120,{x:0,z:0,jump:false,sprint:false});
 for(const goal of points.slice(1)){
  const budget=120*(Math.hypot(p.pos.x-goal[0],p.pos.z-goal[2])/5+15);let frames=0;
  while(Math.hypot(p.pos.x-goal[0],p.pos.z-goal[2])>.35&&frames++<budget){p.yaw=Math.atan2(-(goal[0]-p.pos.x),-(goal[2]-p.pos.z));p.step(1/120,{x:0,z:1,jump:false,sprint:true});}
  assert.ok(Math.hypot(p.pos.x-goal[0],p.pos.z-goal[2])<=.35,`blocked at ${p.pos.toArray()}, goal ${goal}`);
  assert.ok(Math.abs(p.pos.y-goal[1])<.6,`floor ${p.pos.y} vs ${goal}`);assert.equal(p.swimming,false);
 }return p;
}
test('twenty buildings have real doors, floors, roof cover and street-to-interior return paths',()=>{
 assert.equal(HOME_BUILDINGS.length,20);
 for(const h of HOME_BUILDINGS){
  const p=(x:number,z:number):[number,number,number]=>[h.p[0]+Math.cos(h.yaw)*x+Math.sin(h.yaw)*z,h.p[1]+.12,h.p[2]-Math.sin(h.yaw)*x+Math.cos(h.yaw)*z];
  const route=[h.approach,p(0,h.d/2-1),p(0,0),p(0,-h.d/2+2),p(0,0),p(0,h.d/2-1),h.approach];
  // The home has a kitchen table at the back; its stair/bedroom route is checked separately.
  if(h.kind==='home')route.splice(3,1);
  try{walk(route);}catch(e){throw new Error(`${h.id}: ${String(e)}`);}
  const roof=bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(h.p[0],h.p[1]+2,h.p[2]),new THREE.Vector3(0,1,0)),THREE.DoubleSide);
  assert.ok(roof&&roof.point.y>h.p[1]+3.5,`${h.id} has actual overhead cover`);
 }
});
test('home interior stair reaches the upper writing corner and returns without jumping',()=>{
 walk([[-175,16,110],[-175,16.12,126],[-175,16.12,131],[-184,16.12,127],[-184,20.34,143],[-184,20.34,145],[-175,20.34,145],[-175,20.34,128],[-177,20.34,128],[-175,20.34,128],[-175,20.34,145],[-184,20.34,145],[-184,20.34,143],[-184,16.12,127],[-175,16.12,127],[-175,16,110]]);
});
test('all eight guest rooms open onto the corridor and the Saber daily route is walkable in both directions',()=>{
 for(const side of[-1,1])for(let i=0;i<4;i++){const z=-60+i*8;walk([[-35,16.12,-18],[-35,16.12,z],[-35+side*12,16.12,z],[-35,16.12,z],[-35,16.12,-18]]);}
 walk(SABER_HOME_WALK);walk([...SABER_HOME_WALK].reverse());
});
test('home interactions and residents are grounded, clear of furniture and remain independent of chapter completion',()=>{
 for(const {id,p}of HOME_ACTIONS.filter(a=>a.id!=='home_saber_talk')){
  const v=new Player(colliders,0);v.teleport(p[0],p[1]-.6,p[2]);for(let i=0;i<150;i++)v.step(1/120,{x:0,z:0,jump:false,sprint:false});
  assert.ok(Math.hypot(v.pos.x-p[0],v.pos.z-p[2])<.3,`${id}: clear body ${v.pos.toArray()}`);assert.ok(Math.abs(v.pos.y-(p[1]-.9))<.4,`${id}: floor ${v.pos.y}`);
 }
 for(const socket of homeResidentSockets()){const p=socket.position;assert.equal(socket.worldRegion,'home');const v=new Player(colliders,0);v.teleport(p[0]-720,p[1]+.6,p[2]);for(let i=0;i<120;i++)v.step(1/120,{x:0,z:0,jump:false,sprint:false});assert.ok(Math.hypot(v.pos.x-p[0]+720,v.pos.z-p[2])<.3&&Math.abs(v.pos.y-p[1])<.3,`${socket.id}: grounded with body clearance ${v.pos.toArray()}`);}
 const done=new Set<string>();assert.equal(inviteSaberHome(done),false);done.add('saber_contract');done.add('sun_core');const before=[...done];assert.equal(inviteSaberHome(done),true);assert.equal(inviteSaberHome(done),false);assert.equal(homeSaberReady(done),true);assert.deepEqual([...done],[...before,HOME_FLAGS.invited]);assert.match(homeChapterMemories(done)[0],/落日王国/);assert.doesNotMatch(homeChapterMemories(done)[0],/京都/);
 const restored=new Set(JSON.parse(JSON.stringify([...done])));assert.equal(homeSaberReady(restored),true);restored.delete('saber_contract');assert.equal(homeSaberReady(restored),false,'a stale home fact never creates a contract');
});
test('all civic counters and controls have standing clearance and unique interaction identifiers',()=>{
 const layout=JSON.parse(readFileSync(new URL('../public/assets/world_home.layout.json',import.meta.url),'utf8'));
 const ids=[...layout.markers.map((m:{id:string})=>m.id),...HOME_ACTIONS.map(a=>a.id),...HOME_CIVIC_ACTIONS.map(a=>a.id)];assert.equal(new Set(ids).size,ids.length,'discovery and activity markers cannot shadow each other');
 for(const a of HOME_CIVIC_ACTIONS){const p=new Player(colliders,0);p.teleport(a.p[0],a.p[1]-.6,a.p[2]);for(let i=0;i<120;i++)p.step(1/120,{x:0,z:0,jump:false,sprint:false});assert.ok(Math.hypot(p.pos.x-a.p[0],p.pos.z-a.p[2])<.3&&Math.abs(p.pos.y-a.p[1]+.9)<.4,`${a.id}: body/ground ${p.pos.toArray()}`);}
});
test('garden and harbour residents walk real terrain and stop to talk',()=>{
 const geo=solid.clone().translate(720,0,0),bvh=new MeshBVH(geo),host=createSettlementNpcs(homeResidentSockets()),life=createHomeResidentLife(host,[{name:'home',bvh,enabled:true}]);
 try{for(const r of HOME_RESIDENT_ROUTES){const start=host.getPosition(r.id)!,viewer=new THREE.Vector3(start[0]+15,start[1],start[2]+5);for(let i=0;i<400;i++)life.update(.05,viewer,null,true,true);const moved=host.getPosition(r.id)!;assert.ok(Math.hypot(moved[0]-start[0],moved[2]-start[2])>4,r.id+' walks');for(let i=0;i<30;i++)life.update(.05,viewer,r.id,true,true);const stopped=host.getPosition(r.id)!;assert.ok(Math.hypot(stopped[0]-moved[0],stopped[2]-moved[2])<.001,r.id+' stops during conversation');}}finally{life.dispose();host.dispose();geo.dispose();}
});
