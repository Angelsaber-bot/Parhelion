import * as THREE from 'three';
import { WEAPONS } from '../shared/content.ts';
import { artPoint, combatArt, disposeTree, makeArtMount, weaponArtPool, type ArtInstance, type WeaponArtPool } from './weaponArt.ts';
export interface GunPresentation {
  group: THREE.Group; muzzle: THREE.Object3D; sight: THREE.Vector3;
  ready: Promise<void>;
  animate(kick: number, reload: number): void;
  dispose(): void;
}
/** Fallback is visible immediately; the successful async load swaps only visuals and anchors. */
export function attachGunArt(weapon: number, skin: number, fallback: { group: THREE.Group; muzzle: THREE.Object3D }, firstPerson = false, pool: WeaponArtPool = weaponArtPool): GunPresentation {
  const group = new THREE.Group(), muzzle = new THREE.Object3D();
  muzzle.name = 'Muzzle'; muzzle.position.copy(fallback.muzzle.position);
  group.add(fallback.group, muzzle);
  const sight = new THREE.Vector3(0, weapon === 2 ? 0.1 : 0.088, 0.02);
  const def = combatArt(WEAPONS[weapon].id);
  const colors = WEAPONS[weapon].skins[skin] ?? WEAPONS[weapon].skins[0];
  const handle = def ? pool.acquire(def, colors) : null;
  let dead = false, fallbackLive = true, art: ArtInstance | null = null;
  const poses = new Map<string, THREE.Vector3>();
  group.userData.artState = 'loading';
  const ready = (handle?.ready ?? Promise.resolve(null)).then((loaded) => {
    if (dead || !loaded || !def) return;
    art = loaded;
    group.add(makeArtMount(def, art.root));
    muzzle.position.copy(artPoint(def, def.muzzle!));
    if (def.sight) sight.copy(artPoint(def, def.sight));
    for (const [role, part] of Object.entries(art.parts)) poses.set(role, part.position.clone());
    if (firstPerson) art.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false; mesh.receiveShadow = false;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (/^PH_glass(?:[._]?\d+)?$/.test(m.name)) { m.transparent = true; m.opacity = 0.12; m.depthWrite = false; }
      }
    });
    group.remove(fallback.group); disposeTree(fallback.group, false); fallbackLive = false;
    group.userData.artState = 'ready'; group.userData.artId = def.id;
  }).catch((error: unknown) => {
    handle?.release();
    if (!dead) { group.userData.artState = 'fallback'; console.warn('Weapon art unavailable; procedural fallback retained.', error); }
  });
  return {
    group, muzzle, sight, ready,
    animate(kick, reload) {
      if (!art) return;
      // Cosmetic only: preserve authored pivots, reset each pose, never alter fire timing/ammo.
      for (const [role, p] of poses) art.parts[role].position.copy(p);
      if (art.parts.bolt) art.parts.bolt.position.x -= Math.min(1, kick) * 0.12;
      if (art.parts.magazine) art.parts.magazine.position.y -= Math.sin(reload * Math.PI) * 0.65;
      if (art.parts.fore_end) art.parts.fore_end.position.x -= Math.min(1, kick) * 0.25;
    },
    dispose() {
      if (dead) return;
      dead = true; handle?.release();
      if (fallbackLive) disposeTree(fallback.group, false);
      group.removeFromParent();
    },
  };
}
