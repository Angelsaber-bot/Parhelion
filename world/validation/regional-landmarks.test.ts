import test from 'node:test';
import assert from 'node:assert/strict';
import { SiteArt } from '../src/story/campaignSites';
import { Frame, haloStatue, trialStele, prismPedestal } from '../src/exploration/models';

const signature = (build: (f: Frame) => void) => {
  const art = new SiteArt(); build(new Frame(art, [0, 0, 0]));
  const boxes: string[] = [];
  for (const parts of (art as unknown as { bins: Map<string, { computeBoundingBox(): void; boundingBox: { min: { toArray(): number[] }; max: { toArray(): number[] } } }[]> }).bins.values())
    for (const g of parts) { g.computeBoundingBox(); boxes.push([...g.boundingBox.min.toArray(), ...g.boundingBox.max.toArray()].map(v => v.toFixed(2)).join(',')); }
  return boxes.sort().join('|');
};
test('the shared landmarks are built in each realm’s own manner, not stamped identically', () => {
  for (const [name, build] of [['statue', haloStatue], ['stele', trialStele], ['pedestal', (f: Frame, r: string) => prismPedestal(f, 0, r as never)]] as const) {
    const sigs = ['alpha', 'britain', 'blacksail', 'winter', 'kyoto'].map(region => signature(f => (build as (f: Frame, r: string) => void)(f, region)));
    assert.equal(new Set(sigs).size, sigs.length, `${name}: two realms share the same design`);
  }
});
