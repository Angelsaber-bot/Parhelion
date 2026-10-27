import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { KingdomCraft, townHouse, wallCraft, roundTower, pavilion, roundHall, bridgeCraft, standingStone, swordDais, shrineCraft, battlefieldCraft, gateCraft, removeUpFaces, deckSector, mergeKingdomVisuals, keepCrown, keepBracket, farFoundation } from '../tools/gen/britain/craft.ts';
import { colored, BOX } from '../tools/gen/geo.ts';

function hash(c:KingdomCraft) {
  const h=createHash('sha256');
  for(const p of c.pieces())for(const g of p.batch.vis)h.update(Buffer.from(g.attributes.position.array.buffer));
  return h.digest('hex');
}
test('britain craft: all eight equal-sized town fronts have different authored geometry, not only tint',()=>{
  const hashes=new Set<string>();
  for(let i=0;i<8;i++){const c=new KingdomCraft();townHouse(c,0,0,0,0,6,4.5,4,i);hashes.add(hash(c));}
  assert.equal(hashes.size,8);
});
test('britain craft: all landmark detail is finite visual-only geometry across ten real surface families',()=>{
  const c=new KingdomCraft();
  for(let i=0;i<8;i++)townHouse(c,i*10,0,0,0,6,4.5,4,i);
  wallCraft(c,0,0,0,0,7,6.2,0);roundTower(c,'Test',0,0,0,3.4,12);
  for(let i=0;i<5;i++)pavilion(c,0,0,0,3.4,i);
  roundHall(c,0,0,0,13,0);bridgeCraft(c,0,2,-20,0);standingStone(c,0,0,0,0,4,0);
  keepCrown(c,0,26.8,0,6,26);keepBracket(c,0,10,0,0,6);farFoundation(c,0,0,0,()=>-5);
  swordDais(c,0,0,0);shrineCraft(c,0,0,0);battlefieldCraft(c,0,0,0,0,1);gateCraft(c,0,0,0,0);
  const materials=new Set<string>();
  for(const p of c.pieces()) {
    materials.add(p.material);assert.equal(p.batch.col.length,0,p.name);
    for(const g of p.batch.vis) {
      assert.ok(g.attributes.position.count>0);
      for(const a of Object.values(g.attributes))for(const v of a.array)assert.ok(Number.isFinite(v),p.name);
      const pos=g.attributes.position;
      for(let i=0;i<pos.count;i+=3) {
        const a=new THREE.Vector3().fromBufferAttribute(pos,i),b=new THREE.Vector3().fromBufferAttribute(pos,i+1),d=new THREE.Vector3().fromBufferAttribute(pos,i+2);
        assert.ok(b.sub(a).cross(d.sub(a)).lengthSq()>1e-16,`nondegenerate ${p.name} triangle ${i/3}`);
      }
    }
  }
  assert.deepEqual([...materials].sort(),['Limestone','Sandstone','Oak','Slate','Thatch','Plaster','Wool','Iron','Bronze','CharredWood'].map(s=>'M_Britain'+s).sort());
});
test('britain craft: circular wall fix removes only old visual top faces',()=>{
  const original=colored(BOX,'#ffffff'), fixed=removeUpFaces(original);
  assert.equal(original.attributes.position.count,36);
  assert.equal(fixed.attributes.position.count,30);
  for(let i=0;i<fixed.attributes.normal.count;i++)assert.ok(fixed.attributes.normal.getY(i)<.99);
});
test('britain craft: copings meet at shared annular endpoints without overlapping rectangular top slabs',()=>{
  const c=new KingdomCraft();wallCraft(c,0,0,0,0,7,6.2,0,60);
  const top=c.pieces().find(p=>p.material==='M_BritainLimestone')!.batch.vis.at(-1)!;
  assert.equal(top.attributes.position.count,6);
  const a=top.attributes.position;
  for(let i=0;i<a.count;i++)assert.ok(Math.abs(a.getY(i)-7.035)<1e-5);
  assert.ok(a.getX(0)>a.getX(1),'outer radius is farther than inner radius');
});

test('britain craft: keep disk and annular landing share edges instead of overlapping top faces',()=>{
  const c=new KingdomCraft();
  for(let s=0;s<24;s++){deckSector(c,0,0,0,0,6.1,s);deckSector(c,0,0,0,6.1,9.5,s);}
  const meshes=c.pieces().flatMap(p=>p.batch.vis.map(g=>new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}))));
  for(const r of [3.2,5.8,6.4,8.3])for(const a of [.17,.49,1.1,2.13,3.51]){
    const ray=new THREE.Raycaster(new THREE.Vector3(Math.cos(a)*r,5,Math.sin(a)*r),new THREE.Vector3(0,-1,0));
    assert.equal(ray.intersectObjects(meshes,false).length,1,`one top surface at ${r},${a}`);
  }
});
test('britain craft: batching retains eight distinct houses while consolidating static physical materials',()=>{
  const c=new KingdomCraft();for(let i=0;i<8;i++)townHouse(c,i*12,0,0,0,6,4.5,4,i);
  const pieces=c.pieces(),before=pieces.reduce((n,p)=>n+p.batch.vis.reduce((n,g)=>n+g.attributes.position.count,0),0);
  mergeKingdomVisuals(pieces);
  assert.ok(pieces.length<=10);
  assert.equal(pieces.reduce((n,p)=>n+p.batch.vis.reduce((n,g)=>n+g.attributes.position.count,0),0),before);
  assert.ok(pieces.every(p=>p.batch.col.length===0));
});

test('britain craft: round hall lancet glazing is outside the original thick wall, not buried on its centreline',()=>{
  const c=new KingdomCraft();roundHall(c,0,0,0,13,0);
  const glazing=c.pieces().filter(p=>p.material==='M_BritainIron');
  assert.ok(glazing.length>0);
  for(const p of glazing)for(const g of p.batch.vis)for(let i=0;i<g.attributes.position.count;i++){
    const a=g.attributes.position;
    assert.ok(Math.hypot(a.getX(i),a.getZ(i))>13.5,'glazing and mullions clear the 0.5m wall thickness');
  }
});
