import type { Layout } from './types';

/** Reject broken HTTP responses and layouts before creating physics/UI from them. */
export async function loadLayout(url = './assets/world_alpha.layout.json', fetcher: typeof fetch = fetch): Promise<Layout> {
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`地图布局请求失败（HTTP ${response.status}）`);
  const value: unknown = await response.json();
  validateLayout(value);
  return value;
}

function validateLayout(value: unknown): asserts value is Layout {
  const fail = () => { throw new Error('地图布局数据无效，请重新生成或下载地图'); };
  const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const string = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
  const vector = (v: unknown, n: number) => Array.isArray(v) && v.length === n && v.every(finite);
  if (!record(value)) return fail();
  const { world, areas, markers, paths, objective } = value;
  if (!record(world) || !string(world.id) || !string(world.name) || !string(world.nameEn) ||
      !finite(world.half) || world.half <= 0 || !finite(world.playHalf) || world.playHalf <= 0 || world.playHalf > world.half ||
      !finite(world.waterLevel) || !finite(world.seed) || !finite(world.version)) return fail();
  if (!Array.isArray(areas) || !areas.length || !areas.every(a => record(a) && string(a.id) && string(a.name) && string(a.nameEn) && string(a.color) && vector(a.c, 2) && vector(a.tp, 2) && finite(a.r) && a.r > 0)) return fail();
  if (!Array.isArray(paths) || !paths.every(p => Array.isArray(p) && p.every(v => vector(v, 2)))) return fail();
  const types = new Set(['spawn', 'objective', 'interact', 'discovery', 'enemy', 'cover', 'poi']);
  if (!Array.isArray(markers) || !markers.every(m => record(m) && string(m.id) && string(m.label) && string(m.type) && types.has(m.type) && vector(m.p, 3) && (m.radius === undefined || finite(m.radius) && m.radius > 0) && (m.requires === undefined || Array.isArray(m.requires) && m.requires.every(string)))) return fail();
  const ids = new Set(markers.map(m => m.id));
  if (ids.size !== markers.length || !markers.some(m => m.id === 'spawn_p1' && m.type === 'spawn') || markers.some(m => m.requires?.some((id: string) => !ids.has(id)))) return fail();
  if (!record(objective) || !string(objective.id) || !string(objective.name) || !Array.isArray(objective.steps) || !objective.steps.every(s => record(s) && string(s.id) && string(s.text) && Array.isArray(s.done) && s.done.every(id => string(id) && ids.has(id)))) return fail();
}
