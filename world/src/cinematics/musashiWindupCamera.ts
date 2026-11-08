import * as THREE from 'three';
import type { EraArtFrame } from './eraStageArt';
const ease = (x: number) => { x = THREE.MathUtils.clamp(x, 0, 1); return x * x * (3 - 2 * x); };
/** Only opens the existing mid-charge shot. Intro, steady reduced mode and release stay authoritative. */
export class MusashiWindupCamera {
  readonly aim = new THREE.Vector3();
  private target = new THREE.Vector3();
  constructor(private actor: THREE.Group) {}
  update(frame: EraArtFrame, camera: THREE.PerspectiveCamera, reduced: boolean, baseAim: THREE.Vector3): THREE.Vector3 {
    this.aim.copy(baseAim);
    const p = frame.progress;
    if (reduced || frame.phase !== 'charge' || !Number.isFinite(p) || p <= .22 || p >= .9) return this.aim;
    const weight = ease((p - .22) / .21) * (1 - ease((p - .65) / .23));
    const center = this.actor.position;
    this.target.set(center.x, 1.55, center.z + .05); this.aim.lerp(this.target, weight);
    this.target.set(center.x + 1.6, 2, center.z + 7.8); camera.position.lerp(this.target, weight);
    camera.fov = THREE.MathUtils.lerp(camera.fov, 40, weight);
    camera.lookAt(this.aim); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    return this.aim;
  }
}
