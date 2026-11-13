import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import type { Collider, Player } from '../player/player';
import type { Marker } from '../core/types';
import { WINTER_CUSTOMS_WORKS as W, WINTER_CUSTOMS_LABELS, winterCustomsCartReleased } from '../story/winterCustomsWorks';
import { landscapeWalkway } from './landscapeWalkway';

/** The optional empty cart is present before battle. It rolls down its loading
 * apron into the square; no food is destroyed and neither exit is closed. */
export function createWinterCustomsWorks() {
  const root = new THREE.Group(); root.name = 'WinterCustomsWorks';
  const frame = new THREE.Matrix4().makeTranslation(0, 0, -720);
  const arts: SiteArt[] = [], geometries: THREE.BufferGeometry[] = [], colliders: Collider[] = [];
  const wood = '#71604f', edge = '#55595c', snow = '#dde5e6', ground = 8.1;
  function finish(art: SiteArt, name: string) {
    art.relocate(frame); art.finish('winter'); art.root.name = name; root.add(art.root); arts.push(art);
    const geo = mergeParts(art.solids); art.solids.forEach(g => g.dispose()); art.solids.length = 0;
    const collider: Collider = { name: 'COL_' + name, bvh: new MeshBVH(geo), enabled: true };
    colliders.push(collider); geometries.push(geo); return { art, geo, collider };
  }
  const fixed = new SiteArt();
  landscapeWalkway(fixed, [[-91, 9.6, 238], [-80, ground, 238]], { width: 3.8, floor: wood, edge });
  fixed.box([-90.1, 8.8, 238], [1.6, 1.4, 3.8], wood, true);
  for (const z of [236.7, 239.3]) fixed.box([-85.5, 8.4, z], [.9, .6, .35], edge, true);
  fixed.box([-84.8, ground + .45, 241], [.25, .9, .25], edge, true);
  fixed.beam([-84.8, ground + .8, 241], [-84.8, ground + 1.16, 240.6], .12, '#b8a167');
  // Low ropes mark the evacuation edge, with both crossings visibly open.
  for (const z of [234, 256]) {
    for (const dz of [-2, 2]) fixed.box([-55, ground + .6, z + dz], [.18, 1.2, .18], wood, true);
    fixed.beam([-55, ground + .8, z - 2], [-55, ground + .8, z + 2], .09, '#b49c75', true);
    fixed.box([-55, ground + 1.55, z], [.05, .75, 1.1], '#c7c4b4');
    for (const dz of [-.24, .24]) fixed.box([-54.96, ground + 1.55, z + dz], [.04, .45, .08], edge);
  }
  const caches = [[-90, ground, 251], [-57, ground, 250]] as const;
  for (const [x, y, z] of caches) {
    fixed.box([x, y + .45, z], [1.45, .9, .85], wood, true);
    fixed.box([x, y + .93, z], [1.52, .08, .95], snow);
    for (const dx of [-.55, .55]) fixed.box([x + dx, y + .45, z], [.075, .94, .9], edge);
    for (let n = 0; n < 4; n++) fixed.cyl([x - .35 + n * .23, y + 1.07, z], .065, .2, '#b5a16c');
    fixed.lantern(x, y + 1.6, z + .45);
  }
  finish(fixed, 'WinterCustomsLoadingApronAndCaches');
  const startX = -87, endX = -73, startY = 9.6 - 4 / 11 * 1.5;
  const wagon = new SiteArt();
  wagon.box([startX, startY + 1.05, 238], [4.4, .24, 2.35], wood, true);
  for (const z of [236.82, 239.18]) {
    for (const x of [-88.8, -87, -85.2]) wagon.box([x, startY + 1.6, z], [.15, 1.2, .12], edge, true);
    for (const y of [1.35, 1.7, 2.05]) wagon.box([startX, startY + y, z], [4.4, .23, .13], wood, true);
  }
  for (const x of [-89.2, -84.8]) wagon.box([x, startY + 1.42, 238], [.15, .74, 2.35], wood, true);
  for (let n = 0; n < 7; n++) wagon.box([startX - 1.8 + n * .6, startY + 1.18, 238], [.04, .02, 2.2], edge);
  for (const z of [237.4, 238.6]) wagon.beam([-84.8, startY + .85, z], [-83.4, startY + .6, z], .14, wood);
  const moving = finish(wagon, 'WinterCustomsEmptyGrainCart'), base = Float32Array.from(moving.geo.attributes.position.array);
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: '#393d40', roughness: .85 });
  const wheelRoot = new THREE.Group(); root.add(wheelRoot);
  const wheels = [] as THREE.Group[];
  for (const dx of [-1.5, 1.5]) for (const dz of [-1.35, 1.35]) {
    const group = new THREE.Group(); group.position.set(startX + dx, startY + .56, 238 + dz - 720); wheelRoot.add(group); wheels.push(group);
    const ring = new THREE.TorusGeometry(.5, .085, 6, 16); geometries.push(ring); group.add(new THREE.Mesh(ring, wheelMaterial));
    const hub = new THREE.CylinderGeometry(.12, .12, .25, 8).rotateX(Math.PI / 2); geometries.push(hub); group.add(new THREE.Mesh(hub, wheelMaterial));
    const spoke = new THREE.BoxGeometry(.07, .97, .08); geometries.push(spoke);
    for (let n = 0; n < 4; n++) { const mesh = new THREE.Mesh(spoke, wheelMaterial); mesh.rotation.z = n * Math.PI / 4; group.add(mesh); }
  }
  const braceArt = new SiteArt();
  for (const z of [236.7, 239.3]) braceArt.beam([-85.5, 8.7, z], [-84.8, startY + 1.3, z], .16, '#b8a167', true);
  const brace = finish(braceArt, 'WinterCustomsCartBrace');
  const targetMaterial = new THREE.MeshStandardMaterial({ color: '#d1b46e', emissive: '#3b3019' });
  const targetGeo = new THREE.BoxGeometry(.32, .45, .2); geometries.push(targetGeo);
  const target = new THREE.Mesh(targetGeo, targetMaterial); target.position.set(-85.2, startY + 1.1, -483.42); target.userData.target = W.pin; root.add(target);
  const markers: Marker[] = [
    { id: W.cart, type: 'interact', label: WINTER_CUSTOMS_LABELS.get(W.cart)![0], p: [-84.8, ground + 1.4, -479], radius: 2.7 },
    ...caches.map(([x, y, z], i): Marker => { const id = i ? W.eastAmmo : W.westAmmo; return { id, type: 'interact', label: WINTER_CUSTOMS_LABELS.get(id)![0], p: [x, y + 1.2, z - 720], radius: 2.3 }; }),
  ];
  const cartFrame = new THREE.Group(); root.add(cartFrame); cartFrame.add(moving.art.root, wheelRoot);
  moving.art.root.position.set(-startX, -startY, -238); wheelRoot.position.set(-startX, -startY, 482);
  let x = startX, y = startY, tilt = 0, initialized = false;
  const trackY = (px: number) => px < -80 ? 9.6 - (px + 91) / 11 * 1.5 : ground;
  function setPosition(nextX: number) {
    x = nextX;
    const rear = trackY(x - 1.5), front = trackY(x + 1.5);
    y = (rear + front) / 2; tilt = Math.atan2(front - rear, 3);
    const dx = x - startX, position = moving.geo.attributes.position, c = Math.cos(tilt), s = Math.sin(tilt);
    cartFrame.position.set(x, y, -482); cartFrame.rotation.z = tilt;
    for (let i = 0; i < position.count; i++) {
      const px = base[i * 3] - startX, py = base[i * 3 + 1] - startY;
      position.setX(i, x + px * c - py * s); position.setY(i, y + px * s + py * c);
    }
    position.needsUpdate = true; moving.collider.bvh.refit(); moving.geo.computeBoundingBox(); moving.geo.computeBoundingSphere();
    for (const wheel of wheels) wheel.rotation.z = -dx / .56;
  }
  return {
    root, colliders, targets: [target], markers,
    apply(done: ReadonlySet<string>, dt: number, player?: Pick<Player, 'pos' | 'vel' | 'flying' | 'gliding' | 'swimming' | 'onGround'>) {
      const released = winterCustomsCartReleased(done);
      if (!initialized) { initialized = true; setPosition(released ? endX : startX); }
      target.visible = brace.art.root.visible = brace.collider.enabled = !released;
      if (!released && x !== startX) setPosition(startX);
      if (released && x < endX && dt > 0) {
        const next = Math.min(endX, x + Math.min(dt, .05) * 3.2);
        const aboard = !!player && Math.abs(player.pos.x - x) < 2.1 && Math.abs(player.pos.z + 482) < 1.1
          && player.pos.y >= y + 1.05 && player.pos.y < y + 2.4 && player.onGround && !player.flying && !player.swimming && !player.gliding;
        const inFront = !!player && !aboard && player.pos.x > x - 2.65 && player.pos.x < next + 3.05
          && Math.abs(player.pos.z + 482) < 1.85 && player.pos.y < y + 2.4 && player.pos.y + 1.75 > y;
        if (!inFront) {
          const oldX = x, oldY = y, oldTilt = tilt; setPosition(next);
          if (aboard && player) {
            const dx = player.pos.x - oldX, dy = player.pos.y - oldY, angle = tilt - oldTilt;
            player.pos.x = x + dx * Math.cos(angle) - dy * Math.sin(angle);
            player.pos.y = y + dx * Math.sin(angle) + dy * Math.cos(angle);
          }
        }
      }
      root.updateMatrixWorld(true);
    },
    dispose() {
      colliders.forEach(c => { c.enabled = false; }); geometries.forEach(g => g.dispose()); wheelMaterial.dispose(); targetMaterial.dispose();
      for (const art of arts) { for (const mesh of art.layers.values()) mesh.geometry.dispose(); Object.values(art.materials).forEach(m => m.dispose()); } root.removeFromParent();
    },
  };
}
