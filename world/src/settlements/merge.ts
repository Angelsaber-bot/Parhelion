import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * mergeGeometries() returns null when the parts disagree on the index or on their attribute
 * set (e.g. a box with uv beside a lathe without), which broke World loading on 2026-10-29.
 * Mixed parts are made non-indexed and trimmed to the attributes they all share first.
 */
export function mergeParts(parts: THREE.BufferGeometry[], groups = false): THREE.BufferGeometry {
  let geos = parts;
  if (geos.some((g) => g.index) && geos.some((g) => !g.index)) geos = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const shared = Object.keys(geos[0].attributes).filter((k) => geos.every((g) => g.attributes[k] && g.attributes[k].itemSize === geos[0].attributes[k].itemSize));
  geos = geos.map((g) => {
    if (Object.keys(g.attributes).every((k) => shared.includes(k)) && !Object.keys(g.morphAttributes).length) return g;
    const h = parts.includes(g) ? g.clone() : g;
    for (const k of Object.keys(h.attributes)) if (!shared.includes(k)) h.deleteAttribute(k);
    h.morphAttributes = {};
    return h;
  });
  const merged = mergeGeometries(geos, groups);
  if (!merged) throw new Error('Cannot merge settlement geometry');
  for (const g of geos) if (!parts.includes(g)) g.dispose();
  return merged;
}
