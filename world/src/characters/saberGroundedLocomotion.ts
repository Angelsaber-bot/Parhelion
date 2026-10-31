import * as THREE from 'three';
import type { Collider } from '../player';
import { SaberTerrainPatch } from './saberTerrainPatch';
import { SaberFootSupport } from './saberFootSupport';
import { SABER_SOLE_PROBES } from './saberSoleGeometry';
import type { SaberStrideSupport } from './saberStrideRuntime';

/** One bounded visual support solver for the two approved Saber outfits.
 * Collision roots, upper-body curves and action clocks remain authoritative.
 * Run targets are grounded before world anchors; inactive/attack ownership is
 * restored before the mixer. Cached triangles avoid per-frame terrain rays.
 */
export class SaberGroundedLocomotion implements SaberStrideSupport {
  readonly patch: SaberTerrainPatch;
  readonly support: SaberFootSupport;
  readonly diagnostics = { unsupported: 0, adjustments: 0, maxAdjustment: 0, maxFinalTargetError: 0 };
  private readonly chains: THREE.Object3D[][];
  private readonly original: THREE.Quaternion[][];
  private readonly lengths: number[][];
  private readonly scales: THREE.Vector3[];
  private readonly restY: number[];
  private readonly offsets: THREE.Vector3[][];
  private readonly normals = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0)];
  private readonly contact = [false, false];
  private readonly rootP = new THREE.Vector3();
  private readonly vectors = Array.from({ length: 32 }, () => new THREE.Vector3());
  private readonly quaternions = Array.from({ length: 16 }, () => new THREE.Quaternion());
  private vi = 0; private qi = 0; private modified = false; private revision = -1;
  constructor(private readonly model: THREE.Object3D, private readonly root: THREE.Object3D,
    private readonly outfit: 'armor' | 'civilian', colliders: Collider[]) {
    const chains = ['Left', 'Right'].map(side => ['UpLeg', 'Leg', 'Foot'].map(part => model.getObjectByName('mixamorig' + side + part) ?? model.getObjectByName('mixamorig:' + side + part)));
    this.chains = chains.some(chain => chain.some(bone => !bone)) ? [] : chains as THREE.Object3D[][];
    this.patch = new SaberTerrainPatch(colliders);
    if (!this.chains.length) {
      this.original = []; this.lengths = []; this.scales = []; this.restY = []; this.offsets = [];
      this.support = new SaberFootSupport((x, z, y) => this.patch.floor(x, z, y), []);
      return;
    }
    model.updateWorldMatrix(true, true);
    this.original = this.chains.map(chain => chain.map(bone => bone.quaternion.clone()));
    this.lengths = this.chains.map(chain => [chain[0].getWorldPosition(new THREE.Vector3()).distanceTo(chain[1].getWorldPosition(new THREE.Vector3())), chain[1].getWorldPosition(new THREE.Vector3()).distanceTo(chain[2].getWorldPosition(new THREE.Vector3()))]);
    this.scales = this.chains.map(chain => chain[2].getWorldScale(new THREE.Vector3()));
    this.restY = this.chains.map(chain => root.worldToLocal(chain[2].getWorldPosition(new THREE.Vector3())).y);
    this.offsets = this.chains.map((_chain, side) => SABER_SOLE_PROBES[outfit][side].map(() => new THREE.Vector3()));
    const inverse = root.getWorldQuaternion(new THREE.Quaternion()).invert();
    const footprints = this.chains.map((chain, side) => {
      const rotation = inverse.clone().multiply(chain[2].getWorldQuaternion(new THREE.Quaternion())), bounds = new THREE.Box3();
      for (const p of SABER_SOLE_PROBES[outfit][side]) bounds.expandByPoint(new THREE.Vector3(...p).multiply(this.scales[side]).applyQuaternion(rotation));
      return { halfWidth: (bounds.max.x - bounds.min.x) / 2, halfLength: (bounds.max.z - bounds.min.z) / 2, lateralOffset: (bounds.max.x + bounds.min.x) / 2, forwardOffset: (bounds.max.z + bounds.min.z) / 2 };
    });
    this.support = new SaberFootSupport((x, z, y) => this.patch.floor(x, z, y), footprints);
  }
  private v() { return this.vectors[this.vi++].set(0, 0, 0); }
  private q() { return this.quaternions[this.qi++].identity(); }
  restore() {
    if (!this.modified) return;
    for (let side = 0; side < 2; side++) for (let i = 0; i < 3; i++) this.chains[side][i].quaternion.copy(this.original[side][i]);
    this.modified = false;
  }
  reset() { this.patch.clear(); this.support.clear(); this.contact.fill(false); }
  begin(dt: number, root: THREE.Vector3) {
    this.rootP.copy(root); this.patch.beginFrame(root.x, root.z, root.y); this.support.advance(dt);
    const changed = this.patch.revision !== this.revision;
    if (changed) { this.support.clear(); this.contact.fill(false); this.revision = this.patch.revision; }
    return changed;
  }
  private prepareOffsets(side: number, q: THREE.Quaternion) {
    const probes = SABER_SOLE_PROBES[this.outfit][side], offsets = this.offsets[side];
    for (let i = 0; i < probes.length; i++) offsets[i].fromArray(probes[i]).multiply(this.scales[side]).applyQuaternion(q);
  }
  private requiredHeight(side: number, target: THREE.Vector3) {
    let required = -Infinity;
    for (const offset of this.offsets[side]) {
      const height = this.patch.floor(target.x + offset.x, target.z + offset.z, this.rootP.y);
      if (height === null) return NaN; // No fabricated support across an unsupported edge.
      required = Math.max(required, height - offset.y + .0005);
    }
    return Math.abs(required - (this.rootP.y + this.restY[side])) <= .28 ? required : NaN;
  }
  /** Bounded planar reach adjustment, rechecked against exact cached triangles. */
  private fit(side: number, target: THREE.Vector3, hip: THREE.Vector3, l1: number, l2: number,
    lift: number, replaceHeight: boolean, normal: THREE.Vector3, initialRequired?: number) {
    const originalX = target.x, originalZ = target.z, reach = l1 + l2 - .0001;
    const center = this.v(), radial = this.v(), delta = this.v();
    for (let pass = 0; pass < 4; pass++) {
      const required = pass === 0 && initialRequired !== undefined ? initialRequired : this.requiredHeight(side, target);
      if (!Number.isFinite(required)) { this.diagnostics.unsupported++; return false; }
      target.y = replaceHeight && pass === 0 ? required + lift : Math.max(target.y, required);
      if (target.distanceTo(hip) <= reach) break;
      const signed = delta.copy(hip).sub(target).dot(normal);
      center.copy(hip).addScaledVector(normal, -signed); radial.copy(target).sub(center);
      const radius = Math.sqrt(Math.max(0, reach * reach - signed * signed));
      if (Math.abs(signed) >= reach || radial.length() <= radius) break;
      center.addScaledVector(radial.normalize(), radius);
      if (Math.hypot(center.x - originalX, center.z - originalZ) > .12) break;
      target.copy(center);
    }
    const adjustment = Math.hypot(target.x - originalX, target.z - originalZ);
    if (adjustment > 1e-6) { this.diagnostics.adjustments++; this.diagnostics.maxAdjustment = Math.max(this.diagnostics.maxAdjustment, adjustment); }
    return true;
  }
  adjust(side: number, target: THREE.Vector3, q: THREE.Quaternion, hip: THREE.Vector3,
    l1: number, l2: number, lift: number, contact: boolean, final: boolean) {
    if (!this.chains.length) return false;
    this.vi = this.qi = 0;
    const normal = this.normals[side];
    if (!final) {
      const plane = this.support.read(side, target.x, target.z, this.rootP.y, this.root.rotation.y, this.patch.revision, contact && !this.contact[side]);
      this.contact[side] = contact;
      if (!plane.valid) { this.diagnostics.unsupported++; return false; }
      normal.copy(plane.normal); q.premultiply(this.q().setFromUnitVectors(this.v().set(0, 1, 0), normal));
    }
    this.prepareOffsets(side, q);
    const supported = this.fit(side, target, hip, l1, l2, lift, !final, normal);
    if (final) this.diagnostics.maxFinalTargetError = Math.max(this.diagnostics.maxFinalTargetError, target.distanceTo(hip) - (l1 + l2 - .0001));
    return supported;
  }
  private setWorld(bone: THREE.Object3D, q: THREE.Quaternion) {
    bone.quaternion.copy(bone.parent!.getWorldQuaternion(this.q()).invert().multiply(q)); bone.updateWorldMatrix(false, true);
  }
  private aim(bone: THREE.Object3D, child: THREE.Object3D, target: THREE.Vector3) {
    const origin = bone.getWorldPosition(this.v()), from = child.getWorldPosition(this.v()).sub(origin).normalize(), to = this.v().copy(target).sub(origin).normalize();
    this.setWorld(bone, this.q().setFromUnitVectors(from, to).multiply(bone.getWorldQuaternion(this.q())));
  }
  /** Idle/Walk only. Run is solved before its anchors by adjust(). */
  applyBase(dt: number) {
    if (!this.chains.length) return;
    this.model.updateWorldMatrix(true, true); this.begin(dt, this.root.getWorldPosition(this.rootP));
    for (let side = 0; side < 2; side++) for (let i = 0; i < 3; i++) this.original[side][i].copy(this.chains[side][i].quaternion);
    this.modified = true;
    for (let side = 0; side < 2; side++) {
      this.vi = this.qi = 0;
      const [upper, lower, foot] = this.chains[side], position = foot.getWorldPosition(this.v()), q = foot.getWorldQuaternion(this.q());
      let min = Infinity;
      for (const p of SABER_SOLE_PROBES[this.outfit][side]) min = Math.min(min, this.vectors[31].fromArray(p).applyMatrix4(foot.matrixWorld).y);
      const lift = Math.max(0, min - this.rootP.y), weight = 1 - THREE.MathUtils.smoothstep(lift, 0, .09), contact = lift < .005;
      const plane = this.support.read(side, position.x, position.z, this.rootP.y, this.root.rotation.y, this.patch.revision, contact && !this.contact[side]);
      this.contact[side] = contact;
      if (!plane.valid) { this.diagnostics.unsupported++; continue; }
      const normal = this.normals[side].copy(plane.normal);
      q.premultiply(this.q().setFromUnitVectors(this.v().set(0, 1, 0), normal).slerp(this.q(), 1 - weight));
      this.prepareOffsets(side, q);
      const required = this.requiredHeight(side, position);
      if (!Number.isFinite(required)) { this.diagnostics.unsupported++; continue; }
      const target = this.v().copy(position); target.y = Math.max(required, THREE.MathUtils.lerp(position.y, required + lift, weight));
      const hip = upper.getWorldPosition(this.v()), oldKnee = lower.getWorldPosition(this.v()), [l1, l2] = this.lengths[side];
      if (!this.fit(side, target, hip, l1, l2, 0, false, normal, required)) continue;
      const delta = this.v().copy(target).sub(hip), distance = THREE.MathUtils.clamp(delta.length(), Math.abs(l1 - l2) + .0001, l1 + l2 - .0001), axis = delta.normalize();
      const pole = oldKnee.sub(hip); pole.addScaledVector(axis, -pole.dot(axis));
      if (pole.lengthSq() < 1e-10) { pole.set(0, 0, 1).applyQuaternion(this.root.getWorldQuaternion(this.q())); pole.addScaledVector(axis, -pole.dot(axis)); }
      pole.normalize();
      const along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance), height = Math.sqrt(Math.max(0, l1 * l1 - along * along));
      const knee = this.v().copy(hip).addScaledVector(axis, along).addScaledVector(pole, height), end = this.v().copy(hip).addScaledVector(axis, distance);
      this.aim(upper, lower, knee); this.aim(lower, foot, end); this.setWorld(foot, q);
      this.diagnostics.maxFinalTargetError = Math.max(this.diagnostics.maxFinalTargetError, target.distanceTo(end));
    }
  }
}
