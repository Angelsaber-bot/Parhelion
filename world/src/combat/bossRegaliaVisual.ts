import * as THREE from 'three';
/**
 * Champion regalia. Every chapter boss shares one authored human rig, so the silhouette that tells
 * 空位之王 from 亡航提督 has to be built here: layered procedural regalia pinned to the head and chest
 * bones, in bind-pose root-space metres (the boss body group scales the whole lot by 1.8).
 *
 * The authored kits are already dressed — the guard wears a helm, the raider a tricorn, the officer
 * a shako, the samurai a kabuto — so regalia augments what is there instead of stacking a second
 * hat on top of it. Rig landmarks: head bone 1.55, eyes ~1.69, chin ~1.58, chest bone 1.27,
 * shoulders ~1.44; the authored silhouette tops out at 1.85 (guard) to 2.16 (officer's shako).
 *
 * Visual only — every behaviour stays in the simulation. One kit per boss id per EnemyVisuals,
 * built the first time that champion is seen and disposed with the world.
 */
export type BossRegaliaId = 'boss_vacant_king' | 'boss_drowned_admiral' | 'boss_winter_warden' | 'boss_hellfire_lord';
type Rot = [number, number, number];
export interface BossRegalia { remove(): void; update?(e: { mode: string }, t: number): void }

const put = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x: number, y: number, z: number, rot: Rot = [0, 0, 0]) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(...rot); m.castShadow = true; parent.add(m); return m;
};
/** Collects geometries and materials so one dispose() frees the whole kit. */
function bin() {
  const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [];
  return {
    g: <T extends THREE.BufferGeometry>(x: T) => { geos.push(x); return x; },
    m: <T extends THREE.Material>(x: T) => { mats.push(x); return x; },
    dispose() { geos.forEach(x => x.dispose()); mats.forEach(x => x.dispose()); },
  };
}

/** 落日王国 · 空位之王: the crown of an empty throne — a circlet with its front tooth missing and its
 *  neighbour snapped, worn over the guard helm, a sun mantle hung off the back, and a broken halo. */
