/** Actual EnemyVisuals CPU-skinned sequence. Offline images, NOT browser/WebGL/FPS evidence. */
import * as THREE from 'three';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { EnemyVisuals, type EnemyModel } from '../../src/enemyVisuals.ts';
import { WorldCombatState, enemyAttackTiming } from '../../src/combat.ts';
import { ENEMY_WEAPON_HAND, measureEnemyWeaponAxis } from '../../src/enemyAttackActing.ts';
import { enemyAttackPose } from '../../src/enemyAttackPresentation.ts';
import { parseLocalGlb } from '../player-fixture.ts';
const out = path.resolve(process.argv[2] ?? '../artifacts/enemy-contact-sequence');
const models = (process.argv[3]?.split(',') ?? ['ashigaru','samurai','officer','sunward_guard','deck_raider','musketeer']) as EnemyModel[];
await mkdir(out, { recursive: true });
for (const model of models) {
  const url = new URL(`../../public/assets/enemies/${model}.glb`, import.meta.url), asset = fileURLToPath(url);
  const gltf = await parseLocalGlb(url), visuals = new EnemyVisuals(); (visuals as any).cache.set(model, gltf);
  const enemy = new WorldCombatState([{ id: model, kind: 'shade', p: { x: 0, y: 0, z: 0 }, role: model === 'ashigaru' ? 'lancer' : model === 'musketeer' ? 'musketeer' : model === 'sunward_guard' || model === 'officer' ? 'breaker' : 'duelist' }], []).enemies[0];
  enemy.active = true; enemy.attackCount = 1; enemy.contactSequence = 1;
  const parent = new THREE.Group(), fallback = new THREE.Group(), timing = enemyAttackTiming(enemy);
  const sequence = Number(process.argv.find(value => value.startsWith('--frames='))?.slice(9) ?? 0);
  const stages: readonly (readonly [string, 'windup'|'recover', number])[] = sequence > 1 ? Array.from({length:sequence},(_,index) => {
    const elapsed=(timing.windup+timing.recovery)*index/(sequence-1);
    return [`frame-${String(index).padStart(3,'0')}`,elapsed<timing.windup?'windup':'recover',elapsed<timing.windup?timing.windup-elapsed:timing.windup+timing.recovery-elapsed] as const;
  }) : [
    ['00-ready', 'windup', timing.windup], ['01-held', 'windup', .22], ['02-launch', 'windup', .10],
    ['03-contact', 'recover', timing.recovery], ['04-follow', 'recover', timing.recovery - .12], ['05-settle', 'recover', 0],
  ] as const;
  for (const [label, mode, timer] of stages) {
    enemy.mode = mode; enemy.timer = timer;
    visuals.update(enemy, model, parent, fallback, 0, 5, true); parent.updateWorldMatrix(true, true);
    const instance = (visuals as any).instances.get(enemy.id), actor = instance.root as THREE.Object3D;
    const feet = ['footR','footL'].map(name => actor.getObjectByName(name)!);
    const footPos = feet.map(foot => foot.getWorldPosition(new THREE.Vector3()));
    const pelvisPos = actor.getObjectByName('pelvis')!.getWorldPosition(new THREE.Vector3());
    const side = ENEMY_WEAPON_HAND[model as keyof typeof ENEMY_WEAPON_HAND], measured = side ? measureEnemyWeaponAxis(gltf.scene,side) : undefined;
    const bladeDirection = measured ? measured.axis.clone().applyQuaternion(actor.getObjectByName(`hand${side}`)!.getWorldQuaternion(new THREE.Quaternion())).toArray() : null;
    instance.acting.restore(); actor.updateWorldMatrix(true,true);
    const drift = feet.map((foot,index) => foot.getWorldPosition(new THREE.Vector3()).distanceTo(footPos[index]));
    const pelvisShift = pelvisPos.clone().sub(actor.getObjectByName('pelvis')!.getWorldPosition(new THREE.Vector3())).toArray();
    instance.acting.update(enemy); parent.updateWorldMatrix(true,true);
    const metrics = {footDrift:drift,pelvisShift,bladeDirection};
    const id = `${model}-${label}`, meshes: any[] = [], point = new THREE.Vector3();
    parent.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return; const mesh = object;
      if (mesh instanceof THREE.SkinnedMesh) mesh.skeleton.update();
      const count = mesh.geometry.attributes.position.count, positions = new Float32Array(count * 3), uvs = new Float32Array(count * 2), colors = new Float32Array(count * 4);
      for (let i = 0; i < count; i++) {
        mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld); positions.set(point.toArray(), i * 3);
        const uv = mesh.geometry.attributes.uv; if (uv) { uvs[i * 2] = uv.getX(i); uvs[i * 2 + 1] = uv.getY(i); }
        const c = mesh.geometry.attributes.color; colors.set(c ? [c.getX(i), c.getY(i), c.getZ(i), c.itemSize === 4 ? c.getW(i) : 1] : [1, 1, 1, 1], i * 4);
      }
      const index = mesh.geometry.index, indices = new Uint32Array(index ? Array.from(index.array) : Array.from({ length: count }, (_, i) => i));
      const file = `${id}-${meshes.length}.bin`, data = Buffer.concat([Buffer.from(positions.buffer), Buffer.from(uvs.buffer), Buffer.from(colors.buffer), Buffer.from(indices.buffer)]);
      meshes.push({ name: mesh.name, file, count, indices: indices.length, groups: mesh.geometry.groups, materials: [mesh.material].flat().map(m => m.name), data });
    });
    for (const mesh of meshes) { await writeFile(path.join(out, mesh.file), mesh.data); delete mesh.data; }
    await writeFile(path.join(out, `${id}.json`), JSON.stringify({ id, asset, label, metrics, state: { mode, timer }, pose: enemyAttackPose(enemy, model), framing: { center: [0, 1.1, .3], size: model === 'ashigaru' ? 3.7 : 3.2 }, meshes }));
  }
  visuals.dispose(); console.log(`exported ${model}: 6 actual runtime poses`);
}
