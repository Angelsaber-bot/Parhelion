import * as THREE from 'three';
/**
 * Roaming elites wore the ordinary regional kit, so the only thing marking the hardest enemy
 * outside a boss arena was a gold health bar. Each now carries a sashimono — a banner on a back
 * pole — plus a shoulder cord and a rank crest on the brow, tinted to its region.
 *
 * Bind-pose root-space metres on the shared rig (head bone 1.55, chest bone 1.27, shoulders ~1.44).
 * Visual only; the elite profile in minibosses.ts decides every behaviour. One kit per elite id.
 */
export interface EliteCrestColors { cloth: number; trim: number; glow: number }
export const ELITE_CRESTS: Readonly<Record<string, EliteCrestColors>> = Object.freeze({
  elite_oath_knight: { cloth: 0x5b4a42, trim: 0xddaa68, glow: 0xffe3ae },
  elite_reef_captain: { cloth: 0x2c4a4f, trim: 0x66cab8, glow: 0xb2fff1 },
  elite_frost_officer: { cloth: 0x3a4c63, trim: 0x97cbff, glow: 0xe2f5ff },
  elite_ember_samurai: { cloth: 0x5e3b3b, trim: 0xff976a, glow: 0xffe3a1 },
});
export const hasEliteCrest = (id: string | undefined): id is string => !!id && id in ELITE_CRESTS;

const put = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x: number, y: number, z: number, rot: [number, number, number] = [0, 0, 0]) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(...rot); m.castShadow = true; parent.add(m); return m;
};

export function createEliteCrestKit(id: string) {
  const c = ELITE_CRESTS[id] ?? ELITE_CRESTS.elite_oath_knight;
  const geos: THREE.BufferGeometry[] = [];
  const g = <T extends THREE.BufferGeometry>(x: T) => { geos.push(x); return x; };
  const pole = g(new THREE.CylinderGeometry(.012, .014, .78, 7));
  const poleCap = g(new THREE.ConeGeometry(.022, .07, 6));
  const banner = g(new THREE.PlaneGeometry(.23, .5, 1, 4));
  const bannerEdge = g(new THREE.BoxGeometry(.252, .018, .006));
  const bannerTail = g(new THREE.ConeGeometry(.04, .09, 3));
  const mount = g(new THREE.BoxGeometry(.075, .085, .05));
  const mountStrap = g(new THREE.BoxGeometry(.3, .035, .022));
  const cord = g(new THREE.TorusGeometry(.078, .009, 6, 16));
  const tassel = g(new THREE.ConeGeometry(.018, .072, 6)); tassel.translate(0, -.036, 0);
  const crest = g(new THREE.ConeGeometry(.026, .1, 3));
  const crestBar = g(new THREE.BoxGeometry(.148, .018, .024));
  const rankGem = g(new THREE.OctahedronGeometry(.021));
  const mats = {
    cloth: new THREE.MeshStandardMaterial({ name: 'EliteBanner', color: c.cloth, roughness: .9, side: THREE.DoubleSide }),
    trim: new THREE.MeshStandardMaterial({ name: 'EliteBannerTrim', color: c.trim, metalness: .62, roughness: .4 }),
    wood: new THREE.MeshStandardMaterial({ name: 'EliteBannerPole', color: 0x4b3a2a, roughness: .92 }),
    leather: new THREE.MeshStandardMaterial({ name: 'EliteBannerMount', color: 0x37291f, roughness: .9 }),
    glow: new THREE.MeshStandardMaterial({ name: 'EliteRankGem', color: c.glow, emissive: c.trim, emissiveIntensity: .7, metalness: .3, roughness: .2 }),
  };
  return {
    attach(actor: THREE.Object3D) {
      const chest = actor.getObjectByName('chest'), head = actor.getObjectByName('head'); if (!chest) return null;
      const body = new THREE.Group(), brow = new THREE.Group();
      body.name = 'EliteSashimono'; brow.name = 'EliteRankCrest';
      body.userData.visualOnly = brow.userData.visualOnly = true;
      // Back pole in a leather mount, strapped across the shoulder blades.
      put(mountStrap, mats.leather, body, 0, 1.33, -.112, [0, 0, .12]);
      put(mount, mats.leather, body, -.055, 1.27, -.124);
      put(pole, mats.wood, body, -.055, 1.62, -.142, [-.1, 0, 0]);
      put(poleCap, mats.trim, body, -.055, 2.02, -.164, [-.1, 0, 0]);
      const flag = put(banner, mats.cloth, body, .075, 1.76, -.154, [-.1, 0, 0]); flag.userData.dynamic = true;
      put(bannerEdge, mats.trim, body, .075, 2.0, -.157, [-.1, 0, 0]);
      put(bannerEdge, mats.trim, body, .075, 1.52, -.147, [-.1, 0, 0]);
      for (let i = 0; i < 3; i++) put(bannerTail, mats.cloth, body, .005 + i * .07, 1.5, -.147, [Math.PI, 0, 0]);
      // Shoulder cord with tassels: the rank, worn where a player sees it first.
      for (const sign of [-1, 1]) {
        put(cord, mats.trim, body, sign * .165, 1.435, .01, [.22, sign * .35, 0]);
        put(tassel, mats.cloth, body, sign * .185, 1.37, .055);
        put(rankGem, mats.glow, body, sign * .2, 1.455, .035);
      }
      if (head) {
        put(crestBar, mats.trim, brow, 0, 1.722, .085);
        put(crest, mats.trim, brow, 0, 1.79, .08, [-.3, 0, 0]);
        put(rankGem, mats.glow, brow, 0, 1.724, .102);
      }
      actor.add(body); actor.updateWorldMatrix(true, true); chest.attach(body);
      if (head) { actor.add(brow); actor.updateWorldMatrix(true, true); head.attach(brow); }
      return {
        remove() { body.removeFromParent(); brow.removeFromParent(); },
        update(e: { mode: string }, t: number) {
          // The banner stirs as the elite moves and snaps taut on the wind-up.
          const sway = e.mode === 'chase' ? .09 : e.mode === 'windup' ? .02 : .05;
          flag.rotation.z = Math.sin(t * (e.mode === 'chase' ? 4.4 : 1.7)) * sway;
          mats.glow.emissiveIntensity = e.mode === 'windup' ? 1.4 : .7;
        },
      };
    },
    dispose() { geos.forEach(x => x.dispose()); Object.values(mats).forEach(m => m.dispose()); },
  };
}