function vacantKing() {
  const b = bin();
  const band = b.g(new THREE.TorusGeometry(.142, .021, 8, 28)); band.rotateX(Math.PI / 2);
  const velvet = b.g(new THREE.TorusGeometry(.14, .016, 6, 24)); velvet.rotateX(Math.PI / 2);
  const tooth = b.g(new THREE.ConeGeometry(.036, .17, 4));
  const snapped = b.g(new THREE.ConeGeometry(.034, .07, 4));
  const gem = b.g(new THREE.OctahedronGeometry(.024));
  // A cape hung off the back and shoulders, leaving the chest clear for the chain of office.
  const mantle = b.g(new THREE.CylinderGeometry(.19, .34, .42, 22, 1, true, Math.PI * .34, Math.PI * 1.32));
  const hem = b.g(new THREE.CylinderGeometry(.34, .354, .04, 22, 1, true, Math.PI * .34, Math.PI * 1.32));
  const tatter = b.g(new THREE.BoxGeometry(.08, .24, .008)); tatter.translate(0, -.12, 0);
  const link = b.g(new THREE.TorusGeometry(.021, .007, 5, 10));
  const clasp = b.g(new THREE.CylinderGeometry(.058, .058, .018, 18)); clasp.rotateX(Math.PI / 2);
  const ray = b.g(new THREE.ConeGeometry(.014, .06, 4)); ray.rotateX(-Math.PI / 2);
  const halo = b.g(new THREE.TorusGeometry(.21, .017, 7, 26, Math.PI * .52));
  const gold = b.m(new THREE.MeshStandardMaterial({ name: 'KingCircletGold', color: 0xd7b25a, metalness: .85, roughness: .26 }));
  const goldDark = b.m(new THREE.MeshStandardMaterial({ name: 'KingCircletShade', color: 0x8d6f2c, metalness: .7, roughness: .45 }));
  const cloth = b.m(new THREE.MeshStandardMaterial({ name: 'KingMantle', color: 0x23306a, roughness: .85, side: THREE.DoubleSide }));
  const clothTrim = b.m(new THREE.MeshStandardMaterial({ name: 'KingMantleHem', color: 0x8d6f2c, roughness: .55, metalness: .55, side: THREE.DoubleSide }));
  const stone = b.m(new THREE.MeshStandardMaterial({ name: 'KingCircletStone', color: 0x7ad2ff, emissive: 0x1d5f85, emissiveIntensity: .5, metalness: .3, roughness: .2 }));
  const aura = b.m(new THREE.MeshBasicMaterial({ name: 'KingVacantHalo', color: 0xffd98a, transparent: true, opacity: .68 }));
  return {
    attach(actor: THREE.Object3D): BossRegalia | null {
      const head = actor.getObjectByName('head'), chest = actor.getObjectByName('chest'); if (!head || !chest) return null;
      const crown = new THREE.Group(), body = new THREE.Group();
      crown.name = 'VacantKingCrown'; body.name = 'VacantKingMantle';
      crown.userData.visualOnly = body.userData.visualOnly = true;
      put(velvet, goldDark, crown, 0, 1.772, 0);
      put(band, gold, crown, 0, 1.788, 0);
      // Seven teeth, but the throne is vacant: the front one is gone and its neighbour is snapped.
      for (let i = 0; i < 7; i++) {
        if (i === 0) continue;
        const a = i / 7 * Math.PI * 2, broken = i === 1;
        put(broken ? snapped : tooth, gold, crown, Math.cos(a) * .142, broken ? 1.822 : 1.873, Math.sin(a) * .142, [0, -a, broken ? .3 : 0]);
        if (!broken && i % 2 === 0) put(gem, stone, crown, Math.cos(a) * .142, 1.794, Math.sin(a) * .142);
      }
      // Broken halo: three quarter-arcs of one ring, turning at different speeds above the crown.
      const rings = [0, 1, 2].map(i => { const m = put(halo, aura, crown, 0, 2.06 + i * .04, 0, [Math.PI / 2 - .42 - i * .06, 0, i * 2.1]); m.userData.dynamic = true; return m; });
      put(mantle, cloth, body, 0, 1.3, -.03);
      put(hem, clothTrim, body, 0, 1.11, -.03);
      for (let i = 0; i < 5; i++) put(tatter, cloth, body, -.2 + i * .1, 1.11, -.21 + Math.abs(i - 2) * .05, [.22, 0, (i - 2) * .11]);
      // Chain of office across the open chest, with the sun of the sunward throne as its clasp.
      for (let i = 0; i < 9; i++) put(link, gold, body, -.16 + i * .04, 1.475 - Math.abs(i - 4) * .022, .112, [0, 0, (i - 4) * .26]);
      put(clasp, gold, body, 0, 1.345, .138).scale.setScalar(1.15);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; put(ray, gold, body, Math.cos(a) * .076, 1.345 + Math.sin(a) * .076, .142); }
      actor.add(crown, body); actor.updateWorldMatrix(true, true); head.attach(crown); chest.attach(body);
      return {
        remove() { crown.removeFromParent(); body.removeFromParent(); },
        update(_e, t) { rings.forEach((r, i) => { r.rotation.z = i * 2.1 + t * (.3 + i * .16) * (i % 2 ? -1 : 1); }); },
      };
    },
    dispose() { b.dispose(); },
  };
}

/** 黑帆尽头 · 亡航提督: the raider's own tricorn, drowned — kelp hung off the brim, bullion
 *  epaulettes, an admiral's sash and a brine light that never dried out. */
