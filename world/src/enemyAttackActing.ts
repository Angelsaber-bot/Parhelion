import * as THREE from 'three';
import { enemyAttackTiming, type Enemy } from './combat';
import type { EnemyPoseModel } from './enemyAttackPresentation';

const smooth = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
/** Native models use opposite sword hands. Never rotate a generic arm Euler axis:
 * aim the real bind-aware chain and retain the weapon's measured hand-local axis.
 */
export const ENEMY_WEAPON_HAND = { samurai: 'R', officer: 'L', sunward_guard: 'R', deck_raider: 'L' } as const;
type SwordModel = keyof typeof ENEMY_WEAPON_HAND;
const isSword = (model: EnemyPoseModel): model is SwordModel => model in ENEMY_WEAPON_HAND;

export interface EnemyWeaponAxis { axis: THREE.Vector3; reach: number }
const calibrations = new WeakMap<THREE.Object3D, Map<string, EnemyWeaponAxis>>();
/** One-time immutable-template measurement, shared by all clones/LODs of that template.
 * The farthest hand-weighted vertex is the held blade tip, not an invented socket.
 */
export function measureEnemyWeaponAxis(template: THREE.Object3D, side: string): EnemyWeaponAxis | null {
  let cache = calibrations.get(template); if (!cache) { cache = new Map(); calibrations.set(template, cache); }
  const prior = cache.get(side); if (prior) return prior;
  const hand = template.getObjectByName(`hand${side}`); if (!hand) return null;
  template.updateWorldMatrix(true, true);
  const origin = hand.getWorldPosition(new THREE.Vector3()), point = new THREE.Vector3(), tip = new THREE.Vector3(); let reach = 0;
  template.traverse(o => {
    if (!(o instanceof THREE.SkinnedMesh)) return;
    const index = o.skeleton.bones.indexOf(hand as THREE.Bone); if (index < 0) return;
    const indices = o.geometry.attributes.skinIndex, weights = o.geometry.attributes.skinWeight;
    o.skeleton.update();
    for (let i = 0; i < indices.count; i++) {
      let held = false;
      for (let k = 0; k < 4; k++) if (indices.getComponent(i, k) === index && weights.getComponent(i, k) > .8) { held = true; break; }
      if (!held) continue;
      o.getVertexPosition(i, point).applyMatrix4(o.matrixWorld);
      const distance = point.distanceTo(origin); if (distance > reach) { reach = distance; tip.copy(point); }
    }
  });
  if (reach < .4 || reach > 2) return null;
  const result = { axis: hand.worldToLocal(tip).normalize(), reach }; cache.set(side, result); return result;
}

export interface EnemySwordStyle {
  readonly name: 'diagonal-cut' | 'heavy-cleave' | 'deck-slash' | 'officer-lunge';
  readonly preparation: readonly [number, number, number];
  readonly contact: readonly [number, number, number];
  readonly follow: readonly [number, number, number];
  readonly prepareBlade: readonly [number, number, number];
  readonly contactBlade: readonly [number, number, number];
  readonly followBlade: readonly [number, number, number];
  readonly turn: number; readonly counterTurn: number; readonly load: number; readonly drive: number;
}
/** Coordinates mirror around the actual weapon hand, rather than mirror a whole rig
 * (which would swap uniforms/weapons). Different preparation silhouettes share the
 * same authoritative timing and footprint; these are not four new damage profiles.
 */
export const ENEMY_SWORD_STYLES: Readonly<Record<SwordModel, EnemySwordStyle>> = {
  samurai: { name: 'diagonal-cut', preparation: [.33,1.50,.08], contact: [.18,1.22,.43], follow: [-.12,1.07,.36], prepareBlade: [.35,.92,-.18], contactBlade: [-.12,-.18,1], followBlade: [-.95,-.28,.42], turn: .32, counterTurn: -.32, load: .055, drive: .06 },
  sunward_guard: { name: 'heavy-cleave', preparation: [.22,1.62,.06], contact: [.18,1.19,.42], follow: [.12,.98,.43], prepareBlade: [.08,.98,-.1], contactBlade: [-.02,-.25,1], followBlade: [.03,-.75,.66], turn: .12, counterTurn: -.08, load: .085, drive: .07 },
  deck_raider: { name: 'deck-slash', preparation: [.50,1.24,-.04], contact: [.16,1.16,.46], follow: [-.23,1.08,.34], prepareBlade: [.95,.20,.05], contactBlade: [-.25,.05,1], followBlade: [-1,-.13,.12], turn: .42, counterTurn: -.40, load: .045, drive: .04 },
  officer: { name: 'officer-lunge', preparation: [.30,1.20,.10], contact: [.15,1.28,.50], follow: [.20,1.16,.38], prepareBlade: [.25,.50,.82], contactBlade: [-.02,.02,1], followBlade: [.15,-.25,.95], turn: .15, counterTurn: -.18, load: .035, drive: .085 },
};

