/** Audit native export metadata; does not substitute for image inspection or GPU rendering. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.argv[2];
assert(root, 'Usage: node --import tsx audit-native-field-review.ts REVIEW_ROOT');
const rows = [];
for (const region of ['alpha', 'blacksail', 'winter']) {
  const read = async (quality: string) => JSON.parse(await readFile(path.join(root, quality, 'meshes', `${region}.json`), 'utf8'));
  const low = await read('low'), normal = await read('med');
  assert.deepEqual(low.cameras, normal.cameras, `${region}: quality must not alter camera, support or interaction`);
  assert.equal(low.triangles, normal.triangles);
  assert.equal(low.fieldCasterCount, 0);
  assert.equal(normal.fieldCasterCount, 2);
  for (const camera of low.cameras) {
    assert(camera.onGround && !camera.swimming, `${region}/${camera.label}: supported review stance`);
    assert.equal(camera.viewMode, 'production third-person spring arm');
    assert.equal(camera.fov, 75);
    assert.equal(camera.aspect, 1280 / 720);
  }
  const console = low.cameras.find((c: any) => c.label === 'console');
  assert(console.markerInRange && !console.interactionStaticHit, `${region}: console interaction clear`);
  if (console.heroAimRayHits) assert.equal(console.heroAimRayHits.length, 0, `${region}: visible instrument aim is not hidden by hero`);
  const cover = low.cameras.find((c: any) => c.label === 'cover');
  const peek = low.cameras.find((c: any) => c.label === 'peek');
  // Harbor's low crate is not full-height cover from this elevated ray. Do not label it opaque protection.
  if (region !== 'blacksail') assert(cover.aimStaticHit, `${region}: intentional cover blocks this aim ray`);
  assert.equal(peek.aimStaticHit, null, `${region}: narrow peek clears the specified target ray`);
  const wide = low.cameras.find((c: any) => c.label === (region === 'alpha' ? 'peek' : 'peek-wide'));
  if (wide?.visualCenterRayHits) { assert.equal(wide.centerPhysicalHit, null); assert.equal(wide.visualCenterRayHits.length, 0); }

  rows.push({ region, cameraAndRayParity: true, poses: low.cameras.length, triangles: low.triangles,
    lowMeshes: low.meshes.length, normalMeshes: normal.meshes.length, lowCasters: 0, normalCasters: 2,
    consoleDistance: console.markerDistance, consoleInteractionClear: true,
    specifiedTargetRayBlockedByCover: !!cover.aimStaticHit, narrowPeekSpecifiedTargetClear: true,
    narrowPeekCrosshairBlocked: !!peek.centerPhysicalHit, widerPeekCrosshairClear: !wide?.centerPhysicalHit });
}
await writeFile(path.join(root, 'quality-parity.json'), JSON.stringify(rows, null, 2) + '\n');
console.log(JSON.stringify(rows, null, 2));
