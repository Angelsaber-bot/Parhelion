import * as THREE from 'three';
import { SABER_FACE_MORPHS } from './saberCinematicFace';
/** Native geometry-only expression acting. Does not own clips, hit clocks or sockets. */
export function createSaberLiveExpression(root: THREE.Object3D) {
  const face = root.getObjectByName('Face') as THREE.Mesh | undefined;
  const weights = face?.morphTargetInfluences;
  const baseline = weights?.slice();
  const supported = !!weights && weights.length > SABER_FACE_MORPHS.shout;
  let elapsed = 0, focus = 0, disposed = false;
  const smooth = (x: number) => { x = THREE.MathUtils.clamp(x, 0, 1); return x*x*(3-2*x); };
  const owned = [SABER_FACE_MORPHS.determined, SABER_FACE_MORPHS.blink, SABER_FACE_MORPHS.shout];
  function restore() { if (supported && weights && baseline) for (const i of owned) weights[i] = baseline[i]; }
  return {
    available: supported,
    update(dt: number, state: string, visible = true) {
      if (disposed || !supported || !weights || !baseline || !visible || !(dt > 0) || !Number.isFinite(dt)) return;
      elapsed += Math.min(dt, .1);
      focus += ((state === 'attack' ? .52 : state === 'run' ? .22 : .09) - focus) * (1-Math.exp(-dt*7));
      const phase = elapsed % 4.3, blink = smooth((phase-3.94)/.065) * (1-smooth((phase-4.025)/.09));
      weights[SABER_FACE_MORPHS.determined] = Math.max(baseline[SABER_FACE_MORPHS.determined], focus);
      weights[SABER_FACE_MORPHS.blink] = Math.max(baseline[SABER_FACE_MORPHS.blink], blink);
      weights[SABER_FACE_MORPHS.shout] = baseline[SABER_FACE_MORPHS.shout];
    },
    reset() { elapsed = 0; focus = 0; restore(); },
    dispose() { if (!disposed) restore(); disposed = true; }
  };
}
