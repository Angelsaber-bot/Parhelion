import { localizeText } from '../../shared-client/i18n';
import { GATES, REGIONS } from './regions';
import type { Layout } from './types';
import type { MapBox, MapPoint } from './minimapMarkers';

/** A navigation overview, not an inventory of every encounter and interaction. */
export const FULL_MAP_COLORS = { label: '#e0e6e9', landmark: '#b9c8d0', locked: '#83949f', outline: '#1f2a44' } as const;
const OVERVIEW: Record<string, { name: string; hub: string }> = {
  alpha: { name: '幻日谷', hub: 'hq' }, britain: { name: '落日王国', hub: 'swordlake' },
  blacksail: { name: '黑帆尽头', hub: 'port' }, winter: { name: '永冬之城', hub: 'bivouac' },
  kyoto: { name: '业火京都', hub: 'kamo' },
};
export interface FullMapLabel extends MapPoint { text: string; size: number; region: boolean; box: MapBox }
export interface FullMapLandmark extends MapPoint { id: string; kind: 'travel' | 'entrance'; locked: boolean }
const overlaps = (a: MapBox, b: MapBox) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
const pointBox = (p: MapPoint, radius: number): MapBox => [p.x - radius, p.y - radius, p.x + radius, p.y + radius];

/** Keep out-of-world debug targets visible; in-bounds world coordinates stay exact. */
export function projectFullMapTarget(point: MapPoint, width: number, unit: number): MapPoint {
  if (point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= width) return point;
  const c = width / 2, radius = Math.max(0, c - 19 * unit);
  const distance = Math.max(Math.abs(point.x - c), Math.abs(point.y - c));
  const scale = distance > radius ? radius / distance : 1;
  return { x: c + (point.x - c) * scale, y: c + (point.y - c) * scale };
}

export function fullMapPresentation(
  layout: Layout, project: (position: readonly [number, number]) => MapPoint,
  width: number, cssWidth: number, player: MapPoint, target: MapPoint | null,
  done: ReadonlySet<string>, measure: (text: string, size: number) => number,
) {
  const unit = width / cssWidth, font = Math.min(18, Math.max(12, cssWidth / 38)) * unit;
  const labels: FullMapLabel[] = [], landmarks: FullMapLandmark[] = [];
  const reserved: MapBox[] = [pointBox(player, 15 * unit), ...(target ? [pointBox(target, 23 * unit)] : [])];
  const boxes = [...reserved];
  const inFrame = (box: MapBox) => box[0] >= 3 * unit && box[1] >= 3 * unit && box[2] <= width - 3 * unit && box[3] <= width - 3 * unit;
  const addLabel = (text: string, centre: MapPoint, size: number, region: boolean, maxWidth: number, bounds?: MapBox) => {
    // Wrap longer English titles instead of shrinking their text to unreadable glyphs.
    const words = text.split(' '), lines: string[] = [];
    for (const word of words) {
      const last = lines.length - 1, joined = last >= 0 ? `${lines[last]} ${word}` : word;
      if (last >= 0 && measure(joined, size) <= maxWidth) lines[last] = joined;
      else lines.push(word);
    }
    const w = Math.max(...lines.map(line => measure(line, size))) + 8 * unit;
    const h = lines.length * size * 1.22 + 4 * unit;
    const candidates = (region ? [0, 30, -30, 60, -60] : [0, -34, 28]).map(dy => ({ x: centre.x, y: centre.y + dy * unit }));
    if (bounds) {
      // Additional region-constrained positions follow the preferred nearby
      // offsets. The player and active goal always retain full clearance.
      const left = bounds[0] + w / 2 + 2 * unit, right = bounds[2] - w / 2 - 2 * unit;
      const top = bounds[1] + h / 2 + 2 * unit, bottom = bounds[3] - h / 2 - 2 * unit;
      if (left <= right && top <= bottom) for (const fy of [0, .25, .5, .75, 1]) for (const fx of [.5, 0, 1]) {
        candidates.push({ x: left + (right - left) * fx, y: top + (bottom - top) * fy });
      }
      // A narrow gap between player and target can fall between grid rows.
      // Try the exact free edges too, with the same text/glyph clearance.
      for (const occupied of boxes) if (overlaps(bounds, occupied)) {
        for (const y of [occupied[1] - h / 2 - .2 * unit, occupied[3] + h / 2 + .2 * unit]) {
          if (y >= top && y <= bottom) for (const x of [centre.x, left, right]) candidates.push({ x, y });
        }
      }
    }
    for (const { x, y } of candidates) {
      const box: MapBox = [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
      if (!inFrame(box) || boxes.some(other => overlaps(box, other))) continue;
      boxes.push(box);
      for (const [i, line] of lines.entries()) labels.push({ text: line, x, y: y + (i - (lines.length - 1) / 2) * size * 1.22, size, region, box });
      return;
    }
  };
  const regions = REGIONS.filter(def => layout.areas.some(area => area.region === def.id));
  // Region names take precedence over secondary location labels and symbols.
  // Place edge regions first so a displaced central heading cannot consume
  // their limited compact-screen space.
  for (const def of [...regions].sort((a, b) => Number(a.id === 'alpha') - Number(b.id === 'alpha'))) {
    const a = project([def.offset[0] - 334, def.offset[1] - 334]), b = project([def.offset[0] + 334, def.offset[1] + 334]);
    addLabel(localizeText(OVERVIEW[def.id].name), project([def.offset[0], def.offset[1] - 235]), font, true, width * .28, [a.x, a.y, b.x, b.y]);
  }
  const sources = [
    ...regions.filter(def => GATES[def.id]).map(def => ({ id: `entrance:${def.id}`, kind: 'entrance' as const,
      position: [GATES[def.id].p[0], GATES[def.id].p[2]] as const, name: '', locked: !done.has('summon_circle') })),
    ...regions.flatMap(def => {
      const area = layout.areas.find(area => area.region === def.id && area.id === OVERVIEW[def.id].hub);
      return area ? [{ id: `travel:${def.id}:${area.id}`, kind: 'travel' as const, position: area.tp, name: localizeText(area.name), locked: false }] : [];
    }),
  ];
  for (const source of sources) {
    const p = project(source.position), box = pointBox(p, 11 * unit);
    if (!inFrame(box) || boxes.some(other => overlaps(box, other))) continue;
    landmarks.push({ id: source.id, kind: source.kind, locked: source.locked, ...p });
    boxes.push(box);
  }
  // Five named hubs at most, and only where the displayed map has room. Icons
  // still indicate existing destinations on compact screens; they are not buttons.
  if (cssWidth >= 540) for (const source of sources.filter(s => s.name)) {
    const p = landmarks.find(p => p.id === source.id);
    if (p) addLabel(source.name, { x: p.x, y: p.y + 24 * unit }, font * .76, false, width * .22);
  }
  return { labels, landmarks, unit };
}
