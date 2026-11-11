import { createQinAtmosphere, type Emitter } from './qinAtmosphere';
import { ORLEANS_BASTILLE as BA, ORLEANS_BRIDGE_MILL as BM, ORLEANS_GRANGE as GR, ORLEANS_OFFSET, ORLEANS_SCORCH, ORLEANS_WINDMILL as WM } from '../map/orleansOutskirts';

const millWheel = (() => { const s = Math.sin(BM.yaw), c = Math.cos(BM.yaw), w = BM.wheel; return [BM.x + c * w.x + s * w.z, BM.z - s * w.x + c * w.z] as const; })();
/** Orleans' air: light on the Loire, hearth smoke over the roofs, dust in the nave,
 * spray under the mill wheel, chaff on the ridge and the last embers of the grange. */
export const ORLEANS_EMITTERS: readonly Emitter[] = [
  { id: 'loire-west-glints', mode: 'haze', at: [-208, .35, -10], count: 220, spread: [9, .2, 110], color: '#fff6dc', size: .12, height: 0, speed: .07, range: 170, opacity: 1 },
  { id: 'loire-south-glints', mode: 'haze', at: [70, .35, 242], count: 240, spread: [130, .2, 9], color: '#fff6dc', size: .12, height: 0, speed: .07, range: 190, opacity: 1 },
  { id: 'harbour-mist', mode: 'drift', at: [-196, 2.2, -20], count: 120, spread: [12, 1.4, 46], color: '#e9f1f0', size: .1, height: 0, speed: .03, range: 110, opacity: .4 },
  ...([[-111.5, 31.6, 2], [-32.1, 33.7, 113.2], [-93.2, 29.9, 139.2], [44.1, 31.6, 105.4], [78.5, 29.9, 107]] as const).map(([x, y, z], i) => ({ id: `hearth-smoke-${i}`, mode: 'smoke' as const, at: [x, y, z] as [number, number, number], count: 22, spread: [.3, .1, .3] as [number, number, number], color: '#b9b4aa', size: 1.5, height: 11, speed: .07, range: 200, opacity: .26 })),
  { id: 'market-motes', mode: 'drift', at: [-80, 16.5, 90], count: 150, spread: [22, 3, 17], color: '#fff3d6', size: .05, height: 0, speed: .04, range: 90, opacity: .6 },
  { id: 'nave-dust', mode: 'drift', at: [35, 42, -174], count: 220, spread: [20, 9, 36], color: '#ffe9c0', size: .06, height: 0, speed: .03, range: 110, opacity: .75 },
  { id: 'altar-candles', mode: 'rise', at: [35, 35.2, -206], count: 30, spread: [1.6, .1, .3], color: '#ffcf7a', size: .07, height: 1.2, speed: .45, range: 70, opacity: .9 },
  { id: 'cloister-pollen', mode: 'drift', at: [111, 33.6, -194], count: 110, spread: [10, 1.6, 14], color: '#f4f0c8', size: .05, height: 0, speed: .04, range: 80, opacity: .6 },
  { id: 'mill-spray', mode: 'rise', at: [millWheel[0], .1, millWheel[1]], count: 70, spread: [1.3, .1, 2.4], color: '#f2fbff', size: .1, height: 1.5, speed: .6, range: 110, opacity: .85 },
  { id: 'mill-flour', mode: 'drift', at: [BM.x, 16, BM.z], count: 60, spread: [5, 1.6, 6], color: '#fff8e8', size: .05, height: 0, speed: .04, range: 60, opacity: .5 },
  { id: 'windmill-chaff', mode: 'drift', at: [WM.x, 27, WM.z], count: 110, spread: [12, 5, 12], color: '#f1e3b0', size: .05, height: 0, speed: .08, range: 120, opacity: .55 },
  { id: 'grange-embers', mode: 'rise', at: [GR.x + 22, 16.1, GR.z - 9], count: 46, spread: [3.6, .1, 5.5], color: '#ff9a4a', size: .09, height: 2.6, speed: .32, range: 110, opacity: .95 },
  { id: 'grange-smoke', mode: 'smoke', at: [GR.x + 22, 16.6, GR.z - 9], count: 26, spread: [3, .1, 4.5], color: '#6f6a64', size: 2.2, height: 13, speed: .05, range: 220, opacity: .24 },
  { id: 'scorch-ash', mode: 'drift', at: [ORLEANS_SCORCH.x, 17.6, ORLEANS_SCORCH.z], count: 150, spread: [30, 2.4, 11], color: '#cfc8bd', size: .05, height: 0, speed: .05, range: 120, opacity: .5 },
  { id: 'bastille-embers', mode: 'rise', at: [BA.x - 6, 14.1, BA.z + 6], count: 24, spread: [.35, .1, .35], color: '#ffb35a', size: .09, height: 1.8, speed: .4, range: 80, opacity: .9 },
  { id: 'bastille-smoke', mode: 'smoke', at: [BA.x - 6, 14.4, BA.z + 6], count: 16, spread: [.25, .05, .25], color: '#aaa59c', size: 1, height: 7, speed: .08, range: 150, opacity: .26 },
  { id: 'vineyard-gnats', mode: 'drift', at: [-130, 19.4, 322], count: 120, spread: [70, 1.4, 16], color: '#fdf4cf', size: .04, height: 0, speed: .09, range: 100, opacity: .5 },
];
export function createOrleansAtmosphere() { return createQinAtmosphere(ORLEANS_EMITTERS, { offset: ORLEANS_OFFSET }, 'OrleansAtmosphere'); }
