/** Formal deform rig. The game owns feet position/yaw; the asset owns bind pose, UVs and anatomy. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { addPlayerOutline, disposePlayerObject, preservePlayerMaterial, wantsPlayerOutline } from './playerMaterials';
import { makePlayerGlider, type GliderEquipment } from './playerEquipment';
import { PlayerInertia } from './playerInertia';
import { advancePlayerStride, playerStride, samplePlayerFoot, posePlayerGroundLeg } from './playerLocomotion';

export const PLAYER_V2_URL = new URL('../../assets/characters/player_v2/player_v2.glb', import.meta.url).href;
export const DAWN_PHYSICAL_SCALE = .7873802602519613;
type Side = 'R' | 'L';
export interface PlayerAnimationState {
  speed: number; onGround: boolean; swimming: boolean; vy: number; moveYaw: number | null;
  flying?: boolean; gliding?: boolean; aim?: number; pitch?: number; firing?: boolean;
  /** Progression ownership, not a load-state flag; omitted preserves equipped callers. */
  armed?: boolean;
  /** World-space view heading (+Z forward), used only while firing; never changes the camera. */
  lookYaw?: number;
  /** Contact-timed melee overlay, root owns combat and input. */
  melee?: { phase: number; combo: number; yaw: number };
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
// Opening keeps its gentle damping; closing has a finite, interruptible travel budget.
// Share it with rifle recovery so hands finish transferring before the frame disappears.
const GLIDER_STOW_SECONDS = .34;

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
export function solvePlayerArm(rig: SkinnedCharacterRig, side: Side, palmPoint: THREE.Vector3, palmOrientation: THREE.Quaternion, relaxed = 0, neutralWrist = 0, gripAlignment = 0, bladeDirection?: THREE.Vector3) {
  const upper = rig.joints[`Arm_${side}`] as THREE.Bone, lower = rig.joints[`Forearm_${side}`] as THREE.Bone, hand = rig.joints[`Hand_${side}`] as THREE.Bone;
  const socket = rig.handSockets[side];
  const handRest = rig.rest.get(hand)!, lowerRest = rig.rest.get(lower)!;
  const shoulder = upper.getWorldPosition(V());
  const length1 = rig.rest.get(upper)!.rootP.distanceTo(lowerRest.rootP);
  const length2 = lowerRest.rootP.distanceTo(handRest.rootP);
  const sign = side === 'R' ? -1 : 1;
  const rootQ = rig.root.getWorldQuaternion(Q());
  const originalPalm = palmOrientation.clone(), resolvedPalm = originalPalm.clone();
  const freeDorsal = V(sign, 0, 0).applyQuaternion(rootQ);
  let handQ = Q(), elbow = V(), reachable = V();
  const solve = () => {
    handQ = resolvedPalm.clone().multiply(socket.quaternion.clone().invert());
    const target = palmPoint.clone().sub(socket.position.clone().applyQuaternion(handQ));
    const delta = target.sub(shoulder), requestedDistance = delta.length();
    const distance = THREE.MathUtils.clamp(requestedDistance, Math.abs(length1 - length2) + .0001, length1 + length2 - .0001);
    const axis = delta.normalize();
    // Transport an outward reference around the reach axis. Interpolating two raw
    // downward poles can pass through that axis and flip the elbow at partial ADS.
    const pole = V(sign, 0, 0).applyQuaternion(rootQ);
    pole.addScaledVector(axis, -pole.dot(axis));
    if (pole.lengthSq() < 1e-8) {
      pole.copy(V(0, 0, 1).applyQuaternion(rootQ)); pole.addScaledVector(axis, -pole.dot(axis));
    }
    // The elbow stays posterior to the shoulder–wrist line during free swing;
    // the forearm (not the elbow point) flexes forward. A held carry stays outside the stock with
    // comfortable wrist flex rather than forcing a straight line through its frame.
    pole.normalize().applyAxisAngle(axis, sign * (-.9 - .45 * relaxed * (1 - gripAlignment) - .80 * relaxed * gripAlignment));
    if (gripAlignment > 0) {
      // Select the elbow around its IK circle with the grip's metacarpal direction in
      // mind. A positional-only pole can keep the palm attached but kink the wrist.
      const gripPole = V(-1, 0, 0).applyQuaternion(resolvedPalm);
      gripPole.addScaledVector(axis, -gripPole.dot(axis));
      if (gripPole.lengthSq() > 1e-8) {
        gripPole.normalize();
        const turn = Math.atan2(axis.dot(pole.clone().cross(gripPole)), pole.dot(gripPole));
        pole.applyAxisAngle(axis, Math.sin(turn) * .65 * gripAlignment * (1 - relaxed));
      }
    }
    const along = (length1 * length1 - length2 * length2 + distance * distance) / (2 * distance);
    const height = Math.sqrt(Math.max(0, length1 * length1 - along * along));
    elbow = shoulder.clone().addScaledVector(axis, along).addScaledVector(pole, height);
    reachable = shoulder.clone().addScaledVector(axis, distance);
  };
  // A free hand continues the solved forearm, not a world-down pendulum. The palm
  // socket is offset from the wrist, so close this small IK/orientation coupling before
  // posing bones. Equipment orientation still owns every fully contacted hand.
  for (let i = 0; i < (neutralWrist > 0 ? 5 : 1); i++) {
    solve();
    if (neutralWrist > 0) {
      const distal = reachable.clone().sub(elbow).normalize();
      const dorsal = bladeDirection
        ? bladeDirection.clone().cross(distal).normalize()
        : freeDorsal.clone().addScaledVector(distal, -freeDorsal.dot(distal)).normalize();
      // Free hands use 4° palmar flexion; sword grip uses 11.5° controlled ulnar
      // deviation. Neither inherits the former 32–44° wrist kink.
      const relaxedAxis = bladeDirection
        ? distal.clone().multiplyScalar(Math.cos(.20)).addScaledVector(distal.clone().cross(dorsal).normalize(), -Math.sin(.20))
        : distal.clone().multiplyScalar(Math.cos(.07)).addScaledVector(dorsal, -Math.sin(.07));
      resolvedPalm.copy(originalPalm).slerp(basis(relaxedAxis, dorsal), neutralWrist);
    }
  }
  solve();
  aimLink(upper, lower, elbow.clone().sub(shoulder));
  aimLink(lower, hand, reachable.clone().sub(elbow));
  const forearmAxis = reachable.clone().sub(elbow).normalize();
  const bindDorsal = V(0, 1, 0).applyQuaternion(handRest.rootQ.clone().multiply(socket.quaternion))
    .applyQuaternion(lowerRest.rootQ.clone().invert());
  const desiredDorsal = V(0, 1, 0).applyQuaternion(resolvedPalm);
  const rollError = () => {
    const from = bindDorsal.clone().applyQuaternion(lower.getWorldQuaternion(Q()));
    from.addScaledVector(forearmAxis, -from.dot(forearmAxis)).normalize();
    const to = desiredDorsal.clone().addScaledVector(forearmAxis, -desiredDorsal.dot(forearmAxis)).normalize();
    return Math.atan2(forearmAxis.dot(from.clone().cross(to)), from.dot(to));
  };
  // Upper-arm twist is owned by the anatomical elbow hinge, not wrist roll.
  // In the imported T-pose the front (+Z in character space) is the biceps/flexion
  // side of BOTH mirrored arms. Transport that authored direction into the solved
  // upper-arm plane, then align it to positive forearm flexion. Pronation remains
  // in the lower arm, so palm contact does not invert the elbow/sleeve anatomy.
  const upperAxis = elbow.clone().sub(shoulder).normalize();
  const bindFlex = V(0, 0, 1).applyQuaternion(rig.rest.get(upper)!.rootQ.clone().invert());
  const flexFrom = bindFlex.applyQuaternion(upper.getWorldQuaternion(Q()));
  flexFrom.addScaledVector(upperAxis, -flexFrom.dot(upperAxis)).normalize();
  const flexTo = forearmAxis.clone().addScaledVector(upperAxis, -forearmAxis.dot(upperAxis)).normalize();
  const hingeRoll = Math.atan2(upperAxis.dot(flexFrom.clone().cross(flexTo)), flexFrom.dot(flexTo));
  setWorldQuaternion(upper, Q().setFromAxisAngle(upperAxis, hingeRoll).multiply(upper.getWorldQuaternion(Q())));
  aimLink(lower, hand, forearmAxis);
  setWorldQuaternion(lower, Q().setFromAxisAngle(forearmAxis, rollError()).multiply(lower.getWorldQuaternion(Q())));
  setWorldQuaternion(hand, handQ);
  rig.diagnostics.armReachError[side] = socket.getWorldPosition(V()).distanceTo(palmPoint);
}

