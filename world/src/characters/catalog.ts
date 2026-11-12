import type { CharacterKitDefinition } from './characterKit';

/** Full-detail defaults only. Importing this catalog does not activate a World character. */
export const CHARACTER_KITS = {
  blackbeard: {
    id: 'blackbeard', defaultState: 'idle', rootMotion: 'in-place', visualOffset: [0, -.014, 0],
    assetUrl: new URL('../../../assets/characters/blackbeard/remaster_v2/Blackbeard_Captain_Remaster.glb.gz', import.meta.url).href,
    clips: {
      idle: { name: 'Idle', duration: 3, loop: true },
      walk: { name: 'Walk', duration: 32 / 30, loop: true, nominalSpeed: .65625 },
      run: { name: 'Run', duration: .8, loop: true, nominalSpeed: 2.2368421052631575 },
      attack: { name: 'Attack', duration: 1.4, loop: false, events: [{ at: 17 / 30, kind: 'fire', socket: 'muzzle' }] },
      // The artist did not author an exact Melee contact event. Never invent damage timing.
      melee: { name: 'Melee', duration: 1.4, loop: false },
    },
    sockets: { muzzle: { node: 'Blackbeard_Muzzle', forward: [0, 0, 1], up: [0, 1, 0] }, weaponHand: { node: 'HandR' } },
  },
  musashi: {
    id: 'musashi', defaultState: 'idle', rootMotion: 'in-place',
    assetUrl: new URL('../../../assets/characters/musashi/remaster_v2/Musashi_Runtime.glb.gz', import.meta.url).href,
    clips: {
      idle: { name: 'Idle', duration: 3, loop: true },
      walk: { name: 'Walk', duration: 32 / 30, loop: true, nominalSpeed: .7488 },
      run: { name: 'Run', duration: 20 / 30, loop: true, nominalSpeed: 2.0016 },
      attack: { name: 'Attack', duration: 1.6, loop: false, events: [
        { at: 19 / 30, kind: 'hit', socket: 'rightKatana' }, { at: 33 / 30, kind: 'hit', socket: 'leftKatana' },
      ] },
    },
    sockets: { rightKatana: { node: 'Attachment_RightHand_Katana' }, leftKatana: { node: 'Attachment_LeftHand_Katana' } },
  },
  napoleonMounted: {
    id: 'napoleonMounted', defaultState: 'idle', rootMotion: 'in-place', visualOffset: [0, -.010814, 0],
    assetUrl: new URL('../../../assets/characters/napoleon/remaster_v2/Napoleon_WhiteHorse_Remaster.glb.gz', import.meta.url).href,
    clips: {
      idle: { name: 'MountedIdle', duration: 3, loop: true },
      walk: { name: 'MountedWalk', duration: 32 / 30, loop: true, nominalSpeed: .703125 },
      run: { name: 'MountedRun', duration: .8, loop: true, nominalSpeed: 2.093023255813953 },
      attack: { name: 'MountedAttack', duration: 1.4, loop: false, events: [{ at: 23 / 30, kind: 'hit', socket: 'saberTip' }] },
    },
    sockets: {
      saddle: { node: 'SaddleSocket' }, seat: { node: 'RiderSeatAnchor' }, reins: { node: 'ReinSocket' },
      saberGrip: { node: 'SaberSocket' }, saberTip: { node: 'SaberTip' },
    },
    mount: { saddleSocket: 'saddle', riderSeatSocket: 'seat' },
  },
} satisfies Record<string, CharacterKitDefinition>;
export type CharacterKitId = keyof typeof CHARACTER_KITS;

