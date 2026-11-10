/** Each of the 40 signature weapons has its own effect recipe, drawn from its theme. Within a
 * base weapon the five finishes never share a tracer, flash, mark or swing style, so every
 * weapon reads differently in a fight, not just in a different colour. Cosmetic only. */
import { SIGNATURE_SKINS, signatureOf } from '../../shared/signatureSkins.ts';

export const TRACER_STYLES = ['slug', 'helix', 'beads', 'bolt', 'ribbon', 'comet', 'dash', 'wave'] as const;
export const FLASH_SHAPES = ['star', 'ring', 'bloom', 'cross', 'crystal', 'pixel', 'burst', 'spiral', 'hex', 'bolt', 'fangs', 'seal', 'feathers', 'gear'] as const;
export const MARK_SHAPES = ['hole', 'scorch', 'frost', 'petal', 'pixel', 'rune', 'crack', 'splash', 'hex', 'seal', 'feather', 'gear'] as const;
export const SWING_STYLES = ['crescent', 'petals', 'flame', 'frost', 'bolt', 'ink', 'cog', 'wave'] as const;
export type TracerStyle = typeof TRACER_STYLES[number];
export type FlashShape = typeof FLASH_SHAPES[number];
export type MarkShape = typeof MARK_SHAPES[number];
export type SwingStyle = typeof SWING_STYLES[number];

/** Guns: how the shot travels, the shape the muzzle blooms into, and what it leaves on a wall. */
export interface GunFx { kind: 'gun'; tracer: TracerStyle; flash: FlashShape; mark: MarkShape }
/** Melee: how the swing is drawn, and the emblem that bursts at the point of contact. */
export interface MeleeFx { kind: 'melee'; swing: SwingStyle; glyph: FlashShape }
export type SignatureFx = (GunFx | MeleeFx) & { id: string; head: number; tail: number };

const gun = (tracer: TracerStyle, flash: FlashShape, mark: MarkShape): GunFx => ({ kind: 'gun', tracer, flash, mark });
const melee = (swing: SwingStyle, glyph: FlashShape): MeleeFx => ({ kind: 'melee', swing, glyph });

export const SIGNATURE_FX: Record<string, GunFx | MeleeFx> = {
  // Lumen AR
  'tidal-engine': gun('helix', 'spiral', 'splash'), // propeller wash corkscrewing round the shot
  'amber-apiary': gun('beads', 'hex', 'hex'), // drops of honey, a honeycomb print
  'graviton-crucible': gun('wave', 'ring', 'rune'), // a gravity wave, orbit rings
  'cloudline': gun('comet', 'cross', 'scorch'), // a contrail from an airmail plane
  'stormcoil': gun('bolt', 'bolt', 'crack'), // Tesla arc, burnt fracture
  // Corona SG
  'abyssal-maw': gun('slug', 'fangs', 'splash'), // a ring of teeth, bio-luminous spatter
  'cinder-express': gun('comet', 'burst', 'scorch'), // embers from the firebox
  'sealed-passage': gun('ribbon', 'seal', 'seal'), // wax-seal ribbon and stamp
  'lantern-warden': gun('beads', 'ring', 'rune'), // lantern light in drops, a halo
  'bastion-breaker': gun('dash', 'hex', 'crack'), // energy slugs, shield-hex flash
  // Halo DMR
  'celadon-atlas': gun('wave', 'ring', 'crack'), // sea wave, porcelain crazing
  'owl-canticle': gun('ribbon', 'feathers', 'feather'), // a feather on the wind
  'brass-horizon': gun('slug', 'cross', 'rune'), // sextant reticle, compass rose
  'night-nacre': gun('dash', 'crystal', 'frost'), // slanting rain, nacre shards
  'petal-scabbard': gun('comet', 'bloom', 'petal'), // a sakura in bloom
  // Firefly SMG
  'mint-arcade': gun('dash', 'pixel', 'pixel'), // 8-bit blips
  'koi-current': gun('wave', 'spiral', 'splash'), // a koi's swirl and splash
  'mixtape': gun('beads', 'ring', 'gear'), // tape reels
  'guard-sash': gun('ribbon', 'star', 'scorch'), // parade sash and a medal star
  'hummingbird': gun('helix', 'feathers', 'feather'), // whirring wings
  // Longnight sniper
  'abyssal-requiem': gun('comet', 'ring', 'splash'), // bioluminescent whale-song
  'velvet-thorn': gun('helix', 'bloom', 'petal'), // a thorned vine, a rose
  'meridian-key': gun('dash', 'gear', 'gear'), // clock ticks and gears
  'glacier-survey': gun('slug', 'crystal', 'frost'), // ice core, frost burst
  'void-lance': gun('ribbon', 'burst', 'scorch'), // a plasma rail
  // Refraction Blade
  'prismwing': melee('petals', 'feathers'), // butterfly wings
  'crescent-sabre': melee('crescent', 'ring'), // the moon
  'clockwork-cleaver': melee('cog', 'gear'), // a sawing cog
  'serpent-kris': melee('wave', 'spiral'), // a striking serpent
  'frost-fang': melee('frost', 'crystal'), // ice shards
  // Meteor Polearm
  'vermilion-plume': melee('flame', 'feathers'), // phoenix fire
  'ink-bamboo': melee('ink', 'star'), // a brush stroke
  'reef-regalia': melee('wave', 'burst'), // a breaking reef wave
  'tide-moon': melee('crescent', 'ring'), // the moon glaive
  'storm-halberd': melee('bolt', 'bolt'), // lightning
  // Fault Hammer
  'foundry-bell': melee('cog', 'ring'), // whirling gear ring, a bell toll
  'sugar-crash': melee('petals', 'bloom'), // sprinkles and icing
  'cathedral-chime': melee('crescent', 'cross'), // a halo of light
  'comet-thruster': melee('flame', 'burst'), // rocket exhaust
  'amethyst-geode': melee('frost', 'crystal'), // crystal cluster
};

/** The recipe for a finish, with its colours (head = accent, tail = trim); undefined for stock. */
export function signatureFx(id?: string): SignatureFx | undefined {
  const s = signatureOf(id), r = id ? SIGNATURE_FX[id] : undefined;
  if (!s || !r) return undefined;
  return { ...r, id: s.id, head: s.accent, tail: s.trim };
}
export const SIGNATURE_FX_IDS = SIGNATURE_SKINS.map((s) => s.id);
