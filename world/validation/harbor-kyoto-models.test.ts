import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { buildBlackSailSettlement } from '../src/settlements/blacksail';
import { buildKyotoSettlement } from '../src/settlements/kyoto';
import { createFlagshipDockLandscape } from '../src/environment/flagshipDockLandscape';
import { createKyotoStreetLandscape } from '../src/environment/kyotoStreetLandscape';
import { flagshipPoint } from '../src/map/shipInteriorCut';
import { Player } from '../src/player/player';
import { KYOTO_STREET, kyotoStreetPoint } from '../src/story/kyotoStreetWorks';

type Point = [number, number, number];
function sight(root: THREE.Group, from: Point, to: Point) {
  root.updateMatrixWorld(true);
  const origin = new THREE.Vector3(...from), direction = new THREE.Vector3(...to).sub(origin);
  return new THREE.Raycaster(origin, direction.clone().normalize(), .0001, direction.length()).intersectObjects(root.children, true);
}

test('both customs gables face out to the quay and both service hatches open below their glazing', () => {
  const { group } = buildBlackSailSettlement();
  for (const side of [-1, 1]) {
    for (const [y,z] of [[5.63,-4],[5.19,4.8]]) {
      const hit = sight(group,[13*side,y,z],[10.8*side,y,z]).find(h=>h.object.name==='Customs_plaster_solid');
      assert.ok(hit, 'the exterior gable closes the roof behind its framing');
      assert.ok(hit.face!.normal.x*side > .99);
    }
    const x = 7*side + .65;
    assert.equal(sight(group,[x,2.28,6],[x,2.28,4.6]).length,0);
    assert.equal(sight(group,[x,3.12,6],[x,3.12,4.6])[0]?.object.name,'Customs_glass_art');
  }
});

test('the Kyoto inn has a real garden exit, visible shoji inside, and flush floors without duplicate paving', () => {
  const { group } = buildKyotoSettlement();
  for (const y of [.4,1.5,2.9]) assert.equal(sight(group,[8,y,5],[8,y,3]).length,0);
  for (const x of [2.95,14]) {
    const hit = sight(group,[x,1.57,3],[x,1.57,4.5])[0];
    assert.equal((hit?.object as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>).material.userData.craftSurface,'paper');
  }
  for (const [x,z] of [[4.7,1.7],[-12,-.7],[9.65,-9.7]]) {
    const floors = sight(group,[x,.3,z],[x,-.09,z]);
    assert.equal(floors.length,1);
    assert.ok(Math.abs(floors[0].point.y)<.001);
  }
  const player = new Player(group.children.filter(o=>o.userData.solid).map(o=>({
    name:o.name, enabled:true, bvh:new MeshBVH((o as THREE.Mesh).geometry.clone()),
  })),-12);
  player.teleport(9.75,.05,-8.4);
  for (let i=0;i<120;i++) player.step(1/120,{x:0,z:1,jump:false,sprint:false});
  assert.ok(player.pos.z < -11 && player.pos.y>-.15,'a player walks from the sleeping rooms into the garden');
  for (const [x,z] of [[-6.5,-6.4],[-2.5,7.8]]) {
    const water = sight(group,[x+.06,1.7,z],[x+.06,.2,z])[0];
    assert.equal((water?.object as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>).material.color.getHexString(),'6fadb3');
    const radius = x===-6.5 ? .65 : .8;
    const rim = sight(group,[x+radius*.87,1.7,z],[x+radius*.87,.2,z])[0];
    assert.ok(rim && rim.point.y > water.point.y+.08);
  }
});

test('each flagship crane leads rope up from its drum, along the boom and down to its hook', () => {
  const dock = createFlagshipDockLandscape(), expected = new THREE.Color('#b3a17c');
  try {
    for (const u of [-13,13]) for (const [v,y] of [[-18.55,18.2],[-13,23.5],[-6.65,17]]) {
      const hit = sight(dock.root,flagshipPoint(u-.6,v,y),flagshipPoint(u+.6,v,y))[0];
      assert.ok(hit?.face);
      const mesh = hit.object as THREE.Mesh, color=new THREE.Color().fromBufferAttribute(mesh.geometry.getAttribute('color'),hit.face.a);
      assert.equal(color.getHex(),expected.getHex());
    }
    assert.equal(dock.root.children.filter(o=>o instanceof THREE.Mesh).length,3);
  } finally { dock.dispose(); }
});

test('both river-bridge cargo slings meet their hanging line at rest and while lowering', () => {
  const shop = createKyotoStreetLandscape(()=>5), p = kyotoStreetPoint;
  try {
    shop.apply(new Set(),0);
    for (let step=0;step<3;step++) {
      const offset=3.2*(1-step/2);
      for (const [x,z] of [[142,-76.45],[164,-73.55]]) {
        const y=7.33+offset;
        const cord = sight(shop.root,p(x-.2,y+.035,z),p(x+.2,y+.035,z))[0];
        assert.equal((cord?.object as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>).material.color.getHexString(),'b6a17c');
        const sling=sight(shop.root,p(x+.425,y-.295,z+.18),p(x+.425,y-.295,z+.52))[0];
        assert.ok(sling?.face);
        const mesh=sling.object as THREE.Mesh;
        assert.equal(new THREE.Color().fromBufferAttribute(mesh.geometry.getAttribute('color'),sling.face.a).getHexString(),'b6a17c');
      }
      for(let frame=0;frame<30;frame++) shop.apply(new Set([KYOTO_STREET.pin]),.05);
    }
  } finally { shop.dispose(); }
});
