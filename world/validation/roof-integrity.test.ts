import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Batch } from '../tools/gen/geo.ts';
import { addKyotoRoof } from '../tools/gen/kyoto/architecture.ts';

// Weld flat-shaded positions: every shell edge must have two opposite uses.
function openEdges(g: THREE.BufferGeometry) {
  const p = g.attributes.position, edges = new Map<string, { count: number; balance: number }>();
  const key = (i: number) => [p.getX(i), p.getY(i), p.getZ(i)].map(n => Math.round(n * 10000)).join(',');
  for (let i = 0; i < p.count; i += 3) for (let j = 0; j < 3; j++) {
    const a = key(i + j), b = key(i + (j + 1) % 3);
    assert.notEqual(a, b, 'no collapsed edge');
    const id = a < b ? `${a}|${b}` : `${b}|${a}`, edge = edges.get(id) ?? { count: 0, balance: 0 };
    edge.count++; edge.balance += a < b ? 1 : -1; edges.set(id, edge);
  }
  return [...edges.values()].filter(e => e.count !== 2 || e.balance !== 0);
}
for (const kind of ['gable', 'hip'] as const) for (const [w,d,h] of [[14,10,3],[10,14,3],[6,6,.35],[30,23,5.1]]) {
  test(`${kind} ${w}x${d}: roof, soffit and perimeter form a closed shell`, () => {
    const b = new Batch('qa'); addKyotoRoof(b,0,10,0,.37,w,d,h,'#62666a',kind,false);
    assert.equal(b.col.length,0);
    const g = b.vis[0];
    assert.deepEqual(openEdges(g), [], 'all edges sealed with outward winding');
    const mesh = new THREE.Mesh(g,new THREE.MeshBasicMaterial({ side: THREE.FrontSide }));
    const ray = (y: number, dy: number) => new THREE.Raycaster(new THREE.Vector3(.2,y,.1),new THREE.Vector3(0,dy,0)).intersectObject(mesh).length;
    assert.ok(ray(20,-1)>0,'visible from above'); assert.ok(ray(9,1)>0,'visible underside from inside');
  });
}
