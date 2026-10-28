import * as THREE from 'three';

/** One shared motion curve drives world displacement and the horse's in-place gait. */
export const MOUNTED_CHARGE = {
  speed: 4.4, recovery: .7, sideClearance: 1.2, hitRange: 2.25,
  radius: .58, halfLength: 1.35, stepHeight: .38, maxLeash: 22,
} as const;

export function mountedChargeDistance(time: number, duration: number, contact: number) {
  const t = THREE.MathUtils.clamp(time, 0, duration);
  if (t <= contact) return MOUNTED_CHARGE.speed * t;
  const after = t - contact, braking = duration - contact;
  return MOUNTED_CHARGE.speed * (contact + after - after * after / (2 * braking));
}

/**
 * Keep the authored cavalry saber cut and its hit instant. Replace only the horse and seated
 * lower-body channels with the existing gallop, retimed by actual distance, then brake to rest.
 * This is still one action on one mixer: the rider remains parented to the animated saddle.
 * Original clips, geometry, materials and the white horse are not modified.
 */
export function mountedChargeClip(attack: THREE.AnimationClip, run: THREE.AnimationClip, nominalSpeed: number, contact: number) {
  // GLTFLoader sanitizes Blender's Thigh.L etc. into ThighL before binding tracks.
  const lowerBody = (name: string) => /^(H_|Root\.|Hips\.|(?:Thigh|Shin|Foot|Toe)(?:[._]|[LR]\.))/.test(name);
  const tracks = attack.tracks.filter(track => !lowerBody(track.name)).map(track => track.clone());
  const frames = Math.ceil(attack.duration * 60);
  const times = Array.from({ length: frames + 1 }, (_, i) => attack.duration * i / frames);
  for (const source of run.tracks.filter(track => lowerBody(track.name))) {
    const interpolant = (source as THREE.KeyframeTrack & { createInterpolant(): THREE.Interpolant }).createInterpolant();
    const values = times.flatMap(time => Array.from(interpolant.evaluate((mountedChargeDistance(time, attack.duration, contact) / nominalSpeed) % run.duration)));
    const track = source.clone();
    track.times = new Float32Array(times); track.values = new Float32Array(values); tracks.push(track);
  }
  return new THREE.AnimationClip(attack.name, attack.duration, tracks);
}
