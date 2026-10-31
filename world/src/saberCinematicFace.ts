import * as THREE from 'three';
import type { UltimatePerformanceFrame } from './ultimatePerformance';

/** The production face retains its original, fully three-dimensional morphs.
 * Indices below were visually audited against all 56 targets in the published
 * armor asset, not guessed from the exporter's generic target_N names. */
export const SABER_FACE_MORPHS = Object.freeze({ determined: 1, blink: 13, shout: 34, openA: 32 });
const smooth = (x: number) => { x = THREE.MathUtils.clamp(x, 0, 1); return x * x * (3 - 2 * x); };
export function saberFaceExpression(frame: UltimatePerformanceFrame) {
  const p = THREE.MathUtils.clamp(Number.isFinite(frame.progress) ? frame.progress : 0, 0, 1);
  const charge = frame.phase === 'charge';
  // Closed in the quiet charge, then a distinct, decisive opening before raise.
  const blink = charge ? (1 - smooth((p - .38) / .13)) : 0;
  const shout = frame.phase === 'release' ? smooth(p / .06) * (1 - smooth((p - .44) / .24)) : 0;
  return { blink, shout, determined: frame.phase === 'intro' ? .15 : frame.phase === 'outro' ? .25 : .60,
    wind: frame.phase === 'intro' ? .14 : charge ? .25 + .75 * p : frame.phase === 'release' ? 1 : 1 - .8 * p };
}

/** Presentation only; call with the stage's PRIVATE clone, after the body mixer.
 * Uses real facial geometry, plus restrained secondary motion in existing hair
 * and ribbon geometry. No sprites, replacement face, source mutation or events. */
export function createSaberCinematicFace(root: THREE.Object3D) {
  const face = root.getObjectByName('Face') as THREE.Mesh | undefined;
  const faceWeights = face?.morphTargetInfluences;
  const originalWeights = faceWeights?.slice();
  const ownsFace = !!faceWeights && faceWeights.length >= 35;
  const deformers: { mesh: THREE.Mesh; original: THREE.BufferGeometry; geometry: THREE.BufferGeometry; base: Float32Array; mask: Float32Array; ribbon: boolean }[] = [];
  const materialCopies: { mesh: THREE.Mesh; original: THREE.Material | THREE.Material[]; copies: THREE.Material[] }[] = [];
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const ribbon = materials.some(m => m.name === 'shirt') && /shirt/i.test(mesh.name);
    const hair = materials.some(m => m.name === 'hair') && /hair/i.test(mesh.name);
    if (!hair && !ribbon) return;
    const original = mesh.geometry, geometry = original.clone();
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const base = new Float32Array(position.array), mask = new Float32Array(position.count);
    for (let i = 0; i < position.count; i++) {
      const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
      // The crown, braid attachment and upper fringe stay fixed to the skull.
      mask[i] = ribbon ? smooth((1.52 - y) / .10) : Math.max(
        smooth((1.58 - y) / .13) * smooth((Math.abs(x) - .035) / .06),
        smooth((y - 1.665) / .035) * .55,
        smooth((-z - .12) / .08) * smooth((1.59 - y) / .15) * .35
      );
    }
    mesh.geometry = geometry;
    deformers.push({ mesh, original, geometry, base, mask, ribbon });
    const copies = materials.map(m => m.clone());
    for (const m of copies) if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
      const standard = m as THREE.MeshStandardMaterial;
      standard.roughness = hair ? .48 : .66;
    }
    materialCopies.push({ mesh, original: mesh.material, copies });
    mesh.material = Array.isArray(mesh.material) ? copies : copies[0];
  });
  let disposed = false;
  function restore() {
    if (ownsFace && faceWeights && originalWeights) for (let i = 0; i < faceWeights.length; i++) faceWeights[i] = originalWeights[i];
    for (const d of deformers) {
      const position = d.geometry.getAttribute('position') as THREE.BufferAttribute;
      (position.array as Float32Array).set(d.base); position.needsUpdate = true;
    }
  }
  return {
    available: ownsFace,
    update(frame: UltimatePerformanceFrame) {
      if (disposed || !Number.isFinite(frame.elapsed)) return;
      const e = saberFaceExpression(frame);
      if (ownsFace && faceWeights && originalWeights) {
        for (let i = 0; i < faceWeights.length; i++) faceWeights[i] = originalWeights[i];
        faceWeights[SABER_FACE_MORPHS.blink] = e.blink;
        faceWeights[SABER_FACE_MORPHS.determined] = e.determined;
        faceWeights[SABER_FACE_MORPHS.shout] = e.shout * .92;
      }
      for (const d of deformers) {
        const position = d.geometry.getAttribute('position') as THREE.BufferAttribute;
        const values = position.array as Float32Array;
        for (let i = 0; i < position.count; i++) {
          const k = i * 3, x = d.base[k], y = d.base[k + 1], z = d.base[k + 2];
          const wave = Math.sin(frame.elapsed * (d.ribbon ? 8 : 6.5) + y * 21 + x * 12);
          const amount = d.mask[i] * e.wind;
          values[k] = x + amount * wave * (d.ribbon ? .015 : .006);
          values[k + 1] = y + amount * Math.sin(frame.elapsed * 7.3 + x * 18) * .003;
          values[k + 2] = z - amount * (d.ribbon ? .022 : .008) * (.7 + .3 * wave);
        }
        position.needsUpdate = true;
      }
    },
    reset() { if (!disposed) restore(); },
    dispose() {
      if (disposed) return;
      restore(); disposed = true;
      for (const d of deformers) { d.mesh.geometry = d.original; d.geometry.dispose(); }
      for (const m of materialCopies) { m.mesh.material = m.original; for (const copy of m.copies) copy.dispose(); }
    }
  };
}