/** New story-only gestures. The ordinary guard keeps its authored heavy cleave.
 * A forward thrust and shield-braced signal discharge must not share a cut silhouette. */
export const ECHO_WARDEN_ACTING: Readonly<Record<'thrust'|'burst',EnemySwordStyle>> = {
 thrust:{...ENEMY_SWORD_STYLES.sunward_guard,preparation:[.28,1.20,.02],contact:[.15,1.23,.52],follow:[.22,1.14,.34],prepareBlade:[.18,.15,.97],contactBlade:[0,0,1],followBlade:[.15,-.2,.97],turn:.23,counterTurn:-.12,load:.055,drive:.085},
 burst:{...ENEMY_SWORD_STYLES.sunward_guard,preparation:[.28,1.18,.03],contact:[.32,1.03,.14],follow:[.31,1.04,.10],prepareBlade:[.2,-.95,.1],contactBlade:[.15,-.98,.10],followBlade:[.15,-.98,.10],turn:.04,counterTurn:0,load:.06,drive:.015},
};

const shieldNormals=new WeakMap<THREE.Object3D,THREE.Vector3|null>();
/** The native guard's shield is weighted to forearmL, NOT handL. Measure its
 * blue-face versus wooden-back centroid in bind space, then twist only around the real elbow→wrist axis. */
function shieldFrontAxis(template:THREE.Object3D):THREE.Vector3|null{
 if(shieldNormals.has(template))return shieldNormals.get(template)!;
 const bone=template.getObjectByName('forearmL');if(!bone)return null;template.updateWorldMatrix(true,true);
 const front=new THREE.Vector3(),back=new THREE.Vector3();let frontCount=0,backCount=0;
 template.traverse(o=>{if(!(o instanceof THREE.SkinnedMesh))return;const names=[o.material].flat().map(m=>m.name),isFront=names.includes('03 • indigo wool'),isBack=names.includes('07 • walnut pistol stock');if(!isFront&&!isBack)return;
  const skin=o.geometry.attributes.skinIndex,weights=o.geometry.attributes.skinWeight,bi=o.skeleton.bones.indexOf(bone as THREE.Bone),point=new THREE.Vector3();o.skeleton.update();
  for(let i=0;i<skin.count;i++){let held=false;for(let k=0;k<4;k++)if(skin.getComponent(i,k)===bi&&weights.getComponent(i,k)>.8)held=true;if(!held)continue;o.getVertexPosition(i,point).applyMatrix4(o.matrixWorld);if(isFront){front.add(point);frontCount++;}else{back.add(point);backCount++;}}
 });
 const normal=frontCount&&backCount?front.divideScalar(frontCount).sub(back.divideScalar(backCount)):new THREE.Vector3();
 const result=normal.lengthSq()>1e-8?normal.normalize().applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert()):null;shieldNormals.set(template,result);return result;
}

/** Clone-only body acting. Native clips are sampled first every frame. Both native
 * feet are solved back to their pre-overlay world targets while the pelvis carries
 * a small load/weight shift; the scene root and game capsule never translate.
 * Missing/foreign rigs gracefully retain their native clips.
 */
