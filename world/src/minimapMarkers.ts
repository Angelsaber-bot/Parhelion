import type { Layout } from './types';

/** The small map is navigation, not a catalogue of every world interaction. */
export const MINIMAP_VIEW_RADIUS = 70;
export const MINIMAP_MAX_LANDMARKS = 3;
export const MINIMAP_COLORS = {
  landmark: '#c4ced6', target: '#ffd76a', player: '#fff', outline: '#1f2a44',
} as const;

export interface MinimapLandmark {
  id: string;
  kind: 'travel' | 'entrance';
  position: readonly [number, number];
}
export interface MapPoint { x: number; y: number }
export interface MinimapTarget extends MapPoint { atEdge: boolean }
export type MapBox = readonly [number, number, number, number];

/** Only existing regional travel destinations and loaded chapter entrances qualify. */
export function collectMinimapLandmarks(
  areas: Layout['areas'],
  entrances: Readonly<Record<string, { p: readonly [number, number, number] }>>,
): MinimapLandmark[] {
  return [
    ...Object.entries(entrances).filter(([region]) => areas.some((a) => a.region === region))
      .map(([region, gate]): MinimapLandmark => ({ id: `entrance:${region}`, kind: 'entrance', position: [gate.p[0], gate.p[2]] })),
    ...areas.map((a): MinimapLandmark => ({ id: `travel:${a.region ?? ''}:${a.id}`, kind: 'travel', position: a.tp })),
  ];
}

/** Keep the quest bearing inside the CSS-circular viewport, including diagonal targets. */
export function projectMinimapTarget(point: MapPoint, width: number): MinimapTarget {
  const centre = width / 2, radius = Math.max(0, centre - 20);
  const dx = point.x - centre, dy = point.y - centre, distance = Math.hypot(dx, dy);
  const scale = distance > radius ? radius / distance : 1;
  return { x: centre + dx * scale, y: centre + dy * scale, atEdge: distance > radius };
}

/** Deterministic screen-space cap/de-duplication. The player and quest always win. */
export function selectMinimapLandmarks(
  landmarks: readonly MinimapLandmark[],
  project: (position: readonly [number, number]) => MapPoint,
  width: number,
  target?: MapPoint | null,
  labelBox?: MapBox,
): Array<MinimapLandmark & MapPoint> {
  const centre = width / 2, radius = Math.max(0, centre - 18);
  const candidates = landmarks.map((landmark) => ({ ...landmark, ...project(landmark.position) }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) &&
      Math.hypot(p.x - centre, p.y - centre) <= radius &&
      Math.hypot(p.x - centre, p.y - centre) >= 30 &&
      (!target || Math.hypot(p.x - target.x, p.y - target.y) >= 32) &&
      (!labelBox || p.x + 12 < labelBox[0] || p.x - 12 > labelBox[2] || p.y + 12 < labelBox[1] || p.y - 12 > labelBox[3]))
    .sort((a, b) => Number(a.kind !== 'entrance') - Number(b.kind !== 'entrance') ||
      Math.hypot(a.x - centre, a.y - centre) - Math.hypot(b.x - centre, b.y - centre) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const selected: Array<MinimapLandmark & MapPoint> = [];
  for (const point of candidates) {
    if (selected.some((other) => Math.hypot(point.x - other.x, point.y - other.y) < 32)) continue;
    selected.push(point);
    if (selected.length === MINIMAP_MAX_LANDMARKS) break;
  }
  return selected;
}

/** A single contextual place name replaces labels scattered over a dense hub. */
export function minimapArea(areas: Layout['areas'], x: number, z: number): Layout['areas'][number] | undefined {
  return areas.filter((a) => Math.hypot(x - a.c[0], z - a.c[1]) < a.r)
    .sort((a, b) => Math.hypot(x - a.c[0], z - a.c[1]) - Math.hypot(x - b.c[0], z - b.c[1]) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
}
