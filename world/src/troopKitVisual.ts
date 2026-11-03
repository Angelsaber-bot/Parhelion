import * as THREE from 'three';
/**
 * Field kit for ordinary soldiers. Every enemy in a region shares one authored model, so a patrol
 * of six reads as six stamps of the same figure. Each soldier now carries one small deterministic
 * piece of personal kit — a bedroll, a canteen and haversack, a half-cloak, or a helmet feather —
 * chosen from its id, so a line of guards looks like a line of people.
 *
 * Bind-pose root-space metres on the shared rig (head bone 1.55, chest bone 1.27, shoulders ~1.44).
 * Nothing may cross the face or the weapon hand: the kit must never hide a tell.
 * Visual only; one shared kit per EnemyVisuals, every geometry and material disposed with it.
 */
export const TROOP_VARIANTS = ['none', 'bedroll', 'canteen', 'cloak', 'feather'] as const;
export type TroopVariant = typeof TROOP_VARIANTS[number];

/** Stable per-enemy choice: the same soldier keeps the same kit across LOD swaps and era seams. */
export function troopVariant(id: string): TroopVariant {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TROOP_VARIANTS[h % TROOP_VARIANTS.length];
}

const put = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x: number, y: number, z: number, rot: [number, number, number] = [0, 0, 0]) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(...rot); m.castShadow = true; parent.add(m); return m;
};

export function createTroopKit() {
  const geos: THREE.BufferGeometry[] = [];
  const g = <T extends THREE.BufferGeometry>(x: T) => { geos.push(x); return x; };
  const roll = g(new THREE.CylinderGeometry(.052, .052, .34, 10)); roll.rotateZ(Math.PI / 2);
  const rollCap = g(new THREE.CylinderGeometry(.053, .044, .018, 10)); rollCap.rotateZ(Math.PI / 2);
  const strap = g(new THREE.BoxGeometry(.022, .12, .016));
  const beltStrap = g(new THREE.BoxGeometry(.26, .03, .018));
  const canteen = g(new THREE.CylinderGeometry(.045, .045, .05, 12)); canteen.rotateX(Math.PI / 2);
  const stopper = g(new THREE.CylinderGeometry(.013, .015, .022, 8));
  const haversack = g(new THREE.BoxGeometry(.13, .11, .06));
  const flap = g(new THREE.BoxGeometry(.136, .045, .066));
  const cloak = g(new THREE.CylinderGeometry(.16, .25, .34, 16, 1, true, Math.PI * .1, Math.PI * .95));
  const cloakHem = g(new THREE.CylinderGeometry(.25, .258, .028, 16, 1, true, Math.PI * .1, Math.PI * .95));
  const pin = g(new THREE.TorusGeometry(.022, .007, 6, 14));
  const quill = g(new THREE.ConeGeometry(.014, .2, 4));
  const vane = g(new THREE.BoxGeometry(.004, .14, .035));
  const socket = g(new THREE.CylinderGeometry(.016, .02, .035, 8));
  const mats = {
    canvas: new THREE.MeshStandardMaterial({ name: 'TroopCanvas', color: 0x9a8a68, roughness: .95 }),
    canvasShade: new THREE.MeshStandardMaterial({ name: 'TroopCanvasShade', color: 0x6f6349, roughness: .96 }),
    leather: new THREE.MeshStandardMaterial({ name: 'TroopLeather', color: 0x453123, roughness: .9 }),
    tin: new THREE.MeshStandardMaterial({ name: 'TroopTin', color: 0x8d949c, metalness: .72, roughness: .42 }),
    wool: new THREE.MeshStandardMaterial({ name: 'TroopCloak', color: 0x4a4a55, roughness: .92, side: THREE.DoubleSide }),
    woolShade: new THREE.MeshStandardMaterial({ name: 'TroopCloakHem', color: 0x33333d, roughness: .94, side: THREE.DoubleSide }),
    brass: new THREE.MeshStandardMaterial({ name: 'TroopBrass', color: 0xa8873f, metalness: .78, roughness: .34 }),
    feather: new THREE.MeshStandardMaterial({ name: 'TroopFeather', color: 0xc4ccd4, roughness: .86, side: THREE.DoubleSide }),
  };
  return {
    /** Returns null when this soldier draws no kit, or when the rig has no bone to hang it from. */
    attach(actor: THREE.Object3D, id: string) {
      const variant = troopVariant(id);
      if (variant === 'none') return null;
      const chest = actor.getObjectByName('chest'), head = actor.getObjectByName('head');
      if (!chest) return null;
      const body = new THREE.Group(); body.name = `TroopKit_${variant}`; body.userData.visualOnly = true;
      if (variant === 'bedroll') {
        put(roll, mats.canvas, body, 0, 1.245, -.158, [0, 0, .1]);
        put(rollCap, mats.canvasShade, body, -.172, 1.228, -.158, [0, 0, .1]);
        put(rollCap, mats.canvasShade, body, .172, 1.262, -.158, [0, 0, .1]);
        for (const x of [-.08, .08]) put(strap, mats.leather, body, x, 1.245, -.148, [0, 0, .1]);
      } else if (variant === 'canteen') {
        put(beltStrap, mats.leather, body, 0, 1.16, .1, [-.06, 0, -.5]);
        put(canteen, mats.tin, body, -.16, 1.1, .07);
        put(stopper, mats.leather, body, -.16, 1.13, .07);
        put(haversack, mats.canvas, body, .155, 1.09, .055, [0, 0, .1]);
        put(flap, mats.canvasShade, body, .155, 1.14, .058, [0, 0, .1]);
      } else if (variant === 'cloak') {
        // Hung off one shoulder only, so the sword arm and the chest tells stay clear.
        put(cloak, mats.wool, body, -.03, 1.3, -.03, [0, .5, .06]);
        put(cloakHem, mats.woolShade, body, -.03, 1.14, -.03, [0, .5, .06]);
        put(pin, mats.brass, body, -.14, 1.44, .055, [0, Math.PI / 2, 0]);
      } else if (head) {
        put(socket, mats.leather, body, .085, 1.73, -.01, [0, 0, -.22]);
        put(quill, mats.feather, body, .105, 1.84, -.015, [-.1, 0, -.22]);
        put(vane, mats.feather, body, .112, 1.86, -.015, [-.1, 0, -.22]);
      } else return null;
      const bone = variant === 'feather' ? head! : chest;
      actor.add(body); actor.updateWorldMatrix(true, true); bone.attach(body);
      return { variant, remove() { body.removeFromParent(); } };
    },
    dispose() { geos.forEach(x => x.dispose()); Object.values(mats).forEach(m => m.dispose()); },
  };
}
