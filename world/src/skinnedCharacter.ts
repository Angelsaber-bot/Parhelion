/** Formal deform rig. The game owns feet position/yaw; the asset owns bind pose, UVs and anatomy. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { addPlayerOutline, disposePlayerObject, preservePlayerMaterial, wantsPlayerOutline } from './playerMaterials';
import { makePlayerGlider, type GliderEquipment } from './playerEquipment';

export const PLAYER_V2_URL = new URL('../../assets/characters/player_v2/player_v2.glb', import.meta.url).href;
export const DAWN_PHYSICAL_SCALE = .7873802602519613;
type Side = 'R' | 'L';
export interface PlayerAnimationState {
  speed: number; onGround: boolean; swimming: boolean; vy: number; moveYaw: number | null;
  flying?: boolean; gliding?: boolean; aim?: number; pitch?: number; firing?: boolean;
  /** World-space view heading (+Z forward), used only while firing; never changes the camera. */
  lookYaw?: number;
}
interface RestBone { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3; rootQ: THREE.Quaternion; rootP: THREE.Vector3; }
export interface SkinnedCharacterRig {
  kind: 'skinned-v2'; root: THREE.Group; model: THREE.Group; joints: Record<string, THREE.Object3D>;
  bones: Record<string, THREE.Bone>; meshes: THREE.Mesh[]; skeletons: THREE.Skeleton[];
  rest: Map<THREE.Bone, RestBone>; handSockets: Record<Side, THREE.Object3D>;
  glider: GliderEquipment; shoulderHeight: number; hipHeight: number;
  gunHold: { p: THREE.Vector3; q: THREE.Quaternion }; gunSling: { p: THREE.Vector3; q: THREE.Quaternion };
  gunHands: { right: THREE.Vector3; left: THREE.Vector3 };
  gunAnchors: { grip: THREE.Vector3; support: THREE.Vector3 };
  weaponArt: { physicalScale: number; required: true };
  diagnostics: { armReachError: Record<Side, number>; mode: string; disposed: boolean };
  dispose(): void;
}

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Q = () => new THREE.Quaternion();
function basis(direction: THREE.Vector3, dorsal: THREE.Vector3) {
  const x = direction.clone().normalize();
  const y = dorsal.clone().addScaledVector(x, -dorsal.dot(x)).normalize();
  const z = x.clone().cross(y).normalize();
  return Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
const gunPalm: Record<Side, THREE.Quaternion> = {
  // Finger metacarpals point along the barrel; the index is above the lower grip fingers.
  // A downward distal axis puts the index below the trigger regardless of finger curl.
  R: basis(V(0, -.12, -1), V(1, 0, 0)),
  L: basis(V(1, 0, -.15), V(0, -1, 0)),
};
const gliderPalm = basis(V(0, 1, 0), V(0, 0, -1));

export async function loadSkinnedCharacter(options: { outlines?: boolean; load?: (url: string) => Promise<{ scene: THREE.Group }> } = {}) {
  const gltf = await (options.load ?? (url => new GLTFLoader().loadAsync(url)))(PLAYER_V2_URL);
  try { return buildSkinnedCharacter(gltf.scene, options); }
  catch (error) { disposePlayerObject(gltf.scene); throw error; }
}

/** Takes ownership of a freshly loaded/cloned scene; never installs a segmented-body fallback. */
export function buildSkinnedCharacter(model: THREE.Group, options: { outlines?: boolean } = {}): SkinnedCharacterRig {
  const root = new THREE.Group(); root.name = 'Explorer'; root.userData.dynamic = true;
  const assetFrame = new THREE.Group(); assetFrame.name = 'PlayerAssetFrame'; assetFrame.rotation.y = Math.PI;
  root.add(assetFrame); assetFrame.add(model);
  const bones: Record<string, THREE.Bone> = {}, meshes: THREE.Mesh[] = [];
  const materials = new Map<THREE.Material, THREE.Material>();
  const skeletons: THREE.Skeleton[] = [];
  model.traverse(object => {
    const bone = object as THREE.Bone;
    if (bone.isBone) bones[bone.name] = bone;
    const mesh = object as THREE.SkinnedMesh;
    if (!mesh.isMesh) return;
    if (!mesh.isSkinnedMesh) throw new Error(`Player v2 contains unskinned surface: ${mesh.name}`);
    for (const name of ['position', 'normal', 'skinIndex', 'skinWeight']) if (!mesh.geometry.hasAttribute(name)) throw new Error(`Missing ${name} on ${mesh.name}`);
    const old = mesh.material;
    const convert = (m: THREE.Material) => { if (!materials.has(m)) materials.set(m, preservePlayerMaterial(m)); return materials.get(m)!; };
    mesh.material = Array.isArray(old) ? old.map(convert) : convert(old);
    const common = skeletons.find(s => s.bones.length === mesh.skeleton.bones.length && s.bones.every((b, i) => b === mesh.skeleton.bones[i] && s.boneInverses[i].equals(mesh.skeleton.boneInverses[i])));
    if (common) mesh.skeleton = common; else skeletons.push(mesh.skeleton);
    mesh.castShadow = mesh.receiveShadow = true;
    // One local hero, with authored large poses. No costly per-frame CPU vertex bounds pass,
    // and no rest-pose frustum bug while a hand/head has moved outside the bind bounds.
    mesh.frustumCulled = false;
    mesh.userData.skinnedPlayer = true; meshes.push(mesh);
  });
  if (!meshes.length) throw new Error('Player v2 has no skinned surfaces');
  materials.forEach((_replacement, original) => original.dispose());
  const required = (name: string) => { const bone = bones[name]; if (!bone) throw new Error(`Player v2 bone missing: ${name}`); return bone; };
  const joints: Record<string, THREE.Object3D> = {
    Hips: required('J_Bip_C_Hips'), Spine: required('J_Bip_C_Spine'), Chest: required('J_Bip_C_Chest'),
    UpperChest: required('J_Bip_C_UpperChest'), Neck: required('J_Bip_C_Neck'), Head: required('J_Bip_C_Head'),
  };
  for (const side of ['R', 'L'] as const) for (const [alias, source] of [
    ['Shoulder', 'Shoulder'], ['Arm', 'UpperArm'], ['Forearm', 'LowerArm'], ['Hand', 'Hand'],
    ['Thigh', 'UpperLeg'], ['Shin', 'LowerLeg'], ['Foot', 'Foot'], ['Toe', 'ToeBase'],
  ]) joints[`${alias}_${side}`] = required(`J_Bip_${side}_${source}`);
  root.updateMatrixWorld(true);
  const rest = new Map<THREE.Bone, RestBone>();
  for (const bone of Object.values(bones)) rest.set(bone, {
    p: bone.position.clone(), q: bone.quaternion.clone(), s: bone.scale.clone(),
    rootQ: bone.getWorldQuaternion(Q()), rootP: bone.getWorldPosition(V()),
  });
  const handSockets = {} as Record<Side, THREE.Object3D>;
  for (const side of ['R', 'L'] as const) {
    const hand = joints[`Hand_${side}`] as THREE.Bone;
    const middle = required(`J_Bip_${side}_Middle1`);
    const handRest = rest.get(hand)!;
    const direction = rest.get(middle)!.rootP.clone().sub(handRest.rootP).normalize();
    const dorsal = V(0, 1, 0).addScaledVector(direction, -direction.y).normalize();
    const socket = new THREE.Group(); socket.name = side === 'R' ? 'GripSocket_R' : 'SupportSocket_L';
    socket.position.copy(direction).multiplyScalar(.048).addScaledVector(dorsal, -.012).applyQuaternion(handRest.rootQ.clone().invert());
    socket.quaternion.copy(handRest.rootQ).invert().multiply(basis(direction, dorsal));
    socket.userData.anatomicalSide = side; socket.userData.surface = 'palm'; hand.add(socket); handSockets[side] = socket;
  }
  const shoulderHeight = (rest.get(joints.Arm_R as THREE.Bone)!.rootP.y + rest.get(joints.Arm_L as THREE.Bone)!.rootP.y) / 2;
  const hipHeight = rest.get(joints.Hips as THREE.Bone)!.rootP.y;
  const gun = new THREE.Group(); gun.name = 'Gun'; root.add(gun); joints.Gun = gun;
  const glider = makePlayerGlider(); root.add(glider.root); joints.Glider = glider.root;
  glider.deploy(0, 0); meshes.push(...glider.meshes);
  const rig: SkinnedCharacterRig = {
    kind: 'skinned-v2', root, model, bones, joints, meshes, skeletons, rest, handSockets, glider, shoulderHeight, hipHeight,
    gunHold: { p: V(), q: Q().setFromEuler(new THREE.Euler(-.26, Math.PI, 0, 'YXZ')) },
    gunSling: { p: V(.08, 1.14, -.23), q: Q().setFromEuler(new THREE.Euler(-1.03, Math.PI, .45, 'YXZ')) },
    gunHands: { right: V(-.21, shoulderHeight - .13, .06), left: V(-.21, shoulderHeight - .15, .32) },
    gunAnchors: { grip: V(0, -.10, .07).multiplyScalar(DAWN_PHYSICAL_SCALE), support: V(0, -.04, -.2564).multiplyScalar(DAWN_PHYSICAL_SCALE) },
    weaponArt: { physicalScale: DAWN_PHYSICAL_SCALE, required: true },
    diagnostics: { armReachError: { R: 0, L: 0 }, mode: 'ready', disposed: false },
    dispose() { if (this.diagnostics.disposed) return; this.diagnostics.disposed = true; disposePlayerObject(root); },
  };
  if (options.outlines !== false) for (const mesh of [...meshes]) if ((mesh as THREE.SkinnedMesh).isSkinnedMesh && wantsPlayerOutline(mesh)) {
    addPlayerOutline(mesh as THREE.SkinnedMesh, /head|face|skin|hair/i.test(mesh.name) ? .0015 : .0025);
  }
  new SkinnedCharacterAnimator(rig).update(0, { speed: 0, onGround: true, swimming: false, vy: 0, moveYaw: null });
  return rig;
}

function applyLocalDelta(rig: SkinnedCharacterRig, bone: THREE.Bone, delta: THREE.Quaternion) {
  const rest = rig.rest.get(bone)!;
  // Express an anatomical/model-space delta in this imported bone's actual bind basis.
  const localDelta = rest.rootQ.clone().invert().multiply(delta).multiply(rest.rootQ);
  bone.quaternion.copy(rest.q).multiply(localDelta);
}
function setWorldQuaternion(bone: THREE.Object3D, world: THREE.Quaternion) {
  const parent = bone.parent?.getWorldQuaternion(Q()) ?? Q();
  bone.quaternion.copy(parent.invert().multiply(world)); bone.updateWorldMatrix(false, true);
}
function aimLink(bone: THREE.Bone, child: THREE.Bone, direction: THREE.Vector3) {
  const current = child.getWorldPosition(V()).sub(bone.getWorldPosition(V())).normalize();
  const q = Q().setFromUnitVectors(current, direction.clone().normalize()).multiply(bone.getWorldQuaternion(Q()));
  setWorldQuaternion(bone, q);
}

/** Actual elbow/wrist positions and bind axes; no .27/.28 metre or local −Y assumptions. */
export function solvePlayerArm(rig: SkinnedCharacterRig, side: Side, palmPoint: THREE.Vector3, palmOrientation: THREE.Quaternion) {
  const upper = rig.joints[`Arm_${side}`] as THREE.Bone, lower = rig.joints[`Forearm_${side}`] as THREE.Bone, hand = rig.joints[`Hand_${side}`] as THREE.Bone;
  const socket = rig.handSockets[side];
  const handQ = palmOrientation.clone().multiply(socket.quaternion.clone().invert());
  const target = palmPoint.clone().sub(socket.position.clone().applyQuaternion(handQ));
  const shoulder = upper.getWorldPosition(V());
  const length1 = rig.rest.get(upper)!.rootP.distanceTo(rig.rest.get(lower)!.rootP);
  const length2 = rig.rest.get(lower)!.rootP.distanceTo(rig.rest.get(hand)!.rootP);
  const delta = target.clone().sub(shoulder), requestedDistance = delta.length();
  const distance = THREE.MathUtils.clamp(requestedDistance, Math.abs(length1 - length2) + .0001, length1 + length2 - .0001);
  const axis = delta.normalize();
  const pole = V(side === 'R' ? -.65 : .65, -.8, -.14).applyQuaternion(rig.root.getWorldQuaternion(Q()));
  pole.addScaledVector(axis, -pole.dot(axis));
  if (pole.lengthSq() < 1e-8) pole.copy(V(0, 0, -1).applyQuaternion(rig.root.getWorldQuaternion(Q()))).addScaledVector(axis, -axis.z);
  pole.normalize();
  const along = (length1 * length1 - length2 * length2 + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, length1 * length1 - along * along));
  const elbow = shoulder.clone().addScaledVector(axis, along).addScaledVector(pole, height);
  aimLink(upper, lower, elbow.clone().sub(shoulder));
  const reachable = shoulder.clone().addScaledVector(axis, distance);
  aimLink(lower, hand, reachable.clone().sub(elbow));
  setWorldQuaternion(hand, handQ);
  rig.diagnostics.armReachError[side] = socket.getWorldPosition(V()).distanceTo(palmPoint);
}

