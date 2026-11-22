import type * as THREE from 'three';
import { bilingual } from '../../../shared-client/i18n';
import { loadLayout } from '../core/load';
import { carveCoreRing } from '../exploration/bossArenas';
import { bakeQuantized, regionLoader } from '../rendering/glb';
import { BLACKSAIL_CIVIL_CLEARANCE, BLACKSAIL_CIVIL_PATHS } from './blackSailCivilPlan';
import { applyBuildingVariety } from './buildingVariety';
import { clearLandscapeProps, editComponents, removeComponentsInBox, type ComponentBounds } from './landscapeClearance';
import { placeRegion, type RegionDef } from './regions';
import { carveValleyFoundation, lowerLookbackChannel, VALLEY_FOUNDATION_CLEARANCE } from './valleyFoundationPlan';
import { VALLEY_TRANSPORT_CLEARANCE, VALLEY_TRANSPORT_ROUTES } from './valleyTransportPlan';
import { WINTER_CIVIL_CLEARANCE, WINTER_CIVIL_PATHS } from './winterCivilPlan';

// The valley's south seam once opened onto Kyoto; since the 2026-11-10 relayout nothing lies
// south of the valley, so its torii, stone foxes, seam pylons and barrier are retired at load.
const VALLEY_SOUTH_TORII: readonly [number, number, number, number] = [18, 286, 62, 366];
const VALLEY_SOUTH_SEAM_PIECES = /^(Seams|Glow_Props|COL_Props|Valley_Exploration_Detail_(Metal|Brass|Ceramic))$/;
function retireValleySouthSeam(name: string, geometry: THREE.BufferGeometry) {
  if (/^(COL_)?Seam_south_(Veil|Gate)$/.test(name)) { const empty = geometry.clone(); empty.setIndex([]); return empty; }
  return VALLEY_SOUTH_SEAM_PIECES.test(name) ? removeComponentsInBox(geometry, VALLEY_SOUTH_TORII) : null;
}
// The distant true capital was authored on a north-west ridge that the continental coast later
// turned into open sea (ground -5 m). Move the whole set piece onto the ridge north of Camelot,
// clearing trees, bushes and rocks from its new footprint. Britain-local coordinates.
const FAR_CAMELOT_FROM: readonly [number, number, number, number] = [-345, -348, -268, -276];
const FAR_CAMELOT_TO: readonly [number, number, number, number] = [-253, -362, -177, -290];
const FAR_CAMELOT_OFFSET: readonly [number, number, number] = [91, 16, -14];
const inside = (b: ComponentBounds, r: readonly [number, number, number, number]) => {
  const x = (b.min[0] + b.max[0]) / 2, z = (b.min[2] + b.max[2]) / 2;
  return x > r[0] && x < r[2] && z > r[1] && z < r[3];
};
const treeProxy = (b: ComponentBounds) => Math.abs(b.max[1] - b.min[1] - 4) < .08 && b.max[0] - b.min[0] < 1.4 && b.max[2] - b.min[2] < 1.4;
function relocateFarCamelot(name: string, geometry: THREE.BufferGeometry) {
  if (/^(Trees_\w+|Bushes|Rocks\w*)$/.test(name)) return editComponents(geometry, b => inside(b, FAR_CAMELOT_TO) ? 'remove' : null);
  if (!/^(Britain_Physical_\w+|Glow_Props|COL_Props)$/.test(name)) return null;
  return editComponents(geometry, b => {
    if (name === 'COL_Props' && treeProxy(b)) return inside(b, FAR_CAMELOT_TO) ? 'remove' : null;
    return inside(b, FAR_CAMELOT_FROM) ? FAR_CAMELOT_OFFSET : null;
  });
}
/** Map edits at load, then per-copy colour variety for repeated buildings (tools/building-variety.ts). */
export function clearProductionLandscape(region: string, name: string, geometry: THREE.BufferGeometry) {
  const edited = clearProductionLandscapeBase(region, name, geometry);
  const varied = applyBuildingVariety(region, name, edited ?? geometry);
  if (varied && edited && edited !== geometry) edited.dispose();
  return varied ?? edited;
}
function clearProductionLandscapeBase(region: string, name: string, geometry: THREE.BufferGeometry) {
  if (region === 'alpha') {
    // Streamed visual terrain follows the same Lookback stream bed as the core terrain and collision.
    if (name === 'Terrain') { const copy = geometry.clone(); return lowerLookbackChannel(copy) ? copy : (copy.dispose(), null); }
    const retired = retireValleySouthSeam(name, geometry);
    return clearLandscapeProps(name, retired ?? geometry, [...VALLEY_FOUNDATION_CLEARANCE, ...VALLEY_TRANSPORT_CLEARANCE], VALLEY_TRANSPORT_ROUTES) ?? retired;
  }
  if (region === 'winter') return clearLandscapeProps(name, geometry, [[38, 89, 65, 122], ...WINTER_CIVIL_CLEARANCE], WINTER_CIVIL_PATHS);
  if (region === 'blacksail') return clearLandscapeProps(name, geometry, BLACKSAIL_CIVIL_CLEARANCE, BLACKSAIL_CIVIL_PATHS);
  if (region === 'britain') {
    const moved = relocateFarCamelot(name, geometry), source = moved ?? geometry;
    if (!/^Trees_|^COL_Props$/.test(name)) return moved;
    return clearLandscapeProps(name, source, [],
      [[[-120, -70], [-151, -30], [-151, 20], [-170, 60], [-176, 105], [-154, 144], [-120, 184]]]) ?? moved;
  }
  return carveCoreRing(region, name, geometry);
}

export async function loadRegionCore(def: RegionDef, onProgress: (event: ProgressEvent) => void) {
  const [layout, gltf] = await Promise.all([
    loadLayout(`./assets/${def.file}.layout.json`),
    regionLoader().loadAsync(`./assets/${def.file}.core.glb`, onProgress),
  ]);
  for (const name of ['ART', 'COLLISION', 'Terrain']) {
    if (!gltf.scene.getObjectByName(name)) throw new Error(bilingual(`地图模型缺少 ${name} 节点`, `Map model is missing the ${name} node`));
  }
  bakeQuantized(gltf.scene);
  gltf.scene.traverse(object => {
    // Duck-typed like region visual streaming: a second three.js copy (tests, tools) fails instanceof.
    const node = object as THREE.Mesh; if (!node.isMesh) return;
    const carved = def.id === 'alpha' && /^(Terrain|COL_Terrain)$/.test(node.name) ? carveValleyFoundation(node.geometry) : clearProductionLandscape(def.id, node.name, node.geometry);
    if (carved) { node.geometry.dispose(); node.geometry = carved; }
    if (def.id === 'alpha' && /^(Terrain|COL_Terrain)$/.test(node.name)) lowerLookbackChannel(node.geometry);
  });
  placeRegion(gltf.scene, def);
  if (def.id === 'alpha') layout.markers = layout.markers.filter(marker => marker.id !== 'seam_south');
  // W08 and B08 replaced the old era bosses' identities; the reviewed map labels still carry the old names.
  for (const marker of layout.markers) { if (marker.id === 'boss_winter_warden') marker.label = '最后方阵（Boss）'; if (marker.id === 'boss_drowned_admiral') marker.label = '梅瑞克（Boss）'; if (marker.id === 'boss_hellfire_lord') marker.label = '鸦印（Boss）'; }
  return { def, layout, root: gltf.scene };
}
