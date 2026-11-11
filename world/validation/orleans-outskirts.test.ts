import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {regionLoader,bakeQuantized} from '../src/rendering/glb';
import {Player} from '../src/player/player';
import {WorldGrid} from '../src/map/grid';
import {EXPANSION_PLANS} from '../src/map/worldPlan';
import {ORLEANS_BASTILLE as BA,ORLEANS_BRIDGE_MILL as BM,ORLEANS_COUNTRY_LANES,ORLEANS_FIELDS,ORLEANS_GRANGE as GR,ORLEANS_SANDBARS,ORLEANS_TOURELLES as TR,ORLEANS_VINEYARD as VY,ORLEANS_WINDMILL as WM,fieldAt,paintedGround} from '../src/map/orleansOutskirts';
import {ORLEANS_EMITTERS} from '../src/environment/orleansAtmosphere';
import {createOrleansOutskirtsScene} from '../src/environment/orleansOutskirtsScene';

const bytes=readFileSync(new URL('../public/assets/world_orleans.core.glb',import.meta.url));
const {scene}=await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');bakeQuantized(scene);scene.updateMatrixWorld(true);
const geos:THREE.BufferGeometry[]=[];
scene.getObjectByName('COLLISION')!.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;let g=new THREE.BufferGeometry().setAttribute('position',m.geometry.attributes.position.clone());if(m.geometry.index)g.setIndex(m.geometry.index.clone());if(g.index)g=g.toNonIndexed();geos.push(g);});
const bvh=new MeshBVH(mergeGeometries(geos)),colliders=[{name:'Orleans',bvh,enabled:true}];
const terrain=scene.getObjectByName('Terrain') as THREE.Mesh,grid=new WorldGrid([terrain],-360,-360,720,2);
const layout=JSON.parse(readFileSync(new URL('../public/assets/world_orleans.layout.json',import.meta.url),'utf8'));
const plan=EXPANSION_PLANS.find(p=>p.id==='orleans')!,out=layout.development.outskirts;
const down=(x:number,y:number,z:number)=>bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(x,y,z),new THREE.Vector3(0,-1,0)),THREE.DoubleSide);
const up=(x:number,y:number,z:number)=>bvh.raycastFirst(new THREE.Ray(new THREE.Vector3(x,y,z),new THREE.Vector3(0,1,0)),THREE.DoubleSide);
function stand(x:number,y:number,z:number){const p=new Player(colliders,0);p.teleport(x,y+.6,z);for(let i=0;i<90;i++)p.step(1/120,{x:0,z:0,jump:false,sprint:false});return p;}
function stepTo(p:Player,x:number,z:number){
  const budget=120*(Math.hypot(p.pos.x-x,p.pos.z-z)/2.5+12);
  for(let i=0;i<budget&&Math.hypot(p.pos.x-x,p.pos.z-z)>.4;i++){p.yaw=Math.atan2(-(x-p.pos.x),-(z-p.pos.z));p.step(1/120,{x:0,z:1,jump:false,sprint:false});}
  assert.ok(Math.hypot(p.pos.x-x,p.pos.z-z)<=.4,`blocked at ${p.pos.toArray().map(n=>n.toFixed(1))}, target ${x.toFixed(1)},${z.toFixed(1)}`);assert.equal(p.swimming,false);
}

test('both river crossings outside the town stand on built structure, not on an unsupported deck',()=>{
  // Long bridge: stone under the roadway at every pier, open water under every arch crown.
  const lb=out.longBridge as {from:[number,number,number];to:[number,number,number];spans:number;length:number};
  assert.ok(lb.spans>=9&&lb.length>120);
  for(let i=1;i<lb.spans;i++){
    const t=i/lb.spans,x=lb.from[0]+(lb.to[0]-lb.from[0])*t,z=lb.from[2]+(lb.to[2]-lb.from[2])*t;
    if(grid.sampleHeight(x,z)!<0){const pier=up(x,-8,z);assert.ok(pier&&pier.point.y<1,`pier ${i} stands in the river bed: ${pier?.point.y}`);}
    const s=(i-.5)/lb.spans,ax=lb.from[0]+(lb.to[0]-lb.from[0])*s,az=lb.from[2]+(lb.to[2]-lb.from[2])*s;
    if(grid.sampleHeight(ax,az)!<0){const soffit=up(ax,1,az);assert.ok(soffit&&soffit.point.y>10&&soffit.point.y<lb.from[1]-1,`arch ${i} is open over the water: ${soffit?.point.y}`);}
  }
  const walker=stand(lb.from[0],lb.from[1],lb.from[2]);stepTo(walker,lb.to[0],lb.to[2]);stepTo(walker,lb.from[0],lb.from[2]);
  // Riverfront loop: wherever its deck stands clear of the ground, there is a levee or a trestle under it.
  const loop=plan.routes.find(r=>r.id==='riverfront')!.points.slice(4);let supported=0;
  for(let i=1;i<loop.length;i++){
    const a=loop[i-1],b=loop[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/3);
    for(let j=0;j<=n;j++){
      const t=j/n,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,z=a[2]+(b[2]-a[2])*t;
      if(y-grid.sampleHeight(x,z)!<.6)continue;
      // just outside the road ribbon, the bank or the plank deck is still there
      const dx=(b[0]-a[0]),dz=(b[2]-a[2]),len=Math.hypot(dx,dz),hit=[-1,1].map(s=>down(x-dz/len*s*2.9,y+1,z+dx/len*s*2.9));
      assert.ok(hit.some(h=>h&&h.point.y>y-1.6),`loop deck is carried at ${x.toFixed(0)},${z.toFixed(0)}`);supported++;
    }
  }
  assert.ok(supported>60,'the raised loop is long enough to need the check');
});

