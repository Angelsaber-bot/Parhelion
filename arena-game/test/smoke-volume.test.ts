import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SMOKE, TICK_HZ } from '../shared/content.ts';
import type { Smoke } from '../shared/grenade.ts';
import { GrenadeView } from '../src/rendering/grenades.ts';
import { SmokeNameplate, SmokeVolumePass, smokeEnvelope } from '../src/rendering/smokeVolume.ts';

const cloud = (extra: Partial<Smoke> = {}): Smoke => ({ id: 1, owner: 'a', x: 0, y: 0, z: 0, life: SMOKE.life - TICK_HZ, ...extra });

describe('continuous smoke presentation', () => {
  it('smooths deployment and expiry between snapshots, ignores expired and pending smoke', () => {
    expect(smokeEnvelope(cloud({ life: SMOKE.life }))).toBe(0);
    expect(smokeEnvelope(cloud({ life: SMOKE.life }), .1)).toBeCloseTo(.1/.7);
    expect(smokeEnvelope(cloud())).toBe(1);
    expect(smokeEnvelope(cloud({ life: TICK_HZ }), .1)).toBeCloseTo(.9/1.5);
    expect(smokeEnvelope(cloud({ life: 0 }))).toBe(0);
    expect(smokeEnvelope(cloud({ delay: 1 }))).toBe(0);
    expect(smokeEnvelope(cloud(), NaN)).toBe(1);
  });
  it('keeps every overlapping cloud, rotated curtain and the current frame data on quality changes', () => {
    const pass = new SmokeVolumePass(new THREE.PerspectiveCamera());
    const smokes = Array.from({ length: 19 }, (_, id) => cloud({ id, x: id }));
    const box = { width: 4, height: 2.4, depth: 1.2, yaw: Math.PI/4 };
    smokes.push(cloud({ id: 20, x: 30, y: 5, box }));
    pass.sync(smokes, 0);
    expect(pass.enabled).toBe(true);
    expect(pass.uniforms.count.value).toBe(20);
    expect(pass.uniforms.centres.value[19].toArray()).toEqual([30, 6.2, 0, 1]);
    expect(pass.uniforms.shapes.value[19].toArray()).toEqual([2, 1.2, .6, Math.PI/4]);
    pass.sync([], 0); expect(pass.enabled).toBe(false); expect(pass.uniforms.count.value).toBe(0);
    pass.dispose();
  });
  it('removes gameplay billboards while retaining the standalone ability preview', () => {
    const scene = new THREE.Scene(), view = new GrenadeView(scene, true);
    view.sync([], [cloud(), cloud({ id: 2, box: { width: 4, height: 2.4, depth: 1.2, yaw: 0 } })], 0);
    expect(scene.children).toHaveLength(0);
    const preview = new GrenadeView(scene); preview.sync([], [cloud()], 0);
    expect(scene.getObjectByName('Smoke cloud')).toBeDefined();
    view.dispose(); preview.dispose();
  });
});

describe('enemy label boundary stability', () => {
  it('hides immediately, rejects edge chatter and restores after 120 ms clear', () => {
    const label = new SmokeNameplate();
    expect(label.update(false, 0)).toBe(false);
    expect(label.update(true, 1)).toBe(true);
    for (let i = 1; i <= 12; i++) expect(label.update(i % 2 === 0, 1+i/60)).toBe(true);
    expect(label.update(false, 1.3)).toBe(true);
    expect(label.update(false, 1.33)).toBe(false);
  });
});
