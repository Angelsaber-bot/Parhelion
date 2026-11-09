import * as THREE from 'three';
import { WEAPONS } from '../../shared/content.ts';
import {updateFinishClock} from '../cosmetics/weaponFinishes.ts';
import {spinSignatureParts} from '../cosmetics/signatureMotion.ts';
import { artPoint, combatArt, disposeTree, makeArtMount, weaponArtPool, type ArtInstance, type WeaponArtPool } from './weaponArt.ts';
export interface GunPresentation {
  group: THREE.Group; muzzle: THREE.Object3D; sight: THREE.Vector3;
  ready: Promise<void>;
  animate(kick: number, reload: number): void;
  /** Briefly brighten the finish's lit details (equip, inspect). */
  flare?(amount: number): void;
  /** Aim-down-sights progress: ambient motes clear out of the sight picture. */
  focus?(aim: number): void;
  dispose(): void;
}
let artWarmer: ((root: THREE.Object3D, firstPerson: boolean) => Promise<unknown>) | null = null;
/** The scene compiles loaded gun art against the pass it is really drawn in (see ArenaScene). */
export function setGunArtWarmer(warm: typeof artWarmer) { artWarmer = warm; }
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
  // Reactive finish: lit details flare with each shot or swing and on equip, then settle.
  const glows: { material: THREE.MeshStandardMaterial; base: number }[] = [];
  let flare = 0, lastNow = 0;
  group.userData.artState = 'loading';
  const ready = (handle?.ready ?? Promise.resolve(null)).then(async (loaded) => {
    if (dead || !loaded || !def) return;
    if (firstPerson) loaded.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false; mesh.receiveShadow = false;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (/^PH_glass(?:[._]?\d+)?$/.test(m.name)) { m.transparent = true; m.opacity = 0.12; m.depthWrite = false; }
      }
    });
    // Compile the art's shaders off the frame while the fallback is still showing, so a rival's
    // freshly loaded gun never stalls the match on the frame it first appears.
    if (artWarmer) { const warm = artWarmer; await Promise.resolve().then(() => warm(loaded.root, firstPerson)).catch(() => undefined); if (dead) return; }
    art = loaded;
    group.add(makeArtMount(def, art.root));
    if (def.muzzle) muzzle.position.copy(artPoint(def, def.muzzle));
    if (def.sight) sight.copy(artPoint(def, def.sight));
    for (const [role, part] of Object.entries(art.parts)) poses.set(role, part.position.clone());
    group.remove(fallback.group); disposeTree(fallback.group, false); fallbackLive = false;
    art.root.traverse((o) => { const mesh = o as THREE.Mesh; if (!mesh.isMesh) return; for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) { const std = m as THREE.MeshStandardMaterial; if (std.isMeshStandardMaterial && /glow/i.test(std.name) && !glows.some(g => g.material === std)) glows.push({ material: std, base: std.emissiveIntensity }); } });
    flare = 1.1;
    group.userData.artState = 'ready'; group.userData.artId = def.id;
  }).catch((error: unknown) => {
    handle?.release();
    if (!dead) { group.userData.artState = 'fallback'; console.warn('Weapon art unavailable; procedural fallback retained.', error); }
  });
  return {
    group, muzzle, sight, ready,
    animate(kick, reload) {
      const now = performance.now()/1000;
      updateFinishClock(now);
      if (!art) return;
      const dt = lastNow ? Math.min(.1, Math.max(0, now - lastNow)) : 0; lastNow = now;
      flare = Math.max(flare * Math.exp(-dt * 6), Math.min(1, Math.max(0, kick)));
      for (const g of glows) g.material.emissiveIntensity = g.base * (1 + 2.6 * flare);
      spinSignatureParts(art.parts, now, kick);
      // Cosmetic only: preserve authored pivots, reset each pose, never alter fire timing/ammo.
      for (const [role, p] of poses) art.parts[role].position.copy(p);
      if (art.parts.bolt) art.parts.bolt.position.x -= Math.min(1, kick) * 0.12;
      if (art.parts.magazine) art.parts.magazine.position.y -= Math.sin(reload * Math.PI) * 0.65;
      if (art.parts.fore_end) art.parts.fore_end.position.x -= Math.min(1, kick) * 0.25;
    },
    flare(amount) { if (Number.isFinite(amount)) flare = Math.max(flare, amount); },
    focus(aim) { const motes = art?.parts.motes; if (motes) motes.visible = !(aim > .2); },
    dispose() {
      if (dead) return;
      dead = true; handle?.release();
      if (fallbackLive) disposeTree(fallback.group, false);
      group.removeFromParent();
    },
  };
}
