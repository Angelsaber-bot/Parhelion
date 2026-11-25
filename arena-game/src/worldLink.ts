import { CHARACTERS, PLAYABLE_HERO_INDICES } from '../shared/content.ts';

/** A same-tab World visit carries its departure station independently of the Arena map choice. */
export function worldReturnHref(params: URLSearchParams): string | null {
  if (params.get('from') !== 'world') return null;
  const back = new URLSearchParams({ from: 'arena' });
  const station = params.get('station');
  if (station && /^(?:home_echo_hall|arena_echo_[a-z]+)$/.test(station)) back.set('station', station);
  return `/world/?${back}`;
}

/** The playable hero the World asked for, or null. */
export function heroFromWorld(params: URLSearchParams): number | null {
  const id = params.get('hero');
  const index = CHARACTERS.findIndex(c => c.id === id);
  return index >= 0 && (PLAYABLE_HERO_INDICES as readonly number[]).includes(index) ? index : null;
}
