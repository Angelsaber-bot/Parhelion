/**
 * Place-name banners announce an arrival. Stepping back and forth over a district's edge (or circling a
 * building that sits on it) used to replay the same title every few seconds; a place you were just told
 * about stays quiet for a while. A different place always announces at once.
 */
export const AREA_BANNER = Object.freeze({ repeatAfter: 90 });
export interface AreaAnnounced { id: string; at: number }

/** `now` and `last.at` are milliseconds. `current` is the area the player was in last frame ('' for none). */
export function shouldAnnounceArea(id: string, current: string, last: AreaAnnounced | null, now: number) {
  if (!id || id === current) return false;
  return !(last && last.id === id && now - last.at >= 0 && now - last.at < AREA_BANNER.repeatAfter * 1000);
}
