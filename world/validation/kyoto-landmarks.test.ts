import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { regionLoader, bakeQuantized } from '../src/rendering/glb.ts';
import { POND } from '../tools/gen/kyoto/layout.ts';
import { Player, type Collider } from '../src/player/player';

// Exercise exported geometry, including compression/quantization, rather than source strings.
const bytes = readFileSync(new URL('../public/assets/world_kyoto.glb', import.meta.url));
const gltf = await regionLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
bakeQuantized(gltf.scene);
gltf.scene.updateMatrixWorld(true);
function geometry(name: string) {
  const mesh = gltf.scene.getObjectByName(name) as THREE.Mesh;
  assert.ok(mesh?.isMesh, `exported ${name}`);
  return mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
}
const terrain = new MeshBVH(geometry('Terrain'));
const pavilion = geometry('Kinkaku');
const gold = geometry('Kinkaku_Gold');
const goldBVH = new MeshBVH(gold);
const hall = new MeshBVH(geometry('Higashiyama'));
const down = new THREE.Vector3(0, -1, 0);

test('Kyoto exported Kinkaku hillside bamboo posts meet the terrain, not a floating balcony', () => {
  const p = pavilion.attributes.position;
  const x = -202, startZ = -229.5, endZ = POND.c[1] - POND.rz * .92 + 4;
  const n = Math.ceil(Math.abs(endZ - startZ) / 1.5);
  for (let k = 0; k <= n; k++) {
    const z = startZ + (endZ - startZ) * k / n;
    let base = Infinity;
    for (let i = 0; i < p.count; i++) {
      if (Math.hypot(p.getX(i) - x, p.getZ(i) - z) < .075) base = Math.min(base, p.getY(i));
    }
    assert.ok(Number.isFinite(base), `fence post ${k} exists`);
    const ground = terrain.raycastFirst(new THREE.Ray(new THREE.Vector3(x, 300, z), down), THREE.DoubleSide);
    assert.ok(ground, `terrain below post ${k}`);
    assert.ok(Math.abs(base - ground.point.y) < .03, `post ${k} meets exported terrain within 3cm; gap ${base - ground.point.y}m`);
  }
});

test('Kyoto exported Kinkaku balcony is connected on all four sides and has no remote gold rails', () => {
  const p = gold.attributes.position;
  let count = 0;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) < 6.5 || p.getY(i) > 7.9) continue;
    count++;
    assert.ok(Math.abs(p.getX(i) + 215) < 7.8, 'gold lower gallery stays within actual east/west deck extent');
    assert.ok(Math.abs(p.getZ(i) + 218) < 6.3, 'gold lower gallery stays within actual north/south deck extent');
  }
  assert.ok(count > 100, 'lower gallery has actual exported detail');
  // Between posts, each narrow deck connects the facade to its outer rail.
  for (const [dx, dz] of [[7.3, .47], [-7.3, .47], [.47, 5.8], [.47, -5.8]]) {
    const hit = goldBVH.raycastFirst(new THREE.Ray(new THREE.Vector3(-215 + dx, 6.9, -218 + dz), down), THREE.DoubleSide);
    assert.ok(hit && Math.abs(hit.point.y - 6.86) < .025, `supported gallery deck on side ${dx},${dz}; hit ${hit?.point.y}`);
  }
});

test('Kyoto exported Kiyomizu upper gables have opaque infill under both curved roof ends', () => {
  for (const side of [-1, 1]) for (const dz of [-6, -3, 0, 3, 6]) {
    const t = Math.abs(dz) / 7.75;
    const y = 44 + 4.2 * Math.pow(1 - t, 1.45) + .3 * Math.pow(t, 8) - .5;
    const origin = new THREE.Vector3(298 + side * 18, y, 50 + dz);
    const hit = hall.raycastFirst(new THREE.Ray(origin, new THREE.Vector3(-side, 0, 0)), THREE.DoubleSide);
    assert.ok(hit, `solid upper gable at side ${side}, z offset ${dz}, not sky through open truss`);
    assert.ok(Math.abs(hit.point.x - (298 + side * 9.55)) < .15, `hit actual upper gable face, not opposite wall: ${hit.point.x}`);
  }
});

test('Yasaka gate stone shoes span the real slope beneath both piers and outer posts', () => {
  const support = new MeshBVH(geometry('Kyoto_Hillside_Foundations'));
  const centre = terrain.raycastFirst(new THREE.Ray(new THREE.Vector3(212,300,-20),down),THREE.DoubleSide)!.point.y;
  let exposed = 0;
  for(const side of[-1,1])for(const dx of[-2.65,-2.3,0,2.3,2.65])for(const dz of[-1.55,0,1.55]){
    const x=212+dx,z=-20+side*4.5+dz;
    const ray=new THREE.Ray(new THREE.Vector3(x,300,z),down);
    const ground=terrain.raycastFirst(ray,THREE.DoubleSide)!.point.y;
    if(ground>=centre-.04)continue;
    const hits=support.raycast(ray,THREE.DoubleSide).sort((a,b)=>a.distance-b.distance);
    assert.ok(hits.length>=2,`solid foundation beneath exposed gate at ${x},${z}`);
    assert.ok(hits[0].point.y>=centre+.06&&hits[0].point.y<centre+.15,'stone reaches the outer timber post bases');
    assert.ok(hits[1].point.y<=ground-.08,'stone bottom is buried below actual exported terrain');exposed++;
  }
  assert.ok(exposed>=12,'both downhill footings were sampled, not only the buried uphill edge');
});

test('Yasaka gate passage remains walkable in both directions with the real stone shoes enabled',()=>{
  const colliders:Collider[]=[];
  gltf.scene.getObjectByName('COLLISION')!.traverse(o=>{
    const m=o as THREE.Mesh;if(!m.isMesh)return;
    colliders.push({name:m.name,bvh:new MeshBVH(geometry(m.name)),enabled:true});
  });
  const player=new Player(colliders,1),idle={x:0,z:0,jump:false,sprint:false};
  try{
    for(const z of[-22,-20,-18])for(const [from,to]of[[206,218],[218,206]]){
      const y=terrain.raycastFirst(new THREE.Ray(new THREE.Vector3(from,300,z),down),THREE.DoubleSide)!.point.y;
      player.teleport(from,y+.12,z);for(let i=0;i<45;i++)player.step(1/120,idle);
      let frames=0;
      while(Math.abs(player.pos.x-to)>.15&&frames++<120*6){player.yaw=Math.atan2(player.pos.x-to,player.pos.z-z);player.step(1/120,{...idle,z:1});}
      for(let i=0;i<20;i++)player.step(1/120,idle);
      assert.ok(Math.abs(player.pos.x-to)<.3&&Math.abs(player.pos.z-z)<.2,`clear central/edge lane at ${player.pos.toArray()}`);
      assert.ok(player.onGround&&!player.swimming,'no jumping, falling or swimming required');
    }
  }finally{for(const c of colliders)c.bvh.geometry.dispose();}
});