test('bridge mill pier offers a clear yard, an enterable mill and a wheel that reaches the water',()=>{
  const s=Math.sin(BM.yaw),c=Math.cos(BM.yaw),at=(lx:number,lz:number)=>[BM.x+c*lx+s*lz,BM.z-s*lx+c*lz] as const;
  for(const [lx,lz] of [[3,-3.4],[2,3],[-3,2]]){const [x,z]=at(lx,lz),floor=down(x,BM.deck+1.5,z);assert.ok(floor&&Math.abs(floor.point.y-(BM.deck-.1))<.25,`pier top at ${lx},${lz}`);}
  const [dx,dz]=at(-1,3.5),[ix,iz]=at(-1,8),[sx,sz]=at(1,1.5),p=stand(sx,BM.deck,sz);
  stepTo(p,dx,dz);stepTo(p,ix,iz);assert.ok(up(ix,BM.deck+1.2,iz),'mill interior is roofed');stepTo(p,dx,dz);
  const W=BM.wheel;assert.ok(W.y-W.radius<0&&W.y-W.radius>-1.5,'lowest paddles dip into the river');assert.ok(W.y+W.radius<9.4,'wheel clears the gear loft above it');
  const [wx,wz]=at(W.x,W.z);assert.ok(grid.sampleHeight(wx,wz)!<-1,'the wheel hangs over open channel');
});

test('country lanes are walkable both ways and reach every second-ring landmark',()=>{
  const lanes=out.lanes as {id:string;points:[number,number,number][]}[];
  assert.deepEqual(lanes.map(l=>l.id),ORLEANS_COUNTRY_LANES.map(l=>l.id));
  for(const lane of lanes)for(const pts of [lane.points,[...lane.points].reverse()]){
    const p=stand(...pts[0]);
    for(const q of pts.filter((_,i)=>i%6===0||i===pts.length-1)){
      try{stepTo(p,q[0],q[2]);assert.ok(Math.abs(p.pos.y-q[1])<1.3,`lane floor ${p.pos.y} vs ${q[1]}`);}catch(error){throw new Error(`${lane.id}: ${error instanceof Error?error.message:error}`);}
    }
  }
  const site=(id:string)=>plan.sites.find(s=>s.id===id)!.position,end=(id:string)=>lanes.find(l=>l.id===id)!.points.at(-1)!;
  // lane ends → the place itself
  for(const [lane,target] of [['grange',site('grange')],['millhill',site('windmill')],['bastille',site('bastille')]] as const){const e=end(lane),p=stand(...e);stepTo(p,target[0],target[2]);stepTo(p,e[0],e[2]);}
  const gate=lanes.find(l=>l.id==='southbank')!.points.reduce((best,q)=>Math.abs(q[0]-(VY.x+3.5))<Math.abs(best[0]-(VY.x+3.5))?q:best);
  const v=stand(...gate);stepTo(v,VY.x+3.5,VY.z-5.5);stepTo(v,VY.x+1,VY.z);assert.ok(up(VY.x+1,v.pos.y+1.2,VY.z),'press barn is roofed');stepTo(v,VY.x+3.5,VY.z-5.5);stepTo(v,gate[0],gate[2]);
  // the breach is a second way into the bastille
  const b=stand(BA.x-BA.half-7,grid.sampleHeight(BA.x-BA.half-7,BA.z-3)!,BA.z-3);stepTo(b,BA.x-BA.half+8,BA.z-3);stepTo(b,BA.x,BA.z);
});

