import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { WorldMap } from '../src/map';
import { collectMinimapLandmarks, minimapArea, MINIMAP_COLORS, MINIMAP_MAX_LANDMARKS, projectMinimapTarget, selectMinimapLandmarks, type MinimapLandmark } from '../src/minimapMarkers';
import { GATES, mergeLayouts, REGIONS } from '../src/regions';
import type { Layout, Marker } from '../src/types';

const area = (id: string, x: number, z: number, region = 'alpha'): Layout['areas'][number] =>
  ({ id, name: id, nameEn: id, c: [x, z], tp: [x, z], r: 100, color: '#f00', region });
const point = (id: string, x: number, y: number, kind: MinimapLandmark['kind'] = 'travel'): MinimapLandmark => ({ id, kind, position: [x, y] });
const project = ([x, y]: readonly [number, number]) => ({ x, y });

test('key-point sources are only existing travel coordinates and loaded chapter entrances', () => {
  const sources = collectMinimapLandmarks([area('port', 740, 10, 'blacksail'), area('camp', 0, 0)], GATES);
  assert.deepEqual(sources.map((p) => p.id), ['entrance:blacksail', 'travel:blacksail:port', 'travel:alpha:camp']);
  assert.deepEqual(sources[0].position, [GATES.blacksail.p[0], GATES.blacksail.p[2]]);
  assert.deepEqual(sources[1].position, [740, 10]);
});

test('dense hubs have a hard three-landmark cap, stable order, and spatial de-duplication', () => {
  const sources = [point('duplicate', 250, 190), point('gate', 252, 191, 'entrance'), point('west', 120, 190), point('south', 190, 270), point('north', 190, 90), point('edge', 1, 1)];
  const selected = selectMinimapLandmarks(sources, project, 380);
  assert.equal(selected.length, MINIMAP_MAX_LANDMARKS);
  assert.deepEqual(selected.map((p) => p.id), ['gate', 'west', 'south']);
  assert.deepEqual(selectMinimapLandmarks([...sources].reverse(), project, 380), selected);
  for (const a of selected) for (const b of selected) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 32);
});

test('player, active quest and label exclusion zones take priority over secondary landmarks', () => {
  const sources = [point('player', 190, 190), point('quest', 260, 190, 'entrance'), point('near-quest', 250, 175), point('under-label', 190, 64), point('safe', 120, 190)];
  assert.deepEqual(selectMinimapLandmarks(sources, project, 380, { x: 260, y: 190 }, [130, 50, 250, 80]).map((p) => p.id), ['safe']);
});

test('nearby quest positions remain exact; offscreen objectives keep their bearing inside the circle', () => {
  assert.deepEqual(projectMinimapTarget({ x: 230, y: 220 }, 380), { x: 230, y: 220, atEdge: false });
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0], [1, 1], [-1, -1]]) {
    const p = projectMinimapTarget({ x: 190 + dx * 1000, y: 190 + dy * 1000 }, 380);
    assert.equal(p.atEdge, true);
    assert.ok(Math.abs(Math.hypot(p.x - 190, p.y - 190) - 170) < 1e-8);
    assert.ok(Math.abs((p.x - 190) * dy - (p.y - 190) * dx) < 1e-8);
  }
});

test('context label is the nearest containing area, not a crowd of point labels', () => {
  const areas = [area('far', 40, 0), area('near', 10, 0), area('outside', 0, 200)];
  assert.equal(minimapArea(areas, 0, 0)?.id, 'near');
  assert.equal(minimapArea(areas, 500, 500), undefined);
});

type PathCommand = [string, ...number[]];
function canvas() {
  const fills: Array<{ color: string; path: PathCommand[] }> = [], strokes: Array<{ color: string; path: PathCommand[] }> = [];
  const labels: string[] = [], translated: number[][] = [];
  let path: PathCommand[] = [];
  const ctx = {
    canvas: { width: 380 }, fillStyle: '', strokeStyle: '',
    save() {}, restore() {}, clearRect() {}, drawImage() {}, measureText(text: string) { return { width: text.length * 9 }; },
    strokeText() {}, fillText(text: string) { labels.push(text); },
    beginPath() { path = []; }, moveTo(x: number, y: number) { path.push(['M', x, y]); },
    lineTo(x: number, y: number) { path.push(['L', x, y]); }, closePath() { path.push(['Z']); },
    arc(x: number, y: number, r: number) { path.push(['A', x, y, r]); },
    fill() { fills.push({ color: this.fillStyle, path: [...path] }); },
    stroke() { strokes.push({ color: this.strokeStyle, path: [...path] }); },
    translate(x: number, y: number) { translated.push([x, y]); }, rotate() {},
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills, strokes, labels, translated };
}
const markers: Marker[] = [
  { id: 'new', type: 'interact', p: [10, 0, 0], label: 'interaction' },
  { id: 'done', type: 'interact', p: [20, 0, 0], label: 'done' },
  { id: 'hidden', type: 'discovery', p: [0, 0, 10], label: 'hidden' },
  { id: 'found', type: 'discovery', p: [0, 0, 20], label: 'found' },
  { id: 'spawn', type: 'spawn', p: [-10, 0, 0], label: 'spawn' },
  { id: 'enemy', type: 'enemy', p: [0, 0, -10], label: 'enemy' },
  { id: 'objective', type: 'objective', p: [10, 0, 10], label: 'objective' },
  { id: 'poi', type: 'poi', p: [-10, 0, -10], label: 'poi' },
  { id: 'cover', type: 'cover', p: [10, 0, -10], label: 'cover' },
];
function map(areas: Layout['areas'] = []) {
  return Object.assign(Object.create(WorldMap.prototype) as WorldMap,
    { half: 360, size: 361, base: {}, layout: { areas, markers } });
}
const options = { full: false, done: new Set(['done']), found: new Set(['found']), enemies: [{ p: { x: 0, z: 5 }, boss: false }, { p: { x: 5, z: 0 }, boss: true }] };

