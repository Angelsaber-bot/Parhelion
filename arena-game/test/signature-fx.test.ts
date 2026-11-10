import { expect, it } from 'vitest';
import { WEAPONS } from '../shared/content.ts';
import { SIGNATURE_SKINS } from '../shared/signatureSkins.ts';
import { FLASH_SHAPES, MARK_SHAPES, SIGNATURE_FX, SWING_STYLES, TRACER_STYLES, signatureFx } from '../src/cosmetics/signatureFx.ts';
import { SWING_GLSL } from '../src/rendering/weaponFx.ts';

it('all 40 signature weapons have their own effect recipe of the right kind', () => {
  expect(SIGNATURE_SKINS).toHaveLength(40);
  for (const skin of SIGNATURE_SKINS) {
    const fx = signatureFx(skin.id)!, weapon = WEAPONS.find((w) => w.id === skin.weapon)!;
    expect(fx, skin.id).toBeDefined(); expect(fx.kind, skin.id).toBe(weapon.kind);
    expect(fx.head).toBe(skin.accent); expect(fx.tail).toBe(skin.trim);
    if (fx.kind === 'gun') { expect(TRACER_STYLES).toContain(fx.tracer); expect(FLASH_SHAPES).toContain(fx.flash); expect(MARK_SHAPES).toContain(fx.mark); }
    else { expect(SWING_STYLES).toContain(fx.swing); expect(FLASH_SHAPES).toContain(fx.glyph); }
  }
  expect(Object.keys(SIGNATURE_FX).sort()).toEqual(SIGNATURE_SKINS.map((s) => s.id).sort());
  expect(signatureFx('nope')).toBeUndefined(); expect(signatureFx(undefined)).toBeUndefined();
});
it('within each base weapon, the five finishes never share a tracer, flash, mark, swing or emblem', () => {
  for (const weapon of WEAPONS) {
    const recipes = SIGNATURE_SKINS.filter((s) => s.weapon === weapon.id).map((s) => SIGNATURE_FX[s.id]);
    expect(recipes, weapon.id).toHaveLength(5);
    const distinct = (pick: (r: (typeof recipes)[number]) => string) => new Set(recipes.map(pick)).size;
    if (weapon.kind === 'gun') for (const k of ['tracer', 'flash', 'mark'] as const) expect(distinct((r) => (r as unknown as Record<string, string>)[k]), `${weapon.id} ${k}`).toBe(5);
    else for (const k of ['swing', 'glyph'] as const) expect(distinct((r) => (r as unknown as Record<string, string>)[k]), `${weapon.id} ${k}`).toBe(5);
  }
});
it('no two of the 40 weapons look the same: recipe plus colours is unique everywhere', () => {
  const keys = SIGNATURE_SKINS.map((s) => JSON.stringify({ ...SIGNATURE_FX[s.id], c: [s.accent, s.trim] }));
  expect(new Set(keys).size).toBe(40);
});
it('every swing style has its own branch in the shared swing shader', () => {
  for (let i = 1; i < SWING_STYLES.length; i++) expect(SWING_GLSL).toContain(`style == ${i}.`);
});
