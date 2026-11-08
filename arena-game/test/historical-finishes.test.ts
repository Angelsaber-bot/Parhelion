import { it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WEAPONS } from '../shared/content.ts';
import { RoomCore } from '../shared/room.ts';
import { RULES_VERSION } from '../shared/protocol.ts';
import { readSkinSelection, withSkinSelection } from '../src/cosmetics/skinSelection.ts';
import { WeaponArtPool, combatArt } from '../src/weapons/weaponArt.ts';

const historical = { firefly: 'guard-sash', corona: 'sealed-passage', halo: 'night-nacre' } as const;
const selected = () => WEAPONS.map(w => w.id in historical ? w.skins.findIndex(s => s.id === historical[w.id as keyof typeof historical]) : 0);

it('new finishes save by stable identity, restore to their own guns and preserve unrelated preferences', () => {
  const indices = selected();
  const saved = withSkinSelection({ name: 'Returning', char: 1, map: 'blackflag', layout: '2v2', skinIds: { lumen: 'cloudline' } }, indices);
  expect(saved.skinIds).toMatchObject(historical);
  expect(saved).toMatchObject({ name: 'Returning', char: 1, map: 'blackflag', layout: '2v2' });
  expect(readSkinSelection(JSON.parse(JSON.stringify(saved)))).toEqual(indices);
  expect(readSkinSelection({ skinIds: { firefly: 'sealed-passage', corona: 'night-nacre', halo: 'guard-sash' } })).toEqual(WEAPONS.map(() => 0));
  // Every already-published numeric position still resolves to its original ID.
  expect(WEAPONS.find(w => w.id === 'corona')!.skins.slice(0, 2).map(s => s.id)).toEqual(['abyssal-maw', 'cinder-express']);
  expect(WEAPONS.find(w => w.id === 'halo')!.skins.slice(0, 3).map(s => s.id)).toEqual(['celadon-atlas', 'owl-canticle', 'brass-horizon']);
  expect(WEAPONS.find(w => w.id === 'firefly')!.skins.slice(0, 3).map(s => s.id)).toEqual(['mint-arcade', 'koi-current', 'mixtape']);
});

it('the production server room preserves new indices through join and broadcast snapshots', () => {
  const room = new RoomCore({ layout: '1v1', map: 'blackflag', bots: false });
  expect(() => room.join('old', { rulesVersion: 11, skins: selected() })).toThrow(/版本/);
  expect(room.match.slots.size).toBe(0);
  const welcome = room.join('new', { rulesVersion: RULES_VERSION, team: 'A', name: 'Craft', skins: selected(), loadout: ['firefly', 'corona', 'blade'] });
  expect(welcome.rulesVersion).toBe(12);
  let snapshot = room.step();
  for (let tick = 0; tick < 10 && !snapshot; tick++) snapshot = room.step();
  const player = snapshot!.players.find(p => p.id === 'new')!;
  expect(player.skins).toEqual(selected());
  for (const [weapon, id] of Object.entries(historical)) {
    const wi = WEAPONS.findIndex(w => w.id === weapon);
    expect(WEAPONS[wi].skins[player.skins[wi]].id).toBe(id);
  }
});

for (const [weapon, id] of Object.entries(historical)) it(`${id}: actual GLB has non-emissive side and crown craft details attached to its moving parts`, async () => {
  const def = combatArt(weapon)!, bytes = await readFile(new URL(`../../assets/weapons/glb/${def.file}.glb`, import.meta.url));
  const source = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
  const pool = new WeaponArtPool(async () => source), skin = WEAPONS.find(w => w.id === weapon)!.skins.find(s => s.id === id)!;
  const handle = pool.acquire(def, skin), instance = (await handle.ready)!;
  try {
    for (const role of ['body', 'stock']) for (const crown of role === 'body' ? ['', '_crown'] : ['']) {
      const art = instance.parts[role].getObjectByName(`Signature_${id}_${role}${crown}`)!;
      expect(art, `${role}${crown} should carry authored artwork`).toBeDefined();
      let count = 0;
      art.traverse(o => { if (!(o instanceof THREE.Mesh)) return; count += o.geometry.attributes.position.count;
        for (const material of [o.material].flat() as THREE.MeshPhysicalMaterial[]) expect((material.emissive.r + material.emissive.g + material.emissive.b) * material.emissiveIntensity).toBe(0);
      });
      expect(count).toBeGreaterThan(24);
    }
    if (weapon === 'corona') {
      const foreEnd = instance.parts.fore_end;
      const inlay = foreEnd.getObjectByName(`Signature_${id}_fore_end`)!;
      expect(inlay.parent).toBe(foreEnd);
      // The pump has ivory side panels but a rubber upper grip; only its actual
      // paintable sides receive the seal. Receiver crown detail is checked above.
      instance.root.updateMatrixWorld(true); const before = inlay.getWorldPosition(new THREE.Vector3());
      foreEnd.position.x -= .1; instance.root.updateMatrixWorld(true);
      expect(inlay.getWorldPosition(new THREE.Vector3()).x - before.x).toBeCloseTo(-.1, 6);
    }
    source.traverse(o => { if (o instanceof THREE.Mesh) for (const material of [o.material].flat()) expect(material.userData.finish).toBeUndefined(); });
  } finally { handle.release(); handle.release(); expect(pool.size).toBe(0); }
});
