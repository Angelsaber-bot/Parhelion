// The short encoding is the 16x9 8-bit luminance frame used by existing captures.
// The longer encoding packs 64x36 4-bit luminance, high nibble first.
export const DETAIL_FRAME_CHARS = 64 * 36 / 2 * 4 / 3;
export const COARSE_FRAME_CHARS = 16 * 9 * 4 / 3;

export function encodeDetailFrame(rgba: Uint8ClampedArray): string {
  const packed = new Uint8Array(64 * 36 / 2);
  for (let y = 0; y < 36; y++) for (let x = 0; x < 64; x++) {
    let light = 0;
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
      const i = ((y * 3 + dy) * 192 + x * 3 + dx) * 4;
      light += rgba[i] * .213 + rgba[i + 1] * .715 + rgba[i + 2] * .072;
    }
    const pixel = y * 64 + x;
    packed[pixel >> 1] |= Math.round(light / (9 * 17)) << (pixel % 2 ? 0 : 4);
  }
  return btoa(String.fromCharCode(...packed));
}

export function coarseFrame(encoded: string): string {
  if (encoded.length === COARSE_FRAME_CHARS) return encoded;
  const bytes = atob(encoded), coarse = new Uint8Array(16 * 9);
  for (let y = 0; y < 9; y++) for (let x = 0; x < 16; x++) {
    let sum = 0;
    for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx += 2) {
      const pair = bytes.charCodeAt(((y * 4 + dy) * 64 + x * 4 + dx) >> 1);
      sum += (pair >> 4) + (pair & 15);
    }
    coarse[y * 16 + x] = Math.round(sum * 17 / 16);
  }
  return btoa(String.fromCharCode(...coarse));
}
