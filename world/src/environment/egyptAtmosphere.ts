import { createQinAtmosphere, type Emitter } from './qinAtmosphere';
import { EGYPT_FRAME } from '../map/egyptPlan';

/** Egypt's air: heat-shimmer motes over the river and lake, dust devils on the desert,
 * incense in the temple, embers on the roof altar and gold dust in the barque tomb. */
export const EGYPT_EMITTERS: readonly Emitter[] = [
  { id: 'lake-glints', mode: 'haze', at: [-205, 12.8, 150], count: 160, spread: [34, .3, 22], color: '#fff6d8', size: .12, height: 0, speed: .08, range: 120, opacity: 1 },
  { id: 'river-glints', mode: 'haze', at: [-40, 9, 160], count: 200, spread: [70, .3, 14], color: '#fff6d8', size: .12, height: 0, speed: .07, range: 140, opacity: 1 },
  ...([[-60, 16, 40], [150, 16, 60], [-220, 15, -10]] as const).map(([x, y, z], i) => ({ id: `dust-devil-${i}`, mode: 'rise' as const, at: [x, y, z] as [number, number, number], count: 90, spread: [1.6, .2, 1.6] as [number, number, number], color: '#d9bd86', size: .3, height: 14, speed: .12, range: 220, opacity: .45 })),
  { id: 'sand-drift', mode: 'drift', at: [120, 16, 120], count: 220, spread: [90, 2, 80], color: '#e8cf98', size: .08, height: 0, speed: .09, range: 200, opacity: .5 },
  ...([[70, 31.5, -100], [90, 31.5, -100], [70, 31.5, -120], [90, 31.5, -120]] as const).map(([x, y, z], i) => ({ id: `incense-${i}`, mode: 'smoke' as const, at: [x, y, z] as [number, number, number], count: 18, spread: [.2, .05, .2] as [number, number, number], color: '#cfd3d8', size: .8, height: 6, speed: .12, range: 120, opacity: .3 })),
  { id: 'altar-embers', mode: 'rise', at: [56, 41.6, -150], count: 40, spread: [.4, .1, .4], color: '#ffb35a', size: .12, height: 3, speed: .5, range: 100, opacity: 1 },
  { id: 'hall-motes', mode: 'drift', at: [80, 31, -145], count: 160, spread: [32, 5, 18], color: '#ffe9b8', size: .05, height: 0, speed: .03, range: 90, opacity: .7 },
  { id: 'tomb-gold', mode: 'haze', at: [80, 15, -252], count: 140, spread: [16, 4, 14], color: '#ffd77a', size: .07, height: 0, speed: .04, range: 70, opacity: .9 },
  { id: 'treasury-gold', mode: 'haze', at: [116, 15.5, -253], count: 90, spread: [9, 3, 9], color: '#ffd77a', size: .06, height: 0, speed: .03, range: 60, opacity: .9 },
  { id: 'sacred-lake-glints', mode: 'haze', at: [150, 28.9, -116], count: 90, spread: [11, .2, 13], color: '#fff6d8', size: .1, height: 0, speed: .06, range: 110, opacity: 1 },
  { id: 'quarry-dust', mode: 'drift', at: [-182, 28, -153], count: 120, spread: [18, 2, 14], color: '#d9b9a2', size: .09, height: 0, speed: .07, range: 130, opacity: .55 },
  { id: 'cliff-incense', mode: 'smoke', at: [183, 27.6, -60], count: 18, spread: [.2, .05, .2], color: '#cfd3d8', size: .8, height: 6, speed: .12, range: 120, opacity: .3 },
  { id: 'sanctuary-motes', mode: 'drift', at: [195, 28, -78], count: 70, spread: [6, 2, 7], color: '#ffe9b8', size: .05, height: 0, speed: .03, range: 70, opacity: .7 },
  { id: 'camp-fire', mode: 'rise', at: [-212, 16.8, 26], count: 40, spread: [.4, .1, .4], color: '#ffb35a', size: .12, height: 3, speed: .5, range: 100, opacity: 1 },
  { id: 'village-oven', mode: 'smoke', at: [-56.5, 16.8, 15.1], count: 16, spread: [.2, .05, .2], color: '#c9c4bc', size: .9, height: 7, speed: .1, range: 120, opacity: .28 },
];
export function createEgyptAtmosphere() { return createQinAtmosphere(EGYPT_EMITTERS, EGYPT_FRAME, 'EgyptAtmosphere'); }
