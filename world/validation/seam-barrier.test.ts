import {adventureTravelOpen} from '../src/story/openWorldCampaign';
/** Actual compressed-asset / production Player / production state-loop checks. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { regionLoader, bakeQuantized } from '../src/rendering/glb.ts';
import { Player, PLAYER, type Collider } from '../src/player/player.ts';
import { boundaryWalls, LINKS, REGIONS } from '../src/map/regions.ts';
import { WorldProgress } from '../src/core/progress.ts';
import { SEAM_BARRIERS, SEAM_FIELD } from '../tools/gen/valley/seam-barrier.ts';
import { heightFn } from '../tools/gen/terrain.ts';

const bytes = readFileSync(new URL('../public/assets/world_alpha.glb', import.meta.url));
const gltf = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
bakeQuantized(gltf.scene); gltf.scene.updateMatrixWorld(true);
const mesh = (name: string) => gltf.scene.getObjectByName(name) as THREE.Mesh;
const geometry = (m: THREE.Mesh) => { const g=m.geometry.clone().applyMatrix4(m.matrixWorld); return g.index?g.toNonIndexed():g; };
const statics: THREE.BufferGeometry[] = [boundaryWalls()];
const colliders: Collider[] = [], gates: { name: string; opensWhen: string[] }[] = [];
gltf.scene.getObjectByName('COLLISION')!.traverse(o => {
  const m = o as THREE.Mesh; if (!m.isMesh) return;
  if (m.userData.dynamic) {
    colliders.push({ name: m.name, enabled: true, bvh: new MeshBVH(geometry(m)) });
    if (Array.isArray(m.userData.opensWhen)) gates.push({ name: m.userData.art, opensWhen: m.userData.opensWhen });
  } else statics.push(geometry(m));
});
colliders.unshift({ name: 'static', enabled: true, bvh: new MeshBVH(mergeGeometries(statics)) });
const progress = new WorldProgress();
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
const stateLoop = main.slice(main.indexOf('  for (const g of gates) {'), main.indexOf('  for (const g of solids)'));
assert.ok(stateLoop.includes('c.enabled = !open'), 'execute actual production gate loop');
const apply = () => runInNewContext(stateLoop, { adventureTravelOpen,gates, done: progress.done,
  byName: (name: string) => mesh(name), collider: (name: string) => colliders.find(c => c.name === name) });
const idle = { x: 0, z: 0, jump: false, sprint: false };
function drive(p: Player, direction: THREE.Vector2, seconds = 1.4, jump = false) {
  p.yaw = Math.atan2(-direction.x, -direction.y);
  for (let i = 0; i < seconds * 120; i++) p.step(1 / 120, { ...idle, z: 1, sprint: true, jump });
}
function bounds(m: THREE.Mesh) { const g = geometry(m); g.computeBoundingBox(); return g.boundingBox!; }

for (const s of SEAM_BARRIERS) {
  const name = `Seam_${s.id}_Gate`, art = mesh(name), col = mesh(`COL_${name}`);
  const base = bounds(col).min.y - SEAM_FIELD.bottom; // Reviewed installation height, independent of the reworked surrounding terrain.
  test(`${s.id}: local story field matches its visible collision and retains its unlock`, () => {
    assert.ok(art?.isMesh && col?.isMesh);
    assert.deepEqual(col.userData.opensWhen, ['summon_circle']);
    assert.deepEqual(art.userData.opensWhen, ['summon_circle']);
    const triangles = (m: THREE.Mesh) => {
      const p=geometry(m).attributes.position, out:string[]=[];
      for(let i=0;i<p.count;i+=3) {
        const vertices:string[]=[];
        for(let j=0;j<3;j++)vertices.push([p.getX(i+j),p.getY(i+j),p.getZ(i+j)].map(n=>n.toFixed(5)).join(','));
        out.push(vertices.sort().join(';'));
      }
      return out.sort();
    };
    assert.deepEqual(triangles(art),triangles(col),'every actual exported visible triangle matches its collision triangle');
    const a = bounds(art), c = bounds(col);
    assert.ok(a.min.distanceTo(c.min) < .012 && a.max.distanceTo(c.max) < .012, 'exported ART/COL bounds agree within quantization');
    assert.ok(Math.abs(c.min.y - (base - 10)) < .01 && Math.abs(c.max.y - (base + 70)) < .01);
    const center = new THREE.Vector3(s.center[0], base + 5, s.center[1]);
    const inward = new THREE.Vector3(s.inward[0], 0, s.inward[1]);
    const gate = colliders.find(c => c.name === col.name)!;
    const hit = gate.bvh.raycastFirst(new THREE.Ray(center.clone().addScaledVector(inward, 4), inward.clone().negate()), THREE.DoubleSide);
    assert.ok(hit && Math.abs(hit.distance - (4 - SEAM_FIELD.thickness / 2)) < .02, 'player meets the visible pillars, not empty ground 24 m beyond');
    const originalPylons = mesh('Seams');
    const p = geometry(originalPylons).attributes.position;
    for (const sign of [-1, 1]) {
      const x = s.center[0] + s.inward[1] * 10 * sign, z = s.center[1] - s.inward[0] * 10 * sign;
      let found = false;
      for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i) - x) < 1 && Math.abs(p.getZ(i) - z) < 1 && p.getY(i) >= base + 14.8) found = true;
      assert.ok(found, 'the new front endpoints match actual existing pylon geometry');
    }
  });

  test(`${s.id}: local story installation can be bypassed through the open world, without remote walls`, () => {
    const actualGate = geometry(col), shell = new MeshBVH(mergeGeometries([boundaryWalls(), actualGate]));
    const [cx,cz]=s.center,[ix,iz]=s.inward;
    const point=(q:number,t:number)=>new THREE.Vector3(cx-ix*q+iz*t,base+40,cz-iz*q-ix*t);
    const visited=new Set<string>(),queue:[[number,number]]=[[-4,0]];
    const directions=[[1,0],[-1,0],[0,1],[0,-1]];
    let reached=false;
    for(let head=0;head<queue.length;head++) {
      const [q,t]=queue[head],key=`${q},${t}`;if(visited.has(key))continue;visited.add(key);
      if(q>=30&&Math.abs(t)<3){reached=true;break;}
      for(const[dq,dt]of directions){
        const nq=q+dq,nt=t+dt;if(nq < -6||nq>40||Math.abs(nt)>65||visited.has(`${nq},${nt}`))continue;
        const a=point(q,t),b=point(nq,nt),dir=b.clone().sub(a).normalize();
        const hit=shell.raycastFirst(new THREE.Ray(a,dir),THREE.DoubleSide);
        if(!hit||hit.distance>1.001)queue.push([nq,nt]);
      }
    }
    assert.equal(reached,true,'continuous geography allows walking around local story installations');
    assert.ok(visited.size>400,'search covers the nearby unrestricted valley, not just centerline');
    const oldOffset=s.id==='west'||s.id==='east'?24.5:24;
    const atOld=point(oldOffset-2,0),outward=new THREE.Vector3(-ix,0,-iz);
    const oldHit=new MeshBVH(actualGate).raycastFirst(new THREE.Ray(atOld,outward),THREE.DoubleSide);
    assert.ok(!oldHit||oldHit.distance>4,'the old empty-ground wall was removed, not left behind');
  });

  test(`${s.id}: actual Player is blocked before/unblocked after summon, and reset relocks every segment`, () => {
    progress.reset(); apply();
    const p = new Player(colliders, 1), [cx, cz] = s.center, [ix, iz] = s.inward;
    p.teleport(cx + ix * 3, base + 3, cz + iz * 3);
    drive(p, new THREE.Vector2(-ix, -iz), 1.4);
    const signed = () => (p.pos.x - cx) * ix + (p.pos.z - cz) * iz;
    assert.ok(signed() >= PLAYER.radius + SEAM_FIELD.thickness / 2 - .025, `${p.pos.toArray()}: capsule front remains inside`);
    progress.done.add('tower_console'); apply(); assert.equal(colliders.find(c => c.name === col.name)!.enabled, true);
    progress.done.add('summon_circle'); apply();
    assert.equal(art.visible, false); assert.equal(colliders.find(c => c.name === col.name)!.enabled, false);
    drive(p, new THREE.Vector2(-ix, -iz), 1.4);
    assert.ok(signed() < -5, 'opening removes the new front and returns together');
    progress.reset(); apply(); assert.equal(art.visible, true); assert.equal(colliders.find(c => c.name === col.name)!.enabled, true);
  });

}

test('continuous terrain retains story approach locations and a free camp reset spawn', () => {
  assert.deepEqual(REGIONS[0].play, [-360, 360, -360, 360]);
  assert.deepEqual(LINKS, [[316,410,14,46],[-410,-316,-46,-14],[-46,46,-410,-316],[-6,86,316,410]]);
  progress.reset(); apply();
  const layout = JSON.parse(readFileSync(new URL('../public/assets/world_alpha.layout.json', import.meta.url), 'utf8'));
  const spawn = layout.markers.find((m: {id: string}) => m.id === 'spawn_p1').p;
  assert.deepEqual(spawn, [3, 20, 159]);
  const player = new Player(colliders, 1); player.restartAt(spawn[0], spawn[1] + 1, spawn[2]);
  for (let i = 0; i < 180; i++) player.step(1 / 120, idle);
  assert.ok(player.onGround && Math.abs(player.pos.y - 20.5) < .1);
  drive(player, new THREE.Vector2(0, -1), 1);
  assert.ok(player.pos.z < 153 && player.pos.z > 145, 'camp movement remains unobstructed after reset');
});

test('V debug noclip remains explicit, not a newly imposed progression lock', () => {
  progress.reset(); apply();
  const s = SEAM_BARRIERS[2], p = new Player(colliders, 1), base = heightFn(...s.center);
  p.teleport(s.center[0] - 2, base + 4, s.center[1]); p.flying = true;
  drive(p, new THREE.Vector2(1, 0), .1);
  assert.ok(p.pos.x > s.center[0] + 2);
});