function drownedAdmiral() {
  const b = bin();
  const kelp = b.g(new THREE.CylinderGeometry(.013, .005, .3, 5)); kelp.translate(0, -.15, 0);
  const kelpShort = b.g(new THREE.CylinderGeometry(.011, .004, .18, 5)); kelpShort.translate(0, -.09, 0);
  const drip = b.g(new THREE.SphereGeometry(.014, 8, 6));
  const epaulette = b.g(new THREE.SphereGeometry(.072, 12, 8, 0, Math.PI * 2, 0, Math.PI * .55));
  const epauletteRim = b.g(new THREE.TorusGeometry(.072, .01, 6, 18)); epauletteRim.rotateX(Math.PI / 2);
  const fringe = b.g(new THREE.CylinderGeometry(.006, .004, .08, 5)); fringe.translate(0, -.04, 0);
  const sash = b.g(new THREE.BoxGeometry(.092, .46, .016));
  const sashEdge = b.g(new THREE.BoxGeometry(.106, .46, .008));
  const star = b.g(new THREE.ConeGeometry(.018, .055, 4)); star.rotateX(-Math.PI / 2);
  const medal = b.g(new THREE.CylinderGeometry(.044, .044, .014, 16)); medal.rotateX(Math.PI / 2);
  const bullion = b.m(new THREE.MeshStandardMaterial({ name: 'AdmiralBullion', color: 0xc9a84e, metalness: .84, roughness: .28 }));
  const bullionDark = b.m(new THREE.MeshStandardMaterial({ name: 'AdmiralBullionShade', color: 0x7d6527, metalness: .7, roughness: .45 }));
  const weed = b.m(new THREE.MeshStandardMaterial({ name: 'AdmiralKelp', color: 0x24402c, roughness: .96, side: THREE.DoubleSide }));
  const weedLight = b.m(new THREE.MeshStandardMaterial({ name: 'AdmiralKelpLight', color: 0x375c3e, roughness: .94, side: THREE.DoubleSide }));
  const brine = b.m(new THREE.MeshBasicMaterial({ name: 'AdmiralBrine', color: 0x8ff0c4, transparent: true, opacity: .75 }));
  const silk = b.m(new THREE.MeshStandardMaterial({ name: 'AdmiralSash', color: 0x6c1420, roughness: .7 }));
  return {
    attach(actor: THREE.Object3D): BossRegalia | null {
      const head = actor.getObjectByName('head'), chest = actor.getObjectByName('chest'); if (!head || !chest) return null;
      const hat = new THREE.Group(), body = new THREE.Group();
      hat.name = 'AdmiralDrownedTricorn'; body.name = 'AdmiralSashAndEpaulettes';
      hat.userData.visualOnly = body.userData.visualOnly = true;
      // Kelp hanging off the authored tricorn's brim, longest at the back.
      // Only the back and sides of the brim: nothing may hang across the champion's face.
      for (let i = 0; i < 11; i++) {
        const a = Math.PI * (.18 + i / 10 * .64), deep = i > 2 && i < 8, side = i % 2 ? 1 : -1;
        const x = Math.sin(a) * .205 * side, z = -Math.cos(a) * .205;
        put(deep ? kelp : kelpShort, i % 2 ? weed : weedLight, hat, x, 1.772, z, [-z * .5, 0, x * .7]).userData.dynamic = true;
        if (i === 3 || i === 7) put(drip, brine, hat, x, 1.59, z);
      }
      for (const sign of [-1, 1]) {
        put(epaulette, bullionDark, body, sign * .205, 1.447, 0);
        put(epaulette, bullion, body, sign * .205, 1.458, 0).scale.set(.9, .62, .9);
        put(epauletteRim, bullion, body, sign * .205, 1.437, 0);
        for (let i = 0; i < 6; i++) put(fringe, bullion, body, sign * .205 + (i - 2.5) * .028, 1.437, .055, [.4, 0, 0]);
      }
      // Sash from the right shoulder to the left hip, with the admiral's star over the heart.
      put(sashEdge, bullion, body, 0, 1.24, .118, [-.08, 0, .58]);
      put(sash, silk, body, 0, 1.24, .126, [-.08, 0, .58]);
      put(medal, bullionDark, body, -.125, 1.3, .168);
      put(medal, bullion, body, -.125, 1.3, .174).scale.setScalar(.72);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; put(star, bullion, body, -.125 + Math.cos(a) * .052, 1.3 + Math.sin(a) * .052, .172); }
      actor.add(hat, body); actor.updateWorldMatrix(true, true); head.attach(hat); chest.attach(body);
      const strands = hat.children.filter(o => (o as THREE.Mesh).material === weed || (o as THREE.Mesh).material === weedLight);
      return {
        remove() { hat.removeFromParent(); body.removeFromParent(); },
        update(_e, t) { strands.forEach((s, i) => { s.rotation.x = .14 + Math.sin(t * 1.1 + i * .7) * .1; }); brine.opacity = .55 + Math.sin(t * 2.2) * .2; },
      };
    },
    dispose() { b.dispose(); },
  };
}

/** 永冬之城 · 最后方阵 (W08): the frozen officer at the centre of the last square, ranks marching with him.
 * Ice grown around the shako and shoulders; the marching ranks are a separate view group (combatView). */
