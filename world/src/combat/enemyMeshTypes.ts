import type * as THREE from 'three';
/** Three's documented brand flags work across loader/module boundaries; instanceof
 * silently skips valid GLTF objects when an embedding host has a second constructor. */
export const isEnemyMesh = (value: THREE.Object3D): value is THREE.Mesh => (value as THREE.Mesh).isMesh === true;
export const isEnemySkinnedMesh = (value: THREE.Object3D): value is THREE.SkinnedMesh => (value as THREE.SkinnedMesh).isSkinnedMesh === true;
export const isEnemyTexture = (value: unknown): value is THREE.Texture => !!value && typeof value === 'object' && (value as THREE.Texture).isTexture === true;