export class SkinnedCharacterAnimator {
  facing = 0;
  private phase = 0; private time = 0; private air = 0; private glide = 0; private ready = 1; private bank = 0; private fireAim = 0;
  private lastState: PlayerAnimationState = { speed: 0, onGround: true, swimming: false, vy: 0, moveYaw: null };
  constructor(public rig: SkinnedCharacterRig) {}
  /** Match the actual targeting camera, even when input fires before RAF or after free-look. */
  prepareShot(look: THREE.Vector3) {
    if (!look.toArray().every(Number.isFinite) || look.lengthSq() < 1e-12) return;
    const direction = look.clone().normalize();
    const pitch = Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1));
    const lookYaw = Math.atan2(direction.x, direction.z);
    this.update(0, { ...this.lastState, pitch, lookYaw, firing: true });
  }
  update(dt: number, state: PlayerAnimationState) {
    if (this.rig.diagnostics.disposed) return;
    this.lastState = { ...state };
    dt = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .1) : 0;
    const rig = this.rig, J = rig.joints;
    const speed = Number.isFinite(state.speed) ? Math.max(0, state.speed) : 0;
    const ads = THREE.MathUtils.clamp(state.aim ?? 0, 0, 1), pitch = THREE.MathUtils.clamp(state.pitch ?? 0, -1.5, 1.5);
    // Shot presentation is independent of ADS input/FOV. Raise immediately for an eligible shot,
    // then ease back to low ready / the glider without inventing a firing cooldown or camera change.
    this.fireAim = state.firing ? 1 : THREE.MathUtils.damp(this.fireAim, 0, 8, dt);
    const aim = Math.max(ads, this.fireAim);
    const extreme = THREE.MathUtils.smoothstep(Math.abs(pitch), .65, 1.30);
    const previousFacing = this.facing;
    if (state.firing && Number.isFinite(state.lookYaw)) {
      // dt=0 must still align an input-event shot. A 12*dt movement lerp would leave it sideways.
      this.facing += Math.atan2(Math.sin(state.lookYaw! - this.facing), Math.cos(state.lookYaw! - this.facing));
    } else if (state.moveYaw !== null && Number.isFinite(state.moveYaw)) {
      const delta = Math.atan2(Math.sin(state.moveYaw - this.facing), Math.cos(state.moveYaw - this.facing));
      this.facing += delta * Math.min(1, dt * 12);
    }
    rig.root.rotation.y = this.facing;
    this.time += dt; this.phase += dt * (4 + speed * 1.25);
    this.air = THREE.MathUtils.damp(this.air, state.onGround || state.swimming ? 0 : 1, 10, dt);
    this.glide = THREE.MathUtils.damp(this.glide, state.gliding ? 1 : 0, state.gliding ? 7 : 4, dt);
    const needsRifle = !state.swimming && !state.gliding || ads > .001 || !!state.firing;
    // Existing gameplay permits firing while swimming/gliding. The first shot cannot wait for an
    // invented draw cooldown or come from a back-slung rifle: immediate contact pose on fire.
    this.ready = state.firing ? 1 : THREE.MathUtils.damp(this.ready, needsRifle ? 1 : 0, 3.5, dt);
    const turnRate = dt > 0 ? (this.facing - previousFacing) / dt : 0;
    this.bank = THREE.MathUtils.damp(this.bank, state.gliding ? THREE.MathUtils.clamp(-turnRate * .045, -.12, .12) : 0, 5, dt);
    const g = this.glide, r = this.ready, run = THREE.MathUtils.clamp(speed / 9, 0, 1), move = THREE.MathUtils.clamp(speed / 2, 0, 1), swing = Math.sin(this.phase);
    for (const [bone, rest] of rig.rest) { bone.position.copy(rest.p); bone.quaternion.copy(rest.q); bone.scale.copy(rest.s); }
    const rotation = (name: string, x: number, y = 0, z = 0) => applyLocalDelta(rig, J[name] as THREE.Bone, Q().setFromEuler(new THREE.Euler(x, y, z)));
    const hip = J.Hips as THREE.Bone, hipRest = rig.rest.get(hip)!;
    const hipOffset = V(0, Math.abs(Math.cos(this.phase)) * .025 * move * (1 - g) - .015 * run + Math.sin(this.time * 2.2) * .004 * (1 - move) - (state.swimming ? .45 : 0), 0);
    const parentRestQ = hip.parent ? hip.parent.getWorldQuaternion(Q()) : Q();
    const rootQ = rig.root.getWorldQuaternion(Q());
    hip.position.copy(hipRest.p).add(hipOffset.applyQuaternion(rootQ).applyQuaternion(parentRestQ.invert()));
    const bodyLean = (run * .15 * (1 - aim) * (1 - g)) + (state.swimming ? .65 : 0) + g * .17;
    rotation('Hips', 0, -swing * .035 * move * (1 - aim) * (1 - g), this.bank * .25);
    rotation('Spine', bodyLean * .25, swing * .025 * move * (1 - aim));
    rotation('Chest', bodyLean * .35);
    rotation('UpperChest', bodyLean * .40);
    // A small real clavicle protraction keeps the support arm reachable at steep cross-body aim.
    rotation('Shoulder_L', 0, -(.24 + .08 * aim * extreme) * r);
    rotation('Shoulder_R', 0, .05 * r);
    // Camera may look almost vertically; a human neck must not inherit that entire rotation.
    rotation('Neck', -bodyLean * .30 + THREE.MathUtils.clamp(-pitch * .18, -.20, .20) * aim);
    rotation('Head', -bodyLean * .55 + THREE.MathUtils.clamp(-pitch * .55, -.65, .65) * aim + Math.sin(this.time * 1.1) * .008 * (1 - aim));
    const thighAngles: Record<Side, number> = { R: 0, L: 0 };
    for (const [side, sign] of [['L', 1], ['R', -1]] as const) {
      const phase = this.phase + (side === 'L' ? 0 : Math.PI);
      let thigh = -Math.sin(phase) * (.32 + run * .45) * move - this.air * .38;
      let knee = Math.max(0, Math.sin(phase + .9)) * (.25 + run * .8) * move + this.air * .65;
      if (state.swimming) { thigh = Math.sin(this.time * 4 + sign) * .28; knee = .30 + Math.sin(this.time * 4 + sign + .5) * .15; }
      thigh = THREE.MathUtils.lerp(thigh, .23 + Math.sin(this.time * 2.5 + sign) * .025, g);
      knee = THREE.MathUtils.lerp(knee, .43 + Math.sin(this.time * 2.5 + sign) * .025, g);
      thighAngles[side] = thigh;
      rotation(`Thigh_${side}`, thigh, 0, sign * .025 * g);
      rotation(`Shin_${side}`, knee);
      rotation(`Foot_${side}`, -.10 * g - knee * .13);
      rotation(`Toe_${side}`, -.035 * g);
    }
    // Bone-driven uniform, immutable vertex buffers. Missing optional panel bones are harmless.
    for (const bone of Object.values(rig.bones)) if (/^Uniform(Front|Back)/.test(bone.name)) {
      const isRight = /_R/.test(bone.name), isBack = /Back/.test(bone.name), tip = /Tip|tip|2/.test(bone.name);
      // Source Blender +X/front maps to canonical −X after the proper Yπ conversion.
      // Front panels clear only forward thighs; rear panels clear only trailing thighs.
      const thigh = thighAngles[isRight ? 'R' : 'L'];
      const follow = isBack ? Math.max(0, thigh) : Math.min(0, thigh);
      const secondary = Math.sin(this.time * 4 + (isRight ? 1 : 0)) * .008 * move;
      // Artist-tested chain response: a 35° forward thigh needs ~26° panel base and −6°
      // tip counter-bend, preserving a hanging hem instead of a rigid upward flap.
      const panelGain = tip ? -.17 : isBack ? .68 : .75;
      applyLocalDelta(rig, bone, Q().setFromAxisAngle(V(1, 0, 0), THREE.MathUtils.clamp(follow * panelGain + g * (isBack ? .035 : -.02) + secondary, -.84, .78)));
    }
    rig.glider.deploy(g, this.bank);
    rig.root.updateMatrixWorld(true);
    const qReady = rig.gunHold.q;
    const qAim = Q().setFromEuler(new THREE.Euler(pitch, Math.PI, 0, 'YXZ'));
    const gunQ = qReady.clone().slerp(qAim, aim);
    const shoulderY = (J.Arm_R.getWorldPosition(V()).y + J.Arm_L.getWorldPosition(V()).y) / 2 - rig.root.position.y;
    const readyGrip = V(-.21, shoulderY - .13, .06);
    // At steep angles the stock/barrel rotates past the face. Move the complete gun outside the
    // head silhouette, not through it; camera range, barrel direction and rifle size stay intact.
    const aimGrip = V(-.21 - .025 * extreme, shoulderY - .10 + Math.max(0, -Math.sin(pitch)) * .12, .10 + .04 * extreme);
    const grip = readyGrip.lerp(aimGrip, aim);
    const holdPosition = grip.clone().sub(rig.gunAnchors.grip.clone().applyQuaternion(gunQ));
    rig.gunHold.p.copy(holdPosition);
    const mountWeight = THREE.MathUtils.smoothstep(r, .05, .50);
    J.Gun.position.lerpVectors(rig.gunSling.p, holdPosition, mountWeight);
    J.Gun.quaternion.slerpQuaternions(rig.gunSling.q, gunQ, mountWeight);
    rig.root.updateMatrixWorld(true);
    const heldGunWorldQ = rootQ.clone().multiply(gunQ), gliderWorldQ = J.Glider.getWorldQuaternion(Q());
    const handGunWeight = THREE.MathUtils.smoothstep(r, .20, .95);
    for (const [side, sign] of [['R', -1], ['L', 1]] as const) {
      const freePoint = V(sign * .25, .99, .04);
      if (state.swimming) freePoint.set(sign * (.22 + Math.cos(this.time * 3.3 + sign) * .10), shoulderY - .20 + Math.sin(this.time * 3.3 + sign) * .10, .24 + Math.cos(this.time * 3.3 + sign) * .16);
      const palmPoint = rig.root.localToWorld(freePoint);
      const freePalm = state.swimming ? basis(V(sign * .15, -.12, 1), V(0, 1, .12)) : basis(V(0, -1, 0), V(sign, 0, 0));
      const handQ = rootQ.clone().multiply(freePalm);
      // While the frame is still deployed, transfer directly between its real grips and the
      // forward held-rifle pose. Never chase the gun through its back-sling path with a hand.
      const glideContact = g > .02 ? 1 : g / .02;
      palmPoint.lerp(rig.glider.grips[side].getWorldPosition(V()), glideContact);
      handQ.slerp(gliderWorldQ.clone().multiply(gliderPalm), glideContact);
      const anchor = side === 'R' ? rig.gunAnchors.grip : rig.gunAnchors.support;
      const heldAnchor = anchor.clone().applyQuaternion(gunQ).add(holdPosition);
      palmPoint.lerp(rig.root.localToWorld(heldAnchor), handGunWeight);
      handQ.slerp(heldGunWorldQ.clone().multiply(gunPalm[side]), handGunWeight);
      solvePlayerArm(rig, side, palmPoint, handQ);
      this.poseFingers(side, handGunWeight, glideContact * (1 - handGunWeight));
    }
    rig.diagnostics.mode = r > .99 ? aim > .5 ? 'aim' : 'ready' : g > .99 && r < .01 ? 'glide' : state.swimming ? 'swim' : 'transition';
    rig.root.updateMatrixWorld(true);
    rig.skeletons.forEach(s => s.update());
  }
  private poseFingers(side: Side, rifle: number, glide: number) {
    const rig = this.rig;
    const hand = rig.joints[`Hand_${side}`] as THREE.Bone;
    const handRest = rig.rest.get(hand)!;
    const middle = rig.bones[`J_Bip_${side}_Middle1`];
    const distal = rig.rest.get(middle)!.rootP.clone().sub(handRest.rootP).normalize();
    const curlAxis = distal.clone().cross(V(0, 1, 0)).negate().normalize();
    for (const finger of ['Index', 'Middle', 'Ring', 'Little', 'Thumb']) for (let segment = 1; segment <= 3; segment++) {
      const bone = rig.bones[`J_Bip_${side}_${finger}${segment}`]; if (!bone) continue;
      const rest = rig.rest.get(bone)!;
      const base = [.12, .18, .12][segment - 1];
      const gun = finger === 'Thumb' ? [.50, .75, .55][segment - 1] : side === 'R' && finger === 'Index' ? [.32, .60, .40][segment - 1] : [.72, 1.05, .68][segment - 1];
      const hang = finger === 'Thumb' ? [.60, .85, .60][segment - 1] : [.82, 1.15, .72][segment - 1];
      const angle = base + (gun - base) * rifle + (hang - base) * glide;
      const axis = curlAxis.clone().applyQuaternion(rest.rootQ.clone().invert());
      bone.quaternion.copy(rest.q).multiply(Q().setFromAxisAngle(axis, angle));
      if (finger === 'Thumb' && segment === 1) {
        // Thumb CMC opposition/adduction has a different axis from finger flexion. The original
        // thumb points sideways in the T-pose; more ordinary finger curl alone leaves it abducted.
        const oppositionAxis = V(0, 1, 0).applyQuaternion(rest.rootQ.clone().invert());
        const opposition = (side === 'R' ? -1 : 1) * (.10 + .65 * rifle + .75 * glide);
        bone.quaternion.multiply(Q().setFromAxisAngle(oppositionAxis, opposition));
      }
    }
  }
}
