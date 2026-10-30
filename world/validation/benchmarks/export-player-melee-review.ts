/** Actual runtime GPU-skin poses evaluated on CPU for offline review; not a browser/FPS test. */
import * as THREE from 'three';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const source=resolve(process.argv[3]);
const {attachExplorerBlade}=await import(pathToFileURL(`${source}/world/src/playerBladeArt.ts`).href);
const {parseLocalGlb}=await import(pathToFileURL(`${source}/world/validation/player-fixture.ts`).href);
const {playerFixture}=await import(pathToFileURL(`${source}/world/validation/player-fixture.ts`).href);
const {SkinnedCharacterAnimator}=await import(pathToFileURL(`${source}/world/src/skinnedCharacter.ts`).href);

const out = process.argv[2]; if (!out) throw new Error('Provide local output directory');
const label = process.argv[4] ?? 'after'; await mkdir(out, { recursive: true });
const base = { speed: 0, onGround: true, swimming: false, vy: 0, moveYaw: 0 };
async function dump(root: THREE.Object3D, id: string) {
  root.updateWorldMatrix(true, true); const meshes: any[] = [];
  root.traverseVisible(object => {
    const mesh = object as THREE.Mesh; if (!mesh.isMesh || mesh.userData.playerOutline) return;
    const count = mesh.geometry.attributes.position.count, positions = new Float32Array(count * 3), uv = new Float32Array(count * 4);
    const point = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld).toArray(positions, i * 3);
      for (const [channel, name] of ['uv', 'uv1'].entries()) {
        const attr = mesh.geometry.attributes[name]; if (attr) { uv[i * 4 + channel * 2] = attr.getX(i); uv[i * 4 + channel * 2 + 1] = attr.getY(i); }
      }
    }
    const index = mesh.geometry.index, indices = new Uint32Array(index ? index.array : Array.from({ length: count }, (_, i) => i));
    meshes.push({ name: mesh.name, file: `${id}-${meshes.length}.bin`, count, indices: indices.length, groups: mesh.geometry.groups,
      materials: (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(material => {
        const m = material as THREE.MeshStandardMaterial;
        return { name: m.name, color: m.color.toArray(), roughness: m.roughness, metalness: m.metalness };
      }), data: Buffer.concat([Buffer.from(positions.buffer), Buffer.from(uv.buffer), Buffer.from(indices.buffer)]) });
  });
  for (const mesh of meshes) { await writeFile(`${out}/${mesh.file}`, mesh.data); delete mesh.data; }
  await writeFile(`${out}/${id}.json`, JSON.stringify({ id, label, assets: [
    `${source}/assets/characters/player_v2/player_v2.glb`,
    `${source}/assets/weapons/glb/01_Dawn_AR.glb`,
    `${source}/assets/weapons/glb/06_Refract_Blade.glb`,
  ], meshes, joints: Object.fromEntries(['Arm_R','Forearm_R','Hand_R','Arm_L','Forearm_L','Hand_L'].map(name => {
    const side = name.endsWith('_R') ? 'R' : 'L';
    const bone = root.getObjectByName(`J_Bip_${side}_${name.startsWith('Forearm') ? 'LowerArm' : name.startsWith('Hand') ? 'Hand' : 'UpperArm'}`)!;
    return [name,bone.getWorldPosition(new THREE.Vector3()).toArray()];
  })), framing: { center: [0, 1.18, .05], size: 1.12 } }));
}
const f=await playerFixture(),animator=new SkinnedCharacterAnimator(f.rig),blade=attachExplorerBlade(f.rig,()=>parseLocalGlb(pathToFileURL(`${source}/assets/weapons/glb/06_Refract_Blade.glb`)));await blade.ready;blade.update(true);
if(process.argv[5]==='sequence'){
 const {PlayerMelee}=await import(pathToFileURL(`${source}/world/src/playerMelee.ts`).href);const melee=new PlayerMelee();for(let i=0;i<60;i++)animator.update(1/60,base);melee.press(0);
 for(let frame=0;frame<132;frame++){if(melee.active&&melee.phase>.6)melee.press(0);melee.update(1/60,true);animator.update(1/60,{...base,melee:melee.active?{phase:melee.phase,combo:melee.combo,yaw:0}:undefined});blade.update(melee.active);if(frame%5===0)await dump(f.rig.root,`${label}-${String(frame).padStart(3,'0')}`);}
}else{
 for(const combo of[0,1,2])for(const phase of[.18,.4,.65]){animator.reset(true);for(let i=0;i<60;i++)animator.update(1/60,base);animator.update(1/60,{...base,melee:{phase,combo,yaw:0}});blade.update(true);await dump(f.rig.root,`${label}-cut${combo}-phase${phase}`);}
}
blade.dispose();f.dispose();console.log('Exported actual three-beat melee poses');
