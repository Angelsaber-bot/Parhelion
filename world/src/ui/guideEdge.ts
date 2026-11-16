/**
 * Where the objective marker sits when its target is off screen. It rides an ellipse inside the HUD corners
 * (minimap, realm panel, skill bar) and above the health bar. The bottom of that ellipse runs straight through
 * the lower middle of the screen, which is where toasts, progress panels and the interaction prompt live: a
 * target behind you parked the arrow on top of whatever the game was telling you. On the lower arc the marker
 * now keeps to one side of that column. Coordinates are normalised device units (-1..1, y up).
 */
export const GUIDE_EDGE = Object.freeze({
  a: .86, top: .68, bottom: .6,
  /** Half-width in CSS pixels of the lower-middle column kept clear (toasts are at most 620 px wide). */
  clearPx: 340,
  /** Give up on phones: if the column would take more than this share of the ellipse's half-width, leave the marker alone. */
  maxShare: .8,
  /** How far past dead-behind the target must swing before the marker changes sides. */
  flip: .1,
});

export interface GuideEdge { edge: boolean; x: number; y: number; side: -1 | 0 | 1 }

/** `lastSide` is the side returned on the previous frame (0 when the marker was not being held aside). */
export function guideEdgePosition(sx: number, sy: number, behind: boolean, viewportWidth = 1440, lastSide: -1 | 0 | 1 = 0): GuideEdge {
  const G = GUIDE_EDGE, b = sy >= 0 ? G.top : G.bottom, r = Math.hypot(sx / G.a, sy / b);
  if (!behind && r <= 1.05) return { edge: false, x: sx, y: sy, side: 0 };
  const k = 1 / Math.max(r, 1e-3); let x = sx * k, y = sy * k;
  const clear = viewportWidth > 0 ? G.clearPx / (viewportWidth / 2) : Infinity;
  if (y >= 0 || !(clear <= G.a * G.maxShare) || Math.abs(x) >= clear) return { edge: true, x, y, side: 0 };
  const side: -1 | 1 = lastSide !== 0 && Math.abs(x) < G.flip ? lastSide : x < 0 ? -1 : 1;
  x = side * clear; y = -G.bottom * Math.sqrt(Math.max(0, 1 - (clear / G.a) ** 2));
  return { edge: true, x, y, side };
}
