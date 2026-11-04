/**
 * Hit-stop: a few hundredths of a second where the whole world nearly freezes on a landed blow,
 * so a strike reads as weight instead of a number. Melee and skills only (the rifle stays fluid);
 * heavier hits, several targets and kills hold a little longer. Reduced effects turn it off.
 */
export const HIT_STOP = Object.freeze({ scale: .08, melee: .045, skill: .035, heavy: 30, heavyExtra: .025, multiExtra: .015, kill: .04, max: .11 });

export function hitStopSeconds(source: string, hits: readonly { damage: number }[], kills: number): number {
  if (!hits.length || (source !== 'melee' && source !== 'skill')) return 0;
  const top = Math.max(...hits.map(h => h.damage));
  let s = source === 'melee' ? HIT_STOP.melee : HIT_STOP.skill;
  if (top >= HIT_STOP.heavy) s += HIT_STOP.heavyExtra;
  if (hits.length > 1) s += HIT_STOP.multiExtra;
  if (kills > 0) s += HIT_STOP.kill;
  return Math.min(HIT_STOP.max, s);
}
