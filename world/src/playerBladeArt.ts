import * as THREE from 'three';
import { createWeaponFinishMaterials } from './weaponFinishMaterials';
import { weaponFinish, type WeaponFinishId } from './weaponFinishes';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { SkinnedCharacterRig } from './skinnedCharacter';
export const REFRACT_GRIP = new THREE.Vector3(-.43, .0355, 0);
export const REFRACT_SCALE = .48;
/** Handle center sits inside curled fingers, 3 cm palmar of the skin socket. */
export const REFRACT_PALM_OFFSET = new THREE.Vector3(0, -.03, 0);
const url = new URL('../../assets/weapons/glb/06_Refract_Blade.glb', import.meta.url).href;
/** Reuse the accepted authored blade, fitted around its measured grip. No extra environment. */
export function attachExplorerBlade(rig: SkinnedCharacterRig, load = (path: string): Promise<{scene: THREE.Group}> => new GLTFLoader().loadAsync(path)) {
 const root = new THREE.Group(); root.name = 'ExplorerMeleeBlade'; root.position.copy(REFRACT_PALM_OFFSET); root.visible = false; root.userData.artState = 'loading';
 rig.handSockets.R.add(root);
 let disposed = false, ready = false, model: THREE.Group | undefined;
 let finish: ReturnType<typeof createWeaponFinishMaterials> | undefined, selectedFinish: WeaponFinishId = 'original';
 const disposeModel = (object: THREE.Object3D) => {
   const gs=new Set<THREE.BufferGeometry>(),ms=new Set<THREE.Material>();
   object.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){gs.add(m.geometry);(Array.isArray(m.material)?m.material:[m.material]).forEach(x=>ms.add(x));}});
   gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());
 };
 const task = load(url).then(asset=>{
   if(disposed){disposeModel(asset.scene);return;}
   model=asset.scene;
   const anchor=new THREE.Group();anchor.rotation.y=-Math.PI/2;anchor.scale.setScalar(REFRACT_SCALE);
   // Source blade points +X and grip lies at x=-.43. The imported handle center is translated into the fitted palm offset.
   model.position.copy(REFRACT_GRIP).negate();anchor.add(model);root.add(anchor);
   model.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){m.castShadow=false;m.receiveShadow=true;}});
   finish=createWeaponFinishMaterials(model,{patterns:false});finish.apply(selectedFinish);
   ready=true;root.userData.artState='ready';
 }).catch(error=>{if(!disposed)root.userData.artState='error';throw new Error(`Refract Blade failed to load: ${error instanceof Error?error.message:String(error)}`);});
 return { root, ready:task,
   setFinish(value:unknown){const definition=weaponFinish(value);if(disposed||!definition)return false;selectedFinish=definition.id;finish?.apply(selectedFinish);return true;},
   get finish(){return selectedFinish;}, get loaded(){return ready&&!disposed;}, update(active:boolean){root.visible=ready&&!disposed&&active&&rig.root.userData.meleeGripReady===true;},
   dispose(){if(disposed)return;disposed=true;finish?.dispose();finish=undefined;root.removeFromParent();if(model)disposeModel(model);ready=false;root.visible=false;root.userData.artState='disposed';} };
}
