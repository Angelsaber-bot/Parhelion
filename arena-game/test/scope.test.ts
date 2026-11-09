import { expect, it, vi } from 'vitest';
import { ScopeOverlay, reticleColour } from '../src/ui/scopeOverlay.ts';

it('the lens overlay draws both reticles and its readouts without throwing, then clears', () => {
  const calls: string[] = [], grad = { addColorStop: () => {} };
  const ctx = new Proxy({}, { get: (_t, k) => k === 'createRadialGradient' || k === 'createLinearGradient' ? () => grad : (...a: unknown[]) => { calls.push(String(k)); return a; }, set: () => true });
  const canvas = { getContext: () => ctx, clientWidth: 1280, clientHeight: 800, width: 0, height: 0 } as unknown as HTMLCanvasElement;
  vi.stubGlobal('devicePixelRatio', 1);
  const o = new ScopeOverlay(canvas);
  for (const kind of ['sniper', 'dmr'] as const) o.draw({ open: .6, kind, accent: 0xff4a3a, range: 123.4, zoom: 4.8, label: 'X' });
  expect(calls.filter((c) => c === 'fillText').length).toBeGreaterThanOrEqual(6); expect(canvas.width).toBe(1280);
  o.clear(); expect(calls.at(-1)).toBe('clearRect'); vi.unstubAllGlobals();
});
it('dark finish accents are lifted so the illuminated reticle always reads', () => {
  const lum = (c: number) => (.2126 * ((c >> 16) & 255) + .7152 * ((c >> 8) & 255) + .0722 * (c & 255)) / 255;
  for (const c of [0x000000, 0x2c1a3d, 0x922f37, 0x14283c]) expect(lum(reticleColour(c))).toBeGreaterThan(.45);
  expect(reticleColour(0x7fe0ff)).toBe(0x7fe0ff);
});
it('the scope never steers the aim: no sway, breath or glint modules remain', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const game = readFileSync(new URL('../src/game.ts', import.meta.url), 'utf8');
  expect(game).not.toMatch(/sway|breath/i);
  expect(existsSync(new URL('../src/player/scopeSway.ts', import.meta.url))).toBe(false);
  expect(existsSync(new URL('../src/rendering/scopeGlint.ts', import.meta.url))).toBe(false);
});

it('every sniper and DMR finish has its own animated scope theme, and each draws at any moment', async () => {
  const { SCOPE_THEMES, scopeTheme } = await import('../src/ui/scopeThemes.ts');
  const { WEAPONS } = await import('../shared/content.ts');
  const scoped = WEAPONS.filter((w) => w.id === 'halo' || w.id === 'longnight').flatMap((w) => w.skins.map((s) => s.id));
  expect(scoped).toHaveLength(10);
  for (const id of scoped) expect(scopeTheme(id), id).toBeDefined();
  expect(new Set(Object.values(SCOPE_THEMES).map((t) => t.fx)).size).toBe(10); // ten different effects
  expect(scopeTheme('stormcoil')).toBeUndefined(); expect(scopeTheme(undefined)).toBeUndefined();
  const grad = { addColorStop: () => {} }, calls: string[] = [];
  const ctx = new Proxy({}, { get: (_t, k) => ['createRadialGradient', 'createLinearGradient', 'createConicGradient'].includes(String(k)) ? () => grad : (...a: unknown[]) => { calls.push(String(k)); return a; }, set: () => true });
  const canvas = { getContext: () => ctx, clientWidth: 1280, clientHeight: 800, width: 0, height: 0 } as unknown as HTMLCanvasElement;
  vi.stubGlobal('devicePixelRatio', 2);
  const o = new ScopeOverlay(canvas);
  for (const id of scoped) for (const time of [0, 1.234, 77.7]) o.draw({ open: 1, kind: 'sniper', accent: 0x123456, range: 50, zoom: 5.8, label: '', theme: id, time });
  expect(canvas.width).toBe(1600); // themed scopes render at a capped 1.25 ratio
  expect(calls.filter((c) => c === 'stroke').length).toBeGreaterThan(500); vi.unstubAllGlobals();
});
