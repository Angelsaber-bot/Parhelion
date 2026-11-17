import { CHARACTERS, PLAYABLE_HERO_INDICES } from '../shared/content.ts';

/**
 * Arriving from the World's Echo Hall: `/arena/?from=world&hero=<id>&map=<id>`. The lobby preselects that hero and
 * map (the player still presses Start) and offers a way back. The link is remembered for this browser tab only, so
 * it survives Arena's own navigation but never leaks into a later visit that did not come from the World.
 * Nothing here carries World power into Arena: heroes stay equal and every hero remains selectable.
 */
export const WORLD_LINK_KEY = 'parhelion.arena.fromWorld';
export const WORLD_RETURN_HREF = '/world/?from=arena';

type TabStorage = Pick<Storage, 'getItem' | 'setItem'>;
const tabStorage = (): TabStorage | null => { try { return typeof sessionStorage === 'undefined' ? null : sessionStorage; } catch { return null; } };

/** True when this tab was opened from the World (now or earlier in the same tab). */
export function cameFromWorld(params: URLSearchParams, storage: TabStorage | null = tabStorage()): boolean {
  const now = params.get('from') === 'world';
  try { if (now) storage?.setItem(WORLD_LINK_KEY, '1'); return now || storage?.getItem(WORLD_LINK_KEY) === '1'; } catch { return now; }
}

/** The playable hero the World asked for, or null. */
export function heroFromWorld(params: URLSearchParams): number | null {
  const id = params.get('hero');
  const index = CHARACTERS.findIndex(c => c.id === id);
  return index >= 0 && (PLAYABLE_HERO_INDICES as readonly number[]).includes(index) ? index : null;
}