test('real minimap renderer removes every ordinary marker and live monster, including bosses', () => {
  const drawn = canvas();
  map().draw(drawn.ctx, new THREE.Vector3(), 0, options);
  assert.deepEqual(drawn.fills.map((p) => p.color), [MINIMAP_COLORS.player]);
  assert.equal(drawn.strokes.some((p) => p.path.some(([kind]) => kind === 'A')), false, 'no coloured dots remain');
});

test('actual renderer keeps current target gold and one player, with a monochrome bounded hub', () => {
  const drawn = canvas();
  map([area('hub', 0, 0), area('east', 25, 0), area('west', -25, 0), area('south', 0, 30), area('north', 0, -30)])
    .draw(drawn.ctx, new THREE.Vector3(), 0, { ...options, target: [200, 200] });
  assert.deepEqual(drawn.fills.map((p) => p.color), [MINIMAP_COLORS.target, MINIMAP_COLORS.player]);
  assert.ok(drawn.strokes.filter((p) => p.color === MINIMAP_COLORS.landmark).length <= 3);
  assert.deepEqual(drawn.labels, ['hub']);
  const diamond = drawn.fills[0].path;
  const centre = { x: diamond[0][1], y: diamond[1][2] };
  assert.ok(Math.abs(Math.hypot(centre.x - 190, centre.y - 190) - 170) < 1e-8);
  assert.equal(drawn.translated.length, 1);
  assert.ok(drawn.translated[0].every((value) => Math.abs(value - 190) < 1e-8));
});

test('changing, clearing and arriving at the quest target has no stale edge marker or landmark exclusion', () => {
  const worldMap = map([area('east', 25, 0)]), position = new THREE.Vector3();
  for (const target of [[25, 0], [-250, 0], null, [0, 0]] as Array<[number, number] | null>) {
    const drawn = canvas();
    worldMap.draw(drawn.ctx, position, 0, { ...options, target });
    assert.equal(drawn.fills.filter((p) => p.color === MINIMAP_COLORS.target).length, target ? 1 : 0);
    assert.equal(drawn.strokes.filter((p) => p.color === MINIMAP_COLORS.landmark).length, target?.[0] === 25 ? 0 : 1);
    if (target?.[0] === 0) assert.ok(drawn.fills[0].path[0][2] < 174, 'arrival diamond remains visible beyond the white player arrow');
  }
});

test('current target wins over the contextual area label', () => {
  const drawn = canvas();
  map([area('hub', 0, 0)]).draw(drawn.ctx, new THREE.Vector3(), 0, { ...options, target: [0, (380 * 0.17 - 190) * 140 / 380] });
  assert.deepEqual(drawn.labels, []);
  assert.equal(drawn.fills[0].color, MINIMAP_COLORS.target);
});

test('full map also removes ordinary dots and preserves in-bounds quest projection', () => {
  const drawn = canvas();
  map().draw(drawn.ctx, new THREE.Vector3(), 0, { ...options, full: true, target: [300, 300] });
  assert.deepEqual(drawn.fills.map((p) => p.color), ['#ffd76a', '#fff']);
  assert.ok(Math.abs(drawn.fills[0].path[0][1] - (190 + 300 * 380 / 720)) < 1e-8);
});

test('all five real layouts keep point budgets at every destination and chapter entrance', () => {
  const layout = mergeLayouts(REGIONS.map((def) => ({ def, layout: JSON.parse(readFileSync(new URL(`../public/assets/${def.file}.layout.json`, import.meta.url), 'utf8')) as Layout })));
  const sources = collectMinimapLandmarks(layout.areas, GATES);
  assert.equal(sources.length, layout.areas.length + 4);
  for (const source of sources) {
    const drawn = canvas();
    const worldMap = Object.assign(Object.create(WorldMap.prototype) as WorldMap, { half: 1080, size: 1081, base: {}, layout });
    worldMap.draw(drawn.ctx, new THREE.Vector3(source.position[0], 0, source.position[1]), 0, { ...options, target: [0, 0] });
    assert.ok(drawn.labels.length <= 1, source.id);
    assert.ok(drawn.strokes.filter((p) => p.color === MINIMAP_COLORS.landmark).length <= 3, source.id);
    assert.deepEqual(drawn.fills.map((p) => p.color), [MINIMAP_COLORS.target, MINIMAP_COLORS.player], source.id);
  }
});