function winterWarden() {
  const b = bin();
  const ring = b.g(new THREE.TorusGeometry(.152, .018, 8, 26)); ring.rotateX(Math.PI / 2);
  const spike = b.g(new THREE.ConeGeometry(.034, .26, 5));
  const collar = b.g(new THREE.TorusGeometry(.128, .054, 8, 22)); collar.rotateX(Math.PI / 2);
  const tuft = b.g(new THREE.SphereGeometry(.036, 8, 6));
  const shard = b.g(new THREE.ConeGeometry(.045, .2, 4));
  const shardSmall = b.g(new THREE.ConeGeometry(.028, .11, 4));
  const rime = b.g(new THREE.OctahedronGeometry(.022));
  const ice = b.m(new THREE.MeshStandardMaterial({ name: 'WardenIce', color: 0xbce6f5, emissive: 0x2a6d8c, emissiveIntensity: .35, metalness: .25, roughness: .16, transparent: true, opacity: .9 }));
  const iceDeep = b.m(new THREE.MeshStandardMaterial({ name: 'WardenIceDeep', color: 0x5f9fbe, emissive: 0x16415a, emissiveIntensity: .3, metalness: .3, roughness: .3 }));
  const fur = b.m(new THREE.MeshStandardMaterial({ name: 'WardenFurCollar', color: 0x4a4038, roughness: .97 }));
  const furLight = b.m(new THREE.MeshStandardMaterial({ name: 'WardenFurTuft', color: 0x6e6153, roughness: .98 }));
  return {
    attach(actor: THREE.Object3D): BossRegalia | null {
      const head = actor.getObjectByName('head'), chest = actor.getObjectByName('chest'); if (!head || !chest) return null;
      const crown = new THREE.Group(), body = new THREE.Group();
      crown.name = 'WinterWardenCrown'; body.name = 'WinterWardenMantle';
      crown.userData.visualOnly = body.userData.visualOnly = true;
      // The crown is not worn: it has grown around the shako, every spike a different height.
      put(ring, iceDeep, crown, 0, 1.95, 0);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2, h = .55 + ((i * 5) % 6) * .17;
        const m = put(spike, ice, crown, Math.cos(a) * .152, 2.04 + h * .07, Math.sin(a) * .152, [Math.sin(a) * .26, 0, -Math.cos(a) * .26]);
        m.scale.set(.92, h, .92);
        if (i % 2 === 0) put(rime, ice, crown, Math.cos(a) * .178, 1.985, Math.sin(a) * .178);
      }
      put(collar, fur, body, 0, 1.452, -.01);
      for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2; put(tuft, furLight, body, Math.cos(a) * .13, 1.466 + Math.sin(i * 2) * .012, Math.sin(a) * .13); }
      // Shoulder ice: two crusted shards per side, leaning outward like a frozen pauldron.
      for (const sign of [-1, 1]) {
        put(shard, ice, body, sign * .178, 1.455, -.01, [-.08, 0, sign * .4]);
        put(shard, iceDeep, body, sign * .196, 1.42, .035, [-.2, 0, sign * .62]).scale.set(.78, .64, .78);
        for (let i = 0; i < 3; i++) put(shardSmall, ice, body, sign * (.152 + i * .018), 1.405 - i * .03, -.04 + i * .045, [-.16, 0, sign * (.5 + i * .14)]);
        put(rime, ice, body, sign * .138, 1.478, .045);
      }
      actor.add(crown, body); actor.updateWorldMatrix(true, true); head.attach(crown); chest.attach(body);
      return {
        remove() { crown.removeFromParent(); body.removeFromParent(); },
        update(_e, t) { ice.emissiveIntensity = .3 + Math.sin(t * 1.6) * .12; },
      };
    },
    dispose() { b.dispose(); },
  };
}

/** 业火京都 · 业火之主: gold kuwagata horns over the authored kabuto, an oni half-mask across the
 *  lower face, and lacquered sode whose seams glow hotter the moment the lord winds up. */
