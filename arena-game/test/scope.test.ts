import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ScopeSway, SWAY } from '../src/player/scopeSway.ts';
import { ScopeGlints } from '../src/rendering/scopeGlint.ts';
import { ScopeOverlay } from '../src/ui/scopeOverlay.ts';
import { BTN } from '../shared/sim.ts';
import { sanitize } from '../shared/match.ts';

const run = (s: ScopeSway, seconds: number, o: Partial<Parameters<ScopeSway['update']>[1]> = {}) => {
  let yaw = 0, pitch = 0, maxYaw = 0;
  for (let t = 0; t < seconds; t += 1 / 60) { const [dy, dp] = s.update(1 / 60, { scoped: true, sniper: true, wantHold: false, moving: false, airborne: false, crouched: false, ...o }); yaw += dy; pitch += dp; maxYaw = Math.max(maxYaw, Math.abs(yaw)); }
  return { yaw, pitch, maxYaw };
};

describe('scope sway and held breath', () => {
  it('drifts within its amplitude, and returns to centre when the scope comes down', () => {
    const s = new ScopeSway(), r = run(s, 6);
    expect(r.maxYaw).toBeGreaterThan(SWAY.sniper * .6); expect(r.maxYaw).toBeLessThanOrEqual(SWAY.sniper * 1.01);
    let yaw = r.yaw; for (let i = 0; i < 180; i++) yaw += s.update(1 / 60, { scoped: false, sniper: true, wantHold: false, moving: false, airborne: false, crouched: false })[0];
    expect(Math.abs(yaw)).toBeLessThan(SWAY.sniper * .05);
  });
  it('holding breath steadies the scope for a few seconds, then a gasp makes it worse', () => {
    const s = new ScopeSway(); run(s, 2);
    run(s, 1.5, { wantHold: true });
    expect(s.holding).toBe(true); expect(s.amp).toBeLessThan(SWAY.sniper * SWAY.held * 1.5); // nearly still
    for (let i = 0; i < SWAY.breath * 60 && s.gasp === 0; i++) run(s, 1 / 60, { wantHold: true });
    expect(s.stamina).toBe(0); expect(s.holding).toBe(false); expect(s.gasp).toBeGreaterThan(0);
    run(s, 1, { wantHold: true });
    expect(s.gasp).toBeGreaterThan(0); expect(s.amp).toBeGreaterThan(SWAY.sniper * 1.5); // gasping
    run(s, 4); expect(s.stamina).toBeGreaterThan(.9);
  });
  it('moving and jumping sway more, crouching less, and the DMR sways less than the sniper', () => {
    const amp = (o: Parameters<typeof run>[2]) => { const s = new ScopeSway(); run(s, 3, o); return s.amp; };
    expect(amp({ moving: true })).toBeGreaterThan(amp({})); expect(amp({ airborne: true })).toBeGreaterThan(amp({ moving: true }));
    expect(amp({ crouched: true })).toBeLessThan(amp({})); expect(amp({ sniper: false })).toBeLessThan(amp({}));
  });
});

it('the aim bit reaches the server for glints but carries no rule', () => {
  expect(sanitize({ seq: 1, mx: 0, mz: 0, yaw: 0, pitch: 0, buttons: BTN.AIM | BTN.FIRE, weapon: 0, view: 0 })!.buttons).toBe(BTN.AIM | BTN.FIRE);
});

it('a glint shows only when the scope points at you, brighter head-on and visible from afar', () => {
  const scene = new THREE.Scene(), g = new ScopeGlints(scene), at = new THREE.Vector3(0, 1.5, 0);
  g.set('s', at, .3, 20, 0); expect(scene.children.find((o) => o.name === 'Scope glint')?.visible ?? false).toBe(false);
  g.set('s', at, .99, 20, 0); const s = scene.getObjectByName('Scope glint') as THREE.Sprite; expect(s.visible).toBe(true);
  const near = s.scale.y; g.set('s', at, .99, 80, 0); expect(s.scale.y).toBeGreaterThan(near);
  g.set('s', at, .75, 80, 0); expect(s.material.opacity).toBeLessThan(.5); // glancing angle: faint
  g.prune(new Set()); expect(scene.children).toHaveLength(0); g.dispose();
});

it('the lens overlay draws both reticles without throwing and clears', () => {
  const calls: string[] = [], grad = { addColorStop: () => {} };
  const ctx = new Proxy({}, { get: (_t, k) => k === 'createRadialGradient' || k === 'createLinearGradient' ? () => grad : (...a: unknown[]) => { calls.push(String(k)); return a; }, set: () => true });
  const canvas = { getContext: () => ctx, clientWidth: 1280, clientHeight: 800, width: 0, height: 0 } as unknown as HTMLCanvasElement;
  vi.stubGlobal('devicePixelRatio', 1);
  const o = new ScopeOverlay(canvas);
  for (const kind of ['sniper', 'dmr'] as const) o.draw({ open: .6, kind, accent: 0xff4a3a, range: 123.4, zoom: 4.8, stamina: .4, holding: true, gasp: false, kick: .5, label: 'X' });
  expect(calls.filter((c) => c === 'fillText').length).toBeGreaterThan(6); expect(canvas.width).toBe(1280);
  o.clear(); expect(calls.at(-1)).toBe('clearRect'); vi.unstubAllGlobals();
});

it('dark finish accents are lifted so the illuminated reticle always reads', async () => {
  const { reticleColour } = await import('../src/ui/scopeOverlay.ts');
  const lum = (c: number) => (.2126 * ((c >> 16) & 255) + .7152 * ((c >> 8) & 255) + .0722 * (c & 255)) / 255;
  for (const c of [0x000000, 0x2c1a3d, 0x922f37, 0x14283c]) expect(lum(reticleColour(c))).toBeGreaterThan(.45);
  expect(reticleColour(0x7fe0ff)).toBe(0x7fe0ff);
});
