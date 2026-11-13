import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Collider } from '../player/player';
import { SiteArt } from '../story/campaignSites';
import { mergeParts } from '../settlements/merge';
import { flagshipPoint as P, SHIP_INTERIOR } from '../map/shipInteriorCut';
import { FLAGSHIP_WORKS as F, flagshipBridgeLowered } from '../story/flagshipWorks';
import { landscapeWalkway } from './landscapeWalkway';

/** A mast bridge beside the permanent maintenance route. Physics is installed
 * only after the lowering finishes; gates protect both ends during movement. */
export function createFlagshipMastBridge() {
  const root = new THREE.Group(); root.name = 'FlagshipWorkingMastBridge';
  const bridge = new SiteArt(), fittings = new SiteArt(), gates = new SiteArt();
  const start = new THREE.Vector3(...P(-8, -13, 14)), end = new THREE.Vector3(...P(8, -3.75, 7));
  const delta = end.clone().sub(start), run = Math.hypot(delta.x, delta.z);
  const forward = new THREE.Vector3(delta.x, 0, delta.z).normalize();
  const axis = new THREE.Vector3(-forward.z, 0, forward.x);
  const side = new THREE.Vector3(forward.z, 0, -forward.x);
  const swing = Math.PI * .43 + Math.atan2(-delta.y, run);
  landscapeWalkway(bridge, [start.toArray(), end.toArray()], { width: 2.5, floor: '#a08459', edge: '#564738', rails: true, steps: true });
  bridge.beam(start.clone().add(new THREE.Vector3(0, -.36, 0)).toArray(), end.clone().add(new THREE.Vector3(0, -.36, 0)).toArray(), .62, '#674c32');
  for (let i = 0; i <= 12; i++) {
    const point = start.clone().lerp(end, i / 12); point.y -= .3;
    bridge.ring(point.toArray(), .39, .055, '#626561', 'metal', [0, Math.atan2(delta.x, delta.z), Math.PI / 2]);
  }
  const rotation: [number, number, number] = [0, SHIP_INTERIOR.yaw, 0];
  fittings.box(P(0, -17.2, 14.65), [1.15, 1.3, 1.8], '#645343', true, 'body', rotation);
  fittings.box(P(0, -17.2, 15.33), [1.18, .05, 1.85], '#dacba3', false, 'body', rotation);
  // A physical three-part load diagram rather than a floating objective icon.
  for (const [u, v] of [[-.48, -17.55], [0, -17.2], [.48, -16.85]]) fittings.box(P(u, v, 15.37), [.18, .04, .4], '#966b46', false, 'body', rotation);
  fittings.beam(P(-.48, -17.55, 15.38), P(.48, -16.85, 15.38), .035, '#5c685b');
  fittings.beam(P(-13, -18, 15.2), P(-12.1, -17.2, 16), .11, '#bda779');
  fittings.ring(P(-12.1, -17.2, 16), .34, .075, '#6b7470', 'metal', rotation);
  fittings.beam(P(-8, -13, 13.45), P(-8, -15, 13.45), .5, '#4a4d48', true);
  for (const point of [start, end]) {
    for (const height of [.55, 1.05]) gates.beam(point.clone().addScaledVector(side, -1.2).add(new THREE.Vector3(0, height, 0)).toArray(), point.clone().addScaledVector(side, 1.2).add(new THREE.Vector3(0, height, 0)).toArray(), .16, '#ba9152', true);
  }
  const resources: THREE.BufferGeometry[] = [], colliders: Collider[] = [];
  function finish(art: SiteArt, name: string, enabled: boolean) {
    art.finish('blacksail'); root.add(art.root);
    const geo = mergeParts(art.solids); art.solids.forEach(g => g.dispose()); art.solids.length = 0;
    resources.push(geo); const collider: Collider = { name, bvh: new MeshBVH(geo), enabled }; colliders.push(collider); return collider;
  }
  const bridgeCollider = finish(bridge, 'COL_FlagshipLoweredMast', false);
  finish(fittings, 'COL_FlagshipMastFittings', true);
  const gateCollider = finish(gates, 'COL_FlagshipMastSafetyGates', true);
  const pinMaterial = new THREE.MeshStandardMaterial({ color: '#deb455', metalness: .55, roughness: .38 });
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .8, 10), pinMaterial);
  pin.position.fromArray(P(-12.1, -17.2, 16)); pin.rotation.z = Math.PI / 2;
  pin.userData.target = F.pin; root.add(pin);
  const drum = new THREE.Mesh(new THREE.TorusGeometry(.58, .09, 6, 18), pinMaterial);
  drum.position.fromArray(P(13, -17.25, 15.3)); root.add(drum);
  let initialized = false, progress = 0, winchAngle = 0;
  const turn = new THREE.Quaternion(), offset = new THREE.Vector3();
  return {
    root, colliders, targets: [pin],
    apply(done: ReadonlySet<string>, dt: number, active?: string, channel = 0, vesselReady = true) {
      const lowered = flagshipBridgeLowered(done);
      if (!initialized || !lowered) progress = Number(lowered);
      else if (dt > 0) progress = Math.min(1, progress + Math.min(dt, .05) / 4);
      initialized = true;
      const smooth = progress * progress * (3 - 2 * progress);
      turn.setFromAxisAngle(axis, swing * (1 - smooth));
      bridge.root.quaternion.copy(turn);
      offset.copy(start).applyQuaternion(turn); bridge.root.position.copy(start).sub(offset);
      bridgeCollider.enabled = lowered && progress >= 1 && vesselReady;
      gates.root.visible = gateCollider.enabled = !bridgeCollider.enabled;
      pin.visible = !done.has(F.release) && !done.has(F.pin);
      winchAngle = done.has(F.winch) ? Math.PI * 6 : active === F.winch ? channel * Math.PI * 6 : 0;
      drum.rotation.set(0, SHIP_INTERIOR.yaw, winchAngle);
      root.updateMatrixWorld(true);
    },
    dispose() {
      for (const collider of colliders) collider.enabled = false;
      for (const geo of resources) geo.dispose();
      for (const art of [bridge, fittings, gates]) { for (const layer of art.layers.values()) layer.geometry.dispose(); for (const material of Object.values(art.materials)) material.dispose(); }
      pin.geometry.dispose(); drum.geometry.dispose(); pinMaterial.dispose(); root.removeFromParent();
    },
  };
}
