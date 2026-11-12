import * as THREE from 'three';

export interface SaberBraceCue {
  readonly position: THREE.Vector3;
  readonly target: THREE.Vector3;
}

/** Adjust the left arm over the ordinary grounded pose while the sword hand stays free. */
export function createSaberBrace(model: THREE.Object3D, root: THREE.Object3D) {
  const bone = (part: string) => model.getObjectByName('mixamorigLeft' + part) ?? model.getObjectByName('mixamorig:Left' + part);
  const shoulder = bone('Arm'), elbow = bone('ForeArm'), hand = bone('Hand');
  if (!shoulder?.parent || !elbow?.parent || !hand?.parent) return;

  const joints = [shoulder, elbow, hand];
  const original = joints.map(joint => joint.quaternion.clone());
  const origin = new THREE.Vector3(), hinge = new THREE.Vector3(), wrist = new THREE.Vector3();
  const reach = new THREE.Vector3(), pole = new THREE.Vector3();
  const from = new THREE.Vector3(), to = new THREE.Vector3();
  const parent = new THREE.Quaternion(), inverseParent = new THREE.Quaternion(), swing = new THREE.Quaternion();
  let applied = false;

  function aim(joint: THREE.Object3D, child: THREE.Object3D, target: THREE.Vector3) {
    joint.getWorldPosition(from);
    to.copy(target).sub(from).normalize();
    child.getWorldPosition(reach).sub(from).normalize();
    joint.parent!.getWorldQuaternion(parent);
    swing.setFromUnitVectors(reach, to);
    joint.quaternion.premultiply(inverseParent.copy(parent).invert().multiply(swing).multiply(parent));
    joint.updateWorldMatrix(false, true);
  }

  return {
    restore() {
      if (!applied) return;
      joints.forEach((joint, index) => joint.quaternion.copy(original[index]));
      applied = false;
    },
    apply(target: THREE.Vector3, amount: number) {
      if (amount <= 0) return;
      root.updateWorldMatrix(true, true);
      shoulder.getWorldPosition(origin);
      elbow.getWorldPosition(hinge);
      hand.getWorldPosition(wrist);
      const upper = origin.distanceTo(hinge), lower = hinge.distanceTo(wrist);
      if (Math.min(upper, lower) < .002) return;
      joints.forEach((joint, index) => original[index].copy(joint.quaternion));
      reach.copy(target).sub(origin);
      const distance = THREE.MathUtils.clamp(reach.length(), Math.abs(upper - lower) + .001, upper + lower - .001);
      reach.normalize();
      pole.set(1, -.65, 0).transformDirection(root.matrixWorld);
      pole.addScaledVector(reach, -pole.dot(reach)).normalize();
      const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
      hinge.copy(origin).addScaledVector(reach, along).addScaledVector(pole, Math.sqrt(Math.max(0, upper * upper - along * along)));
      wrist.copy(origin).addScaledVector(reach, distance);
      aim(shoulder, elbow, hinge);
      aim(elbow, hand, wrist);
      // The hand's local +Y follows the fingers up under the amber handle.
      hand.parent!.getWorldQuaternion(parent);
      to.set(0, 1, .1).transformDirection(root.matrixWorld).applyQuaternion(parent.invert());
      from.set(0, 1, 0).applyQuaternion(hand.quaternion);
      hand.quaternion.premultiply(swing.setFromUnitVectors(from, to));
      joints.forEach((joint, index) => joint.quaternion.slerp(original[index], 1 - amount));
      root.updateWorldMatrix(true, true);
      applied = true;
    },
  };
}
