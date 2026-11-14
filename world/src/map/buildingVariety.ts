import * as THREE from 'three';
import data from './building-variety.json';
import { SiteArt } from '../story/campaignSites';
import { REGIONS, regionToWorld } from './regions';
import type { RegionId } from '../settlements/types';

/** Copies of the same building (tools/building-variety.ts) get their own look at load: walls and roof
 * are graded separately within the realm's palette, and each copy carries a different rooftop feature.
 * Geometry and collision are untouched; rows are region-local hull boxes [x0,y0,z0,x1,y1,z1]. */
type Row = { variant: number; box: number[] };
const byRegion = new Map<string, Row[]>();
for (const r of data.rows as number[][]) { const region = data.regions[r[0]]; (byRegion.get(region) ?? byRegion.set(region, []).get(region)!).push({ variant: r[1], box: r.slice(2) }); }

// [hue shift, saturation ×, lightness ×] — wall and roof grades per realm, chosen to stay in period.
const GRADES: Record<string, { wall: [number, number, number][]; roof: [number, number, number][] }> = {
  britain: { wall: [[.02, .9, 1.08], [-.03, .8, .92], [.05, 1.1, 1.0], [0, .7, 1.14]], roof: [[.04, 1.2, .82], [-.06, .9, 1.1], [.08, 1.1, .95], [0, .6, .88]] },
  orleans: { wall: [[.03, 1.2, 1.06], [-.04, .8, .94], [.07, 1.15, 1.0], [0, .75, 1.12]], roof: [[-.03, 1.25, .9], [.05, .8, 1.08], [0, .6, .8], [.09, 1.2, .96]] },
  egypt: { wall: [[.02, 1.2, 1.1], [-.03, .7, 1.16], [.05, 1.3, .92], [0, .85, 1.04]], roof: [[.03, 1.1, .9], [-.04, .8, 1.06], [.06, 1.2, .84], [0, .7, 1.12]] },
  qin: { wall: [[.02, 1.1, .94], [-.03, .85, 1.08], [.05, 1.2, 1.0], [0, .75, .9]], roof: [[0, 1.3, .86], [.04, .9, 1.04], [-.05, 1.1, .92], [.07, 1.2, 1.0]] },
};
const DEFAULT = { wall: [[.03, 1.1, 1.06], [-.03, .85, .94], [.06, 1.15, 1.0]] as [number, number, number][], roof: [[-.04, 1.2, .9], [.05, .85, 1.08], [0, .7, .86]] as [number, number, number][] };

const skip = /^(Terrain|Water|COL_|Trees|Bushes|Rocks|Grass|Glow_)/;
const hsl = { h: 0, s: 0, l: 0 }, color = new THREE.Color();
/** Recolour the vertices of repeated building copies; returns a modified clone, or null when untouched. */
export function applyBuildingVariety(region: string, name: string, geometry: THREE.BufferGeometry) {
  const rows = byRegion.get(region); if (!rows || skip.test(name)) return null;
  const pos = geometry.getAttribute('position'), col = geometry.getAttribute('color');
  if (!pos || !col) return null;
  geometry.computeBoundingBox(); const gb = geometry.boundingBox!;
  const hits = rows.filter(r => r.box[0] - .8 < gb.max.x && r.box[3] + .8 > gb.min.x && r.box[2] - .8 < gb.max.z && r.box[5] + .8 > gb.min.z);
  if (!hits.length) return null;
  const out = geometry.clone(), c = out.getAttribute('color') as THREE.BufferAttribute, p = out.getAttribute('position');
  const grades = GRADES[region] ?? DEFAULT; let changed = false;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const row = hits.find(r => x > r.box[0] - .8 && x < r.box[3] + .8 && z > r.box[2] - .8 && z < r.box[5] + .8 && y > r.box[1] - .5 && y < r.box[4] + 3);
    if (!row) continue;
    const roof = y > row.box[1] + .62 * (row.box[4] - row.box[1]);
    // Walls cycle fastest and roofs advance once per wall cycle, so up to walls×roofs copies all differ.
    const v = row.variant - 1, W = grades.wall.length, R = grades.roof.length;
    const [dh, ds, dl] = roof ? grades.roof[(v + Math.floor(v / W)) % R] : grades.wall[v % W];
    color.setRGB(c.getX(i), c.getY(i), c.getZ(i)).getHSL(hsl);
    // Each further wall cycle steps brightness, so wall-only buildings (tower tops) stay distinct too.
    const cycle = Math.floor(v / W), step = cycle ? (cycle % 2 ? .86 : 1.14) : 1, light = Math.min(1, hsl.l * dl * step);
    // Near-grey stone ignores hue shifts, so give it a faint warm or cool cast instead.
    if (hsl.s < .06) color.setHSL(dh >= 0 ? .08 : .58, .08 + Math.abs(dh) * 2.5, light);
    else color.setHSL((hsl.h + dh + 1) % 1, Math.min(1, hsl.s * ds), light);
    c.setXYZ(i, color.r, color.g, color.b); changed = true;
  }
  if (!changed) { out.dispose(); return null; }
  c.needsUpdate = true; return out;
}