function hellfireLord() {
  const b = bin();
  const horn = b.g(new THREE.ConeGeometry(.032, .42, 4)); horn.translate(0, .21, 0);
  const hornEdge = b.g(new THREE.ConeGeometry(.038, .12, 4)); hornEdge.translate(0, .06, 0);
  const crest = b.g(new THREE.SphereGeometry(.046, 12, 8, 0, Math.PI * 2, 0, Math.PI * .5));
  // Oni half-mask: a lacquered shell across the nose, mouth and chin.
  const maskPlate = b.g(new THREE.SphereGeometry(.102, 16, 12, 0, Math.PI * 2, Math.PI * .46, Math.PI * .42));
  const tusk = b.g(new THREE.ConeGeometry(.015, .055, 5));
  const snarl = b.g(new THREE.BoxGeometry(.016, .012, .03));
  const sode = b.g(new THREE.BoxGeometry(.17, .05, .115));
  const seam = b.g(new THREE.BoxGeometry(.172, .012, .022));
  const iron = b.m(new THREE.MeshStandardMaterial({ name: 'HellfireIron', color: 0x2a2026, metalness: .72, roughness: .44 }));
  const lacquer = b.m(new THREE.MeshStandardMaterial({ name: 'HellfireLacquer', color: 0x6d1420, metalness: .42, roughness: .3 }));
  const lacquerDark = b.m(new THREE.MeshStandardMaterial({ name: 'HellfireLacquerShade', color: 0x42101a, metalness: .35, roughness: .45 }));
  const brass = b.m(new THREE.MeshStandardMaterial({ name: 'HellfireBrass', color: 0xcaa04a, metalness: .85, roughness: .26 }));
  const bone = b.m(new THREE.MeshStandardMaterial({ name: 'HellfireTusk', color: 0xe4d8bd, roughness: .5 }));
  const ember = b.m(new THREE.MeshBasicMaterial({ name: 'HellfireEmber', color: 0xff6a2a }));
  return {
    attach(actor: THREE.Object3D): BossRegalia | null {
      const head = actor.getObjectByName('head'), chest = actor.getObjectByName('chest'); if (!head || !chest) return null;
      const helm = new THREE.Group(), body = new THREE.Group();
      helm.name = 'HellfireKuwagata'; body.name = 'HellfireSode';
      helm.userData.visualOnly = body.userData.visualOnly = true;
      // Kuwagata: two tall gold blades sweeping up and out from the kabuto's brow.
      for (const sign of [-1, 1]) {
        put(horn, brass, helm, sign * .085, 1.8, .03, [-.12, 0, sign * -.38]);
        put(hornEdge, iron, helm, sign * .085, 1.79, .028, [-.12, 0, sign * -.38]);
        put(tusk, bone, helm, sign * .045, 1.6, .095, [-.5, 0, sign * -.25]);
      }
      put(crest, brass, helm, 0, 1.84, .055, [-.3, 0, 0]);
      put(maskPlate, lacquer, helm, 0, 1.646, .012).scale.setScalar(.97);
      for (let i = 0; i < 5; i++) put(snarl, bone, helm, -.044 + i * .022, 1.62, .092 - Math.abs(i - 2) * .008);
      const seams: THREE.Mesh[] = [];
      for (const sign of [-1, 1]) for (let i = 0; i < 3; i++) {
        put(sode, i ? lacquerDark : lacquer, body, sign * (.21 + i * .014), 1.44 - i * .055, 0, [0, 0, sign * -(.18 + i * .07)]);
        const hot = put(seam, ember, body, sign * (.21 + i * .014), 1.414 - i * .055, .006, [0, 0, sign * -(.18 + i * .07)]); hot.userData.dynamic = true; seams.push(hot);
        put(sode, iron, body, sign * (.21 + i * .014), 1.414 - i * .055, 0, [0, 0, sign * -(.18 + i * .07)]).scale.set(1.02, .18, 1.02);
      }
      actor.add(helm, body); actor.updateWorldMatrix(true, true); head.attach(helm); chest.attach(body);
      return {
        remove() { helm.removeFromParent(); body.removeFromParent(); },
        update(e, t) { const hot = e.mode === 'windup' ? 1 : .45; seams.forEach((s, i) => { s.scale.y = hot * (.8 + Math.sin(t * 3 + i) * .35); }); },
      };
    },
    dispose() { b.dispose(); },
  };
}

const BUILDERS = { boss_vacant_king: vacantKing, boss_drowned_admiral: drownedAdmiral, boss_winter_warden: winterWarden, boss_hellfire_lord: hellfireLord } as const;
export const BOSS_REGALIA_IDS = Object.keys(BUILDERS) as readonly BossRegaliaId[];
export const hasBossRegalia = (id: string): id is BossRegaliaId => id in BUILDERS;
export function createBossRegaliaKit(id: BossRegaliaId) { return BUILDERS[id](); }