export class SkinnedCharacterAnimator {
  facing = 0;
  private phase = 0; private time = 0; private air = 0; private glide = 0; private ready = 1; private bank = 0; private fireAim = 0; private adsPose = 0; private carry = 0; private strideSpeed = 0;
  private jumpLead = 1;
  private readonly inertia = new PlayerInertia();
  private readonly inertiaInput = { onGround: true, swimming: false, gliding: false, flying: false, vy: 0, speed: 0, turnRate: 0, turnDecay: 12, lockedUpperBody: false };
  private meleePose: PlayerAnimationState['melee'];
  private meleeRelease = 0;
  private lastState: PlayerAnimationState = { speed: 0, onGround: true, swimming: false, vy: 0, moveYaw: null };
  constructor(public rig: SkinnedCharacterRig) {}
  /** Full new-game/reset boundary, not a normal equipment/locomotion transition. */
  reset(armed = true, facing = 0) {
    this.phase = this.time = this.air = this.glide = this.bank = this.fireAim = this.adsPose = this.carry = this.strideSpeed = 0;
    this.inertia.reset();this.jumpLead=1;
    this.ready = armed ? 1 : 0; this.facing = facing; this.meleePose = undefined; this.meleeRelease = 0;
    this.update(0, { speed: 0, onGround: true, swimming: false, vy: 0, moveYaw: null, armed });
  }
  /** Match the actual targeting camera, even when input fires before RAF or after free-look. */
  prepareShot(look: THREE.Vector3) {
    if (!look.toArray().every(Number.isFinite) || look.lengthSq() < 1e-12) return;
    const direction = look.clone().normalize();
    const pitch = Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1));
    const lookYaw = Math.atan2(direction.x, direction.z);
    this.update(0, { ...this.lastState, melee: undefined, pitch, lookYaw, firing: true });
  }
  update(dt: number, state: PlayerAnimationState) {
    if (this.rig.diagnostics.disposed) return;
    this.lastState = { ...state };
    dt = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .1) : 0;
    const rig = this.rig, J = rig.joints;
    const armed = state.armed !== false, firing = armed && !!state.firing && !state.melee;
    if (state.melee) { this.meleePose = { ...state.melee }; this.meleeRelease = state.melee.combo > 0 ? 1 : THREE.MathUtils.clamp(state.melee.phase / .18, 0, 1); }
    else { this.meleeRelease = Math.max(0, this.meleeRelease - dt / .18); }
    // A real shot / glider / swim immediately owns its original pose. Ordinary recovery
    // transfers back over 180ms, instead of popping the hands back to the rifle.
    if (firing || state.gliding || state.swimming) this.meleeRelease = 0;
    const meleePose = state.melee ?? (this.meleeRelease > 0 ? this.meleePose : undefined);
    const meleePhase = meleePose ? THREE.MathUtils.clamp(meleePose.phase, 0, 1) : 0;
    const meleeCut = meleePose?.combo ?? 0;
    // Keep the grip through queued beat boundaries: cut 0 ends where cut 1 starts.
    const meleeWeight = meleePose ? state.melee ? meleeCut > 0 ? 1 : Math.min(1, meleePhase / .18) : this.meleeRelease : 0;
    const meleeStroke = THREE.MathUtils.smoothstep(meleePhase, meleeCut === 2 ? .20 : .18, meleeCut === 2 ? .52 : .55);
    rig.root.userData.meleeGripReady = meleeWeight > .98;
    J.Gun.visible = armed;
    const speed = Number.isFinite(state.speed) ? Math.max(0, state.speed) : 0;
    // Filter visual gait only; starts/stops must not jerk the shoulders/held weapon while
    // the actual player controller keeps its existing immediate movement response.
    const stride = advancePlayerStride(this.strideSpeed, speed, dt);
    this.strideSpeed = stride.speed;
    const ads = armed && Number.isFinite(state.aim) ? THREE.MathUtils.clamp(state.aim!, 0, 1) : 0;
    const pitch = Number.isFinite(state.pitch) ? THREE.MathUtils.clamp(state.pitch!, -1.5, 1.5) : 0;
    // Shot presentation is independent of ADS input/FOV. Raise immediately for an eligible shot,
    // then ease back to low ready / the glider without inventing a firing cooldown or camera change.
    this.fireAim = !armed ? 0 : firing ? 1 : THREE.MathUtils.damp(this.fireAim, 0, 8, dt);
    // Visual shoulder/hand easing only. The actual ADS value/FOV stays in ShoulderAim;
    // prepareShot/fire still overrides this immediately before the real muzzle is queried.
    this.adsPose = !armed ? 0 : THREE.MathUtils.damp(this.adsPose, ads, 14, dt);
    const aim = Math.max(this.adsPose, this.fireAim);
    const extreme = THREE.MathUtils.smoothstep(Math.abs(pitch), .65, 1.30);
    const previousFacing = this.facing;
    if (state.melee && Number.isFinite(state.melee.yaw)) {
      this.facing = state.melee.yaw;
    } else if (firing && Number.isFinite(state.lookYaw)) {
      // dt=0 must still align an input-event shot. A 12*dt movement lerp would leave it sideways.
      this.facing += Math.atan2(Math.sin(state.lookYaw! - this.facing), Math.cos(state.lookYaw! - this.facing));
    } else if (state.moveYaw !== null && Number.isFinite(state.moveYaw)) {
      const delta = Math.atan2(Math.sin(state.moveYaw - this.facing), Math.cos(state.moveYaw - this.facing));
      this.facing += delta * (1 - Math.exp(-12 * dt));
    }
    rig.root.rotation.y = this.facing;
    this.time += dt;
    // No hidden idle treadmill: stop the stride phase as visual speed settles.
    this.phase += stride.phase;
    if(state.onGround&&!state.swimming)this.jumpLead=Math.cos(this.phase)>=0?1:-1;
    this.air = THREE.MathUtils.damp(this.air, state.onGround || state.swimming ? 0 : 1, 10, dt);
    const stowing = !state.gliding && this.glide > 0;
    this.glide = state.gliding ? THREE.MathUtils.damp(this.glide, 1, 7, dt)
      : Math.max(0, this.glide - dt / GLIDER_STOW_SECONDS);
    const needsRifle = armed && (!state.swimming && !state.gliding || ads > .001 || firing);
    // Existing gameplay permits firing while swimming/gliding. The first shot cannot wait for an
    // invented draw cooldown or come from a back-slung rifle: immediate contact pose on fire.
    this.ready = !armed ? 0 : firing ? 1 : stowing && needsRifle
      ? Math.min(1, this.ready + dt / GLIDER_STOW_SECONDS)
      : THREE.MathUtils.damp(this.ready, needsRifle ? 1 : 0, 3.5, dt);
    const turnRate = dt > 0 ? (this.facing - previousFacing) / dt : 0;
    const inertiaInput=this.inertiaInput;inertiaInput.onGround=state.onGround;inertiaInput.swimming=state.swimming;
    inertiaInput.gliding=!!state.gliding;inertiaInput.flying=!!state.flying;inertiaInput.vy=state.vy;
    inertiaInput.speed=speed;inertiaInput.turnRate=turnRate;inertiaInput.lockedUpperBody=firing || ads > .001 || meleeWeight > 0;
    const weightTransfer = this.inertia.update(dt, inertiaInput);
    this.bank = THREE.MathUtils.damp(this.bank, state.gliding ? THREE.MathUtils.clamp(-turnRate * .045, -.12, .12) : 0, 5, dt);
    const g = this.glide, r = this.ready, run = THREE.MathUtils.clamp(this.strideSpeed / 9, 0, 1), move = THREE.MathUtils.clamp(this.strideSpeed / 2, 0, 1), swing = Math.sin(this.phase);
    const carryTarget = state.onGround && !state.swimming && !state.gliding ? THREE.MathUtils.clamp(speed / 2, 0, 1) * (1 - aim) : 0;
    this.carry = aim >= .999 ? 0 : THREE.MathUtils.damp(this.carry, carryTarget, 6, dt);
    // Ordinary travel is a one-handed muzzle-down carry, not a shouldered combat stance.
    // ADS blends back to two hands; firing takes ownership immediately, including
    // prepareShot's dt=0 input-event path. Neither changes camera or combat timing.
    const carry = this.carry * (1 - g);
    for (const [bone, rest] of rig.rest) { bone.position.copy(rest.p); bone.quaternion.copy(rest.q); bone.scale.copy(rest.s); }
    const rotation = (name: string, x: number, y = 0, z = 0) => applyLocalDelta(rig, J[name] as THREE.Bone, Q().setFromEuler(new THREE.Euler(x, y, z)));
    const hip = J.Hips as THREE.Bone, hipRest = rig.rest.get(hip)!;
    const hipOffset = V(0, (-.045 + Math.cos(this.phase * 2) * .008) * move * (1 - this.air) * (1 - g) + Math.sin(this.time * 2.2) * .004 * (1 - move) - (state.swimming ? .45 : 0), 0);
    // The pelvis loads over planted feet; no root/controller translation and no altered
    // foot targets. Existing leg IK supplies real knee flexion instead of sliding shoes.
    const meleeGround = meleeWeight * (1 - this.air) * (1 - g) * (state.swimming ? 0 : 1) * (1 - move * .3);
    const heavy = meleeCut === 2;
    const heavyBlend = heavy ? THREE.MathUtils.smoothstep(meleePhase, 0, .18) : 0;
    const load = Math.sin(Math.PI * THREE.MathUtils.clamp(meleePhase / .82, 0, 1));
    // The support legs absorb a measured landing; root/capsule height is untouched.
    hipOffset.y -= weightTransfer.compression * (1 - g) * (1 - meleeWeight);
    hipOffset.x += weightTransfer.turn * .16 * (1 - this.air);
    hipOffset.y -= meleeGround * (.035 + heavyBlend * .02 + load * (.04 + heavyBlend * .025));
    hipOffset.x += meleeGround * (meleeStroke - .5) * (.06 - heavyBlend * .035) * (meleeCut === 1 ? -1 : 1);
    hipOffset.z += meleeGround * (.015 + Math.sin(meleeStroke * Math.PI) * (heavy ? .035 : .02));
    const meleeTwist = meleeGround * (meleeStroke - .5) * (.62 - heavyBlend * .38) * (meleeCut === 1 ? -1 : 1);
    const meleeLean = meleeGround * (heavy ? THREE.MathUtils.lerp(.065, -.06 + meleeStroke * .30, heavyBlend) : .065 + Math.sin(meleeStroke * Math.PI) * .055);
    const parentRestQ = hip.parent ? hip.parent.getWorldQuaternion(Q()) : Q();
    const rootQ = rig.root.getWorldQuaternion(Q());
    hip.position.copy(hipRest.p).add(hipOffset.applyQuaternion(rootQ).applyQuaternion(parentRestQ.invert()));
    const bodyLean = (run * .15 * (1 - aim) * (1 - g)) + (state.swimming ? .65 : 0) + g * .17
      + (weightTransfer.compression * 1.3 + (weightTransfer.descent * .035 + weightTransfer.gather * .06) * this.air) * (1 - aim) * (1 - g);
    rotation('Hips', meleeLean * .2, -swing * .035 * move * (1 - aim) * (1 - g) + meleeTwist * .35, this.bank * .25 - weightTransfer.turn * .35);
    rotation('Spine', bodyLean * .25 + meleeLean * .25, swing * .025 * move * (1 - aim) + meleeTwist * .2, -weightTransfer.turn * .3);
    rotation('Chest', bodyLean * .35 + meleeLean * .35, meleeTwist * .5, -weightTransfer.turn * .35);
    rotation('UpperChest', bodyLean * .40 + meleeLean * .2, meleeTwist * .15);
    // A small real clavicle protraction keeps the support arm reachable at steep cross-body aim.
    rotation('Shoulder_L', 0, -(.24 + .08 * aim * extreme) * r * (1 - carry) + Math.cos(this.phase) * .025 * move * (armed ? carry : 1 - g));
    rotation('Shoulder_R', 0, .05 * r * (1 - carry) + Math.cos(this.phase) * .025 * move * (!armed ? 1 - g : 0));
    // Camera may look almost vertically; a human neck must not inherit that entire rotation.
    rotation('Neck', -bodyLean * .30 - meleeLean * .25 + THREE.MathUtils.clamp(-pitch * .18, -.20, .20) * aim);
    rotation('Head', -bodyLean * .55 - meleeLean * .4 + THREE.MathUtils.clamp(-pitch * .55, -.65, .65) * aim + Math.sin(this.time * 1.1) * .008 * (1 - aim), 0, weightTransfer.turn * .55);
    const thighAngles: Record<Side, number> = { R: 0, L: 0 };
    for (const [side, sign] of [['L', 1], ['R', -1]] as const) {
      const phase = this.phase + (side === 'L' ? 0 : Math.PI);
      // Supported gait owns the alternating foot cycle. Once airborne, continuing
      // that treadmill causes bicycle legs; gather the takeoff-leading knee instead,
      // then extend toward contact according to measured vertical velocity.
      const airBlend=state.flying?0:this.air,leading=sign===this.jumpLead;
      const airThigh=-.16-weightTransfer.gather*(leading?.46:.20)+weightTransfer.descent*.07;
      const airKnee=.38+weightTransfer.gather*(leading?.66:.34)-weightTransfer.descent*.14;
      let thigh=THREE.MathUtils.lerp(-Math.sin(phase)*(.32+run*.45)*move,airThigh,airBlend);
      let knee=THREE.MathUtils.lerp(Math.max(0,Math.sin(phase+.9))*(.25+run*.8)*move,airKnee,airBlend);
      if(state.flying){thigh-=this.air*.38;knee+=this.air*.65;}
      if (state.swimming) { thigh = Math.sin(this.time * 4 + sign) * .28; knee = .30 + Math.sin(this.time * 4 + sign + .5) * .15; }
      thigh = THREE.MathUtils.lerp(thigh, .23 + Math.sin(this.time * 2.5 + sign) * .025, g);
      knee = THREE.MathUtils.lerp(knee, .43 + Math.sin(this.time * 2.5 + sign) * .025, g);
      thighAngles[side] = thigh;
      rotation(`Thigh_${side}`, thigh, 0, sign * .025 * g);
      rotation(`Shin_${side}`, knee);
      rotation(`Foot_${side}`, -.10 * g - knee * .13 + airBlend * (weightTransfer.ascent * (leading?.18:.25) - weightTransfer.descent*.04));
      rotation(`Toe_${side}`, -.035 * g);
    }
    rig.root.updateMatrixWorld(true);
    // Solve planted feet from the imported limb lengths rather than assuming generic bones.
    // Airborne/jump/glider poses still own the legs as the grounded weight fades out.
    // A confirmed support contact owns the feet immediately: easing an airborne leg
    // beneath a landing-compressed pelvis would put the soles through the floor.
    const groundWeight = state.swimming ? 0 : state.onGround ? 1 : (1 - this.air) * (1 - g);
    for (const side of ['L', 'R'] as const) {
      const foot = J[`Foot_${side}`] as THREE.Bone;
      const sample = samplePlayerFoot(this.phase + (side === 'R' ? Math.PI : 0), this.strideSpeed);
      const target = rig.rest.get(foot)!.rootP.clone();
      target.z += sample.z * move; target.y += sample.y * move;
      posePlayerGroundLeg(rig, side, target, groundWeight, sample.swing * move);
      // Cloth follows the solved thigh, not the superseded airborne sinusoid.
      const thigh = J[`Thigh_${side}`].getWorldPosition(V()), knee = J[`Shin_${side}`].getWorldPosition(V());
      const direction = knee.sub(thigh).applyQuaternion(rootQ.clone().invert());
      thighAngles[side] = THREE.MathUtils.lerp(thighAngles[side], Math.atan2(-direction.z, -direction.y), groundWeight);
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
    // Cant the receiver away from the sleeve and point the barrel outside the leading knee.
    const qCarry = Q().setFromEuler(new THREE.Euler(-1.08 + swing * .025, Math.PI - .40, -.65, 'YXZ'));
    const gunQ = qReady.clone().slerp(qCarry, carry).slerp(qAim, aim);
    const shoulderY = (J.Arm_R.getWorldPosition(V()).y + J.Arm_L.getWorldPosition(V()).y) / 2 - rig.root.position.y;
    const readyGrip = V(-.21, shoulderY - .13, .06);
    const carryGrip = V(-.30 + Math.cos(this.phase) * .006, shoulderY - .44 + Math.cos(this.phase * 2) * .006, .15 + swing * .018);
    readyGrip.lerp(carryGrip, carry);
    // At steep angles the stock/barrel rotates past the face. Move the complete gun outside the
    // head silhouette, not through it; camera range, barrel direction and rifle size stay intact.
    const aimGrip = V(-.21 - .025 * extreme, shoulderY - .10 + Math.max(0, -Math.sin(pitch)) * .12, .10 + .04 * extreme);
    const grip = readyGrip.lerp(aimGrip, aim);
    const holdPosition = grip.clone().sub(rig.gunAnchors.grip.clone().applyQuaternion(gunQ));
    rig.gunHold.p.copy(holdPosition);
    const mountWeight = THREE.MathUtils.smoothstep(r, .05, .50);
    J.Gun.position.lerpVectors(rig.gunSling.p, holdPosition, mountWeight);
    J.Gun.quaternion.slerpQuaternions(rig.gunSling.q, gunQ, mountWeight);
    J.Gun.position.lerp(rig.gunSling.p, meleeWeight);
    J.Gun.quaternion.slerp(rig.gunSling.q, meleeWeight);
    rig.root.updateMatrixWorld(true);
    const heldGunWorldQ = rootQ.clone().multiply(gunQ), gliderWorldQ = J.Glider.getWorldQuaternion(Q());
    const handGunWeight = THREE.MathUtils.smoothstep(r, .20, .95);
    for (const [side, sign] of [['R', -1], ['L', 1]] as const) {
      const freePoint = V(sign * .25, .99, .04);
      if (side === 'L' || !armed) {
        const stride = this.phase + (side === 'R' ? Math.PI : 0);
        // The hand trails the opposite-leg swing slightly. A shorter elbow-to-hip reach
        // bends the elbow naturally (especially running), instead of straight-arm paddling.
        const armSwing = -Math.cos(stride + Math.PI * (.5 - playerStride(this.strideSpeed).stance) - .18);
        freePoint.lerp(V(sign * (.25 + .01 * run), shoulderY - .485 + run * .04 + Math.max(0, armSwing) * .025 * move,
          .035 + armSwing * (.12 + .055 * run) * move), armed ? carry : 1);
      }
      if (!state.swimming && !state.flying) {
        const airAct = this.air * (1 - g) * (1 - aim) * (1 - meleeWeight);
        // Free arms balance the jump; equipment-contact IK still owns held hands.
        freePoint.y += airAct * (.19 * weightTransfer.gather + .04 * weightTransfer.descent);
        freePoint.z += airAct * (.17 * weightTransfer.gather - .025 * weightTransfer.descent);
        freePoint.x += sign * airAct * .025 * weightTransfer.descent;
      }
      if (state.swimming) freePoint.set(sign * (.22 + Math.cos(this.time * 3.3 + sign) * .10), shoulderY - .20 + Math.sin(this.time * 3.3 + sign) * .10, .24 + Math.cos(this.time * 3.3 + sign) * .16);
      if (meleeWeight > 0) {
        // Targets remain inside measured arm reach; IK preserves anatomical elbow poles.
        const cut = meleeStroke;
        const bladePoint = side === 'R'
          ? V(meleeCut === 1 ? -.04 - cut * .31 : -.35 + cut * .31,
              shoulderY - .39 + (meleeCut === 2 ? .02 * (1 - heavyBlend) + .64 * Math.sin(Math.min(1, meleePhase / .20) * Math.PI / 2) * Math.pow(1 - cut, 1.4) : .02), .23 + Math.sin(cut * Math.PI) * .035 + (heavy ? cut * .07 : 0))
          : V(.26 + Math.sin(cut * Math.PI) * .025, shoulderY - .24 + (heavy ? .10 * heavyBlend * (1 - cut) : 0), .18);
        freePoint.lerp(bladePoint, meleeWeight);
      }
      const palmPoint = rig.root.localToWorld(freePoint);
      const freePalm = state.swimming ? basis(V(sign * .15, -.12, 1), V(0, 1, .12))
        : basis(V(0, -1, 0), V(sign, 0, 0));
      if (side === 'R' && meleeWeight > 0) freePalm.slerp(basis(V(.12,-.8,.35), V(-1,0,.15)), meleeWeight);
      const handQ = rootQ.clone().multiply(freePalm);
      // While the frame is still deployed, transfer directly between its real grips and the
      // forward held-rifle pose. Never chase the gun through its back-sling path with a hand.
      // Water/unarmed travel has no rifle to receive the hands. Release across the close, not
      // holding the frame until its final few pixels and snapping to the swim stroke.
      const glideContact = stowing && (state.swimming || !armed) ? THREE.MathUtils.smoothstep(g, 0, 1) : g > .02 ? 1 : g / .02;
      palmPoint.lerp(rig.glider.grips[side].getWorldPosition(V()), glideContact);
      handQ.slerp(gliderWorldQ.clone().multiply(gliderPalm), glideContact);
      const anchor = side === 'R' ? rig.gunAnchors.grip : rig.gunAnchors.support;
      const heldAnchor = anchor.clone().applyQuaternion(gunQ).add(holdPosition);
      const contact = handGunWeight * (side === 'L' ? 1 - carry : 1) * (1 - meleeWeight);
      palmPoint.lerp(rig.root.localToWorld(heldAnchor), contact);
      handQ.slerp(heldGunWorldQ.clone().multiply(gunPalm[side]), contact);
      // Finish neutral alignment near release. Re-solving a half-contacted palm
      // against its own blended forearm creates an unstable orientation feedback loop.
      const neutralWrist = meleeWeight > 0 ? meleeWeight : state.swimming ? 0 : THREE.MathUtils.smoothstep((1 - glideContact) * (1 - contact), .75, 1);
      // A sword grip must roll around the forearm, not inherit the free-hand dorsal
      // axis (which pointed the old blade almost vertically into the ground).
      const cutArc = THREE.MathUtils.smoothstep(meleePhase, meleeCut === 2 ? .20 : .18, meleeCut === 2 ? .58 : .60);
      const slashAngle = (cutArc - .5) * 2.25 * (meleeCut === 1 ? -1 : 1);
      const bladeDirection = side === 'R' && meleeWeight > 0
        ? (meleeCut === 2 ? V(Math.sin(slashAngle) * (1 - heavyBlend * .4), .12 + heavyBlend * .23, Math.cos(slashAngle)) : V(Math.sin(slashAngle), .12, Math.cos(slashAngle))).normalize().applyQuaternion(rootQ)
        : undefined;
      solvePlayerArm(rig, side, palmPoint, handQ, armed ? carry : 1 - g, neutralWrist, contact, bladeDirection);
      this.poseFingers(side, Math.max(contact, side === 'R' ? meleeWeight : 0), glideContact * (1 - contact), side === 'R' ? meleeWeight : 0);
    }
    rig.diagnostics.mode = meleeWeight > .5 ? 'melee' : r > .99 ? aim > .5 ? 'aim' : 'ready' : g > .99 && r < .01 ? 'glide' : state.swimming ? 'swim' : !armed ? 'unarmed' : 'transition';
    rig.root.updateMatrixWorld(true);
    rig.skeletons.forEach(s => s.update());
  }
  private poseFingers(side: Side, rifle: number, glide: number, melee = 0) {
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
      const sword = finger === 'Thumb' ? [.50, .75, .55][segment - 1] : [.72, 1.05, .68][segment - 1];
      const angle = base + (gun - base) * rifle + (hang - base) * glide + (sword - gun) * melee;
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
