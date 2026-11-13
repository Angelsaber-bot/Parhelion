import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Collider } from '../player/player';
import { SiteArt } from '../story/campaignSites';
import { WINTER_MILL_BRIDGE as B, WINTER_WITHDRAWAL as W } from '../story/winterWithdrawal';
import { createWinterMillArchitecture } from './winterMillArchitecture';

export function createWinterMillBridge(rally: [number, number, number], ground: (x: number, z: number, ceiling?: number) => number | null = () => null) {
  const art = new SiteArt(), root = new THREE.Group();
  root.name = 'WinterWithdrawalWorks'; root.add(art.root);
  const workshop = createWinterMillArchitecture(B.north, ground); root.add(workshop.root);
  const north = new THREE.Vector3(...B.north), south = new THREE.Vector3(...B.south);
  const forward = south.clone().sub(north).normalize(), side = new THREE.Vector3(forward.z, 0, -forward.x);
  const center = north.clone().lerp(south, .5), length = north.distanceTo(south);
  const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward);
  const e = new THREE.Euler().setFromQuaternion(rotation);
  const r: [number, number, number] = [e.x, e.y, e.z];
  const deck = new THREE.PlaneGeometry(B.width, length).rotateX(-Math.PI / 2).applyQuaternion(rotation).translate(center.x, center.y, center.z);
  const collider: Collider = { name: 'COL_WinterMillBridge', bvh: new MeshBVH(deck), enabled: false };
  const plankCount = Math.ceil(length / .85);
  for (let i = 0; i < plankCount; i++) {
    const p = north.clone().lerp(south, (i + .5) / plankCount); p.y -= .11;
    art.box(p.toArray(), [B.width, .22, length / plankCount - .035], i % 3 === 0 ? '#8c7b6a' : '#6d5b4c', false, 'body', r);
  }
  for (const sign of [-1, 1]) {
    const offset = (B.width / 2 - .18) * sign;
    const a = north.clone().addScaledVector(side, offset), b = south.clone().addScaledVector(side, offset);
    a.y += .88; b.y += .88; art.beam(a.toArray(), b.toArray(), .15, '#776653');
    for (let d = 2; d < length; d += 3.4) {
      const p = north.clone().addScaledVector(forward, d).addScaledVector(side, offset);
      art.box([p.x, p.y + .44, p.z], [.16, 1.14, .18], '#5f5348', false, 'body', r);
      if (d % 6.8 < 3.5) {
        const foot = p.clone().addScaledVector(side, -sign * 1.25); foot.y = .95;
        art.beam([p.x, p.y - .2, p.z], foot.toArray(), .27, '#837a72');
      }
    }
  }
  art.finish('winter'); art.root.name = 'WinterMillWithdrawalBridge';
  const signal = new THREE.Group(), gun = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#535960' });
  const wood = new THREE.MeshStandardMaterial({ color: '#695849' });
  const flag = new THREE.MeshStandardMaterial({ color: '#b9bcae', side: THREE.DoubleSide });
  function part(parent: THREE.Group, geometry: THREE.BufferGeometry, material: THREE.Material, p: [number, number, number]) {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.fromArray(p); parent.add(mesh); return mesh;
  }
  const [x, y, z] = rally;
  signal.position.set(x + 4.4, y, z + 1.35);
  part(signal, new THREE.CylinderGeometry(.065, .1, 3.8, 8), wood, [0, 1.9, 0]);
  const banner = part(signal, new THREE.PlaneGeometry(1.15, .59), flag, [.63, 3.2, 0]);
  root.add(signal, gun);
  gun.position.set(x - 2.9, y, z - 1.65);
  for (const side of [-1, 1]) {
    part(gun, new THREE.CylinderGeometry(.67, .67, .17, 12).rotateZ(Math.PI / 2), wood, [side * .62, .65, 0]);
    part(gun, new THREE.BoxGeometry(.19, .34, 1.9), wood, [side * .33, .72, .3]);
  }
  part(gun, new THREE.CylinderGeometry(.19, .24, 2.7, 12).rotateX(Math.PI / 2), metal, [0, 1.08, -.65]);
  return {
    root, collider, workshopCollider: workshop.collider,
    apply(done: ReadonlySet<string>, dt: number) {
      workshop.update(dt);
      art.root.visible = collider.enabled = done.has(W.mill);
      signal.visible = done.has(W.redoubt) || done.has(W.mill);
      gun.visible = done.has(W.redoubt);
      const withdrew = done.has(W.retreat);
      const target = withdrew ? 1.8 : -.35;
      banner.position.y = withdrew ? 1.25 : 3.2;
      flag.color.setHex(withdrew ? 0x9bb6c7 : 0xad7257);
      gun.rotation.y = dt > 0 ? THREE.MathUtils.damp(gun.rotation.y, target, 3.1, dt) : target;
    },
    dispose() {
      workshop.dispose();
      collider.enabled = false; deck.dispose();
      for (const mesh of art.layers.values()) mesh.geometry.dispose();
      for (const material of Object.values(art.materials)) material.dispose();
      for (const group of [signal, gun]) group.traverse(node => { if (node instanceof THREE.Mesh) node.geometry.dispose(); });
      metal.dispose(); wood.dispose(); flag.dispose(); root.removeFromParent();
    },
  };
}