export function createEnemyAttackActing(root: THREE.Object3D, template: THREE.Object3D, model: EnemyPoseModel) {
  const noop = { restore() {}, update(_e: Enemy) {} };
  if (!isSword(model)) return noop;
  const side = ENEMY_WEAPON_HAND[model], sign = side === 'R' ? -1 : 1, baseStyle = ENEMY_SWORD_STYLES[model];
  const chain = (names: readonly string[]) => names.map(name => root.getObjectByName(name));
  const armed = chain([`upper_arm${side}`, `forearm${side}`, `hand${side}`]);
  const otherSide = side === 'R' ? 'L' : 'R', free = chain([`upper_arm${otherSide}`, `forearm${otherSide}`, `hand${otherSide}`]);
  const legs = ['R', 'L'].map(side => chain([`thigh${side}`, `shin${side}`, `foot${side}`]));
  const spine = root.getObjectByName('spine'), chest = root.getObjectByName('chest'), pelvis = root.getObjectByName('pelvis');
  const weapon = measureEnemyWeaponAxis(template, side);
  if (!spine || !chest || !pelvis || !weapon || [...armed, ...free, ...legs.flat()].some(bone => !bone)) return noop;
  const upper = armed[0]!, lower = armed[1]!, hand = armed[2]!;
  const shieldAxis=model==='sunward_guard'?shieldFrontAxis(template):null;
  const affected = [...armed, ...free, ...legs.flat(), spine, chest, pelvis] as THREE.Object3D[];
  const native = affected.map(bone => ({ q: bone.quaternion.clone(), p: bone.position.clone() }));
  let applied = false;
  const vectors = Array.from({ length: 128 }, () => new THREE.Vector3()), quaternions = Array.from({ length: 80 }, () => new THREE.Quaternion());
  let vi = 0, qi = 0;
  const v = (x = 0, y = 0, z = 0) => vectors[vi++].set(x, y, z), q = () => quaternions[qi++].identity();
  const copy = (value: THREE.Vector3) => v().copy(value);
  const point = (value: readonly [number, number, number]) => v(sign * value[0], value[1], value[2]);
  const world = (value: THREE.Vector3) => root.localToWorld(value);
  const axis = (value: THREE.Vector3) => value.transformDirection(root.matrixWorld);
  const setWorld = (bone: THREE.Object3D, rotation: THREE.Quaternion) => {
    bone.quaternion.copy(bone.parent!.getWorldQuaternion(q()).invert().multiply(rotation)); bone.updateWorldMatrix(false, true);
  };
  const aim = (bone: THREE.Object3D, child: THREE.Object3D, target: THREE.Vector3) => {
    const origin = bone.getWorldPosition(v()), from = child.getWorldPosition(v()).sub(origin).normalize(), to = copy(target).sub(origin).normalize();
    setWorld(bone, q().setFromUnitVectors(from, to).multiply(bone.getWorldQuaternion(q())));
  };
  const solve = (chain: readonly THREE.Object3D[], target: THREE.Vector3, poleLocal: THREE.Vector3, endRotation: THREE.Quaternion) => {
    const [upper, lower, end] = chain, a = upper.getWorldPosition(v()), b = lower.getWorldPosition(v()), c = end.getWorldPosition(v());
    const l1 = a.distanceTo(b), l2 = b.distanceTo(c), delta = copy(target).sub(a), distance = THREE.MathUtils.clamp(delta.length(), Math.abs(l1 - l2) + .0001, l1 + l2 - .0001), direction = delta.normalize();
    const along = (l1*l1-l2*l2+distance*distance)/(2*distance), height = Math.sqrt(Math.max(0,l1*l1-along*along));
    const pole = axis(poleLocal); pole.addScaledVector(direction, -pole.dot(direction)).normalize();
    aim(upper, lower, copy(a).addScaledVector(direction, along).addScaledVector(pole, height));
    aim(lower, end, copy(a).addScaledVector(direction, distance)); setWorld(end, endRotation);
  };
  return {
    restore() {
      // AnimationMixer may skip unchanged writes; remove our prior overlay BEFORE
      // sampling even on identical/paused frames, or transforms would accumulate.
      if (!applied) return;
      affected.forEach((bone, i) => { bone.quaternion.copy(native[i].q); bone.position.copy(native[i].p); }); applied = false;
      root.updateWorldMatrix(true, true);
    },
    update(e: Enemy) {
      if (e.mode !== 'windup' && !(e.mode === 'recover' && e.contactSequence === e.attackCount && e.attackCount > 0)) return;
      const warden=e.storyPattern==='echo-warden'&&model==='sunward_guard',burst=warden&&e.attack==='burst';
      if (e.attack === 'shot' || (e.attack === 'burst'&&!warden)) return;
      const style=warden&&(e.attack==='thrust'||e.attack==='burst')?ECHO_WARDEN_ACTING[e.attack]:baseStyle;
      vi = qi = 0;
      const timing = enemyAttackTiming(e), windup = e.mode === 'windup';
      const remaining = Math.max(0,e.timer), elapsed = windup ? timing.windup-remaining : timing.recovery-remaining;
      const stroke = windup ? smooth(1-remaining/.2) : 1;
      const followDuration = Math.min(.2,timing.recovery*.4), follow = windup ? 0 : smooth(elapsed/followDuration);
      const release = windup ? 0 : smooth((elapsed-followDuration)/Math.max(.1,timing.recovery-followDuration));
      const weight = (windup ? smooth(elapsed/.22) : 1)*(1-release);
      if (weight <= 0) return;
      affected.forEach((bone,i) => { native[i].q.copy(bone.quaternion); native[i].p.copy(bone.position); }); applied = true;
      root.updateWorldMatrix(true,true);
      const footTargets = legs.map(chain => chain[2]!.getWorldPosition(v())), footRotations = legs.map(chain => chain[2]!.getWorldQuaternion(q()));
      const pelvisPoint = root.worldToLocal(pelvis.getWorldPosition(v()));
      pelvisPoint.y -= style.load*(1-.3*stroke)*weight;
      pelvisPoint.z += (-.035*(1-stroke)+style.drive*stroke)*weight;
      pelvis.position.copy(pelvis.parent!.worldToLocal(world(pelvisPoint))); pelvis.updateWorldMatrix(false,true);
      legs.forEach((chain,i) => solve(chain as THREE.Object3D[],footTargets[i],v(0,0,1),footRotations[i]));
      const yaw = sign*(style.turn*(1-stroke)+style.counterTurn*follow)*weight;
      const lean = (burst?-.035:(-.045*(1-stroke)+.13*stroke))*weight;
      for (const [bone,share] of [[spine,.35],[chest,.65]] as const) {
        const rotation = q().setFromAxisAngle(axis(v(0,1,0)),yaw*share).multiply(bone.getWorldQuaternion(q()));
        rotation.premultiply(q().setFromAxisAngle(axis(v(1,0,0)),lean*share)); setWorld(bone,rotation);
      }
      const targetLocal = point(style.preparation).lerp(point(style.contact),stroke).lerp(point(style.follow),follow);
      const target = hand.getWorldPosition(v()).lerp(world(targetLocal),weight);
      const desired = axis(point(style.prepareBlade).lerp(point(style.contactBlade),stroke).lerp(point(style.followBlade),follow).normalize());
      const originalHand = hand.getWorldQuaternion(q()), originalBlade = copy(weapon.axis).applyQuaternion(originalHand).normalize();
      const targetRotation = q().setFromUnitVectors(originalBlade,desired).multiply(originalHand), handRotation = q().copy(originalHand).slerp(targetRotation,weight);
      solve([upper,lower,hand],target,v(sign,-.5,-.15),handRotation);
      // The free arm counterbalances the cut/lunge instead of hanging in bind pose.
      // Its native wrist orientation is preserved, including the pirate's holstered pistol grip.
      const freeHand = free[2]!, freeRotation = freeHand.getWorldQuaternion(q());
      const freeLocal = burst ? v(-sign*.24,1.42,.34) : model === 'officer' ? v(-sign*.32,1.04,-.15) : v(-sign*.37,1.12,.02).lerp(v(-sign*.32,1.20,.13),stroke).lerp(v(-sign*.30,1.18,.12),follow);
      const freeTarget = freeHand.getWorldPosition(v()).lerp(world(freeLocal),weight);
      solve(free as THREE.Object3D[],freeTarget,v(-sign*.5,-1,.15),freeRotation);
      if(burst&&shieldAxis){
        const elbow=free[1]!,rotation=elbow.getWorldQuaternion(q()),along=freeHand.getWorldPosition(v()).sub(elbow.getWorldPosition(v())).normalize();
        const front=copy(shieldAxis).applyQuaternion(rotation).projectOnPlane(along).normalize(),wanted=axis(v(0,0,1)).projectOnPlane(along).normalize();
        if(front.lengthSq()>.1&&wanted.lengthSq()>.1){const angle=Math.atan2(along.dot(copy(front).cross(wanted)),front.dot(wanted));rotation.premultiply(q().setFromAxisAngle(along,angle*weight));setWorld(elbow,rotation);setWorld(freeHand,freeRotation);}
      }
    },
  };
}