test('gatehouse passage, windmill and bastille keep their built shapes',()=>{
  const s=Math.sin(TR.yaw),c=Math.cos(TR.yaw);
  for(const lz of [-4,0,4]){const x=TR.x+s*lz,z=TR.z+c*lz,roof=up(x,TR.deck+1.5,z);assert.ok(roof&&roof.point.y-TR.deck>8,`gate passage headroom at ${lz}: ${roof?.point.y}`);}
  for(const side of [-1,1]){const x=TR.x+c*side*12.6,z=TR.z-s*side*12.6,top=down(x,80,z);assert.ok(top&&top.point.y-TR.deck>10,'drum tower stands beside the gate');}
  const p=stand(TR.x-s*9,TR.deck,TR.z-c*9);stepTo(p,TR.x+s*9,TR.z+c*9);stepTo(p,TR.x-s*9,TR.z-c*9);
  const base=plan.sites.find(q=>q.id==='windmill')!.position[1],cap=down(WM.x,90,WM.z);assert.ok(cap&&cap.point.y-base>11.5,'tower mill rises above its ridge');
  assert.ok(WM.hub-WM.sail>3,'sail tips clear a walker beneath them');
  // rampart: higher than a person on three sides, with a gate gap to the south
  for(const [x,z] of [[BA.x+BA.half,BA.z],[BA.x,BA.z-BA.half],[BA.x-BA.half,BA.z+14]]){const crest=down(x,60,z);assert.ok(crest&&crest.point.y-grid.sampleHeight(x,z)!>2.2,`rampart at ${x},${z}`);}
  const gate=down(BA.x,60,BA.z+BA.half);assert.ok(gate&&Math.abs(gate.point.y-grid.sampleHeight(BA.x,BA.z+BA.half)!)<.3,'gate is open ground');
});

test('ground paint, sandbanks and second-ring sites are physical and stay inside the region',()=>{
  for(const f of ORLEANS_FIELDS){assert.ok(Math.abs(f.x)+f.w/2<350&&Math.abs(f.z)+f.d/2<350);assert.equal(fieldAt(f.x,f.z)?.field,f);assert.equal(paintedGround(f.x,f.z),1);assert.ok(grid.sampleHeight(f.x,f.z)!>8,'fields lie on dry land');}
  assert.equal(paintedGround(0,0),0,'the town itself keeps the shared ground blend');
  // painted ground survives the continental colour blend near the region's edge
  const color=terrain.geometry.attributes.color,position=terrain.geometry.attributes.position,probe=(x:number,z:number)=>{let best=0,d=Infinity;for(let i=0;i<position.count;i++){const e=Math.hypot(position.getX(i)-x,position.getZ(i)-z);if(e<d){d=e;best=i;}}return new THREE.Color().fromBufferAttribute(color,best);};
  const wheat=probe(92,328),meadow=probe(92,350);assert.ok(wheat.r-wheat.b>meadow.r-meadow.b+.08,'wheat strips read as a field beside the meadow');
  const burnt=probe(176,296);assert.ok(burnt.r+burnt.g+burnt.b<meadow.r+meadow.g+meadow.b-.25,'the burnt swath is dark');
  for(const bar of ORLEANS_SANDBARS){const y=grid.sampleHeight(bar.x,bar.z)!;assert.ok(y>.3&&y<1.2,`sandbank stands just above the water: ${y}`);}
  for(const z of [40,70,100,130]){let bed=Infinity;for(let x=-260;x<-140;x+=2)bed=Math.min(bed,grid.sampleHeight(x,z)!);assert.ok(bed<-1.5,'the navigable channel is untouched');}
  for(const id of ['tourelles','bridgemill','vineyard','grange','windmill','bastille']){
    const m=layout.markers.find((q:{id:string})=>q.id===`orleans_${id}`);assert.ok(m&&m.type==='discovery'&&m.note.length>12);
  }
  assert.equal(layout.lights.length,8,'the second ring adds no point lights to the shared pool');
  assert.ok(GR.x>0&&VY.x<0);
});

test('mill wheel and windmill sails turn about fixed shafts; atmosphere stays a bounded GPU set',()=>{
  const machines=createOrleansOutskirtsScene(),near={x:-720,z:-1440};
  const count=(o:THREE.Object3D)=>{let n=0;o.traverse(c=>{if((c as THREE.Mesh).isMesh)n++;});return n;};
  assert.ok(count(machines.root)<=8,'each machine is merged per colour');
  const wheelAt=machines.wheel.getWorldPosition(new THREE.Vector3()),sailAt=machines.sails.getWorldPosition(new THREE.Vector3());
  machines.update(1,near);assert.ok(machines.wheel.rotation.x>0&&machines.sails.rotation.z>0);
  assert.ok(machines.wheel.getWorldPosition(new THREE.Vector3()).distanceTo(wheelAt)<1e-6&&machines.sails.getWorldPosition(new THREE.Vector3()).distanceTo(sailAt)<1e-6);
  const before=machines.wheel.rotation.x;machines.update(1,{x:3000,z:3000});assert.equal(machines.wheel.rotation.x,before,'far away it rests and hides');assert.equal(machines.root.visible,false);
  machines.update(Number.NaN,near);assert.ok(Number.isFinite(machines.wheel.rotation.x));machines.dispose();machines.update(1,near);
  assert.ok(ORLEANS_EMITTERS.length<=24);assert.ok(ORLEANS_EMITTERS.reduce((n,e)=>n+e.count,0)<=2400);
  assert.equal(new Set(ORLEANS_EMITTERS.map(e=>e.id)).size,ORLEANS_EMITTERS.length);
  for(const e of ORLEANS_EMITTERS)assert.ok(Math.abs(e.at[0])<350&&Math.abs(e.at[2])<350&&e.range<=220,`${e.id} stays in Orleans`);
});
