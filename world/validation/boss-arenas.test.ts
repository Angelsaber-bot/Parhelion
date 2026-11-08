import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { SiteArt } from '../src/story/campaignSites.ts';
import { CAMLANN, CORE_RING, HONNOJI, RED_SQUARE, camlannArena, carveCoreRing, flagshipDeckArena, honnojiArena, redSquareArena } from '../src/exploration/bossArenas.ts';

test('Camlann arena: swords, stones and throne dress the field but never crowd the core or the king', () => {
  const art = new SiteArt(), flat = () => 6;
  const before = art.solids.length;
  const built = camlannArena(art, flat);
  assert.equal(built.swords, CAMLANN.swords);
  const solids = art.solids.slice(before);
  assert.ok(solids.length > 10, 'standing stones and the throne dais block movement');
  const [bx, bz] = CAMLANN.boss, [cx, cz] = CAMLANN.core;
  for (const g of solids) {
    g.computeBoundingBox(); const c = g.boundingBox!.getCenter(new THREE.Vector3());
    assert.ok(Math.hypot(c.x - bx, c.z - bz) > CAMLANN.clear, `nothing solid inside the duel circle (${c.x.toFixed(1)}, ${c.z.toFixed(1)})`);
    assert.ok(Math.hypot(c.x - cx, c.z - cz) > 5, 'the Sun Core stays reachable');
  }
  // the throne stands behind the king as seen from the core
  const [tx, tz] = built.throne;
  assert.ok(Math.hypot(tx - cx, tz - cz) > Math.hypot(bx - cx, bz - cz));
});

test('the core ring blocks are cut from the streamed limestone, and nothing else is', () => {
  const [lx, lz] = CORE_RING.local;
  const tri = (x: number, z: number) => [x - .3, 6, z, x + .3, 6, z, x, 7, z + .2];
  const ringStone = tri(lx + CORE_RING.radius, lz), wall = tri(lx + 30, lz), straddling = [lx + CORE_RING.radius, 6, lz, lx + 20, 6, lz, lx, 6, lz + 5];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([...ringStone, ...wall, ...straddling], 3));
  const out = carveCoreRing('britain', 'Britain_Physical_Limestone', geometry)!;
  assert.ok(out, 'a ring block was found');
  assert.deepEqual([...out.index!.array], [3, 4, 5, 6, 7, 8]);
  assert.equal(carveCoreRing('britain', 'Britain_Physical_Oak', geometry), null, 'other surfaces are left alone');
  assert.equal(carveCoreRing('winter', 'Britain_Physical_Limestone', geometry), null);
  const untouched = new THREE.BufferGeometry(); untouched.setAttribute('position', new THREE.Float32BufferAttribute(wall, 3));
  assert.equal(carveCoreRing('britain', 'Britain_Physical_Limestone', untouched), null, 'meshes without ring blocks are kept as shipped');
});

test('Red Square and Honnō-ji: the centrepiece stands behind the boss and nothing lands in the duel', () => {
  for (const [def, build] of [[RED_SQUARE, redSquareArena], [HONNOJI, honnojiArena]] as const) {
    const art = new SiteArt();
    const built = build(art, () => 2) as { bell?: readonly [number, number]; screen?: readonly [number, number] };
    const [bx, bz] = def.boss, [cx, cz] = def.core, [tx, tz] = built.bell ?? built.screen!;
    assert.ok(Math.hypot(tx - cx, tz - cz) > Math.hypot(bx - cx, bz - cz), 'behind the boss as seen from the core');
    assert.equal(art.solids.length > 0, def === RED_SQUARE, 'only the great bell blocks movement; the burning courtyard stays open');
    for (const g of art.solids) {
      g.computeBoundingBox(); const c = g.boundingBox!.getCenter(new THREE.Vector3());
      assert.ok(Math.hypot(c.x - bx, c.z - bz) > def.clear && Math.hypot(c.x - cx, c.z - cz) > 5);
    }
  }
});

test('the flagship deck is dressed from rail to quarterdeck without adding a single obstacle', () => {
  const art = new SiteArt();
  const { props } = flagshipDeckArena(art);
  assert.ok(props > 30);
  assert.equal(art.solids.length, 0, 'the deck fight keeps its authored collision');
});