/** A different rooftop feature per copy, in the realm's idiom (visual only, no collision). */
export function createBuildingOrnaments() {
  const root = new THREE.Group(); root.name = 'BuildingVarietyOrnaments';
  for (const [region, rows] of byRegion) {
    const def = REGIONS.find(r => r.id === region); if (!def) continue;
    const a = new SiteArt();
    for (const { variant, box } of rows) {
      const lx = box[0] + (box[3] - box[0]) * (variant % 2 ? .28 : .72), lz = box[2] + (box[5] - box[2]) * (variant % 3 ? .3 : .7), top = box[4];
      const [x, z] = regionToWorld(def, lx, lz), kind = variant % 4;
      if (region === 'egypt') { if (kind === 1) a.cyl([x, top + .45, z], .45, .9, '#b9764a'); else if (kind === 2) a.box([x, top + .9, z], [1.8, .08, 1.4], '#d8c49a'); else if (kind === 3) a.box([x, top + .7, z], [.9, 1.4, .9], '#c8b48a'); else a.cyl([x, top + .3, z], .35, .6, '#7a6a52'); }
      else if (region === 'qin') { if (kind === 1) a.box([x, top + .9, z], [.12, 1.8, .12], '#5c4532'); else if (kind === 2) a.box([x, top + .45, z], [1.4, .9, .9], '#8c3a2a'); else if (kind === 3) a.cyl([x, top + .35, z], .5, .7, '#7a6a52'); else a.box([x, top + .2, z], [1.8, .4, .4], '#c0452f'); }
      else { // britain / orleans / others: chimney, dormer, finial with pennant, lantern
        if (kind === 1) { a.box([x, top + .7, z], [.7, 1.8, .7], '#8a7e70'); a.box([x, top + 1.65, z], [.85, .14, .85], '#5d5650'); }
        else if (kind === 2) { a.box([x, top + .45, z], [1.4, .9, 1.1], '#a8907a'); a.box([x, top + .95, z], [1.5, .12, 1.2], '#6b4e3a'); }
        else if (kind === 3) { a.box([x, top + 1.1, z], [.08, 2.2, .08], '#4a3a2a'); a.box([x + .35, top + 1.9, z], [.7, .4, .03], region === 'orleans' ? '#2f4d8c' : '#7a2a2a'); }
        else { a.cyl([x, top + .5, z], .28, .5, '#4a3a2a'); a.cyl([x, top + .85, z], .18, .3, '#ffd98a', false, 'glow'); }
      }
    }
    a.finish(region as RegionId); // SiteArt only uses the id for naming a.root.name = `BuildingVariety_${region}`; root.add(a.root);
  }
  return root;
}