/** Regional character kits use the shared fallback for basic combat contacts. */
export const MODEL_CHARACTER_KITS = {
  // Native scale and authored root/hover are preserved.
  // These clips have no authored combat contacts; gameplay uses an explicit fallback.
  jeanne: {
    id: 'jeanne', defaultState: 'idle', rootMotion: 'in-place',
    assetUrl: new URL('../../../assets/characters/jeanne/final_20261110/runtime.part1.bin', import.meta.url).href,
    additionalAssetUrls: [new URL('../../../assets/characters/jeanne/final_20261110/runtime.part2.bin', import.meta.url).href],
    clips: {
      idle: { name: 'Idle', duration: 2, loop: true },
      // Native Walk/Run are retained in the GLB as reference clips only.
      walk: { name: 'Walk_Draped', duration: .9, loop: true },
      run: { name: 'Run_Draped', duration: .65, loop: true },
      presentation: { name: 'Jeanne_Resolve', duration: 8, loop: false },
    },
    sockets: { head: { node: 'HeadSocket' }, rightHand: { node: 'Hand_R' }, leftHand: { node: 'Hand_L' }, weapon: { node: 'WeaponSocket' } },
  },
  ozymandias: {
    id: 'ozymandias', defaultState: 'idle', rootMotion: 'in-place',
    assetUrl: new URL('../../../assets/characters/ozymandias/final_20261110/runtime.glb.gz', import.meta.url).href,
    clips: {
      idle: { name: 'Idle', duration: 2, loop: true },
      walk: { name: 'Walk', duration: .9, loop: true },
      run: { name: 'Run', duration: .65, loop: true },
      presentation: { name: 'Ozy_Regal', duration: 3, loop: false },
    },
    sockets: { head: { node: 'HeadSocket' }, rightHand: { node: 'Hand_R' }, leftHand: { node: 'Hand_L' }, weapon: { node: 'WeaponSocket' } },
  },
  qinShiHuang: {
    id: 'qinShiHuang', defaultState: 'idle', rootMotion: 'in-place',
    assetUrl: new URL('../../../assets/characters/qin-shi-huang/final_20261110/runtime.glb.gz', import.meta.url).href,
    clips: {
      idle: { name: 'Idle', duration: 4, loop: true },
      walk: { name: 'Walk', duration: 2, loop: true },
      run: { name: 'Run', duration: 1.5, loop: true },
      presentation: { name: 'RegalHover', duration: 6, loop: false },
    },
    sockets: { head: { node: 'HeadSocket' }, rightHand: { node: 'Hand_R' }, leftHand: { node: 'Hand_L' }, weapon: { node: 'WeaponSocket' } },
  },
} satisfies Record<string, CharacterKitDefinition>;
export type ModelCharacterKitId = keyof typeof MODEL_CHARACTER_KITS;

/** Character kits loaded by the regional companion renderer. */
export const MODEL_COMPANIONS = [
  { id: 'jeanne', name: '贞德', nameEn: 'Jeanne' },
  { id: 'ozymandias', name: '奥兹曼迪亚斯', nameEn: 'Ozymandias' },
  { id: 'qinShiHuang', name: '始皇帝', nameEn: 'Qin Shi Huang' },
] as const satisfies readonly { id: ModelCharacterKitId; name: string; nameEn: string }[];
export type ModelCompanionId = typeof MODEL_COMPANIONS[number]['id'];
export const isModelCompanionId = (id: string): id is ModelCompanionId => MODEL_COMPANIONS.some(entry => entry.id === id);

/** Padded, orientation-independent upper-body/prop placement envelopes.
 * Derived from every vertex at 33 phases of each registered native clip.
 * Deliberately conservative; not continuous-time or arbitrary-blend collision certification.
 */
export const MODEL_COMPANION_CLEARANCE: Record<ModelCompanionId, { radius: number; height: number; bands: readonly { bottom: number; top: number; radius: number }[] }> = {
  jeanne: { radius: 1.6, height: 2.6, bands: [
    { bottom: .2, top: .5, radius: .9 }, { bottom: .5, top: 1, radius: .8 },
    { bottom: 1, top: 1.5, radius: 1.3 }, { bottom: 1.5, top: 2.6, radius: 1.6 },
  ] },
  ozymandias: { radius: .9, height: 1.9, bands: [
    { bottom: .2, top: .5, radius: .9 }, { bottom: .5, top: 1.5, radius: .8 }, { bottom: 1.5, top: 1.9, radius: .5 },
  ] },
  qinShiHuang: { radius: 1.1, height: 2.3, bands: [
    { bottom: .2, top: .5, radius: .7 }, { bottom: .5, top: 1, radius: 1 },
    { bottom: 1, top: 2, radius: 1.1 }, { bottom: 2, top: 2.3, radius: .8 },
  ] },
};
