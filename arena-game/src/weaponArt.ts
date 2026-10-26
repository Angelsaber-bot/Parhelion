// Presentation only. Do not import into the simulation or Worker.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import registry from '../../assets/weapons/registry.json';
export const WEAPON_ART = registry;
export type ArtDef = typeof registry[number];
// Explicit static URLs are fingerprinted by Vite; no download until acquire().
export const ART_URLS: Record<string, string> = {
  dawn: new URL('../../assets/weapons/glb/01_Dawn_AR.glb', import.meta.url).href,
  firefly: new URL('../../assets/weapons/glb/02_Firefly_SMG.glb', import.meta.url).href,
  afterglow: new URL('../../assets/weapons/glb/03_Afterglow_Shotgun.glb', import.meta.url).href,
  meridian: new URL('../../assets/weapons/glb/04_Meridian_DMR.glb', import.meta.url).href,
  longnight: new URL('../../assets/weapons/glb/05_Longnight_Sniper.glb', import.meta.url).href,
  refract: new URL('../../assets/weapons/glb/06_Refract_Blade.glb', import.meta.url).href,
  meteor: new URL('../../assets/weapons/glb/07_Meteor_Polearm.glb', import.meta.url).href,
  faultline: new URL('../../assets/weapons/glb/08_Faultline_Hammer.glb', import.meta.url).href,
};
export const combatArt = (weaponId: string) => WEAPON_ART.find((a) => a.combat === weaponId);
/** Dispose unique owned resources only once; never use on borrowed geometry clones. */
export function disposeTree(root: THREE.Object3D, textures = true) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), maps = new Set<THREE.Texture>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) geometries.add(m.geometry);
    if (m.material) for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      materials.add(mat);
      if (textures) for (const v of Object.values(mat)) if (v instanceof THREE.Texture) maps.add(v);
    }
  });
  geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); maps.forEach((t) => t.dispose());
}
export interface ArtInstance { root: THREE.Group; parts: Record<string, THREE.Object3D> }
export interface ArtHandle { ready: Promise<ArtInstance | null>; release(): void }
type Entry = { refs: number; promise: Promise<THREE.Group>; source?: THREE.Group };
/** One geometry per active model, instance-owned materials/poses, no unbounded cache. */
export class WeaponArtPool {
  private entries = new Map<string, Entry>();
  constructor(private load: (url: string) => Promise<THREE.Group> = async (url) => (await new GLTFLoader().loadAsync(url)).scene) {}
  get size() { return this.entries.size; }
  acquire(def: ArtDef, colors?: { body: number; accent: number }): ArtHandle {
    let entry = this.entries.get(def.id);
    if (!entry) {
      entry = { refs: 0, promise: Promise.resolve(null as unknown as THREE.Group) };
      const e = entry;
      e.promise = Promise.resolve().then(() => this.load(ART_URLS[def.id])).then((root) => {
        e.source = root;
        if (e.refs === 0) { disposeTree(root); if (this.entries.get(def.id) === e) this.entries.delete(def.id); }
        return root;
      }, (error) => { if (this.entries.get(def.id) === e) this.entries.delete(def.id); throw error; });
      this.entries.set(def.id, e);
    }
    const e = entry;
    e.refs++;
    let released = false, instance: ArtInstance | undefined;
    const owned = new Set<THREE.Material>();
    const release = () => {
      if (released) return;
      released = true;
      instance?.root.removeFromParent(); owned.forEach((m) => m.dispose());
      if (--e.refs === 0 && e.source) { disposeTree(e.source); if (this.entries.get(def.id) === e) this.entries.delete(def.id); }
    };
    const ready = e.promise.then((source) => {
      if (released) return null;
      const root = source.clone(true);
      const cloned = new Map<THREE.Material, THREE.Material>();
      const material = (mat: THREE.Material) => {
        let m = cloned.get(mat);
        if (!m) {
          m = mat.clone(); cloned.set(mat, m); owned.add(m);
          const pbr = m as THREE.MeshStandardMaterial;
          if (colors && pbr.isMeshStandardMaterial) {
            if (/^PH_ivory(?:[._]?\d+)?$/.test(m.name)) pbr.color.setHex(colors.body);
            if (/^PH_glow(?:[._]?\d+)?$/.test(m.name)) { pbr.color.setHex(colors.accent); pbr.emissive.setHex(colors.accent); }
          }
        }
        return m;
      };
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.material = Array.isArray(m.material) ? m.material.map(material) : material(m.material);
        m.castShadow = true; m.receiveShadow = true;
      });
      // Direct asset-root children only: GLTFLoader primitive children may duplicate part names.
      const asset = root.children.find((o) => o.name === `${def.file}_ROOT`);
      if (!asset) { release(); throw new Error(`武器资产缺少 ${def.file}_ROOT`); }
      const parts: Record<string, THREE.Object3D> = {};
      for (const node of asset.children) if (node.name.startsWith(`${def.file}__`)) parts[node.name.slice(`${def.file}__`.length)] = node;
      instance = { root, parts };
      return instance;
    });
    return { ready, release };
  }
}
export const weaponArtPool = new WeaponArtPool();
/** glTF +X forward/+Y up -> game -Z forward/+Y up: rotate Y exactly once. */
export function makeArtMount(def: ArtDef, root: THREE.Object3D) {
  const mount = new THREE.Group(); mount.name = `Art_${def.id}`;
  mount.rotation.y = Math.PI / 2; mount.scale.setScalar(def.scale); mount.position.fromArray(def.offset); mount.add(root);
  return mount;
}
export function artPoint(def: ArtDef, raw: number[]) {
  return new THREE.Vector3(raw[2], raw[1], -raw[0]).multiplyScalar(def.scale).add(new THREE.Vector3().fromArray(def.offset));
}
