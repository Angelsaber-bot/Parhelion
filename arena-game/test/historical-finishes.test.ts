import { it, expect } from 'vitest';
import { WEAPONS } from '../shared/content.ts';
import { RoomCore } from '../shared/room.ts';
import { RULES_VERSION } from '../shared/protocol.ts';
import { readSkinSelection, withSkinSelection } from '../src/cosmetics/skinSelection.ts';
import { signatureModelOf } from '../shared/signatureSkins.ts';

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
  expect(() => room.join('old', { rulesVersion: 16, skins: selected() })).toThrow(/版本/);
  expect(room.match.slots.size).toBe(0);
  const welcome = room.join('new', { rulesVersion: RULES_VERSION, team: 'A', name: 'Craft', skins: selected(), loadout: ['firefly', 'corona', 'blade'] });
  expect(welcome.rulesVersion).toBe(17);
  let snapshot = room.step();
  for (let tick = 0; tick < 10 && !snapshot; tick++) snapshot = room.step();
  const player = snapshot!.players.find(p => p.id === 'new')!;
  expect(player.skins).toEqual(selected());
  for (const [weapon, id] of Object.entries(historical)) {
    const wi = WEAPONS.findIndex(w => w.id === weapon);
    expect(WEAPONS[wi].skins[player.skins[wi]].id).toBe(id);
  }
});

for (const [weapon, id] of Object.entries(historical)) it(`${id}: now ships as its own sculpted model instead of a paint-over`, () => {
  expect(signatureModelOf(id, weapon)).toBeDefined();
});
