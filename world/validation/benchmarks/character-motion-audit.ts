/** Independent actual-rig sample/metrics. Node geometry evaluation, not browser visual QA. */
import * as THREE from 'three';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const source = resolve(process.argv[2] ?? '..'), out = resolve(process.argv[3] ?? '../docs/character-motion-20261028'), label = process.argv[4] ?? 'after';
const { playerFixture } = await import(pathToFileURL(`${source}/world/validation/player-fixture.ts`).href);
const { SkinnedCharacterAnimator } = await import(pathToFileURL(`${source}/world/src/skinnedCharacter.ts`).href);
await mkdir(out, { recursive: true });
const base = { speed: 0, onGround: true, swimming: false, vy: 0, moveYaw: 0 };
const joints = ['Hips', 'Thigh_L', 'Shin_L', 'Foot_L', 'Thigh_R', 'Shin_R', 'Foot_R', 'Hand_L', 'Hand_R'];
const results: any = { label, source, scope: 'Actual production player rig; canonical equal-walltime inputs. CPU matrix/vertex tests are not visual smoothness or browser/FPS evidence.', rates: [] };
for (const hz of [30, 60, 120]) {
  const f = await playerFixture(), animator = new SkinnedCharacterAnimator(f.rig); const samples: any[] = [];
  const scenarios = [
    ['walk-start', .1, {...base, speed:5.5}], ['walk-stride', .9, {...base, speed:5.5}],
    ['turn', .2, {...base, speed:5.5, moveYaw:Math.PI/2}], ['stop', .2, {...base, moveYaw:Math.PI/2}],
    ['aim', .6, {...base, aim:1, pitch:.3, moveYaw:Math.PI/2}],
  ] as const;
  for (const [id, duration, state] of scenarios) {
    for (let i=0;i<Math.round(hz*duration);i++) animator.update(1/hz,state);
    const points = Object.fromEntries(joints.map(name=>[name,f.rig.joints[name].getWorldPosition(new THREE.Vector3()).toArray()]));
    const gripError = Object.fromEntries((['R','L'] as const).map(side=>[side, f.rig.handSockets[side].getWorldPosition(new THREE.Vector3()).distanceTo(f.rig.joints.Gun.localToWorld(f.rig.gunAnchors[side==='R'?'grip':'support'].clone()))]));
    samples.push({id, duration, state, facing:animator.facing, points, gripError, finite:Object.values(f.rig.bones).every((b:any)=>b.matrixWorld.elements.every(Number.isFinite))});
  }
  f.dispose(); results.rates.push({hz,samples});
}
results.crossRate = results.rates[0].samples.map((low:any,index:number)=>{const high=results.rates[2].samples[index];return {id:low.id, yawError:Math.abs(Math.atan2(Math.sin(low.facing-high.facing),Math.cos(low.facing-high.facing))), maxJointError:Math.max(...joints.map(name=>new THREE.Vector3().fromArray(low.points[name]).distanceTo(new THREE.Vector3().fromArray(high.points[name]))))};});
await writeFile(`${out}/${label}-metrics.json`,JSON.stringify(results,null,2));console.log(JSON.stringify({label,crossRate:results.crossRate},null,2));
