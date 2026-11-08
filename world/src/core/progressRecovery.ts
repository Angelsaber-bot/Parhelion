/** Lossless representation of localStorage's UTF-16 code units, including lone
 * surrogates. Blob(string) would replace those while converting to UTF-8.
 * No BOM or wrapper is added; the .utf16le extension declares byte order.
 * This is diagnostic evidence, not an importable JSON progress backup.
 */
export function encodeOriginalProgressText(raw: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(raw.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < raw.length; i++) view.setUint16(i * 2, raw.charCodeAt(i), true);
  return bytes;
}
