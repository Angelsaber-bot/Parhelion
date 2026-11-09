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
