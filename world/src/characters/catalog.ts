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
